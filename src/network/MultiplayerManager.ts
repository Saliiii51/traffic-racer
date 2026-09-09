// MultiplayerManager.ts - Client-side WebSocket Networking for Traffic Rush: Istanbul
import { eventBus } from '../core/EventBus';

export interface OpponentData {
  id: string;
  name: string;
  vehicleId: string;
  colorHex: string;
  lane: number;
  isHost: boolean;
  distance: number;
  isCrashed: boolean;
  isFinished?: boolean;
  finishTime?: number;
}

export interface PlayerStanding {
  rank: number;
  id: string;
  name: string;
  vehicleId: string;
  colorHex: string;
  lane?: number;
  distance: number;
  isCrashed: boolean;
  isFinished?: boolean;
  finishTime?: number;
}

export interface OpponentStateUpdate {
  playerId: string;
  x: number;
  y: number;
  z: number;
  speed: number;
  steer: number;
  brake: boolean;
  nitro: boolean;
  horn: boolean;
  flash: boolean;
  signal: 'none' | 'left' | 'right' | 'hazard';
  distance: number;
  timestamp?: number;
  vx?: number;
  vz?: number;
}

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private ws: WebSocket | null = null;

  public isConnected: boolean = false;
  public isMultiplayerActive: boolean = false;
  public isRacing: boolean = false;
  public isHost: boolean = false;
  public roomCode: string | null = null;
  public myPlayerId: string | null = null;
  public myPlayerName: string = 'Sürücü';
  public myAssignedLane: number = 1;
  public maxPlayers: number = 4;
  public opponents: Map<string, OpponentData> = new Map();
  public roomPlayers: OpponentData[] = [];
  public mode: 'SPRINT' | 'SURVIVAL' = 'SPRINT';
  public targetDistance: number = 3000;
  public seed: number = 0;

  // Single opponent backwards compatibility getter
  public get opponent(): OpponentData | null {
    return this.opponents.values().next().value || null;
  }

  // Rate limiter for outgoing state updates (approx 33.3 updates per second)
  private lastSendTime: number = 0;
  private sendIntervalMs: number = 30; // 33.3 Hz

  private constructor() {}

  public static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  public getOpponentsList(): OpponentData[] {
    return Array.from(this.opponents.values());
  }

  public getServerUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running with standard dev server on 5173, backend socket is on 5174
    if (window.location.port === '5173') {
      return `${protocol}//${window.location.hostname}:5174`;
    }
    // In production / cloud hosting / tunnel, connect to same host & port
    return `${protocol}//${window.location.host}`;
  }

  public connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const url = this.getServerUrl();
      console.log(`[Multiplayer] Connecting to ${url}...`);

      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        console.warn('[Multiplayer] Failed to create WebSocket:', e);
        this.isConnected = false;
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.warn('[Multiplayer] Connection timeout');
          resolve(false);
        }
      }, 4000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('[Multiplayer] Connected to game server!');
        resolve(true);
      };

      this.ws.onclose = () => {
        console.log('[Multiplayer] Disconnected from server');
        this.isConnected = false;
        this.isMultiplayerActive = false;
        this.isRacing = false;
        this.roomCode = null;
        this.opponents.clear();
        this.roomPlayers = [];
        eventBus.emit('mp:disconnected', {});
      };

      this.ws.onerror = (err) => {
        console.warn('[Multiplayer] WebSocket error:', err);
        clearTimeout(timeout);
        this.isConnected = false;
        resolve(false);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw);

      switch (data.type) {
        case 'ROOM_CREATED': {
          this.roomCode = data.roomCode;
          this.myPlayerId = data.playerId;
          this.isHost = true;
          this.isMultiplayerActive = true;
          this.myAssignedLane = data.lane ?? 1;
          this.maxPlayers = data.maxPlayers || 4;
          this.mode = data.mode;
          this.targetDistance = data.targetDistance;
          this.opponents.clear();
          this.roomPlayers = data.players || [];
          eventBus.emit('mp:roomCreated', {
            roomCode: data.roomCode,
            isHost: true,
            mode: data.mode,
            targetDistance: data.targetDistance,
            lane: this.myAssignedLane,
            maxPlayers: this.maxPlayers,
            players: this.roomPlayers,
          });
          break;
        }

        case 'ROOM_JOINED': {
          this.roomCode = data.roomCode;
          this.myPlayerId = data.playerId;
          this.isHost = false;
          this.isMultiplayerActive = true;
          this.myAssignedLane = data.lane ?? 2;
          this.maxPlayers = data.maxPlayers || 4;
          this.mode = data.mode;
          this.targetDistance = data.targetDistance;
          this.roomPlayers = data.players || [];

          this.opponents.clear();
          (data.players as OpponentData[]).forEach((p) => {
            if (p.id !== this.myPlayerId) {
              this.opponents.set(p.id, { ...p, isCrashed: false, distance: 0 });
            }
          });

          eventBus.emit('mp:roomJoined', {
            roomCode: data.roomCode,
            isHost: false,
            mode: data.mode,
            targetDistance: data.targetDistance,
            lane: this.myAssignedLane,
            maxPlayers: this.maxPlayers,
            players: data.players,
          });
          break;
        }

        case 'PLAYER_JOINED': {
          this.roomPlayers = data.players || [];
          (data.players as OpponentData[]).forEach((p) => {
            if (p.id !== this.myPlayerId && !this.opponents.has(p.id)) {
              this.opponents.set(p.id, { ...p, isCrashed: false, distance: 0 });
            }
          });

          eventBus.emit('mp:playerJoined', {
            players: data.players,
            newPlayer: data.newPlayer,
            opponents: this.getOpponentsList(),
            opponent: this.opponent,
          });
          break;
        }

        case 'RACE_STARTING': {
          this.seed = data.seed;
          this.mode = data.mode;
          this.targetDistance = data.targetDistance;
          this.isRacing = true;
          this.roomPlayers = data.players || [];

          // Update assigned lane and opponents map
          (data.players as OpponentData[]).forEach((p) => {
            if (p.id === this.myPlayerId) {
              this.myAssignedLane = p.lane ?? this.myAssignedLane;
            } else {
              this.opponents.set(p.id, { ...p, isCrashed: false, distance: 0 });
            }
          });

          eventBus.emit('mp:raceStarting', {
            seed: data.seed,
            mode: data.mode,
            targetDistance: data.targetDistance,
            countdownSec: data.countdownSec || 3,
            opponents: this.getOpponentsList(),
            opponent: this.opponent,
            players: data.players,
          });
          break;
        }

        case 'OPPONENT_UPDATE': {
          const opp = this.opponents.get(data.playerId);
          if (opp) {
            opp.distance = data.distance;
          }
          eventBus.emit('mp:opponentUpdate', data as OpponentStateUpdate);
          break;
        }

        case 'OPPONENT_CRASHED': {
          const opp = this.opponents.get(data.playerId);
          if (opp) {
            opp.isCrashed = true;
            opp.distance = data.distance || opp.distance;
          }
          eventBus.emit('mp:opponentCrashed', {
            playerId: data.playerId,
            playerName: data.playerName || opp?.name || 'Rakip',
            distance: data.distance,
          });
          break;
        }

        case 'RACE_FINISHED': {
          this.isRacing = false;
          const isMeWinner = data.winnerId === this.myPlayerId;
          eventBus.emit('mp:raceFinished', {
            winnerId: data.winnerId,
            winnerName: data.winnerName,
            isMeWinner,
            reason: data.reason,
            finishTime: data.finishTime,
            standings: data.standings,
          });
          break;
        }

        case 'OPPONENT_LEFT': {
          const leavingName = data.playerName || this.opponents.get(data.playerId)?.name || 'Bir oyuncu';
          this.opponents.delete(data.playerId);
          if (data.players) {
            this.roomPlayers = data.players;
          }
          eventBus.emit('mp:opponentLeft', {
            playerId: data.playerId,
            playerName: leavingName,
            players: data.players,
          });
          break;
        }

        case 'HOST_CHANGED': {
          if (data.newHostId === this.myPlayerId) {
            this.isHost = true;
          }
          if (data.players) {
            this.roomPlayers = data.players;
          }
          eventBus.emit('mp:hostChanged', {
            newHostId: data.newHostId,
            players: data.players,
          });
          break;
        }

        case 'PROMOTED_HOST': {
          this.isHost = true;
          eventBus.emit('mp:promotedHost', {});
          break;
        }

        case 'ERROR': {
          eventBus.emit('mp:error', { message: data.message });
          break;
        }
      }
    } catch (err) {
      console.warn('[Multiplayer] Error parsing message:', err);
    }
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public async createRoom(params: {
    playerName: string;
    vehicleId: string;
    colorHex: string;
    mode: 'SPRINT' | 'SURVIVAL';
    targetDistance?: number;
  }): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) return false;

    this.myPlayerName = params.playerName;
    this.send({
      type: 'CREATE_ROOM',
      playerName: params.playerName,
      vehicleId: params.vehicleId,
      colorHex: params.colorHex,
      mode: params.mode,
      targetDistance: params.targetDistance || 3000,
    });
    return true;
  }

  public async joinRoom(params: {
    roomCode: string;
    playerName: string;
    vehicleId: string;
    colorHex: string;
  }): Promise<boolean> {
    const connected = await this.connect();
    if (!connected) return false;

    this.myPlayerName = params.playerName;
    this.send({
      type: 'JOIN_ROOM',
      roomCode: params.roomCode,
      playerName: params.playerName,
      vehicleId: params.vehicleId,
      colorHex: params.colorHex,
    });
    return true;
  }

  public startRace(): void {
    if (!this.isHost || !this.roomCode) return;
    this.send({ type: 'START_RACE' });
  }

  public sendState(state: {
    x: number;
    y: number;
    z: number;
    speed: number;
    steer: number;
    brake: boolean;
    nitro: boolean;
    horn: boolean;
    flash: boolean;
    signal: 'none' | 'left' | 'right' | 'hazard';
    distance: number;
    vx?: number;
    vz?: number;
  }): void {
    if (!this.isRacing || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    if (now - this.lastSendTime < this.sendIntervalMs) return;
    this.lastSendTime = now;

    this.send({
      type: 'UPDATE_STATE',
      ...state,
      timestamp: Date.now(),
    });
  }

  public sendCrashed(distance: number): void {
    if (!this.isRacing) return;
    this.send({
      type: 'PLAYER_CRASHED',
      distance,
    });
  }

  public sendGoalReached(distance: number, finishTime: number): void {
    if (!this.isRacing) return;
    this.send({
      type: 'REACHED_GOAL',
      distance,
      finishTime,
    });
  }

  public leaveRoom(): void {
    this.send({ type: 'LEAVE_ROOM' });
    this.isMultiplayerActive = false;
    this.isRacing = false;
    this.roomCode = null;
    this.opponents.clear();
    this.roomPlayers = [];
  }
}

export const multiplayerManager = MultiplayerManager.getInstance();
