// Nitro Boost System

import { GAME_CONSTANTS } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';

export class NitroSystem {
  public nitroPercent: number = 100;
  public isActive: boolean = false;
  private wasActive: boolean = false;
  private isDepleted: boolean = false;

  public update(delta: number, wantsNitro: boolean, playerSpeedKmh: number): boolean {
    if (!gameState.isPlaying) {
      this.isActive = false;
      this.isDepleted = false;
      return false;
    }

    // Minimum nitro reserve required to ignite boost (20% ensures a solid 1s burst without audio chatter)
    const MIN_ACTIVATION_PERCENT = 20;

    // When nitro runs out, keep it locked out until the tank recharges to at least MIN_ACTIVATION_PERCENT.
    // Once it reaches this threshold, if the player is still holding the button, nitro automatically re-engages!
    if (this.isDepleted && this.nitroPercent >= MIN_ACTIVATION_PERCENT) {
      this.isDepleted = false;
    }

    // Nitro can only activate if:
    // 1. Not in depleted lockout (must wait until at least MIN_ACTIVATION_PERCENT is reached)
    // 2. Player wants nitro (holding key or button)
    // 3. Player is moving forward (> 20 km/h)
    // 4. Either already active and has remaining gas (> 0%), OR initiating with >= MIN_ACTIVATION_PERCENT
    const canActivate =
      !this.isDepleted &&
      wantsNitro &&
      playerSpeedKmh > 20 &&
      (this.isActive ? this.nitroPercent > 0 : this.nitroPercent >= MIN_ACTIVATION_PERCENT);

    if (canActivate) {
      this.isActive = true;
      // Drain nitro
      const drain = (100 / GAME_CONSTANTS.NITRO.DURATION_SEC) * delta;
      this.nitroPercent = Math.max(0, this.nitroPercent - drain);
      if (this.nitroPercent <= 0) {
        this.nitroPercent = 0;
        this.isActive = false;
        this.isDepleted = true; // Locks out until recharged back to MIN_ACTIVATION_PERCENT
      }
    } else {
      this.isActive = false;
      // Passively recharge
      const recharge = GAME_CONSTANTS.NITRO.RECHARGE_RATE * 100 * delta;
      this.nitroPercent = Math.min(100, this.nitroPercent + recharge);
    }

    gameState.currentNitroPercent = Math.round(this.nitroPercent);

    // Trigger audio & events on state change
    if (this.isActive && !this.wasActive) {
      audioManager.startNitroSound();
      eventBus.emit('nitroActivated', { active: true });
    } else if (!this.isActive && this.wasActive) {
      audioManager.stopNitroSound();
      eventBus.emit('nitroActivated', { active: false });
    }

    this.wasActive = this.isActive;
    eventBus.emit('nitroChanged', { percent: Math.round(this.nitroPercent) });

    return this.isActive;
  }

  public addBonusNitro(amountPercent: number): void {
    this.nitroPercent = Math.min(100, this.nitroPercent + amountPercent);
    gameState.currentNitroPercent = Math.round(this.nitroPercent);
    eventBus.emit('nitroChanged', { percent: Math.round(this.nitroPercent) });
  }

  public reset(): void {
    this.nitroPercent = 100;
    this.isActive = false;
    this.wasActive = false;
    this.isDepleted = false;
    gameState.currentNitroPercent = 100;
  }
}
