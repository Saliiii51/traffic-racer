// RemotePlayerVehicle.ts - High-fidelity 3D Opponent Car for Multiplayer
import * as THREE from 'three';
import { Vehicle } from './Vehicle';
import { VEHICLE_CATALOG } from './VehicleStats';
import { gltfModelLoader } from './GLTFModelLoader';
import type { OpponentStateUpdate } from '../network/MultiplayerManager';

export class RemotePlayerVehicle extends Vehicle {
  public opponentId: string;
  public opponentName: string;
  public vehicleId: string;

  // Dead Reckoning & Smooth Position Error Bleeding
  private simulatedPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private positionError: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private hasReceivedFirstUpdate: boolean = false;

  // Speeds & Rotations (Damped)
  private currentSpeedMps: number = 0;
  private targetSpeedMps: number = 0;
  private currentSteerAngle: number = 0;
  private targetSteerAngle: number = 0;
  private targetYaw: number = 0;

  public get speedKmh(): number {
    return this.currentSpeedMps * 3.6;
  }

  public get currentSteerTilt(): number {
    return this.currentSteerAngle * 0.15;
  }

  public get currentPitch(): number {
    return 0;
  }

  public get steerInput(): number {
    return this.targetSteerAngle;
  }

  // Floating 3D Name & Distance Sprite Tag
  private nameplateCanvas: HTMLCanvasElement | null = null;
  private nameplateCtx: CanvasRenderingContext2D | null = null;
  private nameplateTexture: THREE.CanvasTexture | null = null;
  private lastNameplateUpdate: number = 0;
  private lastNameplateDiff: number = -9999;

  constructor(opponentId: string, opponentName: string, vehicleId: string, colorHex: string) {
    const def = VEHICLE_CATALOG.find((v) => v.id === vehicleId) || VEHICLE_CATALOG[0];
    super((def.modelType as any) || 'coupe', colorHex);

    this.opponentId = opponentId;
    this.opponentName = opponentName;
    this.vehicleId = vehicleId;

    this.mesh.name = `RemotePlayer_${opponentId}`;

    // Initialize position tracking
    this.simulatedPosition.copy(this.mesh.position);
    this.positionError.set(0, 0, 0);

    // Load authentic 3D car model if available
    this.loadOpponentModel(def, colorHex);

    // Setup floating nameplate
    this.setupNameplate();
  }

