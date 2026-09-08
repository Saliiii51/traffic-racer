// ShipManager.ts - Manages loading, calibration, and instancing of 3D marine vessels (cruise_ship.glb)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ShipInstanceData {
  group: THREE.Group;
  baseY: number;
  baseZ: number;
  speed: number;
  rollPhase: number;
  pitchPhase: number;
  direction: number;
}

export class ShipManager {
  private static instance: ShipManager;
  private templateGroup: THREE.Group | null = null;
  private isModelLoaded = false;
  private loadPromise: Promise<boolean> | null = null;
  private readyCallbacks: Array<() => void> = [];

  // Wake foam texture cached
  private static wakeTexture: THREE.CanvasTexture | null = null;

  private constructor() {}

  public static getInstance(): ShipManager {
    if (!ShipManager.instance) {
      ShipManager.instance = new ShipManager();
    }
    return ShipManager.instance;
  }

  public isReady(): boolean {
    return this.isModelLoaded && this.templateGroup !== null;
  }

  public onReady(callback: () => void): void {
    if (this.isReady()) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  public async load(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      const loader = new GLTFLoader();
      const url = '/models/cruise_ship.glb';

      loader.load(
        url,
        (gltf) => {
          try {
            this.setupTemplate(gltf.scene);
            this.isModelLoaded = true;
            console.log('[ShipManager] cruise_ship.glb successfully loaded and calibrated.');
            this.readyCallbacks.forEach((cb) => cb());
            this.readyCallbacks = [];
            resolve(true);
          } catch (err) {
            console.error('[ShipManager] Error setting up cruise ship model:', err);
            resolve(false);
          }
        },
        undefined,
        (err) => {
          console.warn('[ShipManager] Failed to load cruise_ship.glb:', err);
          resolve(false);
        }
      );
    });

