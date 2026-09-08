// CinematicAutopilot.ts - AI Controller for automated "makas" (near-miss slalom) in promo & reels mode
import * as THREE from 'three';
import { laneSystem } from '../road/LaneSystem';
import type { PlayerVehicle } from '../vehicles/PlayerVehicle';
import type { TrafficManager } from '../traffic/TrafficManager';
import type { TrafficVehicle } from '../vehicles/TrafficVehicle';

export interface AutopilotOutput {
  steer: number;
  accelerate: boolean;
  brake: boolean;
  nitro: boolean;
  flashHighBeams: boolean;
}

export type SlalomAggressiveness = 'NORMAL' | 'AGGRESSIVE';

export class CinematicAutopilot {
  public enabled: boolean = false;
  public aggressiveness: SlalomAggressiveness = 'AGGRESSIVE';

  private targetLane: number = 1;
  private currentSteer: number = 0;
  private highBeamTimer: number = 0;
  private highBeamStrobeCount: number = 0;
  private nitroTimer: number = 0;
  private nitroCooldown: number = 0;
  private timeSinceStart: number = 0;
  private timeInCurrentLane: number = 0;
  private slalomDirection: number = 1;

  // Stats for cinematic HUD
  public makasCount: number = 0;

  constructor() {}

  public reset(initialLane: number = 1, aggressiveness: SlalomAggressiveness = 'AGGRESSIVE'): void {
    this.targetLane = initialLane;
    this.currentSteer = 0;
    this.highBeamTimer = 0;
    this.highBeamStrobeCount = 0;
    this.nitroTimer = 2.5; // Start with immediate nitro boost!
    this.nitroCooldown = 0;
    this.timeSinceStart = 0;
    this.timeInCurrentLane = 0;
    this.slalomDirection = Math.random() > 0.5 ? 1 : -1;
    this.makasCount = 0;
    this.aggressiveness = aggressiveness;
    this.enabled = true;
  }

  public setAggressive(aggressive: boolean): void {
    this.aggressiveness = aggressive ? 'AGGRESSIVE' : 'NORMAL';
  }

