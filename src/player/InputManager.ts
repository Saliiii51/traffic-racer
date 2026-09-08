// Input manager abstracting Desktop Keyboard, Mobile Virtual Controls, and Gyroscope Tilt Steering

import { gameState } from '../core/GameState';

export interface InputState {
  steer: number; // -1 (full left) to +1 (full right)
  accelerate: boolean;
  brake: boolean;
  nitro: boolean;
  pauseJustPressed: boolean;
  cameraToggleJustPressed: boolean;
  hornJustPressed: boolean;
  flash: boolean;
  flashJustPressed: boolean;
  signalLeftJustPressed: boolean;
  signalRightJustPressed: boolean;
}

export class InputManager {
  private static instance: InputManager;

  // Raw keyboard keys
  private keysDown: Set<string> = new Set();

  // Mobile / Virtual button states
  private virtualSteerLeft = false;
  private virtualSteerRight = false;
  private virtualAccelerate = false;
  private virtualBrake = false;
  private virtualNitro = false;
  private virtualPause = false;
  private virtualCameraToggle = false;
  private virtualHorn = false;
  private virtualFlash = false;
  private virtualSignalLeft = false;
  private virtualSignalRight = false;

  // Gyroscope tilt
  public controlType: 'buttons' | 'tilt' = 'buttons';
  private gyroSteer = 0;
  private isGyroListening = false;
  private lastOrientationTimestamp = 0;
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;

  // Filtered smoothed steer
  private currentSteer = 0;
  private pauseConsumed = false;
  private cameraConsumed = false;
  private hornConsumed = false;
  private flashConsumed = false;
  private signalLeftConsumed = false;
  private signalRightConsumed = false;

