// Economy Manager managing in-game cash rewards and economy calculations

import { GAME_CONSTANTS } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';

export class EconomyManager {
  private lastAwardedDistance = 0;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('nearMiss', ({ cashBonus }) => {
      this.addSessionCash(cashBonus, 'NEAR_MISS');
    });

    eventBus.on('overtake', () => {
      this.addSessionCash(GAME_CONSTANTS.ECONOMY.OVERTAKE_CASH, 'OVERTAKE');
    });
  }

  public update(currentDistanceMeters: number, speedKmh: number, delta: number): void {
    if (!gameState.isPlaying) return;

    // Award cash per 100 meters traveled
    const distanceInterval = 100;
    if (currentDistanceMeters - this.lastAwardedDistance >= distanceInterval) {
      this.lastAwardedDistance = Math.floor(currentDistanceMeters / distanceInterval) * distanceInterval;
      this.addSessionCash(GAME_CONSTANTS.ECONOMY.CASH_PER_100_METERS, 'DISTANCE');
    }

    // High speed continuous cash bonus
    if (speedKmh >= GAME_CONSTANTS.ECONOMY.HIGH_SPEED_THRESHOLD_KMH) {
      const highSpeedCashPerSec = 25;
      this.addSessionCash(highSpeedCashPerSec * delta, 'HIGH_SPEED', false);
    }
  }

  public addSessionCash(amount: number, _reason: string, playSfx = true): void {
    gameState.currentSessionCash += amount;
    if (playSfx && amount >= 50) {
      audioManager.playReward();
    }
  }

  public reset(): void {
    this.lastAwardedDistance = 0;
    gameState.currentSessionCash = 0;
  }
}