  public update(
    delta: number,
    player: PlayerVehicle,
    trafficManager: TrafficManager
  ): AutopilotOutput {
    if (!this.enabled || !player) {
      return { steer: 0, accelerate: true, brake: false, nitro: false, flashHighBeams: false };
    }

    this.timeSinceStart += delta;
    this.timeInCurrentLane += delta;
    this.nitroCooldown = Math.max(0, this.nitroCooldown - delta);
    this.highBeamTimer = Math.max(0, this.highBeamTimer - delta);

    if (this.nitroTimer > 0) {
      this.nitroTimer -= delta;
      if (this.nitroTimer <= 0) {
        this.nitroCooldown = 0.8;
      }
    }

    const playerPos = player.mesh.position;
    const playerSpeed = player.speedKmh;
    const activeNPCs = trafficManager.getActiveVehicles();

    const targetSpeedKmh = this.aggressiveness === 'AGGRESSIVE' ? 215 : 175;
    const currentLane = laneSystem.getClosestLane(playerPos.x);

    // 1. Analyze vehicles ahead in all 4 lanes
    const scanDistance = Math.max(45, (playerSpeed / 160) * 90);
    const laneDistances: number[] = [999, 999, 999, 999];
    const laneCarsAhead: (TrafficVehicle | null)[] = [null, null, null, null];

    for (const npc of activeNPCs) {
      const relZ = npc.mesh.position.z - playerPos.z;
      if (relZ > 1.0 && relZ < scanDistance) {
        const npcLane = laneSystem.getClosestLane(npc.mesh.position.x);
        if (npcLane >= 0 && npcLane < 4) {
          if (relZ < laneDistances[npcLane]) {
            laneDistances[npcLane] = relZ;
            laneCarsAhead[npcLane] = npc;
          }
        }
      }
    }

    const distInCurrentLane = laneDistances[currentLane];
    const distInTargetLane = laneDistances[this.targetLane];

    // High-beam selektör strobe logic: rapid double/triple flash when catching up
    let shouldFlash = false;
    if (distInCurrentLane < 65) {
      if (this.highBeamTimer <= 0) {
        this.highBeamStrobeCount = 6;
        this.highBeamTimer = 2.0;
      }
    }

    if (this.highBeamStrobeCount > 0) {
      const strobePhase = Math.floor((this.timeSinceStart * 12) % 2);
      shouldFlash = strobePhase === 1;
      this.highBeamStrobeCount -= delta * 5;
    }

    // 2. Dynamic Makas Decision & Gap Finding ("Aralara Girme")
    const maxDwellTime = this.aggressiveness === 'AGGRESSIVE' ? 0.95 : 1.4;
    const hasObstacleAhead = distInCurrentLane < 42 || distInTargetLane < 42;
    const isTimeToWeave = this.timeInCurrentLane >= maxDwellTime;

    if (hasObstacleAhead || isTimeToWeave) {
      const candidateLanes: number[] = [];

      if (currentLane > 0) candidateLanes.push(currentLane - 1);
      if (currentLane < 3) candidateLanes.push(currentLane + 1);

      let bestLane = this.targetLane;
      let highestScore = -999;

      for (const lane of candidateLanes) {
        const clearance = laneDistances[lane];
        const isDoorBlocked = this.isCarAlongside(playerPos.z, lane, activeNPCs);

        if (isDoorBlocked) continue;

        let score = clearance;

        if ((lane - currentLane) * this.slalomDirection > 0) {
          score += 15;
        }

        if (hasObstacleAhead && clearance > 18) {
          score += 40;
        }

        if (score > highestScore) {
          highestScore = score;
          bestLane = lane;
        }
      }

      if (highestScore <= 0) {
        for (let l = 0; l < 4; l++) {
          if (l !== currentLane && laneDistances[l] > 22 && !this.isCarAlongside(playerPos.z, l, activeNPCs)) {
            bestLane = l;
            break;
          }
        }
      }

      if (bestLane !== this.targetLane) {
        this.targetLane = bestLane;
        this.timeInCurrentLane = 0;
        this.makasCount++;

        if (this.targetLane >= 3) this.slalomDirection = -1;
        if (this.targetLane <= 0) this.slalomDirection = 1;

        if (this.nitroCooldown <= 0) {
          this.nitroTimer = 1.9;
        }
      }
    }

    if (this.nitroCooldown <= 0 && this.nitroTimer <= 0 && playerSpeed < targetSpeedKmh - 5) {
      this.nitroTimer = 1.8;
    }

    // 3. Emergency brake only if vehicle is directly blocking within 9m
    let shouldBrake = false;
    if (distInCurrentLane < 9.0 && Math.abs(playerPos.x - laneSystem.getLaneX(this.targetLane)) < 0.6) {
      shouldBrake = true;
    }

    // 4. Ultra-responsive Steering Controller
    const targetX = laneSystem.getLaneX(this.targetLane);
    const diffX = targetX - playerPos.x;

    const steerSharpness = this.aggressiveness === 'AGGRESSIVE' ? 0.95 : 0.70;
    const desiredSteer = Math.max(-1.0, Math.min(1.0, diffX * steerSharpness));

    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, desiredSteer, delta * 18.0);

    // 5. Full Throttle Acceleration
    const shouldAccelerate = playerSpeed < targetSpeedKmh + 20 && !shouldBrake;
    const isNitroActive = this.nitroTimer > 0 && !shouldBrake;

    return {
      steer: this.currentSteer,
      accelerate: shouldAccelerate,
      brake: shouldBrake,
      nitro: isNitroActive,
      flashHighBeams: shouldFlash,
    };
  }

  private isCarAlongside(playerZ: number, laneIndex: number, npcs: TrafficVehicle[]): boolean {
    for (const npc of npcs) {
      const npcLane = laneSystem.getClosestLane(npc.mesh.position.x);
      if (npcLane === laneIndex) {
        const dz = Math.abs(npc.mesh.position.z - playerZ);
        if (dz < 6.0) {
          return true;
        }
      }
    }
    return false;
  }
}

export const cinematicAutopilot = new CinematicAutopilot();
