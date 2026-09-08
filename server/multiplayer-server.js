// Traffic Rush: Istanbul - Real-Time Multiplayer Server
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const PORT = process.env.PORT || 5174;
const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'ok', name: 'TrafficRush-Multiplayer-Server', rooms: rooms.size }));
  }

  // Serve static dist files if dist directory exists
  if (fs.existsSync(DIST_DIR)) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let reqPath = decodeURIComponent(parsedUrl.pathname);
    if (reqPath === '/') reqPath = '/index.html';

    let filePath = path.join(DIST_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
      });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ status: 'ok', name: 'TrafficRush-Multiplayer-Server', rooms: rooms.size }));
});

const wss = new WebSocketServer({ server });

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastRoom(room, data, exceptId) {
  const payload = JSON.stringify(data);
  for (const [id, p] of room.players) {
    if (id !== exceptId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  }
}

const MAX_PLAYERS_PER_ROOM = 4;
const STARTING_LANES = [1, 2, 0, 3]; // 4 Highway lanes: Mid-left, Mid-right, Far-left, Far-right

function buildStandings(room) {
  const players = Array.from(room.players.values());
  return players
    .sort((a, b) => {
      // Finished players first (lowest finishTime wins)
      if (a.isFinished && !b.isFinished) return -1;
      if (!a.isFinished && b.isFinished) return 1;
      if (a.isFinished && b.isFinished) return (a.finishTime || 0) - (b.finishTime || 0);

      // Alive players before crashed players
      if (!a.isCrashed && b.isCrashed) return -1;
      if (a.isCrashed && !b.isCrashed) return 1;

      // Highest distance wins
      return (b.distance || 0) - (a.distance || 0);
    })
    .map((p, index) => ({
      rank: index + 1,
      id: p.id,
      name: p.name,
      vehicleId: p.vehicleId,
      colorHex: p.colorHex,
      lane: p.lane,
      distance: Math.round(p.distance || 0),
      isCrashed: !!p.isCrashed,
      isFinished: !!p.isFinished,
      finishTime: p.finishTime ? Number(p.finishTime.toFixed(2)) : undefined,
    }));
}

wss.on('connection', (ws) => {
  const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
  let currentRoomCode = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'CREATE_ROOM': {
          const roomCode = generateRoomCode();
          const room = {
            code: roomCode,
            mode: data.mode === 'SURVIVAL' ? 'SURVIVAL' : 'SPRINT',
            targetDistance: data.targetDistance || 3000,
            seed: Math.floor(Math.random() * 1000000),
            status: 'LOBBY',
            players: new Map(),
            createdAt: Date.now(),
          };

          const player = {
            ws,
            id: playerId,
            name: (data.playerName || 'Sürücü 1').substring(0, 16),
            vehicleId: data.vehicleId || 'opel_corsa',
            colorHex: data.colorHex || '#dc2626',
            lane: STARTING_LANES[0],
            isHost: true,
            distance: 0,
            isCrashed: false,
            isFinished: false,
          };

          room.players.set(playerId, player);
          rooms.set(roomCode, room);
          currentRoomCode = roomCode;

          send(ws, {
            type: 'ROOM_CREATED',
            roomCode,
            playerId,
            isHost: true,
            lane: player.lane,
            maxPlayers: MAX_PLAYERS_PER_ROOM,
            mode: room.mode,
            targetDistance: room.targetDistance,
            players: Array.from(room.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              vehicleId: p.vehicleId,
              colorHex: p.colorHex,
              lane: p.lane,
              isHost: p.isHost,
            })),
          });
          console.log(`[Room ${roomCode}] Created by ${player.name} (${playerId}) in Lane ${player.lane}`);
          break;
        }

        case 'JOIN_ROOM': {
          const code = (data.roomCode || '').toUpperCase().trim();
          const room = rooms.get(code);

          if (!room) {
            send(ws, { type: 'ERROR', message: 'Oda bulunamadı! Kodu kontrol edin.' });
            return;
          }

          if (room.status !== 'LOBBY') {
            send(ws, { type: 'ERROR', message: 'Bu yarış zaten başladı veya bitti!' });
            return;
          }

          if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
            send(ws, { type: 'ERROR', message: `Oda dolu! (Maksimum ${MAX_PLAYERS_PER_ROOM} oyuncu)` });
            return;
          }

          const playerIndex = room.players.size;
          const assignedLane = STARTING_LANES[playerIndex % STARTING_LANES.length];

          const player = {
            ws,
            id: playerId,
            name: (data.playerName || `Sürücü ${playerIndex + 1}`).substring(0, 16),
            vehicleId: data.vehicleId || 'tofas_sahin',
            colorHex: data.colorHex || '#ffffff',
            lane: assignedLane,
            isHost: false,
            distance: 0,
            isCrashed: false,
            isFinished: false,
          };

          room.players.set(playerId, player);
          currentRoomCode = code;

          const playerList = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            vehicleId: p.vehicleId,
            colorHex: p.colorHex,
            lane: p.lane,
            isHost: p.isHost,
          }));

          send(ws, {
            type: 'ROOM_JOINED',
            roomCode: code,
            playerId,
            isHost: false,
            lane: player.lane,
            maxPlayers: MAX_PLAYERS_PER_ROOM,
            mode: room.mode,
            targetDistance: room.targetDistance,
            players: playerList,
          });

          broadcastRoom(room, {
            type: 'PLAYER_JOINED',
            players: playerList,
            newPlayer: {
              id: player.id,
              name: player.name,
              vehicleId: player.vehicleId,
              colorHex: player.colorHex,
              lane: player.lane,
            },
          }, playerId);

          console.log(`[Room ${code}] Player joined: ${player.name} (${playerId}) in Lane ${player.lane}. Total: ${room.players.size}/${MAX_PLAYERS_PER_ROOM}`);
          break;
        }

        case 'START_RACE': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.status !== 'LOBBY') return;

          const hostPlayer = room.players.get(playerId);
          if (!hostPlayer || !hostPlayer.isHost) {
            send(ws, { type: 'ERROR', message: 'Yalnızca oda kurucusu yarışı başlatabilir!' });
            return;
          }

          if (room.players.size < 2) {
            send(ws, { type: 'ERROR', message: 'Yarışı başlatmak için en az 2 oyuncu gereklidir!' });
            return;
          }

          room.status = 'STARTING';
          room.seed = Math.floor(Math.random() * 10000000);

          const startPayload = {
            type: 'RACE_STARTING',
            seed: room.seed,
            mode: room.mode,
            targetDistance: room.targetDistance,
            countdownSec: 3,
            players: Array.from(room.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              vehicleId: p.vehicleId,
              colorHex: p.colorHex,
              lane: p.lane,
              isHost: p.isHost,
            })),
          };

          broadcastRoom(room, startPayload);
          console.log(`[Room ${currentRoomCode}] Race started with ${room.players.size} players! Seed: ${room.seed}`);
          break;
        }

        case 'UPDATE_STATE': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const p = room.players.get(playerId);
          if (p) {
            p.distance = data.distance || p.distance;
          }

          broadcastRoom(room, {
            type: 'OPPONENT_UPDATE',
            playerId,
            x: data.x,
            y: data.y,
            z: data.z,
            speed: data.speed,
            steer: data.steer,
            brake: data.brake,
            nitro: data.nitro,
            horn: data.horn,
            flash: data.flash,
            signal: data.signal,
            distance: data.distance,
          }, playerId);
          break;
        }

        case 'PLAYER_CRASHED': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const p = room.players.get(playerId);
          if (p) {
            p.isCrashed = true;
            p.distance = data.distance || p.distance;
          }

          broadcastRoom(room, {
            type: 'OPPONENT_CRASHED',
            playerId,
            playerName: p ? p.name : 'Bir Sürücü',
            distance: data.distance || 0,
          }, playerId);

          const allPlayers = Array.from(room.players.values());
          const alivePlayers = allPlayers.filter(pl => !pl.isCrashed);

          if (room.mode === 'SURVIVAL') {
            if (alivePlayers.length === 1) {
              const winner = alivePlayers[0];
              room.status = 'FINISHED';
              broadcastRoom(room, {
                type: 'RACE_FINISHED',
                winnerId: winner.id,
                winnerName: winner.name,
                reason: 'LAST_SURVIVOR',
                standings: buildStandings(room),
              });
              console.log(`[Room ${currentRoomCode}] Survival winner: ${winner.name}`);
            } else if (alivePlayers.length === 0) {
              room.status = 'FINISHED';
              broadcastRoom(room, {
                type: 'RACE_FINISHED',
                winnerId: p ? p.id : '',
                winnerName: p ? p.name : 'Herkes Elendi',
                reason: 'ALL_CRASHED',
                standings: buildStandings(room),
              });
            }
          }
          break;
        }

        case 'REACHED_GOAL': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.status === 'FINISHED') return;

          const p = room.players.get(playerId);
          if (p) {
            p.isFinished = true;
            p.finishTime = data.finishTime || 0;
            p.distance = data.distance || room.targetDistance;
          }

          room.status = 'FINISHED';
          broadcastRoom(room, {
            type: 'RACE_FINISHED',
            winnerId: playerId,
            winnerName: p ? p.name : 'Şampiyon',
            reason: 'GOAL_REACHED',
            finishTime: data.finishTime,
            standings: buildStandings(room),
          });
          console.log(`[Room ${currentRoomCode}] Goal reached by: ${p?.name} in ${data.finishTime}s!`);
          break;
        }

        case 'LEAVE_ROOM': {
          handleDisconnect();
          break;
        }
      }
    } catch (err) {
      console.error('[MultiplayerServer] Parse error:', err);
    }
  });

  function handleDisconnect() {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const leavingPlayer = room.players.get(playerId);
    const leavingName = leavingPlayer ? leavingPlayer.name : 'Bir Sürücü';

    room.players.delete(playerId);
    console.log(`[Room ${currentRoomCode}] Player ${playerId} (${leavingName}) left. Remaining: ${room.players.size}`);

    if (room.players.size === 0) {
      rooms.delete(currentRoomCode);
      console.log(`[Room ${currentRoomCode}] Room closed (empty)`);
    } else {
      const remainingList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        vehicleId: p.vehicleId,
        colorHex: p.colorHex,
        lane: p.lane,
        isHost: p.isHost,
      }));

      broadcastRoom(room, {
        type: 'OPPONENT_LEFT',
        playerId,
        playerName: leavingName,
        players: remainingList,
      });

      const hasHost = Array.from(room.players.values()).some(p => p.isHost);
      if (!hasHost) {
        const newHost = Array.from(room.players.values())[0];
        if (newHost) {
          newHost.isHost = true;
          send(newHost.ws, { type: 'PROMOTED_HOST' });
          broadcastRoom(room, {
            type: 'HOST_CHANGED',
            newHostId: newHost.id,
            players: Array.from(room.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              vehicleId: p.vehicleId,
              colorHex: p.colorHex,
              lane: p.lane,
              isHost: p.isHost,
            })),
          });
          console.log(`[Room ${currentRoomCode}] ${newHost.name} promoted to Host`);
        }
      }
    }
    currentRoomCode = null;
  }

  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏎️ [TrafficRush Multiplayer] WebSocket Server running on port ${PORT} (0.0.0.0)`);
});
