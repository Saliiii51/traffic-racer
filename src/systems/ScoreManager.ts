// Score Manager calculating distance, high-speed multipliers, and stunts

import { GAME_CONSTANTS } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { gameState } from '../core/GameState';

export class ScoreManager {
  private lastZ = 0;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('nearMiss', ({ scoreBonus }) => {
      this.addScore(scoreBonus);
    });

    eventBus.on('overtake', () => {
      this.addScore(GAME_CONSTANTS.ECONOMY.OVERTAKE_SCORE);
    });
  }

  public update(_delta: number, currentZ: number, speedKmh: number): void {
    if (!gameState.isPlaying) return;

    // Track forward distance
    const distDelta = Math.max(0, currentZ - this.lastZ);
    this.lastZ = currentZ;

    if (distDelta > 0) {
      gameState.currentDistanceMeters += distDelta;
      eventBus.emit('distanceChanged', { distanceMeters: gameState.currentDistanceMeters });

      // Multiplier based on speed
      let multiplier = 1.0;
      if (speedKmh >= GAME_CONSTANTS.ECONOMY.HIGH_SPEED_THRESHOLD_KMH) {
        multiplier = GAME_CONSTANTS.ECONOMY.HIGH_SPEED_BONUS_MULT;
      }

      const scoreGain = distDelta * GAME_CONSTANTS.ECONOMY.SCORE_PER_METER * multiplier;
      this.addScore(scoreGain, multiplier);
    }
  }

  public addScore(points: number, multiplier = 1.0): void {
    gameState.currentScore += points;
    eventBus.emit('scoreChanged', {
      score: Math.floor(gameState.currentScore),
      multiplier,
    });
  }

  public reset(startZ = 0): void {
    this.lastZ = startZ;
    gameState.currentScore = 0;
    gameState.currentDistanceMeters = 0;
  }
}