  public setInitialPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
    this.simulatedPosition.set(x, y, z);
    this.positionError.set(0, 0, 0);
  }

  private async loadOpponentModel(def: any, colorHex: string): Promise<void> {
    if (def.modelPath) {
      try {
        const loaded = await gltfModelLoader.loadFromUrl(def.modelPath);
        this.applyCustomGLTF(loaded.clone());
        this.setColor(colorHex);
      } catch (e) {
        console.warn('[RemotePlayerVehicle] Fallback to procedural model:', e);
        this.setColor(colorHex);
      }
    } else {
      this.setColor(colorHex);
    }
  }

  private setupNameplate(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.nameplateCanvas = canvas;
    this.nameplateCtx = ctx;

    this.updateNameplateText(this.opponentName, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    this.nameplateTexture = tex;

    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.2, 0.8, 1);
    sprite.position.set(0, (this.dimensions?.height || 1.3) + 0.85, 0);
    this.mesh.add(sprite);
  }

  public updateNameplateText(name: string, distanceDiffMeters: number): void {
    if (!this.nameplateCtx || !this.nameplateCanvas || !this.nameplateTexture) return;

    const ctx = this.nameplateCtx;
    const w = this.nameplateCanvas.width;
    const h = this.nameplateCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Rounded background box
    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 12);
    ctx.fill();
    ctx.stroke();

    // Player Name & Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tag = distanceDiffMeters > 0 ? `+${distanceDiffMeters}m` : `${distanceDiffMeters}m`;
    ctx.fillText(`${name.substring(0, 12)} (${tag})`, w / 2, h / 2 - 2);

    this.nameplateTexture.needsUpdate = true;
  }

  public applyStateUpdate(update: OpponentStateUpdate): void {
    const updateSpeedMps = Math.max(0, (update.speed || 0) / 3.6);
    this.targetSpeedMps = updateSpeedMps;
    this.targetYaw = (update.steer || 0) * -0.12;
    this.targetSteerAngle = (update.steer || 0) * 0.25;

    this.setBraking(!!update.brake);
    this.setNitroFlames(!!update.nitro);

    // Calculate packet latency compensation (up to 150ms)
    let packetAgeSec = 0;
    if (update.timestamp) {
      const now = Date.now();
      packetAgeSec = Math.max(0, Math.min(0.15, (now - update.timestamp) / 1000));
    }

    // Extrapolate incoming network position by packet transit time
    const netX = update.x + (update.vx || 0) * packetAgeSec;
    const netY = update.y;
    const netZ = update.z + updateSpeedMps * packetAgeSec;

    if (!this.hasReceivedFirstUpdate) {
      this.hasReceivedFirstUpdate = true;
      this.simulatedPosition.set(netX, netY, netZ);
      this.positionError.set(0, 0, 0);
      this.mesh.position.set(netX, netY, netZ);
      this.currentSpeedMps = updateSpeedMps;
      return;
    }

    // Distance difference between current visual position and new incoming target
    const currentVisualX = this.mesh.position.x;
    const currentVisualY = this.mesh.position.y;
    const currentVisualZ = this.mesh.position.z;

    const dx = netX - currentVisualX;
    const dz = netZ - currentVisualZ;
    const distSq = dx * dx + dz * dz;

    if (distSq > 64) {
      // > 8 meters: Hard snap / teleport (crash, respawn, or major desync)
      this.simulatedPosition.set(netX, netY, netZ);
      this.positionError.set(0, 0, 0);
      this.mesh.position.set(netX, netY, netZ);
    } else {
      // Smooth error bleeding:
      // We advance the simulated position to the authoritative network position.
      // Simultaneously, we set positionError to (currentVisual - netPos).
      // At this instant, (simulatedPosition + positionError) === currentVisual.
      // Thus, visual position delta is EXACTLY 0 (zero instantaneous stutter).
      this.simulatedPosition.set(netX, netY, netZ);
      this.positionError.set(
        currentVisualX - netX,
        currentVisualY - netY,
        currentVisualZ - netZ
      );
    }
  }

  public update(delta: number, playerZ: number): void {
    const dt = Math.min(delta, 0.1); // Guard against giant delta spikes

    // 1. Smooth speed changes
    this.currentSpeedMps = THREE.MathUtils.damp(this.currentSpeedMps, this.targetSpeedMps, 10, dt);

    // 2. Dead Reckoning: Continuously advance simulated position along velocity vector
    this.simulatedPosition.z += this.currentSpeedMps * dt;
    // Lateral drift along X if turning
    const lateralSpeed = Math.sin(this.mesh.rotation.y) * this.currentSpeedMps;
    this.simulatedPosition.x += lateralSpeed * dt;

    // 3. Position Error Bleeding: Exponentially decay the offset to zero
    // In ~100ms, >75% of the error is absorbed. In ~200ms, >95% is absorbed.
    const decayFactor = Math.exp(-14 * dt);
    this.positionError.multiplyScalar(decayFactor);

    // Deadband: If error is negligible (< 1cm), snap to zero to eliminate sub-millimeter noise
    if (this.positionError.lengthSq() < 0.0001) {
      this.positionError.set(0, 0, 0);
    }

    // 4. Update rendered mesh position
    this.mesh.position.set(
      this.simulatedPosition.x + this.positionError.x,
      this.simulatedPosition.y + this.positionError.y,
      this.simulatedPosition.z + this.positionError.z
    );

    // 5. Smooth rotation and steering
    this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, this.targetYaw, 14, dt);
    this.currentSteerAngle = THREE.MathUtils.damp(this.currentSteerAngle, this.targetSteerAngle, 14, dt);

    // 6. Update wheels with smoothed speed and steering
    this.updateWheels(this.currentSpeedMps, this.currentSteerAngle, dt);

    // 7. Throttled Nameplate Updates (Max 2.5 times/sec, only when distance changes >= 1m)
    const now = performance.now();
    if (now - this.lastNameplateUpdate > 350) {
      const distDiff = Math.round(this.mesh.position.z - playerZ);
      if (Math.abs(distDiff - this.lastNameplateDiff) >= 1) {
        this.updateNameplateText(this.opponentName, distDiff);
        this.lastNameplateDiff = distDiff;
        this.lastNameplateUpdate = now;
      }
    }
  }

  public dispose(): void {
    if (this.nameplateTexture) {
      this.nameplateTexture.dispose();
    }
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