    return this.loadPromise;
  }

  private setupTemplate(rawModel: THREE.Group): void {
    // Model dimensions in raw OBJ units:
    // X: 3460, Y: 4613, Z: 27045
    // Centering offsets: X: -1701.17, Y: -950 (waterline), Z: +11023.05 (prow at +Z, stern at -Z)
    rawModel.position.set(-1701.17, -950, 11023.05);

    // Enhance materials
    rawModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.42;

          // Pure crisp white cruise hull finish for FrontColor
          if (mat.name === 'FrontColor') {
            mat.color.setHex(0xf8fafd);
            mat.roughness = 0.35;
          }

          // Dark tinted cabin windows
          if (mat.name === 'Color_008') {
            mat.transparent = true;
            mat.opacity = 0.78;
            mat.depthWrite = true;
          }

          // Swimming pool and glass balconies
          if (mat.name === 'Color_H06' || mat.name === 'Water_Pool_Light') {
            mat.transparent = true;
            mat.opacity = 0.72;
            mat.depthWrite = true;
          }

          mat.needsUpdate = true;
        }
      }
    });

    // Outer container scaled to realistic 67.6m cruise ship in Bosphorus
    const scale = 0.0025;
    const modelContainer = new THREE.Group();
    modelContainer.name = 'ShipModelContainer';
    modelContainer.add(rawModel);
    modelContainer.scale.set(scale, scale, scale);

    // Nautical Navigation & Deck Lights
    this.addNauticalLights(modelContainer);

    // Dynamic Wake & Bow Spray
    this.addWakeEffects(modelContainer);

    this.templateGroup = modelContainer;
  }

  private addNauticalLights(parent: THREE.Group): void {
    const lightGeo = new THREE.SphereGeometry(0.32, 8, 8);

    // 1. Port Navigation Light (Red on Left)
    const portMat = new THREE.MeshBasicMaterial({ color: 0xff1e38 });
    const portLight = new THREE.Mesh(lightGeo, portMat);
    portLight.position.set(-4.35, 6.4, 12.5);
    parent.add(portLight);

    // 2. Starboard Navigation Light (Green on Right)
    const stbdMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const stbdLight = new THREE.Mesh(lightGeo, stbdMat);
    stbdLight.position.set(4.35, 6.4, 12.5);
    parent.add(stbdLight);

    // 3. Masthead Steaming Light (White on Radar Mast)
    const mastMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), mastMat);
    mastLight.position.set(0, 9.4, -4.0);
    parent.add(mastLight);

    // 4. Stern Light (White on Aft Railing)
    const sternLight = new THREE.Mesh(lightGeo, mastMat);
    sternLight.position.set(0, 2.5, -33.6);
    parent.add(sternLight);

    // 5. Warm Glowing Promenade Deck Lights (warm amber pucks along balconies)
    const deckGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe6a7 });
    const deckPuckGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);

    const deckPositionsZ = [-20, -10, 0, 10, 20];
    for (const zPos of deckPositionsZ) {
      const leftPuck = new THREE.Mesh(deckPuckGeo, deckGlowMat);
      leftPuck.position.set(-4.28, 3.8, zPos);
      parent.add(leftPuck);

      const rightPuck = new THREE.Mesh(deckPuckGeo, deckGlowMat);
      rightPuck.position.set(4.28, 3.8, zPos);
      parent.add(rightPuck);
    }
  }

  private static getWakeTexture(): THREE.CanvasTexture {
    if (ShipManager.wakeTexture) return ShipManager.wakeTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Churned white foam wake gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.2, 'rgba(235, 248, 255, 0.70)');
    grad.addColorStop(0.6, 'rgba(210, 240, 255, 0.35)');
    grad.addColorStop(1.0, 'rgba(180, 225, 250, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.lineTo(80, 0);
    ctx.lineTo(128, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    // Subtle foam bubble noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 90; i++) {
      const rx = Math.random() * 128;
      const ry = Math.random() * 320;
      const rr = Math.random() * 2.5 + 0.8;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    ShipManager.wakeTexture = tex;
    return tex;
  }

  private addWakeEffects(parent: THREE.Group): void {
    if (typeof document === 'undefined') return;

    // 1. Long Stern Wake Foam trailing behind the ship
    const wakeLength = 55.0;
    const wakeGeo = new THREE.PlaneGeometry(16.0, wakeLength, 8, 12);
    const wakeMat = new THREE.MeshBasicMaterial({
      map: ShipManager.getWakeTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const sternWake = new THREE.Mesh(wakeGeo, wakeMat);
    sternWake.rotation.x = -Math.PI / 2;
    // Wake begins just behind the stern (Z = -33.8) and trails backward
    sternWake.position.set(0, 0.05, -33.8 - wakeLength / 2);
    parent.add(sternWake);

    // 2. Dual Angled Bow Wave Crests (Splashing water at the sharp prow)
    const bowWaveGeo = new THREE.PlaneGeometry(2.4, 14.0);
    const bowWaveMat = new THREE.MeshBasicMaterial({
      color: 0xe0f4ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Left bow spray
    const leftBow = new THREE.Mesh(bowWaveGeo, bowWaveMat);
    leftBow.rotation.x = -Math.PI / 2;
    leftBow.rotation.z = 0.22;
    leftBow.position.set(-3.2, 0.04, 26.0);
    parent.add(leftBow);

    // Right bow spray
    const rightBow = new THREE.Mesh(bowWaveGeo, bowWaveMat);
    rightBow.rotation.x = -Math.PI / 2;
    rightBow.rotation.z = -0.22;
    rightBow.position.set(3.2, 0.04, 26.0);
    parent.add(rightBow);
  }

  /**
   * Creates a fully assembled, positioned clone of the cruise ship.
   */
  public createCruiseShip(options: {
    x?: number;
    y?: number;
    z?: number;
    direction?: number; // +1 = forward (+Z), -1 = opposite (-Z)
  } = {}): THREE.Group | null {
    if (!this.templateGroup) return null;

    const wrapper = new THREE.Group();
    wrapper.name = 'CruiseShip_Bosphorus';

    const clonedModel = this.templateGroup.clone(true);
    wrapper.add(clonedModel);

    const x = options.x ?? 42.0;
    const y = options.y ?? -1.2; // Sea water surface
    const z = options.z ?? 0;
    const dir = options.direction ?? 1;

    wrapper.position.set(x, y, z);

    if (dir < 0) {
      wrapper.rotation.y = Math.PI; // Face towards south/Marmara
    } else {
      wrapper.rotation.y = 0.06; // Slight natural 3.5 deg Bosphorus navigational angle
    }

    return wrapper;
  }
}

export const shipManager = ShipManager.getInstance();
