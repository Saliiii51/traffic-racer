import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/Constants';
import { RoadSegment } from './RoadSegment';
import { cityPackManager } from '../world/CityPackManager';
import { shipManager } from '../world/ShipManager';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';

export class RoadManager {
  public group: THREE.Group;
  private segments: RoadSegment[] = [];
  private totalSegments: number;
  private segmentLength: number;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'RoadManager';
    this.totalSegments = GAME_CONSTANTS.ROAD.TOTAL_SEGMENTS;
    this.segmentLength = GAME_CONSTANTS.ROAD.SEGMENT_LENGTH;

    this.initPool();

    // Sync two-way lane markings on mode/settings change
    eventBus.on('gameModeChanged', () => this.syncTwoWayMode());
    eventBus.on('trafficSettingsChanged', () => this.syncTwoWayMode());

    // Asynchronously load 3D low poly city & bridge pack
    cityPackManager.load().then((loaded) => {
      if (loaded) {
        this.onCityPackLoaded();
      }
    });

    // Asynchronously load 3D cruise ship model
    shipManager.load().then((loaded) => {
      if (loaded) {
        this.onShipLoaded();
      }
    });
  }

  public syncTwoWayMode(): void {
    const isTwoWay = gameState.currentMode === 'TWO_WAY' || 
      (gameState.currentMode === 'CUSTOM_TRAFFIC' && gameState.trafficSettings.direction === 'TWO_WAY');
    for (const segment of this.segments) {
      segment.updateTwoWayMode(isTwoWay);
    }
  }

  private onCityPackLoaded(): void {
    console.log('[RoadManager] City pack ready: rebuilding road segments with 3D models.');
    for (const segment of this.segments) {
      segment.rebuildScenery();
    }
  }

  private onShipLoaded(): void {
    console.log('[RoadManager] Cruise ship ready: placing 3D cruise ship on Bosphorus.');
    for (const segment of this.segments) {
      if (segment.isBridge) {
        segment.rebuildShip();
      }
    }
  }

  private initPool(): void {
    const behindCount = GAME_CONSTANTS.ROAD.SEGMENTS_BEHIND;
    const startZ = -behindCount * this.segmentLength;

    for (let i = 0; i < this.totalSegments; i++) {
      const segment = new RoadSegment(i);
      const segZ = startZ + i * this.segmentLength;
      segment.setPositionZ(segZ);
      this.segments.push(segment);
      this.group.add(segment.mesh);
    }
    this.syncTwoWayMode();
  }

  public update(playerZ: number, delta = 0.016, elapsedTime = 0): void {
    // Sort or check the trailing segment
    // Since segments are queued sequentially, segments[0] is the furthest behind
    const firstSeg = this.segments[0];
    const despawnDistance = GAME_CONSTANTS.ROAD.SEGMENTS_BEHIND * this.segmentLength;

    if (playerZ - firstSeg.endZ > despawnDistance) {
      // Move first segment to the front
      const lastSeg = this.segments[this.segments.length - 1];
      const recycled = this.segments.shift()!;
      recycled.setPositionZ(lastSeg.endZ);
      this.segments.push(recycled);
    }

    // Animate active visible segments (dynamic Bosphorus water waves and bridge lights)
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (Math.abs(seg.startZ - playerZ) < 320) {
        seg.update(elapsedTime, delta);
      }
    }
  }

  public reset(playerZ = 0): void {
    const behindCount = GAME_CONSTANTS.ROAD.SEGMENTS_BEHIND;
    const startZ = playerZ - behindCount * this.segmentLength;

    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].setPositionZ(startZ + i * this.segmentLength);
    }
    this.syncTwoWayMode();
  }

  public getSegmentAtZ(z: number): RoadSegment | null {
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (z >= seg.startZ && z <= seg.endZ) {
        return seg;
      }
    }
    return null;
  }
}
