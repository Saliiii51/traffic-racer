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
  private laneChangeCooldown: number = 0;
  private slalomDirection: number = 1;

  // Lateral velocity tracking for PD critically-damped lane centering (eliminates fishtailing/wobbling)
  private lastPlayerX: number = 0;
  private hasInitializedX: boolean = false;

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
    this.laneChangeCooldown = 0;
    this.slalomDirection = Math.random() > 0.5 ? 1 : -1;
    this.makasCount = 0;
    this.aggressiveness = aggressiveness;
    this.hasInitializedX = false;
    this.lastPlayerX = 0;
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

    const playerPos = player.mesh.position;
    const playerSpeed = player.speedKmh;
    const activeNPCs = trafficManager.getActiveVehicles();

    if (!this.hasInitializedX) {
      this.lastPlayerX = playerPos.x;
      this.hasInitializedX = true;
    }

    this.timeSinceStart += delta;
    this.timeInCurrentLane += delta;
    this.laneChangeCooldown = Math.max(0, this.laneChangeCooldown - delta);
    this.nitroCooldown = Math.max(0, this.nitroCooldown - delta);
    this.highBeamTimer = Math.max(0, this.highBeamTimer - delta);

    if (this.nitroTimer > 0) {
      this.nitroTimer -= delta;
      if (this.nitroTimer <= 0) {
        this.nitroCooldown = 0.8;
      }
    }

    const targetSpeedKmh = this.aggressiveness === 'AGGRESSIVE' ? 215 : 180;
    const currentLane = laneSystem.getClosestLane(playerPos.x);

    // 1. Analyze vehicles ahead in all 4 lanes
    const scanDistance = Math.max(50, (playerSpeed / 160) * 100);
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

    // High-beam selektör strobe logic: rapid double/triple flash when catching up to traffic
    let shouldFlash = false;
    if (distInCurrentLane < 65) {
      if (this.highBeamTimer <= 0) {
        this.highBeamStrobeCount = 6;
        this.highBeamTimer = 2.2;
      }
    }

    if (this.highBeamStrobeCount > 0) {
      const strobePhase = Math.floor((this.timeSinceStart * 12) % 2);
      shouldFlash = strobePhase === 1;
      this.highBeamStrobeCount -= delta * 5;
    }

    // 2. Intelligent Makas Decision (Triggered by Traffic Obstacles or Natural Highway Flow)
    // CRITICAL FIX: Do NOT blindly switch lanes every 0.95 seconds!
    // Real makas is executed when catching up to slower traffic ahead in the current lane.
    const obstacleThreshold = Math.max(38, (playerSpeed / 180) * 52); // ~42-52m depending on speed
    const hasObstacleAhead = distInCurrentLane < obstacleThreshold || distInTargetLane < obstacleThreshold;

    // Minimum time in lane before voluntary freestyle weave (3.8s - 5.2s, NOT 0.95s!)
    const voluntaryWeaveTime = this.aggressiveness === 'AGGRESSIVE' ? 3.8 : 5.2;
    const isTimeToFreestyleWeave = this.timeInCurrentLane >= voluntaryWeaveTime && this.laneChangeCooldown <= 0;

    // Can change lane if cooldown has expired, or emergency override if obstacle is critically close (< 24m)
    const canChangeLane = this.laneChangeCooldown <= 0 || (distInCurrentLane < 24.0);

    if ((hasObstacleAhead || isTimeToFreestyleWeave) && canChangeLane) {
      const candidateLanes: number[] = [];
      if (currentLane > 0) candidateLanes.push(currentLane - 1);
      if (currentLane < 3) candidateLanes.push(currentLane + 1);

      let bestLane = this.targetLane;
      let highestScore = -999;

      for (const lane of candidateLanes) {
        const clearance = laneDistances[lane];
        const isDoorBlocked = this.isCarAlongside(playerPos.z, lane, activeNPCs);

        // Cannot weave into a lane if a car is alongside our doors
        if (isDoorBlocked) continue;
        // Cannot weave into a lane that has an obstacle closer than 20m
        if (clearance < 20.0) continue;

        let score = clearance;

        // Evasion priority: huge bonus if candidate lane is open and current lane is blocked
        if (hasObstacleAhead && clearance > distInCurrentLane + 10) {
          score += 65;
        }

        // Center lanes bonus: prioritize weaving through the middle 2 lanes (Lanes 1 and 2)
        if (lane === 1 || lane === 2) {
          score += 22;
        }

        // Strongly encourage moving away from outer curbs / edge lanes
        if (currentLane === 0 && lane === 1) score += 35;
        if (currentLane === 3 && lane === 2) score += 35;

        // Slalom momentum: slight bonus for alternating weave direction if both lanes are safe
        if ((lane - currentLane) * this.slalomDirection > 0) {
          score += 10;
        }

        if (score > highestScore) {
          highestScore = score;
          bestLane = lane;
        }
      }

      // If candidate lanes are all blocked, fallback check for any open middle lane
      if (highestScore <= 0 && hasObstacleAhead) {
        for (let l = 1; l <= 2; l++) {
          if (l !== currentLane && laneDistances[l] > 28 && !this.isCarAlongside(playerPos.z, l, activeNPCs)) {
            bestLane = l;
            break;
          }
        }
      }

      if (bestLane !== this.targetLane) {
        this.targetLane = bestLane;
        this.timeInCurrentLane = 0;
        this.laneChangeCooldown = 2.2; // Stabilize in the new lane for at least 2.2s!
        this.makasCount++;

        // Update slalom direction for next time
        if (this.targetLane >= 3) this.slalomDirection = -1;
        if (this.targetLane <= 0) this.slalomDirection = 1;

        // Nitro burst when initiating a makas!
        if (this.nitroCooldown <= 0) {
          this.nitroTimer = 1.9;
        }
      }
    }

    // Edge proximity guard: never stay near road boundaries / curbs
    if (playerPos.x < laneSystem.roadLeftEdge + 1.4 && this.targetLane === 0) {
      this.targetLane = 1;
      this.slalomDirection = 1;
      this.laneChangeCooldown = 1.8;
    } else if (playerPos.x > laneSystem.roadRightEdge - 1.4 && this.targetLane === 3) {
      this.targetLane = 2;
      this.slalomDirection = -1;
      this.laneChangeCooldown = 1.8;
    }

    if (this.nitroCooldown <= 0 && this.nitroTimer <= 0 && playerSpeed < targetSpeedKmh - 5) {
      this.nitroTimer = 1.8;
    }

    // 3. Emergency brake only if vehicle is directly blocking within 9m
    let shouldBrake = false;
    if (distInCurrentLane < 9.0 && Math.abs(playerPos.x - laneSystem.getLaneX(this.targetLane)) < 0.6) {
      shouldBrake = true;
    }

    // 4. Critically Damped PD Steering Controller (Zero Wobble / Fishtailing)
    // In PlayerVehicle.updatePhysics, lateralVelocity = -steerInput * K.
    // To move towards +X (targetX > playerPos.x), steerInput must be NEGATIVE.
    const targetX = laneSystem.getLaneX(this.targetLane);
    const diffX = targetX - playerPos.x;

    // Real-time lateral velocity (m/s)
    const lateralVel = (playerPos.x - this.lastPlayerX) / Math.max(0.0001, delta);
    this.lastPlayerX = playerPos.x;

    let desiredSteer = 0;
    const absDiff = Math.abs(diffX);

    // Deadzone: If within 7cm of lane center and lateral drift is minimal, wheel is 100% straight!
    if (absDiff > 0.07 || Math.abs(lateralVel) > 0.22) {
      const steerSharpness = this.aggressiveness === 'AGGRESSIVE' ? 0.72 : 0.55;
      const steerDamping = 0.16; // Damps lateral momentum to eliminate overshoot and oscillation

      const pTerm = -diffX * steerSharpness;
      const dTerm = lateralVel * steerDamping; // Counter-steers as vehicle closes in on targetX
      desiredSteer = Math.max(-1.0, Math.min(1.0, pTerm + dTerm));
    }

    // Smooth response without high-frequency twitching
    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, desiredSteer, Math.min(1.0, delta * 18.0));
    if (Math.abs(this.currentSteer) < 0.015 && absDiff <= 0.07) {
      this.currentSteer = 0;
    }

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
