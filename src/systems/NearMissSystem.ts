// Near Miss Detection & Combo System

import type { PlayerVehicle } from '../vehicles/PlayerVehicle';
import type { TrafficVehicle } from '../vehicles/TrafficVehicle';
import { GAME_CONSTANTS } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';

export class NearMissSystem {
  private comboStreak = 0;
  private comboTimer = 0;

  public update(delta: number, player: PlayerVehicle, traffic: TrafficVehicle[]): void {
    if (!gameState.isPlaying) return;

    // Handle combo timeout
    if (this.comboStreak > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboStreak = 0;
      }
    }

    const playerPos = player.mesh.position;
    const playerHalfLength = player.dimensions.length / 2;

    for (const vehicle of traffic) {
      if (!vehicle.isActive) continue;

      const vehiclePos = vehicle.mesh.position;
      const vehicleHalfLength = vehicle.dimensions.length / 2;

      // 1. Overtake detection (player passes fully ahead of same-direction traffic vehicle)
      if (!vehicle.isOppositeDirection && !vehicle.overtakenChecked && playerPos.z > vehiclePos.z + vehicleHalfLength + 2.0) {
        vehicle.overtakenChecked = true;
        eventBus.emit('overtake', { count: 1 });
      }

      // 2. Near-miss candidate:
      // Player must be passing beside traffic with close lateral proximity (X distance)
      // and overlapping longitudinal range (Z overlap)
      if (!vehicle.nearMissChecked) {
        const lateralDist = Math.abs(playerPos.x - vehiclePos.x);
        const zOverlap = Math.abs(playerPos.z - vehiclePos.z) < (playerHalfLength + vehicleHalfLength + 1.2);

        // Required conditions:
        // - Close lateral distance (between car widths ~ 1.8m and 3.3m center-to-center)
        // - Longitudinal overlap
        // - Closing speed: for oncoming traffic, sum of speeds; for same direction, difference of speeds
        const relativeSpeed = vehicle.isOppositeDirection
          ? player.speedKmh + vehicle.speedKmh
          : player.speedKmh - vehicle.speedKmh;

        if (
          zOverlap &&
          lateralDist >= 1.8 &&
          lateralDist <= 3.3 &&
          relativeSpeed >= GAME_CONSTANTS.NEAR_MISS.RELATIVE_SPEED_MIN_KMH
        ) {
          vehicle.nearMissChecked = true;
          this.triggerNearMiss(lateralDist);
        }
      }
    }
  }

  private triggerNearMiss(lateralDist: number): void {
    this.comboStreak++;
    this.comboTimer = GAME_CONSTANTS.NEAR_MISS.COMBO_TIMEOUT_SEC;

    const baseScore = GAME_CONSTANTS.ECONOMY.NEAR_MISS_SCORE;
    const baseCash = GAME_CONSTANTS.ECONOMY.NEAR_MISS_CASH;

    const scoreBonus = baseScore * this.comboStreak;
    const cashBonus = baseCash * this.comboStreak;

    gameState.currentNearMisses++;
    gameState.currentCombo = this.comboStreak;

    audioManager.playNearMiss(this.comboStreak);

    eventBus.emit('nearMiss', {
      combo: this.comboStreak,
      scoreBonus,
      cashBonus,
      lateralDist,
    });
  }

  public reset(): void {
    this.comboStreak = 0;
    this.comboTimer = 0;
  }
}
