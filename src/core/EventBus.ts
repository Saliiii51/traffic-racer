// Lightweight typed EventBus for game events

import type { CameraViewMode, GameMode, TrafficSettings } from './Constants';

type EventCallback<T = any> = (payload: T) => void;

export interface GameEventPayloads {
  gameStarted: void;
  gamePaused: void;
  gameResumed: void;
  gameOver: {
    distanceMeters: number;
    score: number;
    earnings: number;
    nearMisses: number;
    isNewHighScore: boolean;
    isNewBestDistance: boolean;
  };
  distanceChanged: { distanceMeters: number };
  speedChanged: { speedKmh: number };
  scoreChanged: { score: number; multiplier: number };
  moneyChanged: { totalMoney: number; delta: number };
  nearMiss: { combo: number; scoreBonus: number; cashBonus: number; lateralDist: number };
  overtake: { count: number };
  nitroActivated: { active: boolean };
  nitroChanged: { percent: number };
  vehiclePurchased: { vehicleId: string };
  vehicleSelected: { vehicleId: string };
  upgradePurchased: { vehicleId: string; category: string; newLevel: number };
  levelUp: { newLevel: number; rewardMoney: number };
  missionCompleted: { missionId: string; rewardCash: number };
  screenChanged: { screen: string };
  wrongWayChanged: { isWrongWay: boolean };
  timeAttackTick: { remainingSeconds: number };
  timeBonusAdded: { secondsAdded: number; reason: string };
  cameraModeChanged: { mode: CameraViewMode };
  gameModeChanged: { mode: GameMode };
  environmentChanged: { env: 'DAY' | 'SUNSET' | 'NIGHT' | 'RAIN' };
  exhaustPresetChanged: { preset: 'Standard' | 'Deep' | 'Light' | 'Abarti' };
  licensePlateChanged: { plate: string };
  damageTaken: { damage: number; health: number };
  graphicsQualityChanged: 'low' | 'medium' | 'high';
  trafficSettingsChanged: { settings: TrafficSettings };
  menuCinematicNext: void;

  // Multiplayer events
  'mp:disconnected': {};
  'mp:roomCreated': { roomCode: string; isHost: boolean; mode: string; targetDistance: number };
  'mp:roomJoined': { roomCode: string; isHost: boolean; mode: string; targetDistance: number; players: any[] };
  'mp:playerJoined': { players: any[]; opponent: any };
  'mp:opponentUpdate': any;
  'mp:opponentCrashed': { playerId: string; distance: number };
  'mp:raceStarting': { seed: number; mode: string; targetDistance: number; countdownSec: number; opponent: any };
  'mp:raceFinished': { winnerId: string; winnerName: string; isMeWinner: boolean; reason: string; finishTime?: number };
  'mp:opponentLeft': { playerId: string };
  'mp:promotedHost': {};
  'mp:error': { message: string };
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof GameEventPayloads>(event: K, callback: EventCallback<GameEventPayloads[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof GameEventPayloads>(event: K, callback: EventCallback<GameEventPayloads[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof GameEventPayloads>(
    event: K,
    ...args: GameEventPayloads[K] extends void ? [payload?: void] : [payload: GameEventPayloads[K]]
  ): void {
    const payload = args[0] as GameEventPayloads[K];
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event listener for ${String(event)}:`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = EventBus.getInstance();
