// Traffic Manager managing pooling, spawning, AI, and recycling

import * as THREE from 'three';
import { TrafficVehicle, type TrafficType } from '../vehicles/TrafficVehicle';
import { GAME_CONSTANTS } from '../core/Constants';
import { laneSystem } from '../road/LaneSystem';
import { gameState } from '../core/GameState';
import { npcPackManager } from './NPCPackManager';
import { audioManager } from '../audio/AudioManager';
import { isMobileDevice } from '../utils/orientation';
import { prng } from '../utils/PRNG';
import { multiplayerManager } from '../network/MultiplayerManager';

import type { PlayerVehicle } from '../vehicles/PlayerVehicle';

export class TrafficManager {
  public group: THREE.Group;
  private pool: TrafficVehicle[] = [];
  private poolSize: number;
  private spawnTimer: number = 0;
  private activeVehiclesCache: TrafficVehicle[] = [];
  private isCacheDirty: boolean = true;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'TrafficManager';
    this.poolSize = GAME_CONSTANTS.TRAFFIC.POOL_SIZE;

    this.initPool();

    // Asynchronously load the 3D NPC pack
    npcPackManager.load().then((loaded) => {
      if (loaded) {
        console.log('[TrafficManager] 3D NPC pack ready for traffic flow.');
      }
    });
  }

  private initPool(): void {
    const types: TrafficType[] = ['compact', 'sedan', 'sedan', 'suv', 'truck'];

    for (let i = 0; i < this.poolSize; i++) {
      const type = types[i % types.length];
      const vehicle = new TrafficVehicle(`traffic_${i}`, type);
      this.pool.push(vehicle);
      this.group.add(vehicle.mesh);
    }
  }

  public getActiveVehicles(): TrafficVehicle[] {
    if (this.isCacheDirty) {
      this.activeVehiclesCache.length = 0;
      for (let i = 0; i < this.pool.length; i++) {
        const v = this.pool[i];
        if (v.isActive) {
          this.activeVehiclesCache.push(v);
        }
      }
      this.isCacheDirty = false;
    }
    return this.activeVehiclesCache;
  }

  public update(
    delta: number,
    playerVehicle: PlayerVehicle | null,
    distanceMeters: number,
    didHonk: boolean = false,
    didFlash: boolean = false
  ): void {
    const active = this.getActiveVehicles();
    const playerZ = playerVehicle ? playerVehicle.mesh.position.z : 0;

    // 1. Update active traffic AI & movement
    for (const vehicle of active) {
      vehicle.update(delta, active, playerVehicle, didHonk, didFlash);

      // 2. Despawn if fell behind player
      if (playerZ - vehicle.mesh.position.z > GAME_CONSTANTS.TRAFFIC.DESPAWN_DIST_BEHIND) {
        vehicle.deactivate();
        this.isCacheDirty = true;
      }

      // Despawn if too far ahead (e.g. if player stopped/braked hard)
      if (vehicle.mesh.position.z - playerZ > 260) {
        vehicle.deactivate();
        this.isCacheDirty = true;
      }
    }

    // 2. Resolve NPC-to-NPC collision separation & bumper interactions
    this.resolveTrafficCollisions(this.getActiveVehicles(), playerZ);

    // 3. Spawning rhythm based on distance progression
    this.spawnTimer += delta;
    const spawnInterval = this.getSpawnInterval(distanceMeters);
    const maxActiveTarget = this.getMaxActiveVehicles(distanceMeters);

    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      if (this.getActiveVehicles().length < maxActiveTarget) {
        this.attemptSpawn(playerZ);
      }
    }
  }

  private getSpawnInterval(dist: number): number {
    let baseInterval: number;
    if (dist < 500) baseInterval = 2.6;
    else if (dist < 1500) baseInterval = 1.9;
    else if (dist < 3000) baseInterval = 1.4;
    else baseInterval = 1.0;

    const isCustom = gameState.currentMode === 'CUSTOM_TRAFFIC';
    const density = isCustom ? gameState.trafficSettings.density : 100;

    if (density <= 0) return 999999; // Empty road: zero spawning
    return baseInterval * (100 / Math.max(10, density));
  }

  private getMaxActiveVehicles(dist: number): number {
    let baseMax: number;
    if (dist < 500) baseMax = 6;
    else if (dist < 1500) baseMax = 11;
    else if (dist < 3000) baseMax = 16;
    else baseMax = 22;

    const isCustom = gameState.currentMode === 'CUSTOM_TRAFFIC';
    const density = isCustom ? gameState.trafficSettings.density : 100;

    if (density <= 0) return 0;
    const isMobile = isMobileDevice();
    const maxCap = isMobile ? 12 : this.poolSize;
    const scaledMax = Math.round(baseMax * (density / 100));
    return Math.max(1, Math.min(maxCap, scaledMax));
  }

  private attemptSpawn(playerZ: number): void {
    const isCustom = gameState.currentMode === 'CUSTOM_TRAFFIC';
    const tSettings = gameState.trafficSettings;
    if (isCustom && tSettings.density <= 0) return;

    const available = this.pool.find((v) => !v.isActive);
    if (!available) return;

    const rnd = multiplayerManager.isRacing ? () => prng.next() : Math.random;

    // Pick a lane
    const lane = laneSystem.getRandomLane(rnd);
    const isTwoWay = gameState.currentMode === 'TWO_WAY' || (isCustom && tSettings.direction === 'TWO_WAY');
    // In Turkish / Right-hand traffic standard:
    // Right side of road (screen right, lanes 0 and 1, x < 0) is forward traffic.
    // Left side of road (screen left, lanes 2 and 3, x > 0) is oncoming opposite traffic.
    const isOpposite = isTwoWay && (lane === 2 || lane === 3);

    // Spawn distance ahead:
    // Oncoming cars move towards player so spawn further ahead (130m to 240m)
    const baseDist = isOpposite ? 130 : GAME_CONSTANTS.TRAFFIC.MIN_SPAWN_DIST_AHEAD;
    const spawnZ = playerZ + baseDist + rnd() * 85;

    // Ensure safe gap with any active vehicle already in that lane around spawnZ
    const active = this.getActiveVehicles();
    const isObstructed = active.some((v) => {
      return v.laneIndex === lane && Math.abs(v.mesh.position.z - spawnZ) < GAME_CONSTANTS.TRAFFIC.MIN_VEHICLE_GAP;
    });

    if (isObstructed) return;

    // Speed variation based on vehicle type and lane
    // In One-Way: Lane 0 is leftmost fast lane.
    // In Two-Way: Lane 1 (forward) and Lane 2 (oncoming) are the inner fast lanes near the center yellow line.
    let laneSpeedBonus: number;
    if (isTwoWay) {
      laneSpeedBonus = isOpposite ? (lane === 2 ? 8 : 0) : (lane === 1 ? 8 : 0);
    } else {
      laneSpeedBonus = (3 - lane) * 4;
    }

    const fleetPreset = isCustom ? tSettings.fleetPreset : 'all';
    const template = npcPackManager.getTemplateForFleetAndLane(fleetPreset, lane);

    let chosenType: TrafficType;
    if (template) {
      chosenType = (template.category as TrafficType) || 'sedan';
    } else {
      let poolTypes: TrafficType[];
      if (fleetPreset === 'heavy') {
        poolTypes = ['truck', 'bus'];
      } else if (fleetPreset === 'commercial') {
        poolTypes = ['taxi', 'minibus'];
      } else if (fleetPreset === 'tofas') {
        poolTypes = ['sedan'];
      } else if (fleetPreset === 'passenger') {
        poolTypes = ['sedan', 'suv', 'compact'];
      } else {
        poolTypes = ['taxi', 'taxi', 'minibus', 'courier', 'bus', 'sedan', 'suv', 'compact'];
      }
      chosenType = poolTypes[Math.floor(rnd() * poolTypes.length)];
    }

    const speedPreset = isCustom ? tSettings.speedPreset : 'normal';
    let baseSpeed: number;

    if (speedPreset === 'slow') {
      baseSpeed = 45 + rnd() * 20 + laneSpeedBonus * 0.4;
    } else if (speedPreset === 'fast') {
      baseSpeed = 105 + rnd() * 38 + laneSpeedBonus * 1.2;
    } else if (speedPreset === 'chaotic') {
      baseSpeed = 38 + rnd() * 112;
    } else {
      if (template) {
        const [minS, maxS] = template.speedRange;
        baseSpeed = minS + rnd() * (maxS - minS) + laneSpeedBonus;
      } else {
        baseSpeed = 68 + rnd() * 35 + laneSpeedBonus;
      }
    }

    available.spawn(lane, spawnZ, baseSpeed, chosenType, isOpposite, template);
    this.isCacheDirty = true;
  }

  private resolveTrafficCollisions(vehicles: TrafficVehicle[], playerZ: number = 0): void {
    const len = vehicles.length;
    for (let i = 0; i < len; i++) {
      const vA = vehicles[i];
      if (!vA.isActive) continue;

      for (let j = i + 1; j < len; j++) {
        const vB = vehicles[j];
        if (!vB.isActive) continue;

        // Skip opposite direction traffic (traveling in separate halves of road in TWO_WAY)
        if (vA.isOppositeDirection !== vB.isOppositeDirection) continue;

        const halfWidthA = vA.dimensions.width * 0.5;
        const halfLengthA = vA.dimensions.length * 0.5;
        const halfWidthB = vB.dimensions.width * 0.5;
        const halfLengthB = vB.dimensions.length * 0.5;

        const dx = vB.mesh.position.x - vA.mesh.position.x;
        const dz = vB.mesh.position.z - vA.mesh.position.z;

        const overlapX = halfWidthA + halfWidthB - Math.abs(dx);
        const overlapZ = halfLengthA + halfLengthB - Math.abs(dz);

        // If bounding boxes physically overlap:
        if (overlapX > 0 && overlapZ > 0) {
          // Determine who is ahead and who is behind
          const isBInFront = vA.isOppositeDirection ? dz < 0 : dz > 0;
          const frontCar = isBInFront ? vB : vA;
          const rearCar = isBInFront ? vA : vB;

          // 1. "biri birine deydiğinde hızlansın":
          // The car in front was bumped/touched, so it speeds up!
          frontCar.onBumperTouched(rearCar.speedKmh);
          rearCar.onFrontBumped(frontCar.speedKmh);

          // Play spatial bumper thump audio if near player
          const distToPlayer = Math.abs(frontCar.mesh.position.z - playerZ);
          if (distToPlayer < 65) {
            const pan = Math.max(-1, Math.min(1, frontCar.mesh.position.x / 10));
            const vol = Math.max(0.08, 0.45 * (1 - distToPlayer / 65));
            audioManager.playBumperThump(vol, pan);

            // 30% chance driver taps horn in agitation
            if (Math.random() < 0.3) {
              audioManager.playNpcHorn(pan, 0.24);
            }
          }

          // 2. "npcler birbirinin içinden geçiyor. geçmesin":
          // Physical penetration separation so they never clip through
          if (overlapZ < overlapX) {
            // Front-to-back bumper contact
            const sepZ = (overlapZ + 0.12) * 0.5;
            const signZ = vA.isOppositeDirection ? -1 : 1;
            if (isBInFront) {
              vB.mesh.position.z += signZ * sepZ;
              vA.mesh.position.z -= signZ * sepZ;
            } else {
              vA.mesh.position.z += signZ * sepZ;
              vB.mesh.position.z -= signZ * sepZ;
            }
          } else {
            // Lateral side-by-side contact (side swipe during lane change)
            const sepX = (overlapX + 0.1) * 0.5;
            const signX = Math.sign(dx) || 1;
            vB.mesh.position.x += signX * sepX;
            vA.mesh.position.x -= signX * sepX;

            vA.cancelLaneChange();
            vB.cancelLaneChange();
          }

          vA.updateBoundingBox();
          vB.updateBoundingBox();
        }
      }
    }
  }

  public reset(): void {
    this.spawnTimer = 0;
    for (const vehicle of this.pool) {
      vehicle.deactivate();
    }
    this.isCacheDirty = true;
  }
}
