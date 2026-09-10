import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager';
import { gameState } from '../core/GameState';

export interface ParkingRadarState {
  frontLeftDist: number;
  frontCenterDist: number;
  frontRightDist: number;
  rearLeftDist: number;
  rearCenterDist: number;
  rearRightDist: number;
  closestDist: number;
  isContinuousAlarm: boolean;
}

export class ParkingSensor {
  private timer: number = 0;
  public radarState: ParkingRadarState = {
    frontLeftDist: 999,
    frontCenterDist: 999,
    frontRightDist: 999,
    rearLeftDist: 999,
    rearCenterDist: 999,
    rearRightDist: 999,
    closestDist: 999,
    isContinuousAlarm: false,
  };

  public reset(): void {
    this.timer = 0;
    this.radarState = {
      frontLeftDist: 999,
      frontCenterDist: 999,
      frontRightDist: 999,
      rearLeftDist: 999,
      rearCenterDist: 999,
      rearRightDist: 999,
      closestDist: 999,
      isContinuousAlarm: false,
    };
  }

  public update(
    delta: number,
    carPos: THREE.Vector3,
    carYaw: number,
    carDimensions: { width: number; length: number },
    obstacleBoxes: THREE.Box3[]
  ): ParkingRadarState {
    const halfW = (carDimensions.width || 1.8) * 0.5;
    const halfL = (carDimensions.length || 4.2) * 0.5;

    // Sensor probe locations in car local space
    const cosY = Math.cos(carYaw);
    const sinY = Math.sin(carYaw);

    const localToWorld = (lx: number, lz: number): THREE.Vector3 => {
      const wx = carPos.x + (lx * cosY + lz * sinY);
      const wz = carPos.z + (-lx * sinY + lz * cosY);
      return new THREE.Vector3(wx, carPos.y + 0.3, wz);
    };

    // 6 sensor points: Front Left, Front Center, Front Right, Rear Left, Rear Center, Rear Right
    const probePoints = {
      fl: localToWorld(-halfW * 0.75, halfL),
      fc: localToWorld(0, halfL),
      fr: localToWorld(halfW * 0.75, halfL),
      rl: localToWorld(-halfW * 0.75, -halfL),
      rc: localToWorld(0, -halfL),
      rr: localToWorld(halfW * 0.75, -halfL),
    };

    const getMinDistToBoxes = (probe: THREE.Vector3): number => {
      let minD = 999;
      for (const box of obstacleBoxes) {
        const clampX = Math.max(box.min.x, Math.min(probe.x, box.max.x));
        const clampZ = Math.max(box.min.z, Math.min(probe.z, box.max.z));
        const dx = probe.x - clampX;
        const dz = probe.z - clampZ;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minD) minD = d;
      }
      return minD;
    };

    const flDist = getMinDistToBoxes(probePoints.fl);
    const fcDist = getMinDistToBoxes(probePoints.fc);
    const frDist = getMinDistToBoxes(probePoints.fr);
    const rlDist = getMinDistToBoxes(probePoints.rl);
    const rcDist = getMinDistToBoxes(probePoints.rc);
    const rrDist = getMinDistToBoxes(probePoints.rr);

    const isReverse = gameState.parkingGear === 'R';
    // If in Reverse, prioritize rear sensors. In Drive, prioritize front sensors.
    const relevantDist = isReverse
      ? Math.min(rlDist, rcDist, rrDist, flDist * 1.5, fcDist * 1.5, frDist * 1.5)
      : Math.min(flDist, fcDist, frDist, rlDist * 1.5, rcDist * 1.5, rrDist * 1.5);

    const closestDist = Math.min(flDist, fcDist, frDist, rlDist, rcDist, rrDist);
    const isContinuous = relevantDist <= 0.28;

    this.radarState = {
      frontLeftDist: flDist,
      frontCenterDist: fcDist,
      frontRightDist: frDist,
      rearLeftDist: rlDist,
      rearCenterDist: rcDist,
      rearRightDist: rrDist,
      closestDist,
      isContinuousAlarm: isContinuous,
    };

    // Audio Beeper trigger logic
    if (relevantDist < 2.2) {
      let interval = 0.8;
      if (relevantDist <= 0.28) {
        interval = 0.09;
      } else if (relevantDist <= 0.6) {
        interval = 0.16;
      } else if (relevantDist <= 1.1) {
        interval = 0.32;
      } else if (relevantDist <= 1.6) {
        interval = 0.55;
      }

      this.timer += delta;
      if (this.timer >= interval) {
        this.timer = 0;
        audioManager.playParkingSensorBeep(relevantDist, isContinuous);
      }
    } else {
      this.timer = 0;
    }

    return this.radarState;
  }
}

export const parkingSensor = new ParkingSensor();
