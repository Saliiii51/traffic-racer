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
  private highBeamCooldown: number = 0;
  private nitroTimer: number = 0;
  private lastLaneChangeTime: number = 0;
  private timeSinceStart: number = 0;

  // Stats for cinematic HUD
  public makasCount: number = 0;

  constructor() {}

  public reset(initialLane: number = 1, aggressiveness: SlalomAggressiveness = 'AGGRESSIVE'): void {
    this.targetLane = initialLane;
    this.currentSteer = 0;
    this.highBeamCooldown = 0;
    this.nitroTimer = 0;
    this.lastLaneChangeTime = 0;
    this.timeSinceStart = 0;
    this.makasCount = 0;
    this.aggressiveness = aggressiveness;
    this.enabled = true;
  }

  public update(
    delta: number,
    player: PlayerVehicle,
    trafficManager: TrafficManager
  ): AutopilotOutput {
    if (!this.enabled || !player) {
      return { steer: 0, accelerate: false, brake: false, nitro: false, flashHighBeams: false };
    }

    this.timeSinceStart += delta;
    this.highBeamCooldown = Math.max(0, this.highBeamCooldown - delta);
    this.nitroTimer = Math.max(0, this.nitroTimer - delta);

    const playerPos = player.mesh.position;
    const playerSpeed = player.speedKmh;
    const activeNPCs = trafficManager.getActiveVehicles();

    const targetSpeedKmh = this.aggressiveness === 'AGGRESSIVE' ? 165 : 135;
    const currentLane = laneSystem.getClosestLane(playerPos.x);

    // 1. Analyze vehicles ahead in each lane
    // Look ahead distance scales with speed (e.g. 20m at 80km/h up to 70m at 160km/h)
    const scanDistance = Math.max(30, (playerSpeed / 160) * 80);
    const laneDistances: number[] = [999, 999, 999, 999]; // distance to closest car ahead in each lane
    const laneCarsAhead: (TrafficVehicle | null)[] = [null, null, null, null];

    for (const npc of activeNPCs) {
      const relZ = npc.mesh.position.z - playerPos.z;
      if (relZ > 2.0 && relZ < scanDistance) {
        const npcLane = laneSystem.getClosestLane(npc.mesh.position.x);
        if (npcLane >= 0 && npcLane < 4) {
          if (relZ < laneDistances[npcLane]) {
            laneDistances[npcLane] = relZ;
            laneCarsAhead[npcLane] = npc;
          }
        }
      }
    }

    // 2. Evaluate obstacle directly in front of targetLane and currentLane
    const distInCurrentLane = laneDistances[currentLane];
    const distInTargetLane = laneDistances[this.targetLane];

    // Thresholds
    const triggerDistance = this.aggressiveness === 'AGGRESSIVE' ? 32 : 45;
    const emergencyDistance = 14;

    let shouldFlash = false;
    let shouldBrake = false;
    let shouldNitro = false;

    // Flash high beams when catching up to a car ahead (classic Istanbul highway selektör)
    if (distInCurrentLane < 50 && this.highBeamCooldown <= 0) {
      shouldFlash = true;
      this.highBeamCooldown = 1.6; // cooldown between bursts
    }

    // 3. Lane Decision Logic for Dynamic "Makas" Weaving
    const minLaneChangeInterval = this.aggressiveness === 'AGGRESSIVE' ? 0.8 : 1.2;
    const canChangeLane = this.timeSinceStart - this.lastLaneChangeTime > minLaneChangeInterval;

    if (canChangeLane) {
      // Check if we need to evade or perform an aggressive cut
      const needsEvade = distInCurrentLane < triggerDistance || distInTargetLane < triggerDistance;

      if (needsEvade) {
        // Evaluate adjacent lanes: prefer lanes with most clearance ahead
        let bestLane = currentLane;
        let bestClearance = -1;

        // Try lanes adjacent to currentLane first for tight weaves
        const candidateLanes: number[] = [];
        if (currentLane > 0) candidateLanes.push(currentLane - 1);
        if (currentLane < 3) candidateLanes.push(currentLane + 1);

        // Also consider non-adjacent if both adjacent are blocked
        for (let l = 0; l < 4; l++) {
          if (!candidateLanes.includes(l) && l !== currentLane) {
            candidateLanes.push(l);
          }
        }

        for (const lane of candidateLanes) {
          const clearance = laneDistances[lane];
          // Check safety margin behind or next to us in that lane as well
          const isSideClear = !this.isCarAlongside(playerPos.z, lane, activeNPCs);
          if (isSideClear && clearance > bestClearance && clearance > 18) {
            bestClearance = clearance;
            bestLane = lane;
          }
        }

        if (bestLane !== this.targetLane) {
          this.targetLane = bestLane;
          this.lastLaneChangeTime = this.timeSinceStart;
          this.makasCount++;

          // 50% chance to burst nitro right after initiating a clean makas!
          if (Math.random() < 0.6 && this.nitroTimer <= 0) {
            shouldNitro = true;
            this.nitroTimer = 2.5;
          }
        }
      }
    }

    // 4. Emergency Collision Avoidance (ensure video reel never stops due to crash)
    if (distInCurrentLane < emergencyDistance && Math.abs(playerPos.x - laneSystem.getLaneX(this.targetLane)) < 1.0) {
      // Hard brake momentarily until lane change completes
      shouldBrake = true;
    }

    // 5. Steering Controller
    const targetX = laneSystem.getLaneX(this.targetLane);
    const diffX = targetX - playerPos.x;

    // Responsive PD-like steering calculation
    const steerSharpness = this.aggressiveness === 'AGGRESSIVE' ? 0.75 : 0.55;
    let desiredSteer = Math.max(-1.0, Math.min(1.0, diffX * steerSharpness));

    // Smooth transition into steering to avoid instantaneous snaps
    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, desiredSteer, delta * 12.0);

    // 6. Throttle & Speed Control
    let shouldAccelerate = true;
    if (playerSpeed > targetSpeedKmh + 10) {
      shouldAccelerate = false;
    }

    if (this.nitroTimer > 0) {
      shouldNitro = true;
    }

    return {
      steer: this.currentSteer,
      accelerate: shouldAccelerate && !shouldBrake,
      brake: shouldBrake,
      nitro: shouldNitro && !shouldBrake,
      flashHighBeams: shouldFlash,
    };
  }

  // Verify that an adjacent lane doesn't have an NPC right next to our doors
  private isCarAlongside(playerZ: number, laneIndex: number, npcs: TrafficVehicle[]): boolean {
    for (const npc of npcs) {
      const npcLane = laneSystem.getClosestLane(npc.mesh.position.x);
      if (npcLane === laneIndex) {
        const dz = Math.abs(npc.mesh.position.z - playerZ);
        // Vehicle length is approx 4.5m, safe buffer is 7.5m
        if (dz < 7.5) {
          return true;
        }
      }
    }
    return false;
  }
}

export const cinematicAutopilot = new CinematicAutopilot();
