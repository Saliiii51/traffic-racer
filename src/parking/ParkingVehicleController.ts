import * as THREE from 'three';
import { PlayerVehicle } from '../vehicles/PlayerVehicle';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';

export class ParkingVehicleController {
  public x: number = 0;
  public z: number = 0;
  public yaw: number = 0;
  public speedKmh: number = 0;
  public speedMps: number = 0;
  public steerAngle: number = 0;

  private wheelbase: number = 2.6;
  private maxSteerAngle: number = 0.62; // ~35.5 degrees
  private maxForwardSpeedKmh: number = 32.0;
  private maxReverseSpeedKmh: number = 18.0;
  private accelRate: number = 3.6; // m/s^2
  private brakeRate: number = 12.0; // m/s^2
  private coastDecel: number = 2.2; // m/s^2

  // Wheel meshes for visual steering & rotation
  private frontLeftWheel: THREE.Object3D | null = null;
  private frontRightWheel: THREE.Object3D | null = null;
  private rearLeftWheel: THREE.Object3D | null = null;
  private rearRightWheel: THREE.Object3D | null = null;

  // Reverse light indicators
  private reverseLights: THREE.Mesh[] = [];

  public reset(startX: number, startZ: number, startYaw: number): void {
    this.x = startX;
    this.z = startZ;
    this.yaw = startYaw;
    this.speedKmh = 0;
    this.speedMps = 0;
    this.steerAngle = 0;
    gameState.parkingGear = 'D';
    gameState.currentSpeedKmh = 0;
  }

  public initVehicleHooks(vehicle: PlayerVehicle): void {
    this.reverseLights = [];
    // Search model for wheels & tail lights
    const model = vehicle.mesh;
    model.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      if (/wheel_fl|fl_wheel|wheel_front_l|front_wheel_l/i.test(name)) {
        this.frontLeftWheel = child;
      } else if (/wheel_fr|fr_wheel|wheel_front_r|front_wheel_r/i.test(name)) {
        this.frontRightWheel = child;
      } else if (/wheel_rl|rl_wheel|wheel_rear_l/i.test(name)) {
        this.rearLeftWheel = child;
      } else if (/wheel_rr|rr_wheel|wheel_rear_r/i.test(name)) {
        this.rearRightWheel = child;
      }
    });

    // Create twin white reverse lights at rear of car if not present
    const dim = vehicle.dimensions || { width: 1.8, length: 4.2, height: 1.4 };
    const revGeo = new THREE.BoxGeometry(0.18, 0.08, 0.04);
    const revMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const revL = new THREE.Mesh(revGeo, revMat);
    revL.position.set(-dim.width * 0.32, dim.height * 0.40, -dim.length * 0.50 - 0.02);
    revL.visible = false;
    vehicle.mesh.add(revL);
    this.reverseLights.push(revL);

    const revR = new THREE.Mesh(revGeo, revMat);
    revR.position.set(dim.width * 0.32, dim.height * 0.40, -dim.length * 0.50 - 0.02);
    revR.visible = false;
    vehicle.mesh.add(revR);
    this.reverseLights.push(revR);
  }

  public update(
    delta: number,
    vehicle: PlayerVehicle,
    steerInput: number,
    isAccelerating: boolean,
    isBraking: boolean,
    isColliding: boolean
  ): void {
    const isReverse = gameState.parkingGear === 'R';

    // 1. Steering interpolation
    const targetSteer = steerInput * this.maxSteerAngle;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, delta * 8.0);

    // 2. Acceleration / Braking & Gear Shift Logic
    const maxSpeed = isReverse ? this.maxReverseSpeedKmh : this.maxForwardSpeedKmh;

    if (isColliding) {
      // Bounce knockback
      this.speedKmh = isReverse ? 2.5 : -2.5;
    } else if (isBraking) {
      // If car is already stopped and player holds brake, shift gear!
      if (Math.abs(this.speedKmh) < 0.3) {
        this.speedKmh = 0;
        // In Drive, holding brake/S when stopped can switch to Reverse
        if (!isReverse && isBraking) {
          gameState.setParkingGear('R');
        }
      } else {
        this.speedKmh -= Math.sign(this.speedKmh) * this.brakeRate * 3.6 * delta;
        if (Math.abs(this.speedKmh) < 0.5) this.speedKmh = 0;
      }
    } else if (isAccelerating) {
      // In Reverse, pressing accelerate (W) when stopped can shift back to Drive
      if (isReverse && Math.abs(this.speedKmh) < 0.3) {
        gameState.setParkingGear('D');
      } else {
        if (this.speedKmh < maxSpeed) {
          this.speedKmh += this.accelRate * 3.6 * delta;
          if (this.speedKmh > maxSpeed) this.speedKmh = maxSpeed;
        }
      }
    } else {
      // Coasting deceleration
      if (Math.abs(this.speedKmh) > 0.1) {
        this.speedKmh -= Math.sign(this.speedKmh) * this.coastDecel * 3.6 * delta;
        if (Math.abs(this.speedKmh) < 0.2) this.speedKmh = 0;
      } else {
        this.speedKmh = 0;
      }
    }

    this.speedMps = this.speedKmh / 3.6;
    gameState.currentSpeedKmh = Math.abs(Math.round(this.speedKmh));

    // 3. Kinematic Bicycle Steering Model
    if (Math.abs(this.speedMps) > 0.02) {
      const direction = isReverse ? -1 : 1;
      const moveMps = this.speedMps * direction;

      const angularVelocity = (moveMps / this.wheelbase) * Math.tan(this.steerAngle);
      this.yaw += angularVelocity * delta;

      // Displacement in world coordinates:
      // When yaw = 0, forward is +Z
      this.x += Math.sin(this.yaw) * moveMps * delta;
      this.z += Math.cos(this.yaw) * moveMps * delta;
    }

    // 4. Update Vehicle Mesh Transform
    vehicle.mesh.position.set(this.x, 0, this.z);
    vehicle.mesh.rotation.set(0, this.yaw, 0);

    vehicle.speedKmh = Math.abs(this.speedKmh);
    vehicle.speedMps = Math.abs(this.speedMps);
    vehicle.currentYaw = this.yaw;

    // 5. Visual Front Wheel Steering Angle & Rolling
    if (this.frontLeftWheel) {
      this.frontLeftWheel.rotation.y = this.steerAngle;
      this.frontLeftWheel.rotation.x += this.speedMps * delta * 2.8;
    }
    if (this.frontRightWheel) {
      this.frontRightWheel.rotation.y = this.steerAngle;
      this.frontRightWheel.rotation.x += this.speedMps * delta * 2.8;
    }
    if (this.rearLeftWheel) {
      this.rearLeftWheel.rotation.x += this.speedMps * delta * 2.8;
    }
    if (this.rearRightWheel) {
      this.rearRightWheel.rotation.x += this.speedMps * delta * 2.8;
    }

    // 6. Visual Reverse & Brake Lights
    for (const revLight of this.reverseLights) {
      revLight.visible = isReverse;
    }
    vehicle.setBraking(isBraking);

    // Audio Engine pitch at low speeds
    audioManager.updateEnginePitch(Math.abs(this.speedKmh) / 45, isAccelerating, false);
  }
}

export const parkingVehicleController = new ParkingVehicleController();
