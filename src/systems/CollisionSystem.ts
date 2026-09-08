import * as THREE from 'three';
import type { PlayerVehicle } from '../vehicles/PlayerVehicle';
import type { TrafficVehicle } from '../vehicles/TrafficVehicle';

export type CollisionType = 'none' | 'scrape' | 'slow_bump' | 'fatal_crash';

export interface CollisionResult {
  hasCollided: boolean;
  type: CollisionType;
  collidedWith: TrafficVehicle | null;
  impactSpeedKmh: number;
  relativeSpeedKmh: number;
  overlapX: number;
  overlapZ: number;
  pushDirectionX: number;
  contactPoint: THREE.Vector3;
}

export class CollisionSystem {
  private tempContactPoint = new THREE.Vector3();

  public checkCollisions(player: PlayerVehicle, traffic: TrafficVehicle[]): CollisionResult {
    const pBox = player.boundingBox;

    for (const vehicle of traffic) {
      if (!vehicle.isActive) continue;

      const vBox = vehicle.boundingBox;
      if (pBox.intersectsBox(vBox)) {
        // Calculate penetration depths along X and Z
        const overlapX = Math.min(pBox.max.x, vBox.max.x) - Math.max(pBox.min.x, vBox.min.x);
        const overlapZ = Math.min(pBox.max.z, vBox.max.z) - Math.max(pBox.min.z, vBox.min.z);

        // Center of contact volume in world space
        const contactX = (Math.max(pBox.min.x, vBox.min.x) + Math.min(pBox.max.x, vBox.max.x)) * 0.5;
        const contactY = (Math.max(pBox.min.y, vBox.min.y) + Math.min(pBox.max.y, vBox.max.y)) * 0.5;
        const contactZ = (Math.max(pBox.min.z, vBox.min.z) + Math.min(pBox.max.z, vBox.max.z)) * 0.5;
        this.tempContactPoint.set(contactX, contactY, contactZ);

        // Lateral push direction (+1 = push player right, -1 = push player left)
        const dx = player.mesh.position.x - vehicle.mesh.position.x;
        const pushDirectionX = dx >= 0 ? 1 : -1;

        const relSpeed = vehicle.isOppositeDirection
          ? (player.speedKmh + vehicle.speedKmh)
          : (player.speedKmh - vehicle.speedKmh);
        const impactSpeed = Math.max(player.speedKmh, Math.abs(relSpeed));

        // 1. Oncoming traffic collision (TWO_WAY mode)
        if (vehicle.isOppositeDirection) {
          // If frontal head-on or significant lateral overlap -> fatal crash
          if (overlapX > 0.35 || relSpeed > 65) {
            return {
              hasCollided: true,
              type: 'fatal_crash',
              collidedWith: vehicle,
              impactSpeedKmh: impactSpeed,
              relativeSpeedKmh: relSpeed,
              overlapX,
              overlapZ,
              pushDirectionX,
              contactPoint: this.tempContactPoint.clone(),
            };
          } else {
            // Glancing side graze against oncoming vehicle mirror/flank
            return {
              hasCollided: true,
              type: 'scrape',
              collidedWith: vehicle,
              impactSpeedKmh: impactSpeed,
              relativeSpeedKmh: relSpeed,
              overlapX,
              overlapZ,
              pushDirectionX,
              contactPoint: this.tempContactPoint.clone(),
            };
          }
        }

        // 2. Same-direction traffic:
        // "Makas atarken sıyırma" (Glancing side scrape while overtaking/weaving)
        // If overlap along X is small (< 0.55m) OR if cars are already alongside each other
        const isGlancingScrape = overlapX < 0.55 || (overlapZ > 1.0 && overlapX < 0.72);

        if (isGlancingScrape) {
          return {
            hasCollided: true,
            type: 'scrape',
            collidedWith: vehicle,
            impactSpeedKmh: impactSpeed,
            relativeSpeedKmh: relSpeed,
            overlapX,
            overlapZ,
            pushDirectionX,
            contactPoint: this.tempContactPoint.clone(),
          };
        }

        // 3. "Arabalara yavaş çarpınca sarsılsın oyun devam etsin" (Low-speed rear bump)
        // Only allow non-fatal bump if player is at low/moderate speed (< 90 km/h) AND relative speed is small (< 45 km/h)
        // If traveling at high highway speed (>= 90 km/h), slamming directly into another vehicle is a fatal crash!
        const isLowSpeedBump = (player.speedKmh < 90 && relSpeed < 45) || player.speedKmh < 45;
        if (isLowSpeedBump) {
          return {
            hasCollided: true,
            type: 'slow_bump',
            collidedWith: vehicle,
            impactSpeedKmh: impactSpeed,
            relativeSpeedKmh: relSpeed,
            overlapX,
            overlapZ,
            pushDirectionX,
            contactPoint: this.tempContactPoint.clone(),
          };
        }

        // 4. Direct, deep frontal rear-end smash at high speed -> Fatal Crash
        return {
          hasCollided: true,
          type: 'fatal_crash',
          collidedWith: vehicle,
          impactSpeedKmh: impactSpeed,
          relativeSpeedKmh: relSpeed,
          overlapX,
          overlapZ,
          pushDirectionX,
          contactPoint: this.tempContactPoint.clone(),
        };
      }
    }

    return {
      hasCollided: false,
      type: 'none',
      collidedWith: null,
      impactSpeedKmh: 0,
      relativeSpeedKmh: 0,
      overlapX: 0,
      overlapZ: 0,
      pushDirectionX: 0,
      contactPoint: this.tempContactPoint.set(0, 0, 0),
    };
  }
}

