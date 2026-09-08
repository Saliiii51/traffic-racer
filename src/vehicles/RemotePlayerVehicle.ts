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

  // Network interpolation targets
  private targetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private targetYaw: number = 0;
  private currentSpeedMps: number = 0;
  private currentSteerAngle: number = 0;

  // Floating 3D Name & Distance Sprite Tag
  private nameplateCanvas: HTMLCanvasElement | null = null;
  private nameplateCtx: CanvasRenderingContext2D | null = null;
  private nameplateTexture: THREE.CanvasTexture | null = null;

  constructor(opponentId: string, opponentName: string, vehicleId: string, colorHex: string) {
    const def = VEHICLE_CATALOG.find((v) => v.id === vehicleId) || VEHICLE_CATALOG[0];
    super((def.modelType as any) || 'coupe', colorHex);

    this.opponentId = opponentId;
    this.opponentName = opponentName;
    this.vehicleId = vehicleId;

    this.mesh.name = `RemotePlayer_${opponentId}`;

    // Load authentic 3D car model if available
    this.loadOpponentModel(def, colorHex);

    // Setup floating nameplate
    this.setupNameplate();
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
    this.targetPosition.set(update.x, update.y, update.z);
    this.targetYaw = (update.steer || 0) * -0.12;
    this.currentSpeedMps = (update.speed || 0) / 3.6;
    this.currentSteerAngle = (update.steer || 0) * 0.25;

    this.setBraking(!!update.brake);
    this.setNitroFlames(!!update.nitro);
  }

  public update(delta: number, playerZ: number): void {
    const lerpFactor = Math.min(1.0, delta * 18);
    this.mesh.position.lerp(this.targetPosition, lerpFactor);

    this.mesh.rotation.y = THREE.MathUtils.lerp(
      this.mesh.rotation.y,
      this.targetYaw,
      THREE.MathUtils.clamp(delta * 14, 0, 1)
    );

    this.updateWheels(this.currentSpeedMps, this.currentSteerAngle, delta);

    const distDiff = Math.round(this.mesh.position.z - playerZ);
    if (Math.random() < 0.1) {
      this.updateNameplateText(this.opponentName, distDiff);
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
