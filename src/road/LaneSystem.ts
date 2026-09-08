// Dynamic Lane System for 4-lane highway

import { GAME_CONSTANTS } from '../core/Constants';

export class LaneSystem {
  private static instance: LaneSystem;

  public readonly laneCount: number;
  public readonly laneWidth: number;
  public readonly shoulderWidth: number;
  public readonly laneCenters: number[] = [];
  public readonly roadLeftEdge: number;
  public readonly roadRightEdge: number;
  public readonly drivableMinX: number;
  public readonly drivableMaxX: number;

  private constructor() {
    this.laneCount = GAME_CONSTANTS.ROAD.LANES_COUNT;
    this.laneWidth = GAME_CONSTANTS.ROAD.LANE_WIDTH;
    this.shoulderWidth = GAME_CONSTANTS.ROAD.SHOULDER_WIDTH;

    const totalWidth = this.laneCount * this.laneWidth;
    const halfWidth = totalWidth / 2;

    // Calculate center X for each lane from left (lane 0) to right (lane 3)
    for (let i = 0; i < this.laneCount; i++) {
      const centerX = -halfWidth + this.laneWidth * (i + 0.5);
      this.laneCenters.push(Number(centerX.toFixed(3)));
    }

    this.roadLeftEdge = -halfWidth;
    this.roadRightEdge = halfWidth;

    // Allowed driving bounds including a small margin of the shoulder
    const margin = 0.4;
    this.drivableMinX = -halfWidth - this.shoulderWidth * 0.6 + margin;
    this.drivableMaxX = halfWidth + this.shoulderWidth * 0.6 - margin;
  }

  public static getInstance(): LaneSystem {
    if (!LaneSystem.instance) {
      LaneSystem.instance = new LaneSystem();
    }
    return LaneSystem.instance;
  }

  public getLaneX(laneIndex: number): number {
    const clampedIndex = Math.max(0, Math.min(this.laneCount - 1, Math.floor(laneIndex)));
    return this.laneCenters[clampedIndex];
  }

  public getClosestLane(x: number): number {
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < this.laneCenters.length; i++) {
      const diff = Math.abs(this.laneCenters[i] - x);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  public clampToRoad(x: number, vehicleHalfWidth = 1.0): number {
    return Math.max(this.drivableMinX + vehicleHalfWidth, Math.min(this.drivableMaxX - vehicleHalfWidth, x));
  }

  public getRandomLane(customRandom?: () => number): number {
    const r = customRandom ? customRandom() : Math.random();
    return Math.floor(r * this.laneCount);
  }

  public getTotalRoadWidth(): number {
    return this.laneCount * this.laneWidth;
  }
}

export const laneSystem = LaneSystem.getInstance();