  private constructor() {
    this.controlType = gameState.settings.controlType || 'buttons';
    this.setupKeyboardListeners();
    this.setupGyroListeners();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keysDown.add(e.code);

      // Single-action triggers
      if (e.code === 'KeyC') {
        this.virtualCameraToggle = true;
      } else if (e.code === 'KeyH') {
        this.virtualHorn = true;
      } else if (e.code === 'KeyF') {
        this.virtualFlash = true;
      } else if (e.code === 'KeyQ') {
        this.virtualSignalLeft = true;
      } else if (e.code === 'KeyE') {
        this.virtualSignalRight = true;
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.virtualPause = true;
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        this.virtualFlash = false;
      }
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.resetVirtualInputs();
    });
  }

  public setupGyroListeners(forceRebind = false): void {
    if (typeof window === 'undefined') return;

    if (this.isGyroListening) {
      if (!forceRebind) return;
      if (this.orientationHandler) {
        window.removeEventListener('deviceorientation', this.orientationHandler);
      }
      if (this.motionHandler) {
        window.removeEventListener('devicemotion', this.motionHandler);
      }
      this.isGyroListening = false;
    }

    this.orientationHandler = (e: DeviceOrientationEvent) => {
      if (this.controlType !== 'tilt') return;
      if (e.beta === null && e.gamma === null) return;

      this.lastOrientationTimestamp = Date.now();

      // Detect orientation angle reliably across iOS, Android Chrome, and WebViews
      const screenOrientation = window.screen?.orientation;
      let angle = 0;
      if (screenOrientation && typeof screenOrientation.angle === 'number') {
        angle = screenOrientation.angle;
      } else if (typeof (window as any).orientation === 'number') {
        angle = (window as any).orientation;
      }

      let isLandscape = false;
      const isForcedLandscape = typeof document !== 'undefined' && document.body.classList.contains('forced-landscape');

      if (isForcedLandscape) {
        isLandscape = true;
      } else if (screenOrientation?.type) {
        isLandscape = screenOrientation.type.includes('landscape');
      } else {
        isLandscape = Math.abs(angle) === 90 || angle === 270 || window.innerWidth > window.innerHeight;
      }

      let rawTilt = 0;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      if (isLandscape) {
        // In landscape:
        // Holding phone facing player, rotating left/right like a steering wheel alters beta.
        if (isForcedLandscape) {
          // In forced landscape, top of phone is held in left hand
          rawTilt = beta;
        } else if (angle === 270 || angle === -90) {
          rawTilt = -beta;
        } else {
          // Default landscape
          rawTilt = beta;
        }
      } else {
        // Portrait mode:
        // Turning left/right tilts gamma (-90 to +90).
        if (angle === 180) {
          rawTilt = -gamma;
        } else {
          rawTilt = gamma;
        }
      }

      this.processRawTilt(rawTilt);
    };

    // Fallback: devicemotion accelerationIncludingGravity
    // Automatically takes over if deviceorientation is muted or unsupported
    this.motionHandler = (e: DeviceMotionEvent) => {
      if (this.controlType !== 'tilt') return;
      if (Date.now() - this.lastOrientationTimestamp < 750) return;

      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null) return;

      let angle = 0;
      if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
        angle = window.screen.orientation.angle;
      } else if (typeof (window as any).orientation === 'number') {
        angle = (window as any).orientation;
      }

      const isForcedLandscape = typeof document !== 'undefined' && document.body.classList.contains('forced-landscape');
      const isLandscape =
        isForcedLandscape ||
        window.screen?.orientation?.type?.includes('landscape') ||
        Math.abs(angle) === 90 ||
        angle === 270 ||
        window.innerWidth > window.innerHeight;

      let rawTilt = 0;
      if (isLandscape) {
        const sign = (!isForcedLandscape && (angle === 270 || angle === -90)) ? -1 : 1;
        rawTilt = ((acc.y ?? 0) / 9.8) * 45 * sign;
      } else {
        rawTilt = -((acc.x ?? 0) / 9.8) * 45;
      }

      this.processRawTilt(rawTilt);
    };

    try {
      window.addEventListener('deviceorientation', this.orientationHandler, { passive: true });
    } catch {
      window.addEventListener('deviceorientation', this.orientationHandler as any);
    }

    try {
      window.addEventListener('devicemotion', this.motionHandler, { passive: true });
    } catch {
      window.addEventListener('devicemotion', this.motionHandler as any);
    }

    this.isGyroListening = true;
  }

  private processRawTilt(rawTilt: number): void {
    const deadzone = 2.5; // degrees deadzone to eliminate resting tremble
    const maxAngle = 24.0; // degrees for full turn lock

    if (Math.abs(rawTilt) < deadzone) {
      this.gyroSteer = 0;
    } else {
      const sign = Math.sign(rawTilt);
      const normalized = Math.min(1.0, (Math.abs(rawTilt) - deadzone) / (maxAngle - deadzone));
      // Progressive curve for smooth center control and full turning lock
      this.gyroSteer = sign * Math.pow(normalized, 1.15);
    }
  }

  public async requestOrientationPermission(): Promise<boolean> {
    let granted = true;

    // iOS 13+ DeviceOrientationEvent
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      // @ts-ignore
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        // @ts-ignore
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          granted = false;
        }
      } catch (err) {
        console.warn('DeviceOrientation permission denied', err);
        granted = false;
      }
    }

    // iOS 13+ DeviceMotionEvent (if separate)
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      // @ts-ignore
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        // @ts-ignore
        await DeviceMotionEvent.requestPermission();
      } catch {
        // Non-fatal
      }
    }

    if (granted) {
      this.setupGyroListeners(true);
    }

    return granted;
  }

  public setControlType(type: 'buttons' | 'tilt'): void {
    this.controlType = type;
    gameState.settings.controlType = type;
    gameState.save();
    if (type === 'tilt') {
      this.setupGyroListeners(true);
    }
    const steerCluster = document.getElementById('touch-steering-cluster');
    if (steerCluster) {
      steerCluster.style.opacity = type === 'tilt' ? '0.25' : '1.0';
    }
  }

  public resetVirtualInputs(): void {
    this.virtualSteerLeft = false;
    this.virtualSteerRight = false;
    this.virtualAccelerate = false;
    this.virtualBrake = false;
    this.virtualNitro = false;
    this.virtualPause = false;
    this.virtualCameraToggle = false;
    this.virtualHorn = false;
    this.virtualFlash = false;
    this.virtualSignalLeft = false;
    this.virtualSignalRight = false;
    this.gyroSteer = 0;
  }

  // Virtual control bindings for Mobile HUD
  public setVirtualSteerLeft(pressed: boolean): void {
    this.virtualSteerLeft = pressed;
  }

  public setVirtualSteerRight(pressed: boolean): void {
    this.virtualSteerRight = pressed;
  }

  public setVirtualAccelerate(pressed: boolean): void {
    this.virtualAccelerate = pressed;
  }

  public setVirtualBrake(pressed: boolean): void {
    this.virtualBrake = pressed;
  }

  public setVirtualNitro(pressed: boolean): void {
    this.virtualNitro = pressed;
  }

  public triggerPause(): void {
    this.virtualPause = true;
  }

  public triggerCameraCycle(): void {
    this.virtualCameraToggle = true;
  }

  public triggerHorn(): void {
    this.virtualHorn = true;
  }

  public setVirtualFlash(pressed: boolean): void {
    this.virtualFlash = pressed;
  }

  public triggerFlash(): void {
    this.virtualFlash = true;
  }

  public triggerSignalLeft(): void {
    this.virtualSignalLeft = true;
  }

  public triggerSignalRight(): void {
    this.virtualSignalRight = true;
  }

  // Check state per frame with delta smoothing
  public update(deltaTime: number): InputState {
    let targetSteer = 0;

    if (this.controlType === 'tilt') {
      const touchSteer = (this.virtualSteerRight ? 1.0 : 0) - (this.virtualSteerLeft ? 1.0 : 0);
      const keySteer = (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight') ? 1.0 : 0) -
                       (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft') ? 1.0 : 0);

      if (touchSteer !== 0) {
        targetSteer = touchSteer;
      } else if (keySteer !== 0) {
        targetSteer = keySteer;
      } else {
        targetSteer = this.gyroSteer;
      }
    } else {
      const keySteerLeft = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft') || this.virtualSteerLeft;
      const keySteerRight = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight') || this.virtualSteerRight;

      if (keySteerLeft && !keySteerRight) {
        targetSteer = -1.0;
      } else if (keySteerRight && !keySteerLeft) {
        targetSteer = 1.0;
      }
    }

    // Smooth progressive automotive steering with natural centering
    if (targetSteer !== 0) {
      // Faster response for gyro, smooth buildup for buttons
      const steerSpeed = this.controlType === 'tilt' ? 12.0 : 6.5;
      this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1.0, deltaTime * steerSpeed);
    } else {
      // Smooth return spring to center without vibrating or snapping
      const centerSpringSpeed = this.controlType === 'tilt' ? 14.0 : 9.5;
      this.currentSteer += (0 - this.currentSteer) * Math.min(1.0, deltaTime * centerSpringSpeed);
      if (Math.abs(this.currentSteer) < 0.002) this.currentSteer = 0;
    }

    const accelerate = this.keysDown.has('w') || this.keysDown.has('arrowup') || this.virtualAccelerate;
    const brake = this.keysDown.has('s') || this.keysDown.has('arrowdown') || this.keysDown.has('b') || this.virtualBrake;
    const nitro =
      this.keysDown.has(' ') ||
      this.keysDown.has('space') ||
      this.keysDown.has('shift') ||
      this.keysDown.has('shiftleft') ||
      this.keysDown.has('shiftright') ||
      this.virtualNitro;

    let pauseJustPressed = false;
    if (this.virtualPause && !this.pauseConsumed) {
      pauseJustPressed = true;
      this.pauseConsumed = true;
      this.virtualPause = false;
    } else if (!this.virtualPause) {
      this.pauseConsumed = false;
    }

    let cameraToggleJustPressed = false;
    if (this.virtualCameraToggle && !this.cameraConsumed) {
      cameraToggleJustPressed = true;
      this.cameraConsumed = true;
      this.virtualCameraToggle = false;
    } else if (!this.virtualCameraToggle) {
      this.cameraConsumed = false;
    }

    let hornJustPressed = false;
    if (this.virtualHorn && !this.hornConsumed) {
      hornJustPressed = true;
      this.hornConsumed = true;
      this.virtualHorn = false;
    } else if (!this.virtualHorn) {
      this.hornConsumed = false;
    }

    // High-Beam / Selektör: active continuously as long as key F or touch button is held down!
    const keyFlash = this.keysDown.has('f') || this.keysDown.has('keyf') || this.keysDown.has('KeyF');
    const flash = keyFlash || this.virtualFlash;
    let flashJustPressed = false;
    if (flash && !this.flashConsumed) {
      flashJustPressed = true;
      this.flashConsumed = true;
    } else if (!flash) {
      this.flashConsumed = false;
    }

    let signalLeftJustPressed = false;
    if (this.virtualSignalLeft && !this.signalLeftConsumed) {
      signalLeftJustPressed = true;
      this.signalLeftConsumed = true;
      this.virtualSignalLeft = false;
    } else if (!this.virtualSignalLeft) {
      this.signalLeftConsumed = false;
    }

    let signalRightJustPressed = false;
    if (this.virtualSignalRight && !this.signalRightConsumed) {
      signalRightJustPressed = true;
      this.signalRightConsumed = true;
      this.virtualSignalRight = false;
    } else if (!this.virtualSignalRight) {
      this.signalRightConsumed = false;
    }

    return {
      steer: this.currentSteer,
      accelerate,
      brake,
      nitro,
      pauseJustPressed,
      cameraToggleJustPressed,
      hornJustPressed,
      flash,
      flashJustPressed,
      signalLeftJustPressed,
      signalRightJustPressed,
    };
  }
}

export const inputManager = InputManager.getInstance();
