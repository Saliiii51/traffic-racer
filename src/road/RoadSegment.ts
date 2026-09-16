import * as THREE from 'three';
import { GAME_CONSTANTS, type EnvironmentPreset } from '../core/Constants';
import { laneSystem } from './LaneSystem';
import { shipManager } from '../world/ShipManager';
import { cityPackManager } from '../world/CityPackManager';
import { gameState } from '../core/GameState';

export class RoadSegment {
  public mesh: THREE.Group;
  public length: number;
  public startZ: number = 0;
  public endZ: number = 0;
  public segmentIndex: number;
  public isBridge: boolean;
  public isTunnel: boolean = false;

  // 3D Road Base, Terrain, Scenery, Bridge, Ship, Tunnel, Gantry and Streetlight Groups
  public roadBaseGroup: THREE.Group = new THREE.Group();
  public terrainGroup: THREE.Group = new THREE.Group();
  public sceneryGroup: THREE.Group = new THREE.Group();
  public bridgeMeshGroup: THREE.Group = new THREE.Group();
  public shipGroup: THREE.Group = new THREE.Group();
  public tunnelGroup: THREE.Group = new THREE.Group();
  public gantryGroup: THREE.Group = new THREE.Group();
  public streetLightsGroup: THREE.Group = new THREE.Group();

  // Two-Way / One-Way Dynamic Divider Groups
  private oneWayCenterLineGroup: THREE.Group = new THREE.Group();
  private twoWayDividerGroup: THREE.Group = new THREE.Group();
  private twoWayGantryGroup: THREE.Group = new THREE.Group();

  // Active vessel on water
  private activeShip: THREE.Group | null = null;
  private shipBaseY: number = -1.2;
  private shipDirection: number = 1;

  // Dynamic animated elements
  private bridgeLights: THREE.Mesh[] = [];
  private beaconLights: THREE.Mesh[] = [];
  private maidensTowerBeam: THREE.Group | THREE.Mesh | null = null;

  // Shared reusable geometries and materials can be cached statically
  private static asphaltMaterial: THREE.MeshStandardMaterial;
  private static laneMarkingMaterial: THREE.MeshBasicMaterial;
  private static shoulderLineMaterial: THREE.MeshBasicMaterial;
  private static twoWayYellowMaterial: THREE.MeshBasicMaterial;
  private static roadStudGeo: THREE.BoxGeometry;
  private static roadStudAmberMaterial: THREE.MeshBasicMaterial;
  private static delineatorPostGeo: THREE.CylinderGeometry | null = null;
  private static delineatorBaseGeo: THREE.CylinderGeometry | null = null;
  private static delineatorBandGeo: THREE.CylinderGeometry | null = null;
  private static delineatorOrangeMaterial: THREE.MeshStandardMaterial;
  private static delineatorWhiteMaterial: THREE.MeshBasicMaterial;
  private static delineatorBaseMaterial: THREE.MeshStandardMaterial;
  private static forwardArrowMaterial: THREE.MeshBasicMaterial;
  private static reverseArrowMaterial: THREE.MeshBasicMaterial;
  private static gantrySignalRedMaterial: THREE.MeshBasicMaterial;
  private static gantrySignalGreenMaterial: THREE.MeshBasicMaterial;
  private static curbMaterial: THREE.MeshStandardMaterial;
  private static grassMaterial: THREE.MeshStandardMaterial;
  private static dirtVergeMaterial: THREE.MeshStandardMaterial;
  private static grassTuftMaterial: THREE.MeshStandardMaterial;
  private static grassTuftGeometry: THREE.BufferGeometry | null = null;
  private static wildflowerGeometry: THREE.BufferGeometry | null = null;
  private static daisyMaterial: THREE.MeshStandardMaterial;
  private static poppyMaterial: THREE.MeshStandardMaterial;
  private static buttercupMaterial: THREE.MeshStandardMaterial;
  private static treeFoliageMaterials: THREE.MeshStandardMaterial[] = [];
  private static treeTrunkMaterial: THREE.MeshStandardMaterial;
  private static streetLightMaterial: THREE.MeshStandardMaterial;
  private static lightGlowMaterial: THREE.MeshBasicMaterial;

  // Istanbul specific materials
  public static waterUniforms = {
    uTime: { value: 0 },
  };
  private static waterGeometry: THREE.PlaneGeometry | null = null;
  private static bosphorusWaterMaterial: THREE.MeshStandardMaterial;
  private static bridgeTowerMaterial: THREE.MeshStandardMaterial;
  private static bridgeWhiteMaterial: THREE.MeshStandardMaterial;
  private static bridgeCableMaterial: THREE.MeshStandardMaterial;
  private static bridgePierMaterial: THREE.MeshStandardMaterial;
  private static bridgeSignMaterial: THREE.MeshBasicMaterial;
  private static bridgeGantrySignMaterial: THREE.MeshBasicMaterial;
  private static bridgeTrussMaterial: THREE.MeshStandardMaterial;
  private static gantryMaterial: THREE.MeshStandardMaterial;
  private static ferryHullMaterial: THREE.MeshStandardMaterial;
  private static ferryWhiteMaterial: THREE.MeshStandardMaterial;
  private static ferryYellowMaterial: THREE.MeshStandardMaterial;
  private static ferryWindowMaterial: THREE.MeshBasicMaterial;
  private static ferryWakeMaterial: THREE.MeshBasicMaterial;
  private static signMaterials: THREE.MeshBasicMaterial[] = [];

  // Roadway & landscape materials
  private static sidewalkMaterial: THREE.MeshStandardMaterial;
  private static billboardMaterials: THREE.MeshStandardMaterial[] = [];
  private static kmStoneMaterial: THREE.MeshStandardMaterial;
  private static cypressMaterial: THREE.MeshStandardMaterial;
  private static judasFlowerMaterials: THREE.MeshStandardMaterial[] = [];
  private static bushMaterials: THREE.MeshStandardMaterial[] = [];


  // Avrasya & TEM Highway Tunnel Materials
  private static tunnelWallMaterial: THREE.MeshStandardMaterial;
  private static tunnelCeilingMaterial: THREE.MeshStandardMaterial;
  private static tunnelTubeLightMaterial: THREE.MeshBasicMaterial;
  private static tunnelEmergencyDoorMaterial: THREE.MeshStandardMaterial;
  private static tunnelFanMaterial: THREE.MeshStandardMaterial;

  // Maiden's Tower (Kız Kulesi) Materials
  private static maidensTowerStoneMaterial: THREE.MeshStandardMaterial;
  private static maidensTowerRoofMaterial: THREE.MeshStandardMaterial;
  private static maidensTowerBeaconBeamMaterial: THREE.MeshBasicMaterial;

  // Infrastructure Materials (Pedestrian Overpass, SOS Bay, Streetlight Decals)
  private static overpassSteelMaterial: THREE.MeshStandardMaterial;
  private static overpassGlassMaterial: THREE.MeshStandardMaterial;
  private static sosBayMaterial: THREE.MeshStandardMaterial;
  private static streetlightGlowDecalMaterial: THREE.MeshBasicMaterial;

  // Modern Highway Guardrail & Roadside Scenery Materials
  private static guardrailSteelMaterial: THREE.MeshStandardMaterial;
  private static guardrailPostMaterial: THREE.MeshStandardMaterial;
  private static guardrailReflectorRedMaterial: THREE.MeshBasicMaterial;
  private static guardrailReflectorWhiteMaterial: THREE.MeshBasicMaterial;
  private static drainageGrateMaterial: THREE.MeshStandardMaterial;
  private static soundBarrierGlassMaterial: THREE.MeshStandardMaterial;
  private static soundBarrierFrameMaterial: THREE.MeshStandardMaterial;
  private static stonePineFoliageMaterials: THREE.MeshStandardMaterial[] = [];
  private static exitSignMaterials: THREE.MeshBasicMaterial[] = [];
  private static sosBoxOrangeMaterial: THREE.MeshStandardMaterial;

  // Turkish Highway materials & maps
  private static signMaterialsMap: Map<EnvironmentPreset, THREE.MeshBasicMaterial[]> = new Map();
  private static exitSignMaterialsMap: Map<EnvironmentPreset, THREE.MeshBasicMaterial[]> = new Map();
  private static kmStoneMaterialsMap: Map<EnvironmentPreset, THREE.MeshStandardMaterial> = new Map();
  private static billboardMaterialsMap: Map<EnvironmentPreset, THREE.MeshStandardMaterial[]> = new Map();
  private static bridgeGantrySignMaterialsMap: Map<EnvironmentPreset, THREE.MeshBasicMaterial> = new Map();
  private static tunnelPortalMaterialsMap: Map<EnvironmentPreset, THREE.MeshBasicMaterial> = new Map();

  // Bolu Dağı Alpine materials
  private static spruceFoliageMaterials: THREE.MeshStandardMaterial[] = [];
  private static rockWallMaterial: THREE.MeshStandardMaterial;
  private static boluValleyFloorMaterial: THREE.MeshStandardMaterial;

  // Bozkır Steppe materials
  private static bozkirGrassMaterial: THREE.MeshStandardMaterial;
  private static bozkirDirtMaterial: THREE.MeshStandardMaterial;
  private static bozkirBushMaterial: THREE.MeshStandardMaterial;
  private static osmangaziBridgeTowerMaterial: THREE.MeshStandardMaterial;

  public static setRainWetness(isRain: boolean): void {
    if (!RoadSegment.asphaltMaterial) return;
    if (isRain) {
      RoadSegment.asphaltMaterial.roughness = 0.16;
      RoadSegment.asphaltMaterial.metalness = 0.42;
    } else {
      RoadSegment.asphaltMaterial.roughness = 0.76;
      RoadSegment.asphaltMaterial.metalness = 0.12;
    }
    RoadSegment.asphaltMaterial.needsUpdate = true;
  }

  constructor(segmentIndex: number) {
    this.segmentIndex = segmentIndex;
    this.length = GAME_CONSTANTS.ROAD.SEGMENT_LENGTH;
    this.mesh = new THREE.Group();
    this.mesh.name = `RoadSegment_${segmentIndex}`;

    this.mesh.add(this.roadBaseGroup);
    this.mesh.add(this.terrainGroup);
    this.mesh.add(this.sceneryGroup);
    this.mesh.add(this.bridgeMeshGroup);
    this.mesh.add(this.shipGroup);
    this.mesh.add(this.tunnelGroup);
    this.mesh.add(this.gantryGroup);
    this.mesh.add(this.streetLightsGroup);

    // Segment rhythm:
    // 0: Highway corridor with Pedestrian Overpass & SOS bay
    // 1: Bridge / Viaduct (Bosphorus / Bolu Viaduct / Bozkır Viaduct / Osmangazi)
    // 2: Highway corridor with Gantries & Rolling Hills
    // 3: Highway Tunnel (Avrasya / Bolu Dağı / O-21 / Samanlı)
    const cycle = segmentIndex % 4;
    this.isBridge = cycle === 1;
    this.isTunnel = cycle === 3;

    // Road is centered straight along the Z axis for seamless segment continuity and perfect lane alignment
    this.mesh.position.x = 0;

    RoadSegment.initSharedMaterials();
    this.buildSegment();

    const isTwoWay = gameState.currentMode === 'TWO_WAY' || 
      (gameState.currentMode === 'CUSTOM_TRAFFIC' && gameState.trafficSettings.direction === 'TWO_WAY');
    this.updateTwoWayMode(isTwoWay);
    this.freezeStaticMatrices();
  }

  public freezeStaticMatrices(): void {
    const freezeGroup = (grp: THREE.Group) => {
      grp.traverse((obj) => {
        if (obj !== grp) {
          obj.updateMatrix();
          obj.matrixAutoUpdate = false;
        }
      });
    };
    freezeGroup(this.roadBaseGroup);
    freezeGroup(this.terrainGroup);
    freezeGroup(this.sceneryGroup);
    freezeGroup(this.tunnelGroup);
    freezeGroup(this.gantryGroup);
    freezeGroup(this.streetLightsGroup);
    freezeGroup(this.twoWayDividerGroup);
  }

  public updateTwoWayMode(isTwoWay: boolean): void {
    if (this.oneWayCenterLineGroup) this.oneWayCenterLineGroup.visible = !isTwoWay;
    if (this.twoWayDividerGroup) this.twoWayDividerGroup.visible = isTwoWay;
    if (this.twoWayGantryGroup) this.twoWayGantryGroup.visible = isTwoWay;
  }

  private static createWaterNormalTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const heights = new Float32Array(size * size);
    const twoPi = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      const ny = (y / size) * twoPi;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * twoPi;
        let h = Math.sin(nx * 4) * Math.cos(ny * 4) * 0.45;
        h += Math.sin(nx * 8 + ny * 6) * 0.25;
        h += Math.cos(nx * 6 - ny * 10) * 0.18;
        h += Math.sin(nx * 14 + ny * 12) * 0.08;
        h += Math.cos((nx - ny) * 18) * 0.04;
        heights[y * size + x] = h;
      }
    }

    const bumpScale = 3.2;
    for (let y = 0; y < size; y++) {
      const yPrev = (y - 1 + size) % size;
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xPrev = (x - 1 + size) % size;
        const xNext = (x + 1) % size;

        const dhdx = (heights[y * size + xNext] - heights[y * size + xPrev]) * bumpScale;
        const dhdy = (heights[yNext * size + x] - heights[yPrev * size + x]) * bumpScale;

        let nx = -dhdx;
        let ny = -dhdy;
        let nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;

        const idx = (y * size + x) * 4;
        data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 8);
    return texture;
  }

  // --- Two-Way Highway Center Line & Directional Asphalt Markings ---

  private static createForwardArrowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.clearRect(0, 0, 128, 256);

    // Clean white forward highway arrow (▲)
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 8;

    // Arrowhead pointing UP
    ctx.beginPath();
    ctx.moveTo(64, 16);
    ctx.lineTo(112, 96);
    ctx.lineTo(82, 96);
    ctx.lineTo(82, 236);
    ctx.lineTo(46, 236);
    ctx.lineTo(46, 96);
    ctx.lineTo(16, 96);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  private static createReverseArrowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.clearRect(0, 0, 128, 256);

    // Warning amber & vivid red reverse arrow pointing DOWN (▼ towards the driver)
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(220, 38, 38, 0.65)';
    ctx.shadowBlur = 10;

    // Arrowhead pointing DOWN
    ctx.beginPath();
    ctx.moveTo(64, 240);
    ctx.lineTo(114, 158);
    ctx.lineTo(84, 158);
    ctx.lineTo(84, 24);
    ctx.lineTo(44, 24);
    ctx.lineTo(44, 158);
    ctx.lineTo(14, 158);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Internal hazard stripes (chevron accents)
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.moveTo(44, 55);
    ctx.lineTo(84, 35);
    ctx.lineTo(84, 52);
    ctx.lineTo(44, 72);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(44, 98);
    ctx.lineTo(84, 78);
    ctx.lineTo(84, 95);
    ctx.lineTo(44, 115);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  private static createGantrySignalTexture(isRed: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, 128, 128);

    ctx.lineWidth = 4;
    ctx.strokeStyle = isRed ? '#ff2222' : '#00ff66';
    ctx.strokeRect(4, 4, 120, 120);

    if (isRed) {
      // Red Cross (❌ TERS ŞERİT / DO NOT ENTER)
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(26, 26);
      ctx.lineTo(102, 102);
      ctx.moveTo(102, 26);
      ctx.lineTo(26, 102);
      ctx.stroke();
    } else {
      // Green Down Arrow (⬇️ GİDİŞ / OPEN LANE)
      ctx.fillStyle = '#00ff66';
      ctx.beginPath();
      ctx.moveTo(64, 108);
      ctx.lineTo(102, 60);
      ctx.lineTo(76, 60);
      ctx.lineTo(76, 20);
      ctx.lineTo(52, 20);
      ctx.lineTo(52, 60);
      ctx.lineTo(26, 60);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  public static createDelineatorPost(): THREE.Group {
    const postGroup = new THREE.Group();

    // Black weighted rubber base
    if (!RoadSegment.delineatorBaseGeo) {
      RoadSegment.delineatorBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.04, 10);
      RoadSegment.delineatorBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.88 });
    }
    const base = new THREE.Mesh(RoadSegment.delineatorBaseGeo, RoadSegment.delineatorBaseMaterial);
    base.position.y = 0.02;
    postGroup.add(base);

    // Fluorescent orange flexible post
    if (!RoadSegment.delineatorPostGeo) {
      RoadSegment.delineatorPostGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.72, 10);
      RoadSegment.delineatorOrangeMaterial = new THREE.MeshStandardMaterial({ color: 0xff4000, roughness: 0.4 });
    }
    const post = new THREE.Mesh(RoadSegment.delineatorPostGeo, RoadSegment.delineatorOrangeMaterial);
    post.position.y = 0.36;
    postGroup.add(post);

    // 3 Reflective white honeycomb collars (Bantlar)
    if (!RoadSegment.delineatorBandGeo) {
      RoadSegment.delineatorBandGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.06, 10);
      RoadSegment.delineatorWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }
    const b1 = new THREE.Mesh(RoadSegment.delineatorBandGeo, RoadSegment.delineatorWhiteMaterial);
    b1.position.y = 0.30;
    postGroup.add(b1);

    const b2 = new THREE.Mesh(RoadSegment.delineatorBandGeo, RoadSegment.delineatorWhiteMaterial);
    b2.position.y = 0.45;
    postGroup.add(b2);

    const b3 = new THREE.Mesh(RoadSegment.delineatorBandGeo, RoadSegment.delineatorWhiteMaterial);
    b3.position.y = 0.60;
    postGroup.add(b3);

    return postGroup;
  }

  // --- Photorealistic Lush Grass Diffuse & Normal Procedural Maps ---

  private static createGrassTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // 1. Rich dark humus / soil base gradient
    const baseGrad = ctx.createLinearGradient(0, 0, size, size);
    baseGrad.addColorStop(0, '#183317');
    baseGrad.addColorStop(0.5, '#22441d');
    baseGrad.addColorStop(1, '#1b381a');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Organic soil & turf noise patches
    for (let i = 0; i < 650; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pr = 4 + Math.random() * 18;
      const patchType = Math.random();
      if (patchType < 0.40) {
        ctx.fillStyle = 'rgba(22, 45, 18, 0.45)'; // deep damp loam
      } else if (patchType < 0.78) {
        ctx.fillStyle = 'rgba(48, 98, 38, 0.38)'; // lush emerald turf
      } else {
        ctx.fillStyle = 'rgba(76, 138, 52, 0.28)'; // sunlit meadow patch
      }
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Dense directional grass blade fibers (4800 blades)
    const bladeColors = [
      '#1b4332', // Deep forest emerald
      '#2d6a4f', // Medium lush green
      '#40916c', // Fresh grass green
      '#52b788', // Spring bright green
      '#74c69d', // Vibrant lime tip
      '#95d5b2', // Sun highlight
      '#80b918', // Olive green
      '#b5ba73', // Subtle dry straw fleck
    ];

    for (let b = 0; b < 4800; b++) {
      const bx = Math.random() * size;
      const by = Math.random() * size;
      const blen = 6 + Math.random() * 13;
      const bAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const color = bladeColors[Math.floor(Math.random() * bladeColors.length)];

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.0 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      const ex = bx + Math.cos(bAngle) * blen;
      const ey = by + Math.sin(bAngle) * blen;
      const cpx = bx + (Math.random() - 0.5) * 4;
      const cpy = by - blen * 0.5;
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.stroke();
    }

    // 4. Subtle tiny wildflower speckles (daisy whites, buttercup yellows, poppy reds)
    for (let f = 0; f < 90; f++) {
      const fx = Math.random() * size;
      const fy = Math.random() * size;
      const flowerType = Math.random();
      if (flowerType < 0.45) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx, fy, 2.5, 2.5);
        ctx.fillStyle = '#fbc531';
        ctx.fillRect(fx + 0.5, fy + 0.5, 1.5, 1.5);
      } else if (flowerType < 0.75) {
        ctx.fillStyle = '#fbc531';
        ctx.fillRect(fx, fy, 2.5, 2.5);
      } else {
        ctx.fillStyle = '#e84118';
        ctx.fillRect(fx, fy, 3, 3);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 12);
    tex.anisotropy = 4;
    return tex;
  }

  private static createGrassNormalTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    // Generate height field
    const heights = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
      heights[i] = Math.random() * 0.42;
    }
    // Add directional blade streaks
    for (let s = 0; s < 2800; s++) {
      const sx = Math.floor(Math.random() * size);
      const sy = Math.floor(Math.random() * size);
      const len = Math.floor(6 + Math.random() * 11);
      for (let l = 0; l < len; l++) {
        const py = (sy - l + size) % size;
        const px = (sx + Math.floor((Math.random() - 0.5) * 3) + size) % size;
        heights[py * size + px] = Math.min(1.0, heights[py * size + px] + 0.55);
      }
    }

    // Convert height field to normal map (Sobel / central difference)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const left = heights[y * size + ((x - 1 + size) % size)];
        const right = heights[y * size + ((x + 1) % size)];
        const up = heights[((y - 1 + size) % size) * size + x];
        const down = heights[((y + 1) % size) * size + x];

        const dx = (right - left) * 2.6;
        const dy = (down - up) * 2.6;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const idx = (y * size + x) * 4;
        data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((-ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 12);
    tex.anisotropy = 4;
    return tex;
  }

  private static createDirtVergeTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Warm earth / dirt base
    ctx.fillStyle = '#4a3d2e';
    ctx.fillRect(0, 0, size, size);

    // Soil grain and fine gravel
    for (let i = 0; i < 2400; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const dark = Math.random() < 0.5;
      ctx.fillStyle = dark ? 'rgba(45, 36, 26, 0.4)' : 'rgba(125, 108, 88, 0.35)';
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // Sparse moss / grass patches along the outer edge
    for (let g = 0; g < 450; g++) {
      const gx = 115 + Math.random() * 141;
      const gy = Math.random() * size;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(45, 106, 79, 0.5)' : 'rgba(64, 145, 108, 0.45)';
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 16);
    tex.anisotropy = 4;
    return tex;
  }

  // Featherweight 3D Grass Blade Tuft Geometry (3 intersecting curved blades)
  private static createGrassTuftGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const bladeAngles = [0, Math.PI / 3, (2 * Math.PI) / 3];
    let vertOffset = 0;

    for (const angle of bladeAngles) {
      const w = 0.44;
      const h = 0.58;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 5 vertices: bottom-left, bottom-right, mid-left, mid-right, tip
      const localVerts = [
        { x: -w * 0.5, y: 0, z: 0, u: 0, v: 0 },
        { x: w * 0.5, y: 0, z: 0, u: 1, v: 0 },
        { x: -w * 0.36, y: h * 0.52, z: 0.04, u: 0.1, v: 0.52 },
        { x: w * 0.36, y: h * 0.52, z: 0.04, u: 0.9, v: 0.52 },
        { x: 0, y: h, z: 0.10, u: 0.5, v: 1.0 },
      ];

      for (const v of localVerts) {
        const rx = v.x * cosA - v.z * sinA;
        const rz = v.x * sinA + v.z * cosA;
        positions.push(rx, v.y, rz);
        normals.push(0, 1, 0);
        uvs.push(v.u, v.v);
      }

      // Triangles: (0, 1, 2), (2, 1, 3), (2, 3, 4)
      indices.push(
        vertOffset + 0, vertOffset + 1, vertOffset + 2,
        vertOffset + 2, vertOffset + 1, vertOffset + 3,
        vertOffset + 2, vertOffset + 3, vertOffset + 4
      );
      vertOffset += 5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // 5-petal wildflower disc geometry
  private static createWildflowerGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const stemH = 0.38;
    const petalCount = 5;
    const flowerRadius = 0.16;

    // V0: center of flower
    positions.push(0, stemH, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let p = 0; p < petalCount; p++) {
      const angle = (p / petalCount) * Math.PI * 2;
      const px = Math.cos(angle) * flowerRadius;
      const pz = Math.sin(angle) * flowerRadius;
      const py = stemH + 0.02;

      positions.push(px, py, pz);
      normals.push(0, 1, 0);
      uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }

    for (let p = 1; p <= petalCount; p++) {
      const nextP = p === petalCount ? 1 : p + 1;
      indices.push(0, p, nextP);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private static createTunnelWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Cream / White ceramic tile base
    ctx.fillStyle = '#edf2f4';
    ctx.fillRect(0, 0, 256, 256);

    // Ceramic tile grout grid
    ctx.strokeStyle = '#8d99ae';
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= 256; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (let x = 0; x <= 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }

    // Safety orange / blue accent stripe band along lower waistline
    ctx.fillStyle = '#d90429';
    ctx.fillRect(0, 192, 256, 16);
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(0, 208, 256, 12);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 1);
    tex.anisotropy = 4;
    return tex;
  }

  private static createTunnelCeilingTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Dark acoustic concrete vault
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(0, 0, 128, 128);

    // Ribbed concrete formwork grooves
    ctx.strokeStyle = '#1a1b26';
    ctx.lineWidth = 3;
    for (let y = 0; y <= 128; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 10);
    return tex;
  }

  private static initSharedMaterials(): void {
    if (this.asphaltMaterial) return;

    // Procedural high-resolution asphalt texture with bitumen grain and lane tire wear
    let asphaltTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const aCanvas = document.createElement('canvas');
      aCanvas.width = 256;
      aCanvas.height = 256;
      const actx = aCanvas.getContext('2d');
      if (actx) {
        actx.fillStyle = '#1c2027';
        actx.fillRect(0, 0, 256, 256);

        // Fine gravel noise
        for (let i = 0; i < 3200; i++) {
          const nx = Math.random() * 256;
          const ny = Math.random() * 256;
          const val = Math.floor(Math.random() * 32) + 24;
          actx.fillStyle = `rgba(${val + 10}, ${val + 12}, ${val + 16}, 0.35)`;
          actx.fillRect(nx, ny, 1.5, 1.5);
        }

        // Dark tire wear tracks along the 4 highway lanes
        const laneXPixels = [32, 96, 160, 224];
        for (const lx of laneXPixels) {
          for (const trackOffset of [-13, 13]) {
            const grad = actx.createLinearGradient(lx + trackOffset - 8, 0, lx + trackOffset + 8, 0);
            grad.addColorStop(0, 'rgba(15, 18, 22, 0)');
            grad.addColorStop(0.5, 'rgba(10, 12, 16, 0.45)');
            grad.addColorStop(1, 'rgba(15, 18, 22, 0)');
            actx.fillStyle = grad;
            actx.fillRect(lx + trackOffset - 8, 0, 16, 256);
          }
        }
      }
      asphaltTex = new THREE.CanvasTexture(aCanvas);
      asphaltTex.wrapS = THREE.RepeatWrapping;
      asphaltTex.wrapT = THREE.RepeatWrapping;
      asphaltTex.repeat.set(1, 8);
      asphaltTex.anisotropy = 4;
    }

    this.asphaltMaterial = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: asphaltTex ? 0xffffff : 0x1c2027,
      roughness: 0.76,
      metalness: 0.12,
    });

    this.laneMarkingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    this.shoulderLineMaterial = new THREE.MeshBasicMaterial({
      color: 0xf4a261,
    });

    this.twoWayYellowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb703,
    });

    this.roadStudGeo = new THREE.BoxGeometry(0.12, 0.04, 0.18);
    this.roadStudAmberMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa500,
    });

    const fwdArrowTex = typeof document !== 'undefined' ? RoadSegment.createForwardArrowTexture() : null;
    this.forwardArrowMaterial = new THREE.MeshBasicMaterial({
      map: fwdArrowTex,
      transparent: true,
      depthWrite: false,
    });

    const revArrowTex = typeof document !== 'undefined' ? RoadSegment.createReverseArrowTexture() : null;
    this.reverseArrowMaterial = new THREE.MeshBasicMaterial({
      map: revArrowTex,
      transparent: true,
      depthWrite: false,
    });

    const gantryRedTex = typeof document !== 'undefined' ? RoadSegment.createGantrySignalTexture(true) : null;
    this.gantrySignalRedMaterial = new THREE.MeshBasicMaterial({
      map: gantryRedTex,
    });

    const gantryGreenTex = typeof document !== 'undefined' ? RoadSegment.createGantrySignalTexture(false) : null;
    this.gantrySignalGreenMaterial = new THREE.MeshBasicMaterial({
      map: gantryGreenTex,
    });

    // Interlocking sidewalk paving stone texture
    let sidewalkTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const swCanvas = document.createElement('canvas');
      swCanvas.width = 128;
      swCanvas.height = 128;
      const swctx = swCanvas.getContext('2d');
      if (swctx) {
        swctx.fillStyle = '#9aa5b1';
        swctx.fillRect(0, 0, 128, 128);

        swctx.strokeStyle = '#616e7c';
        swctx.lineWidth = 2;
        for (let row = 0; row < 8; row++) {
          const y = row * 16;
          swctx.beginPath();
          swctx.moveTo(0, y);
          swctx.lineTo(128, y);
          swctx.stroke();

          const offset = (row % 2) * 16;
          for (let col = 0; col < 8; col++) {
            const x = col * 32 + offset;
            swctx.beginPath();
            swctx.moveTo(x, y);
            swctx.lineTo(x, y + 16);
            swctx.stroke();
          }
        }
      }
      sidewalkTex = new THREE.CanvasTexture(swCanvas);
      sidewalkTex.wrapS = THREE.RepeatWrapping;
      sidewalkTex.wrapT = THREE.RepeatWrapping;
      sidewalkTex.repeat.set(1, 16);
      sidewalkTex.anisotropy = 4;
    }

    this.sidewalkMaterial = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      color: sidewalkTex ? 0xffffff : 0x9aa5b1,
      roughness: 0.85,
      metalness: 0.08,
    });

    // Authentic red and white alternating racing & highway rumble curbs (kerb strips)
    let curbTexture: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const curbCanvas = document.createElement('canvas');
      curbCanvas.width = 64;
      curbCanvas.height = 128;
      const curbCtx = curbCanvas.getContext('2d');
      if (curbCtx) {
        // Red stripe
        curbCtx.fillStyle = '#d90429';
        curbCtx.fillRect(0, 0, 64, 64);
        // Bevel groove
        curbCtx.fillStyle = '#9e001c';
        curbCtx.fillRect(0, 60, 64, 4);
        // White stripe
        curbCtx.fillStyle = '#f8f9fa';
        curbCtx.fillRect(0, 64, 64, 64);
        // Bevel groove
        curbCtx.fillStyle = '#ced4da';
        curbCtx.fillRect(0, 124, 64, 4);
      }
      curbTexture = new THREE.CanvasTexture(curbCanvas);
      curbTexture.wrapS = THREE.RepeatWrapping;
      curbTexture.wrapT = THREE.RepeatWrapping;
      curbTexture.repeat.set(1, 15);
    }

    this.curbMaterial = new THREE.MeshStandardMaterial({
      map: curbTexture,
      color: curbTexture ? 0xffffff : 0xd90429,
      roughness: 0.65,
      metalness: 0.08,
    });

    // Photorealistic Lush Grass Terrain with diffuse & normal relief maps
    const grassDiffuse = typeof document !== 'undefined' ? RoadSegment.createGrassTexture() : null;
    const grassNormal = typeof document !== 'undefined' ? RoadSegment.createGrassNormalTexture() : null;
    this.grassMaterial = new THREE.MeshStandardMaterial({
      map: grassDiffuse,
      normalMap: grassNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.84,
      metalness: 0.04,
    });

    // Earthy highway roadside verge (banket) transition strip
    const dirtVergeTex = typeof document !== 'undefined' ? RoadSegment.createDirtVergeTexture() : null;
    this.dirtVergeMaterial = new THREE.MeshStandardMaterial({
      map: dirtVergeTex,
      roughness: 0.92,
      metalness: 0.02,
    });

    // 3D Volumetric Grass Blade Tufts & Wind Sway Shader
    this.grassTuftGeometry = RoadSegment.createGrassTuftGeometry();
    this.grassTuftMaterial = new THREE.MeshStandardMaterial({
      color: 0x48b066,
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    this.grassTuftMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = RoadSegment.waterUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position);
        float sway = sin(uTime * 3.2 + transformed.x * 1.2 + transformed.z * 0.8) * 0.14 * uv.y;
        transformed.x += sway;
        transformed.z += sway * 0.45;
        `
      );
    };

    // Colorful roadside wildflowers (Daisies, Poppies, Buttercups)
    this.wildflowerGeometry = RoadSegment.createWildflowerGeometry();
    this.daisyMaterial = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.55, side: THREE.DoubleSide });
    this.poppyMaterial = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.55, side: THREE.DoubleSide });
    this.buttercupMaterial = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.55, side: THREE.DoubleSide });

    // Photorealistic Animated Bosphorus Water with dual-frequency ripples and GPU Gerstner waves
    const waterNormalMap = typeof document !== 'undefined' ? RoadSegment.createWaterNormalTexture() : null;

    this.bosphorusWaterMaterial = new THREE.MeshStandardMaterial({
      color: 0x051d28,
      roughness: 0.1,
      metalness: 0.12,
      normalMap: waterNormalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });

    this.bosphorusWaterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = RoadSegment.waterUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\nvarying vec3 vWorldPos;\nvarying float vWaveHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec4 wPos = modelMatrix * vec4(position, 1.0);
        float wT = uTime * 2.2;
        float wave1 = sin(wPos.x * 0.06 + wT * 1.1) * cos(wPos.z * 0.04 + wT * 0.9) * 0.22;
        float wave2 = sin(wPos.x * 0.12 - wT * 1.6 + wPos.z * 0.09) * 0.10;
        float wave3 = cos((wPos.x + wPos.z) * 0.08 + wT * 0.7) * 0.06;
        float totalElevation = wave1 + wave2 + wave3;
        vec3 transformed = vec3(position);
        transformed.z += totalElevation;
        vWaveHeight = totalElevation;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vWorldPos;\nvarying float vWaveHeight;\n' + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec2 waterUv1 = vNormalMapUv * 4.0 + vec2(uTime * 0.03, uTime * 0.018);
          vec2 waterUv2 = vNormalMapUv * 7.5 + vec2(-uTime * 0.022, uTime * 0.035);
          vec3 mapN1 = texture2D( normalMap, waterUv1 ).xyz * 2.0 - 1.0;
          vec3 mapN2 = texture2D( normalMap, waterUv2 ).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(vec3((mapN1.xy + mapN2.xy) * normalScale, mapN1.z * 0.7));
          normal = normalize( tbn * mapN );
        #else
          #include <normal_fragment_maps>
        #endif

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(clamp(1.0 - dot(normal, viewDir), 0.0, 1.0), 3.8);
        vec3 deepBosphorus = vec3(0.016, 0.086, 0.125);
        vec3 skyHorizonReflect = vec3(0.106, 0.478, 0.600);
        vec3 crestColor = vec3(0.408, 0.761, 0.847);
        vec3 waterColor = mix(deepBosphorus, skyHorizonReflect, fresnel * 0.82);
        float crestFactor = smoothstep(0.12, 0.32, vWaveHeight);
        waterColor = mix(waterColor, crestColor, crestFactor * 0.35);

        // Sun sparkle highlight on wave crests
        vec3 sunDir = normalize(vec3(0.4, 0.8, -0.4));
        vec3 halfVec = normalize(sunDir + viewDir);
        float nDotH = max(dot(normal, halfVec), 0.0);
        float sunSparkle = pow(nDotH, 180.0) * 1.8;
        waterColor += vec3(1.0, 0.96, 0.85) * sunSparkle;

        diffuseColor.rgb = waterColor;
        `
      );
    };

    // Bridge Tower & Cables
    this.bridgeTowerMaterial = new THREE.MeshStandardMaterial({
      color: 0xd90429, // Iconic Red
      roughness: 0.45,
      metalness: 0.35,
    });

    this.bridgeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      roughness: 0.5,
    });

    this.bridgeCableMaterial = new THREE.MeshStandardMaterial({
      color: 0xced4da,
      metalness: 0.9,
      roughness: 0.2,
    });

    this.bridgePierMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d99ae, // Weathered concrete caisson
      roughness: 0.88,
      metalness: 0.1,
    });

    this.bridgeTrussMaterial = new THREE.MeshStandardMaterial({
      color: 0x495057,
      metalness: 0.75,
      roughness: 0.35,
    });

    const bridgeSignTex = typeof document !== 'undefined' ? RoadSegment.createBridgeSignTexture() : null;
    this.bridgeSignMaterial = new THREE.MeshBasicMaterial({
      map: bridgeSignTex,
    });

    const bridgeGantryTex = typeof document !== 'undefined' ? RoadSegment.createBridgePortalGantryTexture() : null;
    this.bridgeGantrySignMaterial = new THREE.MeshBasicMaterial({
      map: bridgeGantryTex,
    });

    this.gantryMaterial = new THREE.MeshStandardMaterial({
      color: 0x343a40,
      metalness: 0.75,
      roughness: 0.35,
    });

    // Ferry materials
    this.ferryHullMaterial = new THREE.MeshStandardMaterial({ color: 0x1b263b, roughness: 0.6 });
    this.ferryWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.ferryYellowMaterial = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.5 });
    this.ferryWindowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.ferryWakeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

    this.treeFoliageMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x40916c, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x52b788, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.9 }),
    ];

    this.treeTrunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x582f0e,
      roughness: 0.9,
    });

    // Distinctive Turkish Flora (Lush, multi-cluster, flowering)
    this.cypressMaterial = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.9 });
    this.judasFlowerMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xd63384, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0xcc2975, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0xad1457, roughness: 0.85 }),
    ];
    this.bushMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x38b000, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xc2185b, roughness: 0.85 }), // Bougainvillea magenta
      new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.85 }), // Broom yellow
    ];



    this.streetLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x333533,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.lightGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
    });

    // Avrasya & TEM Highway Tunnel Materials
    const tunnelWallTex = typeof document !== 'undefined' ? RoadSegment.createTunnelWallTexture() : null;
    const tunnelCeilingTex = typeof document !== 'undefined' ? RoadSegment.createTunnelCeilingTexture() : null;

    this.tunnelWallMaterial = new THREE.MeshStandardMaterial({
      map: tunnelWallTex,
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.12,
    });

    this.tunnelCeilingMaterial = new THREE.MeshStandardMaterial({
      map: tunnelCeilingTex,
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.08,
    });

    this.tunnelTubeLightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
    });

    this.tunnelEmergencyDoorMaterial = new THREE.MeshStandardMaterial({
      color: 0x00b4d8,
      roughness: 0.35,
    });

    this.tunnelFanMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b2d42,
      roughness: 0.45,
      metalness: 0.75,
    });

    // Maiden's Tower (Kız Kulesi) Materials
    this.maidensTowerStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      roughness: 0.72,
    });

    this.maidensTowerRoofMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.55,
      metalness: 0.35,
    });

    this.maidensTowerBeaconBeamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Infrastructure Materials (Pedestrian Overpass, SOS Bay, Streetlight Decals)
    this.overpassSteelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1d3557,
      roughness: 0.4,
      metalness: 0.65,
    });

    this.overpassGlassMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ecae6,
      transparent: true,
      opacity: 0.60,
      roughness: 0.12,
    });

    this.sosBayMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      roughness: 0.55,
    });

    let streetlightDecalTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const sCanvas = document.createElement('canvas');
      sCanvas.width = 128;
      sCanvas.height = 128;
      const sctx = sCanvas.getContext('2d');
      if (sctx) {
        const grad = sctx.createRadialGradient(64, 64, 2, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 235, 170, 0.80)');
        grad.addColorStop(0.35, 'rgba(255, 215, 130, 0.40)');
        grad.addColorStop(0.70, 'rgba(255, 190, 80, 0.12)');
        grad.addColorStop(1, 'rgba(255, 180, 50, 0)');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 128, 128);
      }
      streetlightDecalTex = new THREE.CanvasTexture(sCanvas);
    }
    this.streetlightGlowDecalMaterial = new THREE.MeshBasicMaterial({
      map: streetlightDecalTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Modern Highway Guardrail, Acoustic Sound Barrier & Roadside Materials
    this.guardrailSteelMaterial = new THREE.MeshStandardMaterial({
      color: 0xcfd5de,
      roughness: 0.32,
      metalness: 0.82,
    });

    this.guardrailPostMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a6372,
      roughness: 0.58,
      metalness: 0.68,
    });

    this.guardrailReflectorRedMaterial = new THREE.MeshBasicMaterial({
      color: 0xff1e27,
    });

    this.guardrailReflectorWhiteMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    this.drainageGrateMaterial = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.85,
      metalness: 0.60,
    });

    this.soundBarrierGlassMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.12,
      metalness: 0.18,
    });

    this.soundBarrierFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.75,
    });

    this.stonePineFoliageMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x123524, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0x18422e, roughness: 0.84 }),
      new THREE.MeshStandardMaterial({ color: 0x0e2b1d, roughness: 0.86 }),
    ];

    this.sosBoxOrangeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7700,
      roughness: 0.40,
    });

    // Regional Turkish Highway Materials
    this.spruceFoliageMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x0e2b1d, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x143b27, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x081f14, roughness: 0.90 }),
    ];
    this.rockWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x544f48,
      roughness: 0.95,
      metalness: 0.05,
    });
    this.boluValleyFloorMaterial = new THREE.MeshStandardMaterial({
      color: 0x183018,
      roughness: 0.90,
    });
    this.bozkirGrassMaterial = new THREE.MeshStandardMaterial({
      color: 0xb59e5f,
      roughness: 0.95,
    });
    this.bozkirDirtMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a724a,
      roughness: 0.95,
    });
    this.bozkirBushMaterial = new THREE.MeshStandardMaterial({
      color: 0x9c8e59,
      roughness: 0.90,
    });
    this.osmangaziBridgeTowerMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.65,
    });

    // Generate authentic Turkish green highway sign textures & billboards & km stones
    this.initHighwaySignMaterials();
    this.initExitSignMaterials();
    this.initBridgeGantrySignMaterials();
    this.initTunnelPortalMaterials();
    this.initBillboardMaterials();
    this.initKmStoneMaterial();
  }

  private static initHighwaySignMaterials(): void {
    if (typeof document === 'undefined') return;

    const envSignConfigs: Record<EnvironmentPreset, Array<{ line1: string; line2: string; sub: string }>> = {
      DAY: [ // 🛣️ E-5 Otobanı
        { line1: '15 TEMMUZ ŞEHİTLER KÖPRÜSÜ', line2: 'KADIKÖY - BEŞİKTAŞ | BOĞAZİÇİ', sub: 'HGS / OGS GİRİŞİ' },
        { line1: 'E-5 KARAYOLU (D100)', line2: 'MECİDİYEKÖY - LEVENT - MASLAK', sub: '70 KM/S - ELEKTRONİK DENETLEME (EDS)' },
        { line1: 'FATİH SULTAN MEHMET KÖPRÜSÜ', line2: 'TEM OTOYOLU | EDİRNE - ANKARA', sub: 'OTOYOL BAĞLANTISI' },
        { line1: 'İSTANBUL ÇEVRE YOLU (O-1)', line2: 'ÜSKÜDAR - ÇAMLICA - ALTUNİZADE', sub: 'HIZ KORİDORU KONTROL NOKTASI' },
      ],
      SUNSET: [ // 🌲 Anadolu Otoyolu (Bolu Dağı)
        { line1: 'BOLU DAĞI GEÇİŞİ', line2: 'RAKIM: 1577m • ZİNCİR TAKMA ALANI', sub: 'DİKKAT: SİS VE BUZLANMA TEHLİKESİ' },
        { line1: 'ANADOLU OTOYOLU (O-4)', line2: 'DÜZCE - BOLU - GEREDE - ANKARA', sub: 'OTOYOL HIZ SINIRI 130 KM/S' },
        { line1: 'ABANT MİLLİ PARKI', line2: 'YEDİGÖLLER MİLLİ PARKI AYRIMI', sub: 'DOĞA GÜZERGAHI ÇIKIŞI' },
        { line1: 'BOLU DAĞI VİYADÜKLERİ', line2: 'UZUNLUK 2272m • VİYADÜK GEÇİŞİ', sub: 'DİKKAT: ŞİDDETLİ YAN RÜZGAR' },
      ],
      NIGHT: [ // 🌾 Ankara - Niğde Otoyolu (Bozkır)
        { line1: 'ANKARA - NİĞDE OTOYOLU (O-21)', line2: "TÜRKİYE'NİN İLK AKILLI OTOYOLU", sub: 'AKILLI ULAŞIM SİSTEMİ (AUS) DEVREDE' },
        { line1: 'KAPADOKYA - GÖREME ÇIKIŞI', line2: 'AKSARAY - DERİNKUYU - NEVŞEHİR', sub: 'IHLARA VADİSİ BAĞLANTISI' },
        { line1: 'O-21 AKILLI SİSTEM MERKEZİ', line2: 'HIZ SINIRI: 140 KM/S • IOT RADAR', sub: 'ANLIK BUZLANMA & SİS SENSÖRLERİ' },
        { line1: 'KONYA - ADANA OTOYOL AYRIMI', line2: 'GÜNEY KORİDORU BAĞLANTISI', sub: 'AKILLI OTOYOL GİRİŞİ' },
      ],
      RAIN: [ // 🌧️ İstanbul - İzmir Otoyolu (Osmangazi)
        { line1: 'İSTANBUL - İZMİR OTOYOLU (O-5)', line2: 'BURSA - BALIKESİR - MANİSA - İZMİR', sub: 'OTOYOL A.Ş. İŞLETMESİ' },
        { line1: 'OSMANGAZİ KÖPRÜSÜ GEÇİŞİ', line2: 'İZMİT KÖRFEZİ • 4. EN UZUN ASMA KÖPRÜ', sub: 'OTOMATİK GEÇİŞ HGS / OGS' },
        { line1: 'GEBZE - ORHANGAZİ BAĞLANTISI', line2: 'SAMANLI DAĞLARI • YALOVA ÇIKIŞI', sub: 'YAĞIŞTA TAKİP MESAFESİNİ KORUYUN' },
        { line1: 'OKSİJEN DİNLENME TESİSLERİ', line2: 'O-3 OKSİJEN ALIŞVERİŞ VE YAŞAM', sub: '2 KM İLERİDE SAĞDA' },
      ],
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const list: THREE.MeshBasicMaterial[] = [];
      const configs = envSignConfigs[p];
      for (const cfg of configs) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#007f3d';
          ctx.fillRect(0, 0, 512, 160);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 10;
          ctx.strokeRect(8, 8, 496, 144);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(16, 16, 480, 128);

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 28px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cfg.line1, 256, 52);

          ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
          ctx.fillText(cfg.line2, 256, 92);

          ctx.fillStyle = '#ffcc00';
          ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
          ctx.fillText(`⚡ ${cfg.sub} ⚡`, 256, 130);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        list.push(new THREE.MeshBasicMaterial({ map: texture }));
      }
      this.signMaterialsMap.set(p, list);
    }
    this.signMaterials = this.signMaterialsMap.get('DAY') || [];
  }

  private static initExitSignMaterials(): void {
    if (typeof document === 'undefined') return;

    const envExitConfigs: Record<EnvironmentPreset, Array<{ badge: string; line1: string; line2: string; sub?: string }>> = {
      DAY: [ // E-5
        { badge: 'K12 ÇIKIŞ / EXIT 500m', line1: 'Kadıköy • Üsküdar', line2: 'Havalimanı ✈' },
        { badge: 'K8 ÇIKIŞ / EXIT 1000m', line1: 'Beşiktaş • Levent', line2: 'Maslak • Sarıyer' },
        { badge: 'TEM OTOYOL AYRIMI', line1: 'Edirne • Ankara', line2: 'Çamlıca Bağlantısı' },
        { badge: 'O-7 KUZEY MARMARA', line1: 'İstanbul Havalimanı ✈', line2: 'YSS Köprüsü' },
      ],
      SUNSET: [ // Bolu Dağı
        { badge: 'K19 ÇIKIŞ / 1000m', line1: 'Abant Tabiat Parkı', line2: 'Mudurnu • Taşkesti' },
        { badge: 'K21 ÇIKIŞ / 500m', line1: 'Bolu (Batı) • Yedigöller', line2: 'Gerede Ayrımı' },
        { badge: 'BOLU DAĞI HİZMET ALANI', line1: 'Et Mangal & Dinlenme', line2: 'Akaryakıt ⛽ • 500m' },
        { badge: 'K17 ÇIKIŞ / DÜZCE', line1: 'Kaynaşlı • Akçakoca', line2: 'Karadeniz Sahil Yolu' },
      ],
      NIGHT: [ // Ankara - Niğde
        { badge: 'K5 ÇIKIŞ / 1500m', line1: 'Şereflikoçhisar • Tuz Gölü', line2: 'Aksaray Çıkışı' },
        { badge: 'K9 ÇIKIŞ / KAPADOKYA', line1: 'Nevşehir • Göreme', line2: 'Ihlara Vadisi 🎈' },
        { badge: 'K14 ÇIKIŞ / NİĞDE', line1: 'Niğde Organize Sanayi', line2: 'Ulukışla • Adana' },
        { badge: 'AKILLI DİNLENME ALANI', line1: 'Trugo 180kW Şarj ⚡', line2: '7/24 Kesintisiz Hizmet' },
      ],
      RAIN: [ // İstanbul - İzmir
        { badge: 'K3 ÇIKIŞ / 500m', line1: 'Osmangazi Köprüsü', line2: 'Yalova • Bursa ↗' },
        { badge: 'K7 ÇIKIŞ / ORHANGAZİ', line1: 'İznik Gölü • Gemlik', line2: 'Serbest Bölge Liman' },
        { badge: 'K12 ÇIKIŞ / BALIKESİR', line1: 'Balıkesir (Kuzey)', line2: 'Edremit • Ayvalık ⚓' },
        { badge: 'OKSİJEN O-3 ÇIKIŞI', line1: 'Dinlenme & Yaşam Merkezi', line2: 'Alışveriş • Mola Yeri' },
      ],
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const list: THREE.MeshBasicMaterial[] = [];
      const configs = envExitConfigs[p];
      for (const cfg of configs) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#00539c';
          ctx.fillRect(0, 0, 512, 256);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 10;
          ctx.strokeRect(8, 8, 496, 240);

          ctx.fillStyle = '#ffbe0b';
          ctx.fillRect(14, 14, 484, 52);

          ctx.fillStyle = '#111827';
          ctx.font = '900 24px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cfg.badge, 256, 40);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(cfg.line1, 36, 115);

          ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
          ctx.fillText(cfg.line2, 36, 165);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('↗', 476, 150);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(24, 204, 464, 32);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cfg.sub || 'OTOYOL SERVİS ALANI • OGS / HGS', 256, 225);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        list.push(new THREE.MeshBasicMaterial({ map: texture }));
      }
      this.exitSignMaterialsMap.set(p, list);
    }
    this.exitSignMaterials = this.exitSignMaterialsMap.get('DAY') || [];
  }

  private static createBridgeSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, 512, 96);

      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 500, 84);

      // Turkish Flag on the left
      ctx.fillStyle = '#e63946';
      ctx.fillRect(18, 16, 75, 54);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(48, 43, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(53, 43, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(64, 43, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 25px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('15 TEMMUZ ŞEHİTLER KÖPRÜSÜ', 110, 36);

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('İSTANBUL BOĞAZI  •  BOSPHORUS STRAIT', 112, 66);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    return tex;
  }

  private static createBridgePortalGantryTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, 512, 128);

      ctx.strokeStyle = '#ffbe0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 504, 120);

      ctx.fillStyle = '#ffbe0b';
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('15 TEMMUZ ŞEHİTLER KÖPRÜSÜ GİRİŞİ', 256, 36);

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
      ctx.fillText('↓          ↓          ↓          ↓', 256, 82);

      ctx.fillStyle = '#8ecae6';
      ctx.font = '13px "Segoe UI", Arial, sans-serif';
      ctx.fillText('OGS / HGS OTOMATİK GEÇİŞ - İYİ YOLCULUKLAR', 256, 112);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private static initBridgeGantrySignMaterials(): void {
    if (typeof document === 'undefined') return;

    const gantryConfigs: Record<EnvironmentPreset, { title: string; sub: string; border: string }> = {
      DAY: {
        title: '15 TEMMUZ ŞEHİTLER KÖPRÜSÜ GİRİŞİ',
        sub: 'OGS / HGS OTOMATİK GEÇİŞ - İYİ YOLCULUKLAR',
        border: '#ffbe0b',
      },
      SUNSET: {
        title: 'BOLU DAĞI 1. VİYADÜĞÜ GİRİŞİ',
        sub: 'UZUNLUK: 2272m • DİKKAT: ŞİDDETLİ YAN RÜZGAR',
        border: '#ff9f1c',
      },
      NIGHT: {
        title: 'O-21 BOZKIR VİYADÜĞÜ GİRİŞİ',
        sub: 'AKILLI OTOYOL KONTROL NOKTASI • HIZ SINIRI 140 KM/S',
        border: '#00f0ff',
      },
      RAIN: {
        title: 'OSMANGAZİ KÖPRÜSÜ GİRİŞİ',
        sub: 'İZMİT KÖRFEZ GEÇİŞİ • YAĞIŞTA TAKİP MESAFESİNİ KORUYUN',
        border: '#38bdf8',
      },
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const cfg = gantryConfigs[p];
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#080c16';
        ctx.fillRect(0, 0, 512, 128);

        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 504, 120);

        ctx.fillStyle = cfg.border;
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.title, 256, 36);

        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        ctx.fillText('↓          ↓          ↓          ↓', 256, 82);

        ctx.fillStyle = '#8ecae6';
        ctx.font = '13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(cfg.sub, 256, 112);
      }
      const tex = new THREE.CanvasTexture(canvas);
      this.bridgeGantrySignMaterialsMap.set(p, new THREE.MeshBasicMaterial({ map: tex }));
    }
  }

  private static initTunnelPortalMaterials(): void {
    if (typeof document === 'undefined') return;

    const portalConfigs: Record<EnvironmentPreset, { title: string; sub: string; border: string; accent: string }> = {
      DAY: {
        title: 'AVRASYA TÜNELİ',
        sub: 'HIZ SINIRI: 70 KM/S • RADAR EDS',
        border: '#38bdf8',
        accent: '#38bdf8',
      },
      SUNSET: {
        title: 'BOLU DAĞI TÜNELİ',
        sub: 'UZUNLUK: 3125m • ASGARİ TAKİP MESAFESİ 50m',
        border: '#ff9f1c',
        accent: '#ffd166',
      },
      NIGHT: {
        title: 'O-21 AKILLI OTOYOL TÜNELİ',
        sub: 'HIZ SINIRI: 110 KM/S • AKILLI GÜVENLİK SİSTEMİ',
        border: '#00f0ff',
        accent: '#00ff88',
      },
      RAIN: {
        title: 'ORHANGAZİ (SAMANLI) TÜNELİ',
        sub: 'UZUNLUK: 3591m • İSTANBUL-İZMİR OTOYOLU (O-5)',
        border: '#818cf8',
        accent: '#a5b4fc',
      },
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const cfg = portalConfigs[p];
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = 4;
        ctx.strokeRect(6, 6, 500, 84);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 30px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.title, 256, 42);
        ctx.fillStyle = cfg.accent;
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillText(cfg.sub, 256, 74);
      }
      const portalTex = new THREE.CanvasTexture(canvas);
      this.tunnelPortalMaterialsMap.set(p, new THREE.MeshBasicMaterial({ map: portalTex }));
    }
  }

  private static initBillboardMaterials(): void {
    if (typeof document === 'undefined') return;

    const envBillboardConfigs: Record<EnvironmentPreset, Array<{
      header: string;
      sub: string;
      badge: string;
      bg: string;
      textColor: string;
      accent: string;
    }>> = {
      DAY: [ // E-5
        { header: 'TÜRK HAVA YOLLARI', sub: 'WIDEN YOUR WORLD', badge: '✈ TURKISH AIRLINES', bg: '#c9182b', textColor: '#ffffff', accent: '#ffffff' },
        { header: 'İSTANBUL BOĞAZI', sub: 'İKİ KITAYI BİRLEŞTİREN ŞEHİR', badge: '⚓ HOŞ GELDİNİZ', bg: '#0077b6', textColor: '#ffffff', accent: '#90e0ef' },
        { header: 'TRAFİKTE DİKKAT HAYAT KURTARIR', sub: 'EMNİYET KEMERİNİZİ TAKINIZ', badge: '⚠ 112 ACİL ÇAĞRI', bg: '#14213d', textColor: '#fca311', accent: '#ffffff' },
        { header: "TÜRKİYE'NİN OTOMOBİLİ - TOGG", sub: 'DOĞUŞTAN ELEKTRİKLİ T10X', badge: '⚡ YOLCULUK BAŞLASIN', bg: '#03045e', textColor: '#00f5d4', accent: '#caf0f8' },
        { header: 'EDS ORTALAMA HIZ KORİDORU', sub: '70 KM/S - GÜVENLİ SÜRÜŞ', badge: '📷 RADAR DENETİMİ', bg: '#2b2d42', textColor: '#edf2f4', accent: '#d90429' },
      ],
      SUNSET: [ // Bolu Dağı
        { header: 'BOLU DAĞI MEŞHUR ET MANGAL', sub: 'KÖFTE • SUCUK • YAYIK AYRANI', badge: '🥩 500m İLERİDE SAĞDA', bg: '#4a1515', textColor: '#ffffff', accent: '#ffd166' },
        { header: 'ABANT DOĞA VE TERMAL OTEL', sub: 'MİLLİ PARK GİRİŞİNDE HUZUR', badge: '🌲 ABANT ÇIKIŞI', bg: '#133926', textColor: '#ffffff', accent: '#95d5b2' },
        { header: 'ORMANLARIMIZI KORUYALIM', sub: 'GELECEĞE NEFES OL - OGM', badge: '🍃 YEŞİL TÜRKİYE', bg: '#1b4332', textColor: '#d8f3dc', accent: '#52b788' },
        { header: 'BOLU ÇİKOLATASI & FINDIĞI', sub: 'DOĞAL YÖRESEL LEZZETLER', badge: '🍫 YOL ÜSTÜ DURAĞI', bg: '#3d2614', textColor: '#fefae0', accent: '#dda15e' },
        { header: 'KIŞ LASTİĞİ VE ZİNCİR', sub: 'ZORUNLU KIŞ EKİPMANI TAŞIYIN', badge: '❄ BOLU GEÇİDİ', bg: '#1d2d44', textColor: '#e0e1dd', accent: '#748cab' },
      ],
      NIGHT: [ // Ankara - Niğde
        { header: "O-21 AKILLI OTOYOL", sub: "TÜRKİYE'NİN DİJİTAL OTOYOLU", badge: '🚀 AUS TEKNOLOJİSİ', bg: '#0b132b', textColor: '#48cae4', accent: '#00b4d8' },
        { header: 'KAPADOKYA GÖREME BALON TURLARI', sub: 'GÜN DOĞUMUNDA PERİ BACALARI', badge: '🎈 KAPADOKYA ÇIKIŞI', bg: '#2a1a4e', textColor: '#ffffff', accent: '#f72585' },
        { header: 'ASELSAN AKILLI ULAŞIM', sub: 'GÜVENLİ VE HIZLI OTOYOL SİSTEMLERİ', badge: '🛡️ MİLLİ TEKNOLOJİ', bg: '#0d1b2a', textColor: '#e0e1dd', accent: '#415a77' },
        { header: 'TRUGO ULTRA HIZLI ŞARJ', sub: '180 kW YÜKSEK HIZLI ŞARJ İSTASYONU', badge: '⚡ TRUGO AĞI', bg: '#003049', textColor: '#669bbc', accent: '#fdf0d5' },
        { header: 'UYKUSUZ YOLA ÇIKMAYINIZ', sub: '2 SAATTE BİR 15 DAKİKA MOLA', badge: '☕ DİNLENME ALANI', bg: '#1b1b1b', textColor: '#fca311', accent: '#ffffff' },
      ],
      RAIN: [ // İstanbul - İzmir
        { header: 'OKSİJEN O-3 DİNLENME MERKEZİ', sub: 'ALIŞVERİŞ • LEZZET • AKARYAKIT', badge: '🛒 OKSİJEN OTOYOL', bg: '#003566', textColor: '#ffc300', accent: '#ffd60a' },
        { header: 'İSTANBUL - İZMİR 3.5 SAAT', sub: 'OTOYOL A.Ş. İLE KESİNTİSİZ YOLCULUK', badge: '🛣️ O-5 KORİDORU', bg: '#001d3d', textColor: '#ffffff', accent: '#00b4d8' },
        { header: 'BURSA MEŞHUR İSKENDER', sub: 'BURSA VE BALIKESİR ÇIKIŞLARINDA', badge: '🍽️ DAMAK TADI', bg: '#780000', textColor: '#fdf0d5', accent: '#c1121f' },
        { header: 'SHELL V-POWER DURAĞI', sub: 'KALİTELİ YAKIT VE GENİŞ MARKET', badge: '⛽ SHELL OKSİJEN', bg: '#ffb703', textColor: '#d90429', accent: '#023047' },
        { header: 'YAĞIŞTA TAKİP MESAFESİ', sub: 'ISLAK ZEMİNDE HIZINIZI DÜŞÜRÜNÜZ', badge: '🌧️ GÜVENLİ SÜRÜŞ', bg: '#1f2421', textColor: '#dce1de', accent: '#9cc5a1' },
      ],
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const list: THREE.MeshStandardMaterial[] = [];
      const configs = envBillboardConfigs[p];
      for (const cfg of configs) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = cfg.bg;
          ctx.fillRect(0, 0, 512, 256);

          ctx.strokeStyle = cfg.accent;
          ctx.lineWidth = 8;
          ctx.strokeRect(10, 10, 492, 236);

          ctx.fillStyle = cfg.accent;
          ctx.fillRect(26, 24, 210, 36);
          ctx.fillStyle = cfg.bg;
          ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
          ctx.fillText(cfg.badge, 36, 49);

          ctx.fillStyle = cfg.textColor;
          ctx.font = '900 28px "Segoe UI", Arial, sans-serif';
          ctx.fillText(cfg.header, 26, 120);

          ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = cfg.accent;
          ctx.fillText(cfg.sub, 26, 175);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        list.push(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.4,
            metalness: 0.2,
          })
        );
      }
      this.billboardMaterialsMap.set(p, list);
    }
    this.billboardMaterials = this.billboardMaterialsMap.get('DAY') || [];
  }

  private static initKmStoneMaterial(): void {
    if (typeof document === 'undefined') return;

    const kmConfigs: Record<EnvironmentPreset, { otoyol: string; km: string }> = {
      DAY: { otoyol: 'O-1', km: '34' },
      SUNSET: { otoyol: 'O-4', km: '218' },
      NIGHT: { otoyol: 'O-21', km: '145' },
      RAIN: { otoyol: 'O-5', km: '56' },
    };

    const presets: EnvironmentPreset[] = ['DAY', 'SUNSET', 'NIGHT', 'RAIN'];
    for (const p of presets) {
      const cfg = kmConfigs[p];
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 128, 256);

        ctx.fillStyle = '#d90429';
        ctx.fillRect(0, 0, 128, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KGM', 64, 42);

        ctx.fillStyle = '#111111';
        ctx.font = 'bold 26px Arial, sans-serif';
        ctx.fillText(cfg.otoyol, 64, 110);
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(cfg.km, 64, 160);
        ctx.font = 'bold 26px Arial, sans-serif';
        ctx.fillStyle = '#d90429';
        ctx.fillText('KM', 64, 215);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
      });
      this.kmStoneMaterialsMap.set(p, mat);
    }
    this.kmStoneMaterial = this.kmStoneMaterialsMap.get('DAY')!;
  }

  private buildSegment(): void {
    const totalRoadWidth = laneSystem.getTotalRoadWidth();
    const halfRoad = totalRoadWidth / 2;
    const shoulderWidth = laneSystem.shoulderWidth;
    const roadBoundaryX = halfRoad + shoulderWidth;
    const segLength = this.length;

    // 1. Main Asphalt Surface
    const asphaltGeo = new THREE.PlaneGeometry(totalRoadWidth, segLength);
    const asphalt = new THREE.Mesh(asphaltGeo, RoadSegment.asphaltMaterial);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0, segLength / 2);
    asphalt.receiveShadow = true;
    this.roadBaseGroup.add(asphalt);

    // 2. Yellow Outer Shoulder Lines
    const shoulderLineGeo = new THREE.PlaneGeometry(0.2, segLength);
    const leftShoulder = new THREE.Mesh(shoulderLineGeo, RoadSegment.shoulderLineMaterial);
    leftShoulder.rotation.x = -Math.PI / 2;
    leftShoulder.position.set(-halfRoad + 0.15, 0.01, segLength / 2);
    this.roadBaseGroup.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderLineGeo, RoadSegment.shoulderLineMaterial);
    rightShoulder.rotation.x = -Math.PI / 2;
    rightShoulder.position.set(halfRoad - 0.15, 0.01, segLength / 2);
    this.roadBaseGroup.add(rightShoulder);

    // 3. Lane Divider Lines & Center Median
    const dashLength = 4.0;
    const dashGap = 4.0;
    const dashesCount = Math.floor(segLength / (dashLength + dashGap));
    const dashGeo = new THREE.PlaneGeometry(0.18, dashLength);

    this.oneWayCenterLineGroup = new THREE.Group();
    this.oneWayCenterLineGroup.name = 'OneWayCenterLineGroup';
    this.twoWayDividerGroup = new THREE.Group();
    this.twoWayDividerGroup.name = 'TwoWayDividerGroup';
    this.roadBaseGroup.add(this.oneWayCenterLineGroup);
    this.roadBaseGroup.add(this.twoWayDividerGroup);

    for (let l = 1; l < laneSystem.laneCount; l++) {
      const lineX = -halfRoad + l * laneSystem.laneWidth;
      const isCenterDivider = l === 2;

      if (!isCenterDivider) {
        const instDashes = new THREE.InstancedMesh(dashGeo, RoadSegment.laneMarkingMaterial, dashesCount);
        const dummy = new THREE.Object3D();
        dummy.rotation.x = -Math.PI / 2;
        for (let d = 0; d < dashesCount; d++) {
          const dashZ = d * (dashLength + dashGap) + dashLength / 2;
          dummy.position.set(lineX, 0.01, dashZ);
          dummy.updateMatrix();
          instDashes.setMatrixAt(d, dummy.matrix);
        }
        instDashes.instanceMatrix.needsUpdate = true;
        this.roadBaseGroup.add(instDashes);
      } else {
        const instCenterDashes = new THREE.InstancedMesh(dashGeo, RoadSegment.laneMarkingMaterial, dashesCount);
        const dummy = new THREE.Object3D();
        dummy.rotation.x = -Math.PI / 2;
        for (let d = 0; d < dashesCount; d++) {
          const dashZ = d * (dashLength + dashGap) + dashLength / 2;
          dummy.position.set(lineX, 0.01, dashZ);
          dummy.updateMatrix();
          instCenterDashes.setMatrixAt(d, dummy.matrix);
        }
        instCenterDashes.instanceMatrix.needsUpdate = true;
        this.oneWayCenterLineGroup.add(instCenterDashes);

        const doubleYellowGeo = new THREE.PlaneGeometry(0.14, segLength);
        const leftYellow = new THREE.Mesh(doubleYellowGeo, RoadSegment.twoWayYellowMaterial);
        leftYellow.rotation.x = -Math.PI / 2;
        leftYellow.position.set(-0.13, 0.012, segLength / 2);
        this.twoWayDividerGroup.add(leftYellow);

        const rightYellow = new THREE.Mesh(doubleYellowGeo, RoadSegment.twoWayYellowMaterial);
        rightYellow.rotation.x = -Math.PI / 2;
        rightYellow.position.set(0.13, 0.012, segLength / 2);
        this.twoWayDividerGroup.add(rightYellow);

        const studCount = Math.floor(segLength / 3.5);
        const instStuds = new THREE.InstancedMesh(RoadSegment.roadStudGeo, RoadSegment.roadStudAmberMaterial, studCount);
        const dummyStud = new THREE.Object3D();
        for (let s = 0; s < studCount; s++) {
          dummyStud.position.set(0, 0.03, s * 3.5 + 1.75);
          dummyStud.updateMatrix();
          instStuds.setMatrixAt(s, dummyStud.matrix);
        }
        instStuds.instanceMatrix.needsUpdate = true;
        this.twoWayDividerGroup.add(instStuds);

        const del1 = RoadSegment.createDelineatorPost();
        del1.position.set(0, 0, 7.5);
        this.twoWayDividerGroup.add(del1);

        const del2 = RoadSegment.createDelineatorPost();
        del2.position.set(0, 0, 22.5);
        this.twoWayDividerGroup.add(del2);

        const arrowGeo = new THREE.PlaneGeometry(1.9, 4.4);
        const fwdArrow0 = new THREE.Mesh(arrowGeo, RoadSegment.forwardArrowMaterial);
        fwdArrow0.rotation.set(-Math.PI / 2, 0, Math.PI);
        fwdArrow0.position.set(laneSystem.getLaneX(0), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(fwdArrow0);

        const fwdArrow1 = new THREE.Mesh(arrowGeo, RoadSegment.forwardArrowMaterial);
        fwdArrow1.rotation.set(-Math.PI / 2, 0, Math.PI);
        fwdArrow1.position.set(laneSystem.getLaneX(1), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(fwdArrow1);

        const revArrow2 = new THREE.Mesh(arrowGeo, RoadSegment.reverseArrowMaterial);
        revArrow2.rotation.set(-Math.PI / 2, 0, Math.PI);
        revArrow2.position.set(laneSystem.getLaneX(2), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(revArrow2);

        const revArrow3 = new THREE.Mesh(arrowGeo, RoadSegment.reverseArrowMaterial);
        revArrow3.rotation.set(-Math.PI / 2, 0, Math.PI);
        revArrow3.position.set(laneSystem.getLaneX(3), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(revArrow3);
      }
    }

    // Cat-eye highway reflectors
    const studSpacing = 6;
    const studsPerLine = Math.floor(segLength / studSpacing);
    const lineXPositions = [
      -halfRoad + 0.25,
      (laneSystem.getLaneX(0) + laneSystem.getLaneX(1)) / 2,
      0,
      (laneSystem.getLaneX(2) + laneSystem.getLaneX(3)) / 2,
      halfRoad - 0.25,
    ];
    const totalStuds = studsPerLine * lineXPositions.length;
    const reflectorGeo = new THREE.BoxGeometry(0.14, 0.05, 0.20);
    const reflectorMat = new THREE.MeshBasicMaterial({ color: 0xfff2a6 });
    const instReflectors = new THREE.InstancedMesh(reflectorGeo, reflectorMat, totalStuds);
    const dummyRefl = new THREE.Object3D();
    let rIdx = 0;
    for (let r = 0; r < studsPerLine; r++) {
      const refZ = r * studSpacing + studSpacing / 2;
      for (const lx of lineXPositions) {
        dummyRefl.position.set(lx, 0.04, refZ);
        dummyRefl.updateMatrix();
        instReflectors.setMatrixAt(rIdx++, dummyRefl.matrix);
      }
    }
    instReflectors.instanceMatrix.needsUpdate = true;
    this.roadBaseGroup.add(instReflectors);

    // 4. Concrete Shoulders / Curbs
    const curbGeo = new THREE.BoxGeometry(shoulderWidth, 0.2, segLength);
    const leftCurb = new THREE.Mesh(curbGeo, RoadSegment.curbMaterial);
    leftCurb.position.set(-halfRoad - shoulderWidth / 2, 0.08, segLength / 2);
    leftCurb.receiveShadow = true;
    this.roadBaseGroup.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, RoadSegment.curbMaterial);
    rightCurb.position.set(halfRoad + shoulderWidth / 2, 0.08, segLength / 2);
    rightCurb.receiveShadow = true;
    this.roadBaseGroup.add(rightCurb);

    // 5. Modern Corrugated W-Beam Guardrails, I-Beam Posts, Reflectors & Drainage Grates
    this.addModernGuardrail(halfRoad, shoulderWidth, segLength);

    // 6. Theme specific layout per Turkish Highway preset
    this.buildThemeElements(roadBoundaryX, segLength);
  }

  private buildThemeElements(roadBoundaryX: number, segLength: number): void {
    const env: EnvironmentPreset = gameState.currentEnvironment || 'DAY';

    if (this.isBridge) {
      if (env === 'DAY') {
        // E-5 OTOBANI (15 Temmuz Şehitler Köprüsü / Boğaziçi)
        this.addBosphorusWater(roadBoundaryX, segLength);
        this.addSuspensionBridgeTower(roadBoundaryX, segLength);
        this.addMaidensTower(roadBoundaryX, segLength);
        this.setupBosphorusShip();
      } else if (env === 'SUNSET') {
        // ANADOLU OTOYOLU (Bolu Dağı 1. Viyadüğü)
        this.addBoluViaduct(roadBoundaryX, segLength);
      } else if (env === 'NIGHT') {
        // ANKARA - NİĞDE OTOYOLU (O-21 Bozkır Viyadüğü)
        this.addBozkirViaduct(roadBoundaryX, segLength);
      } else {
        // İSTANBUL - İZMİR OTOYOLU (Osmangazi Köprüsü Körfez Geçişi)
        this.addOsmangaziBridge(roadBoundaryX, segLength);
      }
    } else if (this.isTunnel) {
      // Highway Tunnel (Avrasya / Bolu Dağı / O-21 / Samanlı)
      this.buildTunnel(roadBoundaryX, segLength, env);
    } else {
      // Open Highway Corridor
      if (env === 'DAY') {
        // E-5 METROPOLITAN CORRIDOR
        this.addGrassTerrain(roadBoundaryX, segLength);
        this.addRoadsideScenery(roadBoundaryX, segLength);
        const signIndex = this.segmentIndex % (RoadSegment.signMaterialsMap.get('DAY')?.length || 4);
        this.addHighwayGantry(roadBoundaryX, segLength * 0.65, signIndex, 'DAY');

        const cycle = this.segmentIndex % 4;
        if (cycle === 0) {
          this.addPedestrianOverpass(roadBoundaryX, segLength * 0.4);
        } else if (cycle === 2) {
          this.addEmergencyBay(roadBoundaryX, segLength * 0.5);
        }
      } else if (env === 'SUNSET') {
        // BOLU DAĞI ALPINE CORRIDOR
        this.addBoluAlpineTerrain(roadBoundaryX, segLength);
        this.addBoluAlpineScenery(roadBoundaryX, segLength);
        const signIndex = this.segmentIndex % (RoadSegment.signMaterialsMap.get('SUNSET')?.length || 4);
        this.addHighwayGantry(roadBoundaryX, segLength * 0.65, signIndex, 'SUNSET');

        if (this.segmentIndex % 4 === 2) {
          this.addEmergencyBay(roadBoundaryX, segLength * 0.5);
        }
      } else if (env === 'NIGHT') {
        // ANKARA - NİĞDE BOZKIR CORRIDOR
        this.addBozkirTerrain(roadBoundaryX, segLength);
        this.addBozkirScenery(roadBoundaryX, segLength);
        const signIndex = this.segmentIndex % (RoadSegment.signMaterialsMap.get('NIGHT')?.length || 4);
        this.addHighwayGantry(roadBoundaryX, segLength * 0.65, signIndex, 'NIGHT');

        if (this.segmentIndex % 4 === 2) {
          this.addEmergencyBay(roadBoundaryX, segLength * 0.5);
        }
      } else {
        // İSTANBUL - İZMİR OTOYOL CORRIDOR
        this.addIzmirOtoyolTerrain(roadBoundaryX, segLength);
        this.addIzmirOtoyolScenery(roadBoundaryX, segLength);
        const signIndex = this.segmentIndex % (RoadSegment.signMaterialsMap.get('RAIN')?.length || 4);
        this.addHighwayGantry(roadBoundaryX, segLength * 0.65, signIndex, 'RAIN');

        const cycle = this.segmentIndex % 4;
        if (cycle === 0) {
          this.addPedestrianOverpass(roadBoundaryX, segLength * 0.4);
        } else if (cycle === 2) {
          this.addEmergencyBay(roadBoundaryX, segLength * 0.5);
        }
      }
    }

    // Streetlights along highway (only outside tunnel!)
    if (!this.isTunnel) {
      const lightSpacing = 30;
      const lightsCount = Math.floor(segLength / lightSpacing);
      for (let i = 0; i < lightsCount; i++) {
        const zOffset = i * lightSpacing + lightSpacing / 2;
        this.addStreetLight(-roadBoundaryX - 0.4, zOffset, false);
        this.addStreetLight(roadBoundaryX + 0.4, zOffset, true);
      }
    }
  }

  // --- BOSPHORUS BRIDGE & WATER PROCEDURAL GEOMETRY ---

  private addBosphorusWater(roadBoundaryX: number, segLength: number): void {
    const waterWidth = 260;
    if (!RoadSegment.waterGeometry) {
      RoadSegment.waterGeometry = new THREE.PlaneGeometry(waterWidth, segLength, 36, 24);
    }
    const leftWater = new THREE.Mesh(RoadSegment.waterGeometry, RoadSegment.bosphorusWaterMaterial);
    leftWater.rotation.x = -Math.PI / 2;
    leftWater.position.set(-roadBoundaryX - waterWidth / 2, -1.2, segLength / 2);
    this.bridgeMeshGroup.add(leftWater);

    const rightWater = new THREE.Mesh(RoadSegment.waterGeometry, RoadSegment.bosphorusWaterMaterial);
    rightWater.rotation.x = -Math.PI / 2;
    rightWater.position.set(roadBoundaryX + waterWidth / 2, -1.2, segLength / 2);
    this.bridgeMeshGroup.add(rightWater);
  }

  private addSuspensionBridgeTower(roadBoundaryX: number, segLength: number): void {
    const towerGroup = new THREE.Group();
    const towerZ = segLength / 2;
    towerGroup.position.set(0, 0, towerZ);

    const pylonHeight = 48.0;
    const pylonX = roadBoundaryX + 3.2;
    const crossSpan = pylonX * 2;

    // 1. Concrete Caisson Foundations
    const pierGeo = new THREE.BoxGeometry(4.4, 5.5, 6.6);
    const leftPier = new THREE.Mesh(pierGeo, RoadSegment.bridgePierMaterial);
    leftPier.position.set(-pylonX, -1.0, 0);
    towerGroup.add(leftPier);

    const rightPier = new THREE.Mesh(pierGeo, RoadSegment.bridgePierMaterial);
    rightPier.position.set(pylonX, -1.0, 0);
    towerGroup.add(rightPier);

    const marineLightGeo = new THREE.SphereGeometry(0.40, 8, 8);
    const leftMarineLight = new THREE.Mesh(marineLightGeo, new THREE.MeshBasicMaterial({ color: 0xff1e00 }));
    leftMarineLight.position.set(-pylonX, 2.0, 3.1);
    towerGroup.add(leftMarineLight);

    const rightMarineLight = new THREE.Mesh(marineLightGeo, new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
    rightMarineLight.position.set(pylonX, 2.0, 3.1);
    towerGroup.add(rightMarineLight);

    // 2. Red Steel Pylons
    const lowerPylonGeo = new THREE.BoxGeometry(2.4, 24.0, 3.0);
    const leftLower = new THREE.Mesh(lowerPylonGeo, RoadSegment.bridgeTowerMaterial);
    leftLower.position.set(-pylonX, 13.8, 0);
    towerGroup.add(leftLower);

    const rightLower = new THREE.Mesh(lowerPylonGeo, RoadSegment.bridgeTowerMaterial);
    rightLower.position.set(pylonX, 13.8, 0);
    towerGroup.add(rightLower);

    const upperPylonGeo = new THREE.BoxGeometry(1.9, 22.0, 2.4);
    const leftUpper = new THREE.Mesh(upperPylonGeo, RoadSegment.bridgeTowerMaterial);
    leftUpper.position.set(-pylonX, 37.0, 0);
    towerGroup.add(leftUpper);

    const rightUpper = new THREE.Mesh(upperPylonGeo, RoadSegment.bridgeTowerMaterial);
    rightUpper.position.set(pylonX, 37.0, 0);
    towerGroup.add(rightUpper);

    // 3. Horizontal Girders
    const beamGeo = new THREE.BoxGeometry(crossSpan, 1.8, 2.2);
    const deckBeam = new THREE.Mesh(beamGeo, RoadSegment.bridgeWhiteMaterial);
    deckBeam.position.set(0, 12.0, 0);
    towerGroup.add(deckBeam);

    const midBeam = new THREE.Mesh(beamGeo, RoadSegment.bridgeWhiteMaterial);
    midBeam.position.set(0, 27.5, 0);
    towerGroup.add(midBeam);

    const crownBeam = new THREE.Mesh(beamGeo, RoadSegment.bridgeWhiteMaterial);
    crownBeam.position.set(0, 44.5, 0);
    towerGroup.add(crownBeam);

    // 4. X-Bracing Trusses
    this.createXBrace(towerGroup, crossSpan, 12.0, 27.5, RoadSegment.bridgeTowerMaterial);
    this.createXBrace(towerGroup, crossSpan, 27.5, 44.5, RoadSegment.bridgeTowerMaterial);

    // 5. Crown Portal Header: 15 Temmuz Şehitler Köprüsü
    const signBoardBox = new THREE.Mesh(new THREE.BoxGeometry(crossSpan * 0.72, 3.6, 0.3), RoadSegment.bridgeTowerMaterial);
    signBoardBox.position.set(0, 46.5, 0);
    towerGroup.add(signBoardBox);

    const signPlaneGeo = new THREE.PlaneGeometry(crossSpan * 0.70, 3.4);
    const signBoardFront = new THREE.Mesh(signPlaneGeo, RoadSegment.bridgeSignMaterial);
    signBoardFront.position.set(0, 46.5, -0.18);
    signBoardFront.rotation.y = Math.PI;
    towerGroup.add(signBoardFront);

    const signBoardBack = new THREE.Mesh(signPlaneGeo, RoadSegment.bridgeSignMaterial);
    signBoardBack.position.set(0, 46.5, 0.18);
    towerGroup.add(signBoardBack);

    // 6. Pinnacle Spires & Aircraft Strobes
    const spireGeo = new THREE.CylinderGeometry(0.12, 0.35, 4.5, 8);
    const beaconGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    for (let side = -1; side <= 1; side += 2) {
      const spire = new THREE.Mesh(spireGeo, RoadSegment.bridgeTowerMaterial);
      spire.position.set(side * pylonX, pylonHeight + 2.0, 0);
      towerGroup.add(spire);

      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(side * pylonX, pylonHeight + 4.3, 0);
      towerGroup.add(beacon);
      this.beaconLights.push(beacon);
    }

    // 7. Suspension Cables & Dynamic LED Ribbon
    this.addBridgeCables(towerGroup, roadBoundaryX, segLength, pylonX);

    // 8. Under-deck Deck Truss & Entrance Gantry
    this.addBridgeDeckTruss(roadBoundaryX, segLength, 'DAY');

    this.bridgeMeshGroup.add(towerGroup);
  }

  private addOsmangaziBridge(roadBoundaryX: number, segLength: number): void {
    // 1. Coastal Gulf Waters
    this.addBosphorusWater(roadBoundaryX, segLength);

    const towerGroup = new THREE.Group();
    const towerZ = segLength / 2;
    towerGroup.position.set(0, 0, towerZ);

    const pylonHeight = 52.0;
    const pylonX = roadBoundaryX + 3.4;
    const crossSpan = pylonX * 2;

    // Concrete Caissons
    const pierGeo = new THREE.BoxGeometry(4.8, 6.0, 7.2);
    const leftPier = new THREE.Mesh(pierGeo, RoadSegment.bridgePierMaterial);
    leftPier.position.set(-pylonX, -1.0, 0);
    towerGroup.add(leftPier);

    const rightPier = new THREE.Mesh(pierGeo, RoadSegment.bridgePierMaterial);
    rightPier.position.set(pylonX, -1.0, 0);
    towerGroup.add(rightPier);

    // Osmangazi Off-White / Silver Steel Pylons
    const lowerPylonGeo = new THREE.BoxGeometry(2.4, 26.0, 3.0);
    const leftLower = new THREE.Mesh(lowerPylonGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    leftLower.position.set(-pylonX, 14.5, 0);
    towerGroup.add(leftLower);

    const rightLower = new THREE.Mesh(lowerPylonGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    rightLower.position.set(pylonX, 14.5, 0);
    towerGroup.add(rightLower);

    const upperPylonGeo = new THREE.BoxGeometry(1.8, 25.0, 2.4);
    const leftUpper = new THREE.Mesh(upperPylonGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    leftUpper.position.set(-pylonX, 39.5, 0);
    towerGroup.add(leftUpper);

    const rightUpper = new THREE.Mesh(upperPylonGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    rightUpper.position.set(pylonX, 39.5, 0);
    towerGroup.add(rightUpper);

    // Cross Girders
    const beamGeo = new THREE.BoxGeometry(crossSpan, 1.8, 2.2);
    const deckBeam = new THREE.Mesh(beamGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    deckBeam.position.set(0, 12.0, 0);
    towerGroup.add(deckBeam);

    const midBeam = new THREE.Mesh(beamGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    midBeam.position.set(0, 29.0, 0);
    towerGroup.add(midBeam);

    const crownBeam = new THREE.Mesh(beamGeo, RoadSegment.osmangaziBridgeTowerMaterial);
    crownBeam.position.set(0, 48.0, 0);
    towerGroup.add(crownBeam);

    this.createXBrace(towerGroup, crossSpan, 12.0, 29.0, RoadSegment.osmangaziBridgeTowerMaterial);
    this.createXBrace(towerGroup, crossSpan, 29.0, 48.0, RoadSegment.osmangaziBridgeTowerMaterial);

    // Pinnacle Spire & Strobes
    const spireGeo = new THREE.CylinderGeometry(0.12, 0.35, 5.0, 8);
    const beaconGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1e40 });

    for (let side = -1; side <= 1; side += 2) {
      const spire = new THREE.Mesh(spireGeo, RoadSegment.osmangaziBridgeTowerMaterial);
      spire.position.set(side * pylonX, pylonHeight + 2.5, 0);
      towerGroup.add(spire);

      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(side * pylonX, pylonHeight + 5.2, 0);
      towerGroup.add(beacon);
      this.beaconLights.push(beacon);
    }

    this.addBridgeCables(towerGroup, roadBoundaryX, segLength, pylonX);
    this.addBridgeDeckTruss(roadBoundaryX, segLength, 'RAIN');

    this.bridgeMeshGroup.add(towerGroup);

    // Passing cargo/cruise vessel in the gulf
    this.setupBosphorusShip();
  }

  private addBoluViaduct(roadBoundaryX: number, segLength: number): void {
    const viaductGroup = new THREE.Group();

    // 1. Deep Alpine Forest Valley Floor (Y = -24m)
    const valleyGeo = new THREE.PlaneGeometry(320, segLength);
    const valleyMesh = new THREE.Mesh(valleyGeo, RoadSegment.boluValleyFloorMaterial);
    valleyMesh.rotation.x = -Math.PI / 2;
    valleyMesh.position.set(0, -24.0, segLength / 2);
    valleyMesh.receiveShadow = true;
    viaductGroup.add(valleyMesh);

    // 2. Tall Spruces on the valley floor below
    const valleyTreePositions = [
      { x: -35, z: segLength * 0.2 },
      { x: -55, z: segLength * 0.6 },
      { x: -25, z: segLength * 0.8 },
      { x: 38, z: segLength * 0.3 },
      { x: 50, z: segLength * 0.7 },
      { x: 28, z: segLength * 0.5 },
      { x: -70, z: segLength * 0.4 },
      { x: 72, z: segLength * 0.6 },
    ];
    for (const pos of valleyTreePositions) {
      const spruce = this.createSpruceTreeMesh(1.4);
      spruce.position.set(pos.x, -24.0, pos.z);
      viaductGroup.add(spruce);
    }

    // 3. Massive Reinforced Concrete Viaduct Piers (Rising from y = -24 to y = 0)
    const pierWidth = 3.2;
    const pierDepth = 4.0;
    const pierHeight = 24.0;
    const pierGeo = new THREE.BoxGeometry(pierWidth, pierHeight, pierDepth);

    const pierPositions = [
      { x: -roadBoundaryX * 0.75, z: segLength * 0.25 },
      { x: roadBoundaryX * 0.75, z: segLength * 0.25 },
      { x: -roadBoundaryX * 0.75, z: segLength * 0.75 },
      { x: roadBoundaryX * 0.75, z: segLength * 0.75 },
    ];

    for (const p of pierPositions) {
      const pier = new THREE.Mesh(pierGeo, RoadSegment.bridgePierMaterial);
      pier.position.set(p.x, -pierHeight / 2, p.z);
      pier.castShadow = false;
      pier.receiveShadow = true;
      viaductGroup.add(pier);

      // Footing pad
      const footGeo = new THREE.BoxGeometry(pierWidth + 2.0, 1.6, pierDepth + 2.0);
      const foot = new THREE.Mesh(footGeo, RoadSegment.bridgePierMaterial);
      foot.position.set(p.x, -23.2, p.z);
      viaductGroup.add(foot);

      // Pier capital bracket supporting deck
      const capGeo = new THREE.BoxGeometry(pierWidth + 1.2, 1.4, pierDepth + 1.0);
      const cap = new THREE.Mesh(capGeo, RoadSegment.bridgePierMaterial);
      cap.position.set(p.x, -0.7, p.z);
      viaductGroup.add(cap);
    }

    // 4. Under-deck Concrete Box Girder
    const deckGirderGeo = new THREE.BoxGeometry(roadBoundaryX * 2 + 1.6, 1.8, segLength);
    const deckGirder = new THREE.Mesh(deckGirderGeo, RoadSegment.bridgePierMaterial);
    deckGirder.position.set(0, -0.9, segLength / 2);
    viaductGroup.add(deckGirder);

    // 5. Viaduct Aerodynamic Wind Baffles (Transparent acoustic glass panels)
    const barrierHeight = 2.8;
    const barrierGeo = new THREE.BoxGeometry(0.12, barrierHeight, segLength);

    const leftBarrier = new THREE.Mesh(barrierGeo, RoadSegment.soundBarrierGlassMaterial);
    leftBarrier.position.set(-roadBoundaryX - 0.75, barrierHeight / 2 + 0.1, segLength / 2);
    viaductGroup.add(leftBarrier);

    const rightBarrier = new THREE.Mesh(barrierGeo, RoadSegment.soundBarrierGlassMaterial);
    rightBarrier.position.set(roadBoundaryX + 0.75, barrierHeight / 2 + 0.1, segLength / 2);
    viaductGroup.add(rightBarrier);

    // Wind barrier metal posts
    const postGeo = new THREE.BoxGeometry(0.20, barrierHeight + 0.2, 0.20);
    const postCount = Math.floor(segLength / 4.0);
    const posts = new THREE.InstancedMesh(postGeo, RoadSegment.soundBarrierFrameMaterial, postCount * 2);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < postCount; i++) {
      const pz = i * 4.0 + 2.0;
      dummy.position.set(-roadBoundaryX - 0.75, (barrierHeight + 0.2) / 2, pz);
      dummy.updateMatrix();
      posts.setMatrixAt(i * 2, dummy.matrix);

      dummy.position.set(roadBoundaryX + 0.75, (barrierHeight + 0.2) / 2, pz);
      dummy.updateMatrix();
      posts.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    viaductGroup.add(posts);

    // 6. Viaduct Entrance Gantry
    this.addBridgeEntranceGantry(roadBoundaryX, 8, 'SUNSET');

    this.bridgeMeshGroup.add(viaductGroup);
  }

  private addBozkirViaduct(roadBoundaryX: number, segLength: number): void {
    const viaductGroup = new THREE.Group();

    // 1. Dry Anatolian Steppe Valley Floor (Y = -15m)
    const valleyGeo = new THREE.PlaneGeometry(300, segLength);
    const valleyMesh = new THREE.Mesh(valleyGeo, RoadSegment.bozkirGrassMaterial);
    valleyMesh.rotation.x = -Math.PI / 2;
    valleyMesh.position.set(0, -15.0, segLength / 2);
    valleyMesh.receiveShadow = true;
    viaductGroup.add(valleyMesh);

    // 2. Cylindrical Concrete Columns with Blue/Cyan Uplighting
    const colRadius = 1.1;
    const colHeight = 15.0;
    const colGeo = new THREE.CylinderGeometry(colRadius, colRadius, colHeight, 12);

    const colPositions = [
      { x: -roadBoundaryX * 0.70, z: segLength * 0.25 },
      { x: roadBoundaryX * 0.70, z: segLength * 0.25 },
      { x: -roadBoundaryX * 0.70, z: segLength * 0.75 },
      { x: roadBoundaryX * 0.70, z: segLength * 0.75 },
    ];

    const uplightGeo = new THREE.TorusGeometry(colRadius + 0.3, 0.08, 6, 12);
    uplightGeo.rotateX(Math.PI / 2);
    const uplightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    for (const c of colPositions) {
      const col = new THREE.Mesh(colGeo, RoadSegment.bridgePierMaterial);
      col.position.set(c.x, -colHeight / 2, c.z);
      col.castShadow = false;
      col.receiveShadow = true;
      viaductGroup.add(col);

      // LED uplight ring at ground level
      const ring = new THREE.Mesh(uplightGeo, uplightMat);
      ring.position.set(c.x, -14.9, c.z);
      viaductGroup.add(ring);
    }

    // 3. Under-deck Girder
    const deckGirderGeo = new THREE.BoxGeometry(roadBoundaryX * 2 + 1.2, 1.6, segLength);
    const deckGirder = new THREE.Mesh(deckGirderGeo, RoadSegment.bridgePierMaterial);
    deckGirder.position.set(0, -0.8, segLength / 2);
    viaductGroup.add(deckGirder);

    // 4. Smart Highway VMS Entrance Gantry
    this.addBridgeEntranceGantry(roadBoundaryX, 8, 'NIGHT');

    this.bridgeMeshGroup.add(viaductGroup);
  }

  private createXBrace(
    parent: THREE.Group,
    width: number,
    yBottom: number,
    yTop: number,
    material: THREE.Material
  ): void {
    const dy = yTop - yBottom;
    const len = Math.hypot(width, dy);
    const angle = Math.atan2(dy, width);
    const braceGeo = new THREE.BoxGeometry(len, 0.9, 0.9);

    const brace1 = new THREE.Mesh(braceGeo, material);
    brace1.position.set(0, (yBottom + yTop) / 2, 0);
    brace1.rotation.z = angle;
    parent.add(brace1);

    const brace2 = new THREE.Mesh(braceGeo, material);
    brace2.position.set(0, (yBottom + yTop) / 2, 0);
    brace2.rotation.z = -angle;
    parent.add(brace2);
  }

  private addBridgeCables(
    towerGroup: THREE.Group,
    _roadBoundaryX: number,
    segLength: number,
    pylonX: number
  ): void {
    const halfLen = segLength / 2;
    const cableSteps = 16;
    const cableRadius = 0.12;

    for (let side = -1; side <= 1; side += 2) {
      const posX = side * pylonX;

      for (let i = -cableSteps; i <= cableSteps; i++) {
        if (i === 0) continue;
        const normZ = i / cableSteps;
        const z = normZ * (halfLen * 0.96);
        const sag = Math.cos(normZ * Math.PI * 0.5);
        const cableTopY = 4.5 + (46.0 - 4.5) * Math.pow(sag, 1.8);
        const hangerHeight = Math.max(0.5, cableTopY - 0.8);

        const hangerGeo = new THREE.CylinderGeometry(0.045, 0.045, hangerHeight, 4);
        const hanger = new THREE.Mesh(hangerGeo, RoadSegment.bridgeCableMaterial);
        hanger.position.set(posX, hangerHeight / 2 + 0.8, z);
        towerGroup.add(hanger);

        const puckGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const puckMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const puck = new THREE.Mesh(puckGeo, puckMat);
        puck.position.set(posX, 1.0, z);
        towerGroup.add(puck);
        this.bridgeLights.push(puck);

        const nodeGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const cableLed = new THREE.Mesh(nodeGeo, nodeMat);
        cableLed.position.set(posX, cableTopY, z);
        towerGroup.add(cableLed);
        this.bridgeLights.push(cableLed);
      }

      for (let i = -cableSteps; i < cableSteps; i++) {
        const z1 = (i / cableSteps) * (halfLen * 0.96);
        const z2 = ((i + 1) / cableSteps) * (halfLen * 0.96);
        const sag1 = Math.cos(Math.abs(i / cableSteps) * Math.PI * 0.5);
        const sag2 = Math.cos(Math.abs((i + 1) / cableSteps) * Math.PI * 0.5);
        const y1 = 4.5 + (46.0 - 4.5) * Math.pow(sag1, 1.8);
        const y2 = 4.5 + (46.0 - 4.5) * Math.pow(sag2, 1.8);

        const dz = z2 - z1;
        const dy = y2 - y1;
        const segLen = Math.hypot(dz, dy);
        const segAngle = Math.atan2(dy, dz);

        const segGeo = new THREE.CylinderGeometry(cableRadius, cableRadius, segLen, 6);
        segGeo.rotateX(Math.PI / 2);
        const cableMesh = new THREE.Mesh(segGeo, RoadSegment.bridgeCableMaterial);
        cableMesh.position.set(posX, (y1 + y2) / 2, (z1 + z2) / 2);
        cableMesh.rotation.x = -segAngle;
        towerGroup.add(cableMesh);
      }
    }
  }

  private addBridgeDeckTruss(roadBoundaryX: number, segLength: number, env?: EnvironmentPreset): void {
    const trussDepth = 1.6;
    const trussWidth = 0.5;
    const trussGeo = new THREE.BoxGeometry(trussWidth, trussDepth, segLength);

    const leftTruss = new THREE.Mesh(trussGeo, RoadSegment.bridgeTrussMaterial);
    leftTruss.position.set(-roadBoundaryX - 0.3, -0.6, segLength / 2);
    this.bridgeMeshGroup.add(leftTruss);

    const rightTruss = new THREE.Mesh(trussGeo, RoadSegment.bridgeTrussMaterial);
    rightTruss.position.set(roadBoundaryX + 0.3, -0.6, segLength / 2);
    this.bridgeMeshGroup.add(rightTruss);

    // Bridge entrance LED matrix gantry at start of bridge
    this.addBridgeEntranceGantry(roadBoundaryX, 10, env);
  }

  private addBridgeEntranceGantry(roadBoundaryX: number, z: number, env?: EnvironmentPreset): void {
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(0, 0, z);

    const span = (roadBoundaryX + 0.8) * 2;
    const legGeo = new THREE.BoxGeometry(0.5, 7.2, 0.5);
    const leftLeg = new THREE.Mesh(legGeo, RoadSegment.gantryMaterial);
    leftLeg.position.set(-roadBoundaryX - 0.8, 3.6, 0);
    gantryGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, RoadSegment.gantryMaterial);
    rightLeg.position.set(roadBoundaryX + 0.8, 3.6, 0);
    gantryGroup.add(rightLeg);

    const topBeamGeo = new THREE.BoxGeometry(span, 0.6, 0.6);
    const topBeam = new THREE.Mesh(topBeamGeo, RoadSegment.gantryMaterial);
    topBeam.position.set(0, 7.2, 0);
    gantryGroup.add(topBeam);

    const currentEnv = env || gameState.currentEnvironment || 'DAY';
    const signMat = RoadSegment.bridgeGantrySignMaterialsMap.get(currentEnv) || RoadSegment.bridgeGantrySignMaterial;

    const signBoardGeo = new THREE.BoxGeometry(span * 0.85, 2.4, 0.18);
    const signBoard = new THREE.Mesh(signBoardGeo, signMat);
    signBoard.position.set(0, 6.2, 0);
    gantryGroup.add(signBoard);

    this.bridgeMeshGroup.add(gantryGroup);
  }

  // --- BOSPHORUS MARINE TRAFFIC (Cruise Ship & Istanbul Ferry) ---

  public rebuildShip(): void {
    if (!this.isBridge) return;
    while (this.shipGroup.children.length > 0) {
      const child = this.shipGroup.children[0];
      this.shipGroup.remove(child);
    }
    this.activeShip = null;
    this.setupBosphorusShip();
  }

  private setupBosphorusShip(): void {
    if (!this.isBridge) return;

    // Prioritize high-detail 3D cruise_ship.glb
    if (shipManager.isReady()) {
      // Alternate side and navigation heading across bridge segments
      const isRight = this.segmentIndex % 2 === 0;
      const lateralX = isRight ? 46.0 : -48.0;
      const direction = isRight ? 1 : -1;
      const shipZ = this.length * 0.5;

      const cruiseShip = shipManager.createCruiseShip({
        x: lateralX,
        y: -1.2,
        z: shipZ,
        direction: direction,
      });

      if (cruiseShip) {
        this.shipGroup.add(cruiseShip);
        this.activeShip = cruiseShip;
        this.shipBaseY = -1.2;
        this.shipDirection = direction;
        return;
      }
    }

    // Fallback: If 3D cruise ship model is still loading asynchronously
    this.addSehirHatlariFerry(42.0, this.length * 0.45);
  }

  private addSehirHatlariFerry(x: number, z: number): void {
    const ferryGroup = new THREE.Group();
    ferryGroup.position.set(x, -0.6, z);

    // 1. Lower Black Hull
    const hullGeo = new THREE.BoxGeometry(7.0, 1.4, 20.0);
    const hull = new THREE.Mesh(hullGeo, RoadSegment.ferryHullMaterial);
    hull.position.y = 0.7;
    ferryGroup.add(hull);

    // 2. White Passenger Saloon / Lower Deck
    const deck1Geo = new THREE.BoxGeometry(6.2, 1.3, 17.0);
    const deck1 = new THREE.Mesh(deck1Geo, RoadSegment.ferryWhiteMaterial);
    deck1.position.y = 1.9;
    ferryGroup.add(deck1);

    // Warm glowing passenger saloon windows
    const winGeo = new THREE.BoxGeometry(0.1, 0.45, 13.0);
    const winL = new THREE.Mesh(winGeo, RoadSegment.ferryWindowMaterial);
    winL.position.set(-3.12, 1.9, 0);
    ferryGroup.add(winL);

    const winR = new THREE.Mesh(winGeo, RoadSegment.ferryWindowMaterial);
    winR.position.set(3.12, 1.9, 0);
    ferryGroup.add(winR);

    // 3. White Upper Bridge / Wheelhouse
    const deck2Geo = new THREE.BoxGeometry(4.4, 1.1, 9.0);
    const deck2 = new THREE.Mesh(deck2Geo, RoadSegment.ferryWhiteMaterial);
    deck2.position.set(0, 3.0, 1.0);
    ferryGroup.add(deck2);

    // 4. Iconic Yellow & Black Ferry Smokestack (Baca)
    const chimneyGeo = new THREE.CylinderGeometry(0.5, 0.55, 2.4, 8);
    const chimney = new THREE.Mesh(chimneyGeo, RoadSegment.ferryYellowMaterial);
    chimney.position.set(0, 4.4, -0.5);
    ferryGroup.add(chimney);

    // Black top rim on chimney
    const rimGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.45, 8);
    const rim = new THREE.Mesh(rimGeo, RoadSegment.ferryHullMaterial);
    rim.position.set(0, 5.4, -0.5);
    ferryGroup.add(rim);

    // 5. Turkish Flag pole on stern
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4);
    const pole = new THREE.Mesh(poleGeo, RoadSegment.ferryWhiteMaterial);
    pole.position.set(0, 2.8, -8.8);
    ferryGroup.add(pole);

    const flagGeo = new THREE.PlaneGeometry(0.8, 0.55);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xe63946, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.4, 3.6, -8.8);
    ferryGroup.add(flag);

    // 6. Stern wake foam trailing behind the ferry
    const wakeGeo = new THREE.PlaneGeometry(8.5, 22.0);
    const wake = new THREE.Mesh(wakeGeo, RoadSegment.ferryWakeMaterial);
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.02, -18.0);
    ferryGroup.add(wake);

    this.shipGroup.add(ferryGroup);
    this.activeShip = ferryGroup;
    this.shipBaseY = -0.6;
    this.shipDirection = 1;
  }

  // --- TURKISH HIGHWAY GREEN GANTRY SIGN (Yeşil Otoyol Tabelası & EDS) ---

  private addHighwayGantry(roadBoundaryX: number, z: number, signIndex: number, env?: EnvironmentPreset): void {
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(0, 0, z);

    const clearHeight = 6.4;
    const totalSpan = (roadBoundaryX + 0.8) * 2;

    // Vertical Left Column
    const colGeo = new THREE.CylinderGeometry(0.18, 0.22, clearHeight + 1.2, 8);
    const leftCol = new THREE.Mesh(colGeo, RoadSegment.gantryMaterial);
    leftCol.position.set(-roadBoundaryX - 0.8, (clearHeight + 1.2) / 2, 0);
    gantryGroup.add(leftCol);

    // Vertical Right Column
    const rightCol = new THREE.Mesh(colGeo, RoadSegment.gantryMaterial);
    rightCol.position.set(roadBoundaryX + 0.8, (clearHeight + 1.2) / 2, 0);
    gantryGroup.add(rightCol);

    // Horizontal Overhead Crossbeam
    const beamGeo = new THREE.BoxGeometry(totalSpan, 0.35, 0.35);
    const beam = new THREE.Mesh(beamGeo, RoadSegment.gantryMaterial);
    beam.position.set(0, clearHeight + 0.6, 0);
    gantryGroup.add(beam);

    // Highway Signboard according to Environment
    const currentEnv = env || gameState.currentEnvironment || 'DAY';
    const envSigns = RoadSegment.signMaterialsMap.get(currentEnv) || RoadSegment.signMaterials;
    const signMat = envSigns[signIndex % (envSigns.length || 1)] || RoadSegment.gantryMaterial;

    const signBoardGeo = new THREE.BoxGeometry(13.2, 3.4, 0.15);
    const signBoard = new THREE.Mesh(signBoardGeo, signMat);
    signBoard.position.set(0, clearHeight - 0.4, 0);
    gantryGroup.add(signBoard);

    // EDS Radar Speed Camera Unit
    const edsBoxGeo = new THREE.BoxGeometry(0.6, 0.4, 0.5);
    const edsBoxMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const edsBox = new THREE.Mesh(edsBoxGeo, edsBoxMat);
    edsBox.position.set(4.0, clearHeight + 0.85, 0.2);
    gantryGroup.add(edsBox);

    // EDS Radar lens
    const lensGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
    lensGeo.rotateX(Math.PI / 2);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(4.0, clearHeight + 0.85, 0.48);
    gantryGroup.add(lens);

    // Two-Way Overhead Lane Control Signals (Şerit Kontrol Işıkları)
    const twoWaySignals = new THREE.Group();
    const sigGeo = new THREE.PlaneGeometry(1.15, 1.15);

    // Lanes 0 & 1 (Forward, Right Side): Green Arrow ⬇️
    const sig0 = new THREE.Mesh(sigGeo, RoadSegment.gantrySignalGreenMaterial);
    sig0.position.set(laneSystem.getLaneX(0), clearHeight - 2.35, 0.12);
    twoWaySignals.add(sig0);

    const sig1 = new THREE.Mesh(sigGeo, RoadSegment.gantrySignalGreenMaterial);
    sig1.position.set(laneSystem.getLaneX(1), clearHeight - 2.35, 0.12);
    twoWaySignals.add(sig1);

    // Lanes 2 & 3 (Oncoming, Left Side): Red Cross ❌
    const sig2 = new THREE.Mesh(sigGeo, RoadSegment.gantrySignalRedMaterial);
    sig2.position.set(laneSystem.getLaneX(2), clearHeight - 2.35, 0.12);
    twoWaySignals.add(sig2);

    const sig3 = new THREE.Mesh(sigGeo, RoadSegment.gantrySignalRedMaterial);
    sig3.position.set(laneSystem.getLaneX(3), clearHeight - 2.35, 0.12);
    twoWaySignals.add(sig3);

    gantryGroup.add(twoWaySignals);
    this.twoWayGantryGroup.add(twoWaySignals);

    this.gantryGroup.add(gantryGroup);
  }

  private getEmbankmentElevation(distFromRoad: number, zNorm: number, segIndex: number): number {
    if (distFromRoad < 2.0) {
      return (distFromRoad / 2.0) * -0.12;
    } else if (distFromRoad < 6.5) {
      const t = (distFromRoad - 2.0) / 4.5;
      return -0.12 - Math.sin(t * Math.PI) * 0.20; // roadside swale drainage dip
    } else {
      const t = Math.min(1.0, (distFromRoad - 6.5) / 18.0);
      const hillWave = Math.sin(distFromRoad * 0.07 + zNorm * 6.28 + segIndex * 1.5) * 0.45;
      return -0.12 + t * 1.5 + hillWave * t; // gentle rising green highway embankment
    }
  }

  private createEmbankmentGeometry(width: number, length: number, isRightSide: boolean): THREE.PlaneGeometry {
    const segsX = 14;
    const segsZ = 16;
    const geo = new THREE.PlaneGeometry(width, length, segsX, segsZ);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localY = pos.getY(i);
      const distFromRoad = isRightSide ? (localX + width / 2) : (width / 2 - localX);
      const zNorm = (localY + length / 2) / length;
      const elev = this.getEmbankmentElevation(distFromRoad, zNorm, this.segmentIndex);
      pos.setZ(i, elev);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private addGrassTuftsAndFlowers(vergeEdgeX: number, segLength: number): void {
    if (!RoadSegment.grassTuftGeometry || !RoadSegment.grassTuftMaterial) return;

    // Seeded pseudo-random for stable procedural distribution
    let seed = this.segmentIndex * 6143 + 31;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const tuftsPerSide = 65;
    const totalTufts = tuftsPerSide * 2;
    const instTufts = new THREE.InstancedMesh(RoadSegment.grassTuftGeometry, RoadSegment.grassTuftMaterial, totalTufts);
    instTufts.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let side = 0; side < 2; side++) {
      const isRight = side === 1;
      for (let i = 0; i < tuftsPerSide; i++) {
        const dist = Math.pow(rnd(), 1.6) * 14.0 + 0.3;
        const z = rnd() * (segLength - 4.0) + 2.0;
        const zNorm = z / segLength;
        const elev = this.getEmbankmentElevation(dist, zNorm, this.segmentIndex);

        const x = isRight ? (vergeEdgeX + dist) : -(vergeEdgeX + dist);
        const scale = 0.75 + rnd() * 0.55;

        dummy.position.set(x, elev, z);
        dummy.rotation.y = rnd() * Math.PI * 2;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        instTufts.setMatrixAt(idx++, dummy.matrix);
      }
    }

    instTufts.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(instTufts);

    // Scatter 36 Vibrant Roadside Wildflowers (Daisies, Poppies, Buttercups)
    if (RoadSegment.wildflowerGeometry) {
      const flowerTypes = [
        { count: 16, mat: RoadSegment.daisyMaterial },
        { count: 10, mat: RoadSegment.poppyMaterial },
        { count: 10, mat: RoadSegment.buttercupMaterial },
      ];

      for (const ft of flowerTypes) {
        const instFlowers = new THREE.InstancedMesh(RoadSegment.wildflowerGeometry, ft.mat, ft.count);
        instFlowers.receiveShadow = true;

        for (let f = 0; f < ft.count; f++) {
          const isRight = rnd() > 0.5;
          const dist = Math.pow(rnd(), 1.3) * 8.0 + 0.4;
          const z = rnd() * (segLength - 4.0) + 2.0;
          const zNorm = z / segLength;
          const elev = this.getEmbankmentElevation(dist, zNorm, this.segmentIndex);

          const x = isRight ? (vergeEdgeX + dist) : -(vergeEdgeX + dist);
          const fScale = 0.85 + rnd() * 0.45;

          dummy.position.set(x, elev, z);
          dummy.rotation.y = rnd() * Math.PI * 2;
          dummy.rotation.x = (rnd() - 0.5) * 0.2;
          dummy.scale.set(fScale, fScale, fScale);
          dummy.updateMatrix();

          instFlowers.setMatrixAt(f, dummy.matrix);
        }

        instFlowers.instanceMatrix.needsUpdate = true;
        this.terrainGroup.add(instFlowers);
      }
    }
  }

  private addGrassTerrain(roadBoundaryX: number, segLength: number): void {
    // 1. Paved Interlocking Sidewalks on both sides (outside barrier)
    const sidewalkWidth = 2.4;
    const sidewalkGeo = new THREE.PlaneGeometry(sidewalkWidth, segLength);

    const leftSidewalk = new THREE.Mesh(sidewalkGeo, RoadSegment.sidewalkMaterial);
    leftSidewalk.rotation.x = -Math.PI / 2;
    leftSidewalk.position.set(-roadBoundaryX - sidewalkWidth / 2, 0.04, segLength / 2);
    leftSidewalk.receiveShadow = true;
    this.terrainGroup.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(sidewalkGeo, RoadSegment.sidewalkMaterial);
    rightSidewalk.rotation.x = -Math.PI / 2;
    rightSidewalk.position.set(roadBoundaryX + sidewalkWidth / 2, 0.04, segLength / 2);
    rightSidewalk.receiveShadow = true;
    this.terrainGroup.add(rightSidewalk);

    // 2. Earthy Highway Roadside Verge (Banket) Transition Strip (1.6m width)
    const vergeWidth = 1.6;
    const vergeGeo = new THREE.PlaneGeometry(vergeWidth, segLength);

    const leftVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    leftVerge.rotation.x = -Math.PI / 2;
    leftVerge.position.set(-roadBoundaryX - sidewalkWidth - vergeWidth / 2, 0.02, segLength / 2);
    leftVerge.receiveShadow = true;
    this.terrainGroup.add(leftVerge);

    const rightVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    rightVerge.rotation.x = -Math.PI / 2;
    rightVerge.position.set(roadBoundaryX + sidewalkWidth + vergeWidth / 2, 0.02, segLength / 2);
    rightVerge.receiveShadow = true;
    this.terrainGroup.add(rightVerge);

    // 3. Sculpted Rolling Highway Embankment Terrain (60m width each side)
    const terrainWidth = 60;
    const vergeEdgeX = roadBoundaryX + sidewalkWidth + vergeWidth;

    const leftGeo = this.createEmbankmentGeometry(terrainWidth, segLength, false);
    const leftTerrain = new THREE.Mesh(leftGeo, RoadSegment.grassMaterial);
    leftTerrain.rotation.x = -Math.PI / 2;
    leftTerrain.position.set(-vergeEdgeX - terrainWidth / 2, 0, segLength / 2);
    leftTerrain.receiveShadow = true;
    this.terrainGroup.add(leftTerrain);

    const rightGeo = this.createEmbankmentGeometry(terrainWidth, segLength, true);
    const rightTerrain = new THREE.Mesh(rightGeo, RoadSegment.grassMaterial);
    rightTerrain.rotation.x = -Math.PI / 2;
    rightTerrain.position.set(vergeEdgeX + terrainWidth / 2, 0, segLength / 2);
    rightTerrain.receiveShadow = true;
    this.terrainGroup.add(rightTerrain);

    // 4. Dense 3D Volumetric Grass Blade Tufts & Wildflower Meadows (InstancedMesh)
    this.addGrassTuftsAndFlowers(vergeEdgeX, segLength);
  }

  private addRoadsideScenery(roadBoundaryX: number, segLength: number): void {
    // 1. Transparent Acoustic Sound Barriers (Gürültü Panelleri) on residential corridors
    const hasSoundBarrierLeft = (this.segmentIndex % 4 === 1);
    const hasSoundBarrierRight = (this.segmentIndex % 4 === 3);
    if (hasSoundBarrierLeft) {
      this.addSoundBarrier(roadBoundaryX, segLength, false);
    }
    if (hasSoundBarrierRight) {
      this.addSoundBarrier(roadBoundaryX, segLength, true);
    }

    // 2. Multi-Layer Botanical Parkway (Stone Pines, Plane Trees, Italian Cypresses, Judas Trees & Bushes)
    const treeSpacing = 12.0;
    const treeCount = Math.floor(segLength / treeSpacing);

    for (let i = 0; i < treeCount; i++) {
      const z = i * treeSpacing + 6;
      const type = (i * 3 + this.segmentIndex * 2) % 4;

      // Staggered offsets for natural parkway appearance
      const leftOffset = hasSoundBarrierLeft ? 5.2 + (i % 2) * 1.5 : 3.6 + (i % 3) * 0.8;
      const rightOffset = hasSoundBarrierRight ? 5.2 + ((i + 1) % 2) * 1.5 : 3.6 + ((i + 1) % 3) * 0.8;

      const leftX = -(roadBoundaryX + leftOffset);
      const rightX = roadBoundaryX + rightOffset;

      // Left parkway flora
      if (type === 0) {
        this.addStonePine(leftX, z);
      } else if (type === 1) {
        this.addLushPlaneTree(leftX, z);
      } else if (type === 2) {
        this.addCypressTree(leftX, z);
      } else {
        this.addJudasTree(leftX, z);
      }

      // Right parkway flora (staggered type for varied roadside scenery)
      const rightType = (type + 2) % 4;
      if (rightType === 0) {
        this.addStonePine(rightX, z);
      } else if (rightType === 1) {
        this.addLushPlaneTree(rightX, z);
      } else if (rightType === 2) {
        this.addCypressTree(rightX, z);
      } else {
        this.addJudasTree(rightX, z);
      }

      // Background Embankment Woodlands (Layer 3 - deeper landscape depth)
      if (i % 2 === 0) {
        const bgLeftX = -(roadBoundaryX + 10.0 + ((i * 5) % 4));
        const bgRightX = roadBoundaryX + 10.0 + (((i + 2) * 5) % 4);
        if (i % 4 === 0) {
          this.addStonePine(bgLeftX, z + 3);
          this.addCypressTree(bgRightX, z + 3);
        } else {
          this.addCypressTree(bgLeftX, z + 3);
          this.addStonePine(bgRightX, z + 3);
        }
      }

      // Low manicured shrubs & oleander bushes along the guardrail verge
      this.addRoadsideBush(-(roadBoundaryX + 1.8), z + 3);
      this.addRoadsideBush(roadBoundaryX + 1.8, z + 3);
      if (i % 2 === 1) {
        this.addRoadsideBush(-(roadBoundaryX + 2.4), z + 8);
        this.addRoadsideBush(roadBoundaryX + 2.4, z + 8);
      }
    }

    // 3. Turkish Highway Milestone (KGM) & SOS Emergency Call Boxes
    if (this.segmentIndex % 2 === 0) {
      this.addKilometerStone(roadBoundaryX + 0.35, segLength * 0.3, 'DAY');
    }
    if (this.segmentIndex % 4 === 2) {
      this.addSosBox(roadBoundaryX + 0.45, segLength * 0.75);
    }

    // 4. Cantilever Overhead Motorway Exit Sign (Mavi Otoyol Çıkış Tabelası)
    if (this.segmentIndex % 4 === 2 && !hasSoundBarrierRight) {
      const exitSignIdx = Math.floor(this.segmentIndex / 4);
      this.addCantileverExitSign(roadBoundaryX, segLength * 0.6, exitSignIdx, 'DAY');
    }

    // 5. Elevated Highway Advertising Billboard on alternating segments
    if (this.segmentIndex % 3 === 2) {
      const signs = RoadSegment.billboardMaterialsMap.get('DAY') || RoadSegment.billboardMaterials;
      const billboardMat = signs[this.segmentIndex % signs.length];
      if (billboardMat) {
        this.addHighwayBillboard(roadBoundaryX + 16.0, segLength * 0.5, billboardMat, true);
      }
    } else if (this.segmentIndex % 3 === 0) {
      const signs = RoadSegment.billboardMaterialsMap.get('DAY') || RoadSegment.billboardMaterials;
      const billboardMat = signs[(this.segmentIndex + 1) % signs.length];
      if (billboardMat) {
        this.addHighwayBillboard(-(roadBoundaryX + 16.0), segLength * 0.5, billboardMat, false);
      }
    }

    // 6. Authentic Istanbul Architecture (Clean, modern, aesthetic buildings)
    this.addRoadsideBuildings(roadBoundaryX, segLength);
  }

  private addRoadsideBuildings(roadBoundaryX: number, segLength: number): void {
    // Only place on open highway segments (skip bridge and tunnel)
    if (this.isBridge || this.isTunnel) {
      if (this.isBridge && (!gameState.currentEnvironment || gameState.currentEnvironment === 'DAY')) {
        this.addBridgeDistantSkyline(segLength);
      }
      return;
    }
    if (gameState.currentEnvironment && gameState.currentEnvironment !== 'DAY') return;
    if (!cityPackManager.hasBuildings) return;

    const seed = Math.abs(this.segmentIndex);
    const padMat = RoadSegment.sidewalkMaterial || new THREE.MeshStandardMaterial({ color: 0x4a4e56, roughness: 0.85 });

    // ==========================================
    // 1. LAYER 1: FOREGROUND COMMERCIAL PLAZAS (Setback 16.5m - 20m)
    // ==========================================

    // LEFT SIDE: 2 Commercial buildings with concrete plaza pads
    const leftZ1 = segLength * 0.24;
    const leftX1 = -(roadBoundaryX + 17.0);
    const bldgLeft1 = cityPackManager.createBuildingInstance(undefined, {
      category: 'commercial',
      facingRoad: 'left',
      seed: seed * 19 + 1,
    });
    if (bldgLeft1) {
      bldgLeft1.position.set(leftX1, 0, leftZ1);
      this.sceneryGroup.add(bldgLeft1);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 22), padMat);
      pad.name = 'PlazaPad_L1';
      pad.position.set(leftX1, 0.08, leftZ1);
      pad.receiveShadow = false;
      this.sceneryGroup.add(pad);
    }

    const leftZ2 = segLength * 0.74;
    const leftX2 = -(roadBoundaryX + 18.5);
    const bldgLeft2 = cityPackManager.createBuildingInstance(undefined, {
      category: 'commercial',
      facingRoad: 'left',
      seed: seed * 19 + 2,
    });
    if (bldgLeft2) {
      bldgLeft2.position.set(leftX2, 0, leftZ2);
      this.sceneryGroup.add(bldgLeft2);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 22), padMat);
      pad.name = 'PlazaPad_L2';
      pad.position.set(leftX2, 0.08, leftZ2);
      pad.receiveShadow = false;
      this.sceneryGroup.add(pad);
    }

    // RIGHT SIDE: 2 Commercial buildings with concrete plaza pads
    const rightZ1 = segLength * 0.28;
    const rightX1 = roadBoundaryX + 17.0;
    const bldgRight1 = cityPackManager.createBuildingInstance(undefined, {
      category: 'commercial',
      facingRoad: 'right',
      seed: seed * 23 + 3,
    });
    if (bldgRight1) {
      bldgRight1.position.set(rightX1, 0, rightZ1);
      this.sceneryGroup.add(bldgRight1);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 22), padMat);
      pad.name = 'PlazaPad_R1';
      pad.position.set(rightX1, 0.08, rightZ1);
      pad.receiveShadow = false;
      this.sceneryGroup.add(pad);
    }

    const rightZ2 = segLength * 0.78;
    const rightX2 = roadBoundaryX + 18.5;
    const bldgRight2 = cityPackManager.createBuildingInstance(undefined, {
      category: 'commercial',
      facingRoad: 'right',
      seed: seed * 23 + 4,
    });
    if (bldgRight2) {
      bldgRight2.position.set(rightX2, 0, rightZ2);
      this.sceneryGroup.add(bldgRight2);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 22), padMat);
      pad.name = 'PlazaPad_R2';
      pad.position.set(rightX2, 0.08, rightZ2);
      pad.receiveShadow = false;
      this.sceneryGroup.add(pad);
    }

    // ==========================================
    // 2. LAYER 2: SKYSCRAPER TOWERS & BACKGROUND CITY BLOCKS (Setback 42m - 62m)
    // ==========================================
    const isEven = seed % 2 === 0;

    // Towering skyscraper (50-80 meters tall) on one side
    const towerX = isEven ? (roadBoundaryX + 44.0) : -(roadBoundaryX + 44.0);
    const towerFacing = isEven ? 'right' : 'left';
    const skyscraper = cityPackManager.createBuildingInstance(undefined, {
      category: 'skyscraper',
      facingRoad: towerFacing,
      scaleMult: 1.18,
      seed: seed * 31 + 5,
    });
    if (skyscraper) {
      skyscraper.position.set(towerX, 0, segLength * 0.48);
      this.sceneryGroup.add(skyscraper);
    }

    // Background urban block on the opposite side
    const bgX = isEven ? -(roadBoundaryX + 52.0) : (roadBoundaryX + 52.0);
    const bgFacing = isEven ? 'left' : 'right';
    const bgBlock = cityPackManager.createBuildingInstance(undefined, {
      category: 'background',
      facingRoad: bgFacing,
      scaleMult: 1.25,
      seed: seed * 37 + 7,
    });
    if (bgBlock) {
      bgBlock.position.set(bgX, 0, segLength * 0.52);
      this.sceneryGroup.add(bgBlock);
    }
  }

  private addBridgeDistantSkyline(segLength: number): void {
    if (!cityPackManager.hasBuildings) return;
    const seed = Math.abs(this.segmentIndex);

    // Distant coastal skyline across the Bosphorus waters (Europe & Asia coastlines)
    const leftSkylineX = -135.0;
    const leftTower = cityPackManager.createBuildingInstance(undefined, {
      category: 'skyscraper',
      facingRoad: 'right',
      scaleMult: 1.6,
      seed: seed * 41 + 1,
    });
    if (leftTower) {
      leftTower.position.set(leftSkylineX, -15.5, segLength * 0.35);
      this.sceneryGroup.add(leftTower);
    }

    const rightSkylineX = 135.0;
    const rightTower = cityPackManager.createBuildingInstance(undefined, {
      category: 'skyscraper',
      facingRoad: 'left',
      scaleMult: 1.6,
      seed: seed * 43 + 2,
    });
    if (rightTower) {
      rightTower.position.set(rightSkylineX, -15.5, segLength * 0.65);
      this.sceneryGroup.add(rightTower);
    }
  }

  public rebuildScenery(): void {
    if (this.isBridge) {
      this.rebuildShip();
      const hasSkyline = this.sceneryGroup.children.some((c) => c.name.startsWith('Building_'));
      if (!hasSkyline && (!gameState.currentEnvironment || gameState.currentEnvironment === 'DAY')) {
        this.addBridgeDistantSkyline(this.length);
      }
      return;
    }

    if (gameState.currentEnvironment && gameState.currentEnvironment !== 'DAY') return;

    // If buildings are not placed yet (e.g. loaded asynchronously), add them
    const hasBldg = this.sceneryGroup.children.some((c) => c.name.startsWith('Building_'));
    if (!hasBldg) {
      const totalRoadWidth = laneSystem.getTotalRoadWidth();
      const halfRoad = totalRoadWidth / 2;
      const shoulderWidth = laneSystem.shoulderWidth;
      const roadBoundaryX = halfRoad + shoulderWidth;
      this.addRoadsideBuildings(roadBoundaryX, this.length);
    }
    this.freezeStaticMatrices();
  }

  // --- LUSH ORGANIC BOTANICAL GREENERY (ZERO FLAT PANCAKES) ---

  private addLushPlaneTree(x: number, z: number): void {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);

    // 1. Natural tapered main trunk
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.44, 3.4, 7);
    const trunk = new THREE.Mesh(trunkGeo, RoadSegment.treeTrunkMaterial);
    trunk.position.y = 1.7;
    trunk.castShadow = false;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // 2. Sculptural branching arms
    const branch1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.20, 1.8, 5), RoadSegment.treeTrunkMaterial);
    branch1.position.set(0.45, 2.7, 0.2);
    branch1.rotation.z = -0.55;
    branch1.rotation.y = 0.3;
    treeGroup.add(branch1);

    const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5), RoadSegment.treeTrunkMaterial);
    branch2.position.set(-0.4, 2.8, -0.2);
    branch2.rotation.z = 0.52;
    branch2.rotation.y = -0.4;
    treeGroup.add(branch2);

    // 3. Volumetric, multi-cluster organic foliage (No flat pancake disks!)
    const mat1 = RoadSegment.treeFoliageMaterials[0];
    const mat2 = RoadSegment.treeFoliageMaterials[1];
    const mat3 = RoadSegment.treeFoliageMaterials[2];

    const centerCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), mat1);
    centerCrown.position.set(0, 4.5, 0);
    centerCrown.scale.set(1.15, 0.95, 1.1);
    centerCrown.castShadow = false;
    treeGroup.add(centerCrown);

    const offsets = [
      { x: 1.1, y: 3.8, z: 0.6, r: 1.4, mat: mat2 },
      { x: -1.0, y: 3.9, z: -0.5, r: 1.35, mat: mat3 },
      { x: 0.3, y: 4.1, z: -1.1, r: 1.4, mat: mat1 },
      { x: -0.4, y: 4.0, z: 1.0, r: 1.3, mat: mat2 },
      { x: 0.0, y: 5.4, z: 0.1, r: 1.25, mat: mat2 },
    ];

    for (const off of offsets) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(off.r, 1), off.mat);
      puff.position.set(off.x, off.y, off.z);
      puff.castShadow = false;
      treeGroup.add(puff);
    }

    const scale = 0.85 + Math.random() * 0.35;
    treeGroup.scale.set(scale, scale, scale);
    this.sceneryGroup.add(treeGroup);
  }

  private addJudasTree(x: number, z: number): void {
    const judasGroup = new THREE.Group();
    judasGroup.position.set(x, 0, z);

    // Dark sculptural trunk
    const trunkGeo = new THREE.CylinderGeometry(0.20, 0.38, 3.2, 7);
    const trunk = new THREE.Mesh(trunkGeo, RoadSegment.treeTrunkMaterial);
    trunk.position.y = 1.6;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    trunk.castShadow = false;
    judasGroup.add(trunk);

    // Branch
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.7, 5), RoadSegment.treeTrunkMaterial);
    branch.position.set(0.4, 2.5, 0.1);
    branch.rotation.z = -0.52;
    judasGroup.add(branch);

    // Blossoming magenta & rose floral clusters
    const flowerMat1 = RoadSegment.judasFlowerMaterials[0];
    const flowerMat2 = RoadSegment.judasFlowerMaterials[1];

    const centerPuff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9, 1), flowerMat1);
    centerPuff.position.set(0, 4.3, 0);
    centerPuff.castShadow = false;
    judasGroup.add(centerPuff);

    const offsets = [
      { x: 0.95, y: 3.6, z: 0.5, r: 1.3, mat: flowerMat2 },
      { x: -0.9, y: 3.7, z: -0.4, r: 1.25, mat: flowerMat1 },
      { x: 0.2, y: 5.1, z: 0.1, r: 1.2, mat: flowerMat2 },
      { x: -0.3, y: 3.9, z: 0.8, r: 1.2, mat: flowerMat1 },
    ];

    for (const off of offsets) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(off.r, 1), off.mat);
      puff.position.set(off.x, off.y, off.z);
      puff.castShadow = false;
      judasGroup.add(puff);
    }

    const scale = 0.85 + Math.random() * 0.3;
    judasGroup.scale.set(scale, scale, scale);
    this.sceneryGroup.add(judasGroup);
  }

  private addCypressTree(x: number, z: number): void {
    const cypressGroup = new THREE.Group();
    cypressGroup.position.set(x, 0, z);

    // Slim trunk base
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6);
    const trunk = new THREE.Mesh(trunkGeo, RoadSegment.treeTrunkMaterial);
    trunk.position.y = 0.9;
    cypressGroup.add(trunk);

    // 3-Tiered elegant tapered evergreen cone (Zarif İtalyan Servisi)
    const tier1 = new THREE.Mesh(new THREE.ConeGeometry(0.88, 2.8, 7), RoadSegment.cypressMaterial);
    tier1.position.y = 2.4;
    tier1.castShadow = false;
    cypressGroup.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.ConeGeometry(0.70, 2.6, 7), RoadSegment.cypressMaterial);
    tier2.position.y = 4.2;
    tier2.castShadow = false;
    cypressGroup.add(tier2);

    const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.50, 2.4, 7), RoadSegment.cypressMaterial);
    tier3.position.y = 5.8;
    tier3.castShadow = false;
    cypressGroup.add(tier3);

    const scale = 0.85 + Math.random() * 0.3;
    cypressGroup.scale.set(scale, scale, scale);
    this.sceneryGroup.add(cypressGroup);
  }

  private addRoadsideBush(x: number, z: number): void {
    const mat = RoadSegment.bushMaterials[Math.floor(Math.random() * RoadSegment.bushMaterials.length)];
    const bushGeo = new THREE.DodecahedronGeometry(0.42 + Math.random() * 0.25, 0);
    const bush = new THREE.Mesh(bushGeo, mat);
    bush.position.set(x, 0.3, z);
    bush.scale.set(1.2, 0.8, 1.2);
    this.sceneryGroup.add(bush);
  }

  private addKilometerStone(x: number, z: number, env: EnvironmentPreset = 'DAY'): void {
    const stoneGroup = new THREE.Group();
    stoneGroup.position.set(x, 0, z);

    // Authentic Turkish KGM milestone prism
    const stoneGeo = new THREE.BoxGeometry(0.45, 0.75, 0.32);
    const mat = RoadSegment.kmStoneMaterialsMap.get(env) || RoadSegment.kmStoneMaterial;
    const stone = new THREE.Mesh(stoneGeo, mat);
    stone.position.y = 0.38;
    stone.castShadow = false;
    stoneGroup.add(stone);

    this.sceneryGroup.add(stoneGroup);
  }

  private addHighwayBillboard(x: number, z: number, material: THREE.MeshStandardMaterial, faceLeft: boolean): void {
    const billboardGroup = new THREE.Group();
    billboardGroup.position.set(x, 0, z);

    const colHeight = 9.2;
    const colGeo = new THREE.CylinderGeometry(0.24, 0.28, colHeight, 8);

    // Left tubular pole
    const pole1 = new THREE.Mesh(colGeo, RoadSegment.gantryMaterial);
    pole1.position.set(-3.6, colHeight / 2, 0);
    billboardGroup.add(pole1);

    // Right tubular pole
    const pole2 = new THREE.Mesh(colGeo, RoadSegment.gantryMaterial);
    pole2.position.set(3.6, colHeight / 2, 0);
    billboardGroup.add(pole2);

    // Overhead billboard poster box
    const boardGeo = new THREE.BoxGeometry(11.2, 4.4, 0.35);
    const board = new THREE.Mesh(boardGeo, material);
    board.position.set(0, colHeight + 1.8, 0);
    board.castShadow = false;
    billboardGroup.add(board);

    // Top lighting arm bracket with 3 spotlights
    const armGeo = new THREE.BoxGeometry(11.2, 0.15, 1.2);
    const arm = new THREE.Mesh(armGeo, RoadSegment.gantryMaterial);
    arm.position.set(0, colHeight + 4.1, faceLeft ? -0.7 : 0.7);
    billboardGroup.add(arm);

    for (let i = -1; i <= 1; i++) {
      const lampGeo = new THREE.BoxGeometry(0.5, 0.18, 0.35);
      const lamp = new THREE.Mesh(lampGeo, RoadSegment.lightGlowMaterial);
      lamp.position.set(i * 3.6, colHeight + 3.95, faceLeft ? -0.7 : 0.7);
      billboardGroup.add(lamp);
    }

    if (faceLeft) {
      billboardGroup.rotation.y = -Math.PI / 2;
    } else {
      billboardGroup.rotation.y = Math.PI / 2;
    }

    this.sceneryGroup.add(billboardGroup);
  }

  private addModernGuardrail(halfRoad: number, shoulderWidth: number, segLength: number): void {
    const postSpacing = 2.5;
    const postCount = Math.floor(segLength / postSpacing);
    const postGeo = new THREE.BoxGeometry(0.08, 0.72, 0.08);

    // Left and right posts using InstancedMesh for high performance
    const leftPosts = new THREE.InstancedMesh(postGeo, RoadSegment.guardrailPostMaterial, postCount);
    const rightPosts = new THREE.InstancedMesh(postGeo, RoadSegment.guardrailPostMaterial, postCount);

    const dummy = new THREE.Object3D();
    const leftX = -halfRoad - shoulderWidth;
    const rightX = halfRoad + shoulderWidth;

    for (let i = 0; i < postCount; i++) {
      const pz = i * postSpacing + postSpacing * 0.5;

      dummy.position.set(leftX, 0.36, pz);
      dummy.updateMatrix();
      leftPosts.setMatrixAt(i, dummy.matrix);

      dummy.position.set(rightX, 0.36, pz);
      dummy.updateMatrix();
      rightPosts.setMatrixAt(i, dummy.matrix);
    }
    leftPosts.instanceMatrix.needsUpdate = true;
    rightPosts.instanceMatrix.needsUpdate = true;
    this.roadBaseGroup.add(leftPosts);
    this.roadBaseGroup.add(rightPosts);

    // Continuous horizontal corrugated W-beam rails
    // Upper corrugated ridge (y=0.62)
    const upperRailGeo = new THREE.BoxGeometry(0.07, 0.16, segLength);
    // Lower corrugated ridge (y=0.42)
    const lowerRailGeo = new THREE.BoxGeometry(0.07, 0.16, segLength);
    // Top safety tubular rail (y=0.78)
    const topTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, segLength, 8);
    topTubeGeo.rotateX(Math.PI / 2);

    const leftUpper = new THREE.Mesh(upperRailGeo, RoadSegment.guardrailSteelMaterial);
    leftUpper.position.set(leftX + 0.04, 0.62, segLength / 2);
    this.roadBaseGroup.add(leftUpper);

    const leftLower = new THREE.Mesh(lowerRailGeo, RoadSegment.guardrailSteelMaterial);
    leftLower.position.set(leftX + 0.04, 0.42, segLength / 2);
    this.roadBaseGroup.add(leftLower);

    const leftTop = new THREE.Mesh(topTubeGeo, RoadSegment.guardrailSteelMaterial);
    leftTop.position.set(leftX, 0.78, segLength / 2);
    this.roadBaseGroup.add(leftTop);

    const rightUpper = new THREE.Mesh(upperRailGeo, RoadSegment.guardrailSteelMaterial);
    rightUpper.position.set(rightX - 0.04, 0.62, segLength / 2);
    this.roadBaseGroup.add(rightUpper);

    const rightLower = new THREE.Mesh(lowerRailGeo, RoadSegment.guardrailSteelMaterial);
    rightLower.position.set(rightX - 0.04, 0.42, segLength / 2);
    this.roadBaseGroup.add(rightLower);

    const rightTop = new THREE.Mesh(topTubeGeo, RoadSegment.guardrailSteelMaterial);
    rightTop.position.set(rightX, 0.78, segLength / 2);
    this.roadBaseGroup.add(rightTop);

    // Retro-reflective "Kelebek" studs mounted on the guardrail face every 5m
    const reflSpacing = 5.0;
    const reflCount = Math.floor(segLength / reflSpacing);
    const reflGeo = new THREE.BoxGeometry(0.05, 0.09, 0.07);

    const leftRefls = new THREE.InstancedMesh(reflGeo, RoadSegment.guardrailReflectorWhiteMaterial, reflCount);
    const rightRefls = new THREE.InstancedMesh(reflGeo, RoadSegment.guardrailReflectorRedMaterial, reflCount);

    for (let i = 0; i < reflCount; i++) {
      const rz = i * reflSpacing + reflSpacing * 0.5;

      // Left reflector (White) facing oncoming traffic
      dummy.position.set(leftX + 0.08, 0.52, rz);
      dummy.rotation.set(0, 0.2, 0);
      dummy.updateMatrix();
      leftRefls.setMatrixAt(i, dummy.matrix);

      // Right reflector (Ruby Red) facing oncoming traffic
      dummy.position.set(rightX - 0.08, 0.52, rz);
      dummy.rotation.set(0, -0.2, 0);
      dummy.updateMatrix();
      rightRefls.setMatrixAt(i, dummy.matrix);
    }
    dummy.rotation.set(0, 0, 0);
    leftRefls.instanceMatrix.needsUpdate = true;
    rightRefls.instanceMatrix.needsUpdate = true;
    this.roadBaseGroup.add(leftRefls);
    this.roadBaseGroup.add(rightRefls);

    // Concrete curb drainage grates (every 15m along the concrete shoulder edge)
    const grateSpacing = 15.0;
    const grateCount = Math.floor(segLength / grateSpacing);
    const grateGeo = new THREE.BoxGeometry(0.48, 0.02, 0.75);
    const leftGrates = new THREE.InstancedMesh(grateGeo, RoadSegment.drainageGrateMaterial, grateCount);
    const rightGrates = new THREE.InstancedMesh(grateGeo, RoadSegment.drainageGrateMaterial, grateCount);

    for (let i = 0; i < grateCount; i++) {
      const gz = i * grateSpacing + grateSpacing * 0.5;

      dummy.position.set(-halfRoad - 0.35, 0.185, gz);
      dummy.updateMatrix();
      leftGrates.setMatrixAt(i, dummy.matrix);

      dummy.position.set(halfRoad + 0.35, 0.185, gz);
      dummy.updateMatrix();
      rightGrates.setMatrixAt(i, dummy.matrix);
    }
    leftGrates.instanceMatrix.needsUpdate = true;
    rightGrates.instanceMatrix.needsUpdate = true;
    this.roadBaseGroup.add(leftGrates);
    this.roadBaseGroup.add(rightGrates);
  }

  private addStonePine(x: number, z: number): void {
    const pineGroup = new THREE.Group();
    pineGroup.position.set(x, 0, z);

    // Weathered Mediterranean pine trunk with slight organic lean
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.44, 3.8, 8);
    const trunk = new THREE.Mesh(trunkGeo, RoadSegment.treeTrunkMaterial);
    trunk.position.y = 1.9;
    trunk.rotation.z = (Math.random() - 0.5) * 0.12;
    trunk.rotation.x = (Math.random() - 0.5) * 0.12;
    trunk.castShadow = false;
    pineGroup.add(trunk);

    // 3 Radiating umbrella boughs branching out at top
    const boughAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    for (const angle of boughAngles) {
      const bough = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.18, 2.2, 5),
        RoadSegment.treeTrunkMaterial
      );
      bough.position.set(
        Math.cos(angle) * 0.6,
        3.2,
        Math.sin(angle) * 0.6
      );
      bough.rotation.y = angle;
      bough.rotation.z = 0.55;
      pineGroup.add(bough);
    }

    // Authentic umbrella parasol canopy (Geniş fıstık çamı tacı)
    const mat1 = RoadSegment.stonePineFoliageMaterials[0] || RoadSegment.treeFoliageMaterials[0];
    const mat2 = RoadSegment.stonePineFoliageMaterials[1] || RoadSegment.treeFoliageMaterials[1];
    const mat3 = RoadSegment.stonePineFoliageMaterials[2] || RoadSegment.treeFoliageMaterials[2];

    // Broad flattened parasol dome
    const mainDome = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8, 1), mat1);
    mainDome.position.set(0, 4.8, 0);
    mainDome.scale.set(1.6, 0.55, 1.6);
    mainDome.castShadow = false;
    pineGroup.add(mainDome);

    // Upper crown tier
    const topDome = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), mat2);
    topDome.position.set(0, 5.4, 0);
    topDome.scale.set(1.3, 0.5, 1.3);
    topDome.castShadow = false;
    pineGroup.add(topDome);

    // Side puffs creating organic edge silhouette
    const subPuffs = [
      { x: 1.6, y: 4.6, z: 0.8, r: 1.1, mat: mat3 },
      { x: -1.7, y: 4.6, z: -0.6, r: 1.15, mat: mat2 },
      { x: 0.5, y: 4.7, z: -1.8, r: 1.2, mat: mat1 },
      { x: -0.6, y: 4.7, z: 1.7, r: 1.1, mat: mat3 },
    ];
    for (const p of subPuffs) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 1), p.mat);
      puff.position.set(p.x, p.y, p.z);
      puff.scale.set(1.2, 0.6, 1.2);
      puff.castShadow = false;
      pineGroup.add(puff);
    }

    const scale = 0.85 + Math.random() * 0.35;
    pineGroup.scale.set(scale, scale, scale);
    this.sceneryGroup.add(pineGroup);
  }

  private addCantileverExitSign(roadBoundaryX: number, z: number, signIndex: number, env: EnvironmentPreset = 'DAY'): void {
    const signs = RoadSegment.exitSignMaterialsMap.get(env) || RoadSegment.exitSignMaterials;
    const signMat = signs[signIndex % (signs.length || 1)];
    if (!signMat) return;

    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(roadBoundaryX + 2.4, 0, z);

    // Concrete foundation footing
    const footing = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.4, 0.7),
      RoadSegment.curbMaterial
    );
    footing.position.y = 0.2;
    gantryGroup.add(footing);

    // Tubular steel mast
    const mastHeight = 7.2;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.24, mastHeight, 10),
      RoadSegment.gantryMaterial
    );
    mast.position.y = mastHeight / 2;
    gantryGroup.add(mast);

    // Cantilever horizontal arm extending across right shoulder and lane (-X direction)
    const armLength = 5.6;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armLength, 0.24, 0.24),
      RoadSegment.gantryMaterial
    );
    arm.position.set(-armLength / 2 + 0.1, mastHeight - 0.2, 0);
    gantryGroup.add(arm);

    // Diagonal gusset strut
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
      RoadSegment.gantryMaterial
    );
    strut.position.set(-1.0, mastHeight - 0.9, 0);
    strut.rotation.z = Math.PI / 4;
    gantryGroup.add(strut);

    // Turkish Highway Blue Exit Board
    const boardWidth = 4.4;
    const boardHeight = 2.2;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardWidth, boardHeight, 0.18),
      signMat
    );
    // Position suspended from cantilever arm over lane
    board.position.set(-armLength * 0.55, mastHeight - 0.3 - boardHeight / 2, 0);
    gantryGroup.add(board);

    // Top lighting fixtures for night visibility
    for (let i = -1; i <= 1; i += 2) {
      const lampArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.8),
        RoadSegment.gantryMaterial
      );
      lampArm.position.set(board.position.x + i * 1.4, mastHeight + 0.1, 0.4);
      gantryGroup.add(lampArm);

      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.12, 0.25),
        RoadSegment.lightGlowMaterial
      );
      lamp.position.set(board.position.x + i * 1.4, mastHeight + 0.05, 0.7);
      gantryGroup.add(lamp);
    }

    this.gantryGroup.add(gantryGroup);
  }

  private addSoundBarrier(roadBoundaryX: number, segLength: number, isRightSide: boolean): void {
    const barrierGroup = new THREE.Group();
    const bx = isRightSide ? roadBoundaryX + 0.95 : -(roadBoundaryX + 0.95);
    barrierGroup.position.set(bx, 0, 0);

    const postSpacing = 3.5;
    const count = Math.floor(segLength / postSpacing);
    const wallHeight = 3.6;

    // Concrete crash wall base
    const baseHeight = 0.65;
    const baseGeo = new THREE.BoxGeometry(0.32, baseHeight, segLength);
    const baseMesh = new THREE.Mesh(baseGeo, RoadSegment.curbMaterial);
    baseMesh.position.set(0, baseHeight / 2, segLength / 2);
    barrierGroup.add(baseMesh);

    // Translucent acoustic acrylic glass panels
    const glassHeight = wallHeight - baseHeight;
    const glassGeo = new THREE.BoxGeometry(0.12, glassHeight, segLength);
    const glassMesh = new THREE.Mesh(glassGeo, RoadSegment.soundBarrierGlassMaterial);
    glassMesh.position.set(0, baseHeight + glassHeight / 2, segLength / 2);
    barrierGroup.add(glassMesh);

    // Steel H-beam structural columns along the wall
    const postGeo = new THREE.BoxGeometry(0.24, wallHeight + 0.1, 0.20);
    const posts = new THREE.InstancedMesh(postGeo, RoadSegment.soundBarrierFrameMaterial, count + 1);
    const dummy = new THREE.Object3D();

    for (let i = 0; i <= count; i++) {
      const pz = i * postSpacing;
      dummy.position.set(0, (wallHeight + 0.1) / 2, pz);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    barrierGroup.add(posts);

    // Top metal capping rail
    const capGeo = new THREE.BoxGeometry(0.28, 0.12, segLength);
    const capMesh = new THREE.Mesh(capGeo, RoadSegment.soundBarrierFrameMaterial);
    capMesh.position.set(0, wallHeight + 0.06, segLength / 2);
    barrierGroup.add(capMesh);

    this.sceneryGroup.add(barrierGroup);
  }

  private addSosBox(x: number, z: number): void {
    const sosGroup = new THREE.Group();
    sosGroup.position.set(x, 0, z);

    // Steel pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6),
      RoadSegment.guardrailPostMaterial
    );
    pole.position.y = 1.0;
    sosGroup.add(pole);

    // Orange box with SOS sign
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.55, 0.28),
      RoadSegment.sosBoxOrangeMaterial
    );
    box.position.y = 1.5;
    sosGroup.add(box);

    // Top angled solar panel
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.04, 0.35),
      RoadSegment.soundBarrierFrameMaterial
    );
    panel.position.set(0, 2.05, 0);
    panel.rotation.x = 0.35;
    sosGroup.add(panel);

    this.sceneryGroup.add(sosGroup);
  }

  private addStreetLight(x: number, z: number, isRightSide: boolean): void {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(x, 0, z);

    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.0, 6);
    const pole = new THREE.Mesh(poleGeo, RoadSegment.streetLightMaterial);
    pole.position.y = 3.0;
    pole.castShadow = false;
    poleGroup.add(pole);

    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);
    const arm = new THREE.Mesh(armGeo, RoadSegment.streetLightMaterial);
    arm.rotation.z = isRightSide ? Math.PI / 3.2 : -Math.PI / 3.2;
    arm.position.set(isRightSide ? -1.0 : 1.0, 5.8, 0);
    poleGroup.add(arm);

    const lampGeo = new THREE.BoxGeometry(0.6, 0.2, 0.4);
    const lamp = new THREE.Mesh(lampGeo, RoadSegment.lightGlowMaterial);
    lamp.position.set(isRightSide ? -2.2 : 2.2, 6.4, 0);
    poleGroup.add(lamp);

    // Warm ambient ground light decal pool beneath the streetlight
    const decalGeo = new THREE.PlaneGeometry(12.0, 12.0);
    const groundDecal = new THREE.Mesh(decalGeo, RoadSegment.streetlightGlowDecalMaterial);
    groundDecal.rotation.x = -Math.PI / 2;
    groundDecal.position.set(isRightSide ? -2.0 : 2.0, 0.03, 0);
    poleGroup.add(groundDecal);

    this.streetLightsGroup.add(poleGroup);
  }

  // --- BOSPHORUS MAIDEN'S TOWER (KIZ KULESI) 3D ARCHITECTURE ---

  private addMaidensTower(roadBoundaryX: number, segLength: number): void {
    const towerGroup = new THREE.Group();
    // Position Maiden's Tower gracefully on the water off to the right side of the Bosphorus bridge
    const posX = roadBoundaryX + 70;
    const posZ = segLength * 0.45;
    towerGroup.position.set(posX, -1.1, posZ);

    // 1. Rocky islet / Stone foundation base
    const islandGeo = new THREE.CylinderGeometry(15, 18, 3.2, 12);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x4a4e69, roughness: 0.9 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = 1.6;
    island.receiveShadow = true;
    towerGroup.add(island);

    // 2. Polygonal fortress courtyard wall
    const fortressGeo = new THREE.CylinderGeometry(11.5, 12.2, 4.8, 8);
    const fortress = new THREE.Mesh(fortressGeo, RoadSegment.maidensTowerStoneMaterial);
    fortress.position.y = 3.2 + 2.4;
    fortress.castShadow = false;
    fortress.receiveShadow = true;
    towerGroup.add(fortress);

    // Fortress parapets / battlements
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bGeo = new THREE.BoxGeometry(2.4, 0.9, 0.8);
      const b = new THREE.Mesh(bGeo, RoadSegment.maidensTowerStoneMaterial);
      b.position.set(Math.cos(angle) * 11.2, 3.2 + 5.2, Math.sin(angle) * 11.2);
      b.rotation.y = -angle;
      towerGroup.add(b);
    }

    // 3. Central octagonal white tower body
    const towerBodyGeo = new THREE.CylinderGeometry(4.2, 5.0, 11.0, 8);
    const towerBody = new THREE.Mesh(towerBodyGeo, RoadSegment.maidensTowerStoneMaterial);
    towerBody.position.y = 8.0 + 5.5;
    towerBody.castShadow = false;
    towerGroup.add(towerBody);

    // 4. Overhanging observation gallery / wooden balcony
    const galleryGeo = new THREE.CylinderGeometry(5.6, 4.2, 1.8, 8);
    const gallery = new THREE.Mesh(galleryGeo, RoadSegment.maidensTowerRoofMaterial);
    gallery.position.y = 19.5;
    towerGroup.add(gallery);

    // Balcony handrail
    const railGeo = new THREE.CylinderGeometry(5.7, 5.7, 0.8, 8, 1, true);
    const rail = new THREE.Mesh(railGeo, RoadSegment.maidensTowerStoneMaterial);
    rail.position.y = 20.6;
    towerGroup.add(rail);

    // 5. Upper Lantern Room (Fener Odası) with glowing warm glass
    const lanternGeo = new THREE.CylinderGeometry(2.8, 2.8, 3.4, 8);
    const lantern = new THREE.Mesh(lanternGeo, RoadSegment.lightGlowMaterial);
    lantern.position.y = 22.0;
    towerGroup.add(lantern);

    // 6. Conical Ottoman lead dome roof
    const domeGeo = new THREE.ConeGeometry(3.6, 5.2, 16);
    const dome = new THREE.Mesh(domeGeo, RoadSegment.maidensTowerRoofMaterial);
    dome.position.y = 23.7 + 2.6;
    dome.castShadow = false;
    towerGroup.add(dome);

    // Golden Crescent Finial (Hilal Alemi)
    const finialGeo = new THREE.CylinderGeometry(0.12, 0.25, 3.6, 6);
    const finialMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const finial = new THREE.Mesh(finialGeo, finialMat);
    finial.position.y = 29.5;
    towerGroup.add(finial);

    const crescentGeo = new THREE.TorusGeometry(0.55, 0.12, 6, 12, Math.PI * 1.5);
    const crescent = new THREE.Mesh(crescentGeo, finialMat);
    crescent.position.set(0, 31.5, 0);
    crescent.rotation.z = Math.PI / 4;
    towerGroup.add(crescent);

    // 7. Rotating Maritime Lighthouse Beacon (Dual rotating conical light beams)
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 22.0, 0);

    // Forward beam
    const beamGeo = new THREE.ConeGeometry(16.0, 95.0, 16, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 47.5);

    const beam1 = new THREE.Mesh(beamGeo, RoadSegment.maidensTowerBeaconBeamMaterial);
    beaconGroup.add(beam1);

    // Opposite rear beam (180 degrees)
    const beam2 = new THREE.Mesh(beamGeo, RoadSegment.maidensTowerBeaconBeamMaterial);
    beam2.rotation.y = Math.PI;
    beaconGroup.add(beam2);

    towerGroup.add(beaconGroup);
    this.maidensTowerBeam = beaconGroup;

    // Add floodlight glow on the tower base
    const baseGlowGeo = new THREE.SphereGeometry(6.5, 8, 8);
    const baseGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffeedd,
      transparent: true,
      opacity: 0.18,
    });
    const baseGlow = new THREE.Mesh(baseGlowGeo, baseGlowMat);
    baseGlow.position.y = 9.0;
    towerGroup.add(baseGlow);

    this.bridgeMeshGroup.add(towerGroup);
  }

  // --- AVRASYA / TEM HIGHWAY TUNNEL ARCHITECTURE ---

  private buildTunnel(roadBoundaryX: number, segLength: number, env: EnvironmentPreset = 'DAY'): void {
    const tunnelHeight = 7.6;
    const tunnelSpan = roadBoundaryX * 2 + 1.2;
    const halfSpan = tunnelSpan / 2;

    // 1. Tiled Side Walls (Left and Right)
    const wallGeo = new THREE.BoxGeometry(0.8, tunnelHeight, segLength);

    const leftWall = new THREE.Mesh(wallGeo, RoadSegment.tunnelWallMaterial);
    leftWall.position.set(-halfSpan, tunnelHeight / 2, segLength / 2);
    leftWall.receiveShadow = true;
    this.tunnelGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, RoadSegment.tunnelWallMaterial);
    rightWall.position.set(halfSpan, tunnelHeight / 2, segLength / 2);
    rightWall.receiveShadow = true;
    this.tunnelGroup.add(rightWall);

    // 2. Concrete Ceiling Vault Slab
    const ceilingGeo = new THREE.BoxGeometry(tunnelSpan + 1.6, 0.8, segLength);
    const ceiling = new THREE.Mesh(ceilingGeo, RoadSegment.tunnelCeilingMaterial);
    ceiling.position.set(0, tunnelHeight + 0.4, segLength / 2);
    ceiling.receiveShadow = true;
    this.tunnelGroup.add(ceiling);

    // Arched chamfers connecting walls to ceiling
    const chamferGeo = new THREE.BoxGeometry(1.6, 0.4, segLength);
    const leftChamfer = new THREE.Mesh(chamferGeo, RoadSegment.tunnelCeilingMaterial);
    leftChamfer.position.set(-halfSpan + 0.8, tunnelHeight - 0.2, segLength / 2);
    leftChamfer.rotation.z = Math.PI / 4;
    this.tunnelGroup.add(leftChamfer);

    const rightChamfer = new THREE.Mesh(chamferGeo, RoadSegment.tunnelCeilingMaterial);
    rightChamfer.position.set(halfSpan - 0.8, tunnelHeight - 0.2, segLength / 2);
    rightChamfer.rotation.z = -Math.PI / 4;
    this.tunnelGroup.add(rightChamfer);

    // 3. Overhead Continuous LED Tube Lighting (Two parallel longitudinal tracks)
    const tubeGeo = new THREE.CylinderGeometry(0.1, 0.1, segLength, 6);
    tubeGeo.rotateX(Math.PI / 2);

    const leftTube = new THREE.Mesh(tubeGeo, RoadSegment.tunnelTubeLightMaterial);
    leftTube.position.set(-halfSpan * 0.55, tunnelHeight - 0.15, segLength / 2);
    this.tunnelGroup.add(leftTube);

    const rightTube = new THREE.Mesh(tubeGeo, RoadSegment.tunnelTubeLightMaterial);
    rightTube.position.set(halfSpan * 0.55, tunnelHeight - 0.15, segLength / 2);
    this.tunnelGroup.add(rightTube);

    // 4. Heavy Industrial Jet Fans (Ceiling ventilation)
    const fanPositionsZ = [segLength * 0.25, segLength * 0.75];
    const fanGeo = new THREE.CylinderGeometry(0.85, 0.85, 3.4, 12);
    fanGeo.rotateX(Math.PI / 2);
    const bracketGeo = new THREE.BoxGeometry(0.18, 1.2, 0.18);

    for (const fz of fanPositionsZ) {
      for (const fx of [-halfSpan * 0.5, halfSpan * 0.5]) {
        const fanGroup = new THREE.Group();
        fanGroup.position.set(fx, tunnelHeight - 1.2, fz);

        const housing = new THREE.Mesh(fanGeo, RoadSegment.tunnelFanMaterial);
        housing.castShadow = false;
        fanGroup.add(housing);

        // Ceiling mounting brackets
        const b1 = new THREE.Mesh(bracketGeo, RoadSegment.tunnelFanMaterial);
        b1.position.set(0, 0.9, -1.0);
        fanGroup.add(b1);

        const b2 = new THREE.Mesh(bracketGeo, RoadSegment.tunnelFanMaterial);
        b2.position.set(0, 0.9, 1.0);
        fanGroup.add(b2);

        // Orange warning spinner cone
        const coneGeo = new THREE.ConeGeometry(0.42, 0.9, 8);
        coneGeo.rotateX(-Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xff6b35 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(0, 0, 1.8);
        fanGroup.add(cone);

        this.tunnelGroup.add(fanGroup);
      }
    }

    // 5. Illuminated Emergency Exit Doors & Green Pictogram Signs (Acil Çıkış)
    const exitDoorsZ = [segLength * 0.2, segLength * 0.7];
    const doorGeo = new THREE.BoxGeometry(0.1, 2.6, 1.4);
    const exitSignGeo = new THREE.BoxGeometry(0.12, 0.55, 1.4);
    const exitSignMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    for (const dz of exitDoorsZ) {
      // Left side exit door
      const leftDoor = new THREE.Mesh(doorGeo, RoadSegment.tunnelEmergencyDoorMaterial);
      leftDoor.position.set(-halfSpan + 0.38, 1.3, dz);
      this.tunnelGroup.add(leftDoor);

      const leftSign = new THREE.Mesh(exitSignGeo, exitSignMat);
      leftSign.position.set(-halfSpan + 0.38, 2.9, dz);
      this.tunnelGroup.add(leftSign);

      // Right side exit door
      const rightDoor = new THREE.Mesh(doorGeo, RoadSegment.tunnelEmergencyDoorMaterial);
      rightDoor.position.set(halfSpan - 0.38, 1.3, dz);
      this.tunnelGroup.add(rightDoor);

      const rightSign = new THREE.Mesh(exitSignGeo, exitSignMat);
      rightSign.position.set(halfSpan - 0.38, 2.9, dz);
      this.tunnelGroup.add(rightSign);
    }

    // 6. Tunnel Portal Arch / VMS Signage at segment entrance
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, 2);

    const portalArchGeo = new THREE.BoxGeometry(tunnelSpan + 2.4, 2.2, 1.8);
    const portalArch = new THREE.Mesh(portalArchGeo, RoadSegment.tunnelCeilingMaterial);
    portalArch.position.set(0, tunnelHeight + 1.1, 0);
    portalGroup.add(portalArch);

    const portalMat = RoadSegment.tunnelPortalMaterialsMap.get(env) || RoadSegment.tunnelCeilingMaterial;
    const bannerGeo = new THREE.PlaneGeometry(tunnelSpan * 0.72, 1.4);
    const banner = new THREE.Mesh(bannerGeo, portalMat);
    banner.position.set(0, tunnelHeight + 1.1, -1.0);
    banner.rotation.y = Math.PI;
    portalGroup.add(banner);

    // Bolu Dağı Alpine mountain rocky cut above tunnel portal
    if (env === 'SUNSET') {
      const rockFacadeGeo = new THREE.BoxGeometry(tunnelSpan + 14, 12, 4.0);
      const rockFacade = new THREE.Mesh(rockFacadeGeo, RoadSegment.rockWallMaterial);
      rockFacade.position.set(0, tunnelHeight + 6.0, 1.0);
      portalGroup.add(rockFacade);
    }

    this.tunnelGroup.add(portalGroup);
  }

  // --- MODERN STEEL & GLASS PEDESTRIAN OVERPASS (YAYA ÜST GEÇİDİ) ---

  private addPedestrianOverpass(roadBoundaryX: number, z: number): void {
    const overpassGroup = new THREE.Group();
    overpassGroup.position.set(0, 0, z);

    const clearanceHeight = 6.4;
    const spanWidth = roadBoundaryX * 2 + 5.0;
    const walkwayWidth = 2.4;

    // 1. Main horizontal walkway bridge deck
    const deckGeo = new THREE.BoxGeometry(spanWidth, 0.45, walkwayWidth);
    const deck = new THREE.Mesh(deckGeo, RoadSegment.overpassSteelMaterial);
    deck.position.set(0, clearanceHeight, 0);
    deck.castShadow = false;
    deck.receiveShadow = true;
    overpassGroup.add(deck);

    // 2. Modern glass safety railings
    const glassGeo = new THREE.BoxGeometry(spanWidth, 1.25, 0.06);

    const frontGlass = new THREE.Mesh(glassGeo, RoadSegment.overpassGlassMaterial);
    frontGlass.position.set(0, clearanceHeight + 0.85, walkwayWidth / 2);
    overpassGroup.add(frontGlass);

    const backGlass = new THREE.Mesh(glassGeo, RoadSegment.overpassGlassMaterial);
    backGlass.position.set(0, clearanceHeight + 0.85, -walkwayWidth / 2);
    overpassGroup.add(backGlass);

    // Steel top handrail tubes
    const railGeo = new THREE.BoxGeometry(spanWidth, 0.08, 0.12);
    const topRail1 = new THREE.Mesh(railGeo, RoadSegment.overpassSteelMaterial);
    topRail1.position.set(0, clearanceHeight + 1.5, walkwayWidth / 2);
    overpassGroup.add(topRail1);

    const topRail2 = new THREE.Mesh(railGeo, RoadSegment.overpassSteelMaterial);
    topRail2.position.set(0, clearanceHeight + 1.5, -walkwayWidth / 2);
    overpassGroup.add(topRail2);

    // 3. Arched tubular roof canopy
    const canopyRoofGeo = new THREE.BoxGeometry(spanWidth, 0.2, walkwayWidth + 0.6);
    const canopyRoof = new THREE.Mesh(canopyRoofGeo, RoadSegment.overpassSteelMaterial);
    canopyRoof.position.set(0, clearanceHeight + 2.5, 0);
    canopyRoof.castShadow = false;
    overpassGroup.add(canopyRoof);

    // Arched canopy ribs
    const ribGeo = new THREE.BoxGeometry(0.12, 1.1, walkwayWidth + 0.6);
    const ribCount = 9;
    for (let r = 0; r < ribCount; r++) {
      const rx = -spanWidth / 2 + (r / (ribCount - 1)) * spanWidth;
      const rib = new THREE.Mesh(ribGeo, RoadSegment.overpassSteelMaterial);
      rib.position.set(rx, clearanceHeight + 1.95, 0);
      overpassGroup.add(rib);
    }

    // 4. Vertical Support Towers & Stairwells (Left and Right sides)
    const towerGeo = new THREE.BoxGeometry(2.2, clearanceHeight + 2.5, 2.8);

    const leftTower = new THREE.Mesh(towerGeo, RoadSegment.overpassSteelMaterial);
    leftTower.position.set(-spanWidth / 2 + 1.1, (clearanceHeight + 2.5) / 2, 0);
    leftTower.castShadow = false;
    overpassGroup.add(leftTower);

    const rightTower = new THREE.Mesh(towerGeo, RoadSegment.overpassSteelMaterial);
    rightTower.position.set(spanWidth / 2 - 1.1, (clearanceHeight + 2.5) / 2, 0);
    rightTower.castShadow = false;
    overpassGroup.add(rightTower);

    // 5. Overhead Istanbul Metropolitan Municipality Banner
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#005f73';
        ctx.fillRect(0, 0, 512, 96);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('İSTANBUL BÜYÜKŞEHİR BELEDİYESİ', 256, 38);
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#94d2bd';
        ctx.fillText('🚶 YAYA ÜST GEÇİDİ', 256, 72);
      }
      const bannerTex = new THREE.CanvasTexture(canvas);
      const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
      const bannerGeo = new THREE.PlaneGeometry(10.0, 1.4);

      const bannerFront = new THREE.Mesh(bannerGeo, bannerMat);
      bannerFront.position.set(0, clearanceHeight + 1.4, walkwayWidth / 2 + 0.08);
      overpassGroup.add(bannerFront);

      const bannerBack = new THREE.Mesh(bannerGeo, bannerMat);
      bannerBack.position.set(0, clearanceHeight + 1.4, -walkwayWidth / 2 - 0.08);
      bannerBack.rotation.y = Math.PI;
      overpassGroup.add(bannerBack);
    }

    this.sceneryGroup.add(overpassGroup);
  }

  // --- EMERGENCY SOS BREAKDOWN BAY (ACİL İMDAT CEBİ) ---

  private addEmergencyBay(roadBoundaryX: number, z: number): void {
    const bayGroup = new THREE.Group();
    // Placed along right highway shoulder
    const bayWidth = 3.6;
    const bayLength = 22.0;
    const bayX = roadBoundaryX + bayWidth / 2;
    bayGroup.position.set(bayX, 0, z);

    // 1. Asphalt pull-off bay apron
    const bayGeo = new THREE.PlaneGeometry(bayWidth, bayLength);
    const bay = new THREE.Mesh(bayGeo, RoadSegment.asphaltMaterial);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 0.02, 0);
    bay.receiveShadow = true;
    bayGroup.add(bay);

    // 2. Yellow hazard boundary stripe
    const stripeGeo = new THREE.PlaneGeometry(0.24, bayLength);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-bayWidth / 2 + 0.15, 0.025, 0);
    bayGroup.add(stripe);

    // 3. Orange Emergency SOS Call Pillar (Acil İmdat Direği)
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(bayWidth / 2 + 0.6, 0, 0);

    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.4, 8);
    const post = new THREE.Mesh(postGeo, RoadSegment.sosBayMaterial);
    post.position.y = 1.2;
    post.castShadow = false;
    pillarGroup.add(post);

    // SOS Box Housing
    const boxGeo = new THREE.BoxGeometry(0.5, 0.75, 0.4);
    const box = new THREE.Mesh(boxGeo, RoadSegment.sosBayMaterial);
    box.position.y = 1.65;
    box.castShadow = false;
    pillarGroup.add(box);

    // Solar panel on top
    const solarGeo = new THREE.BoxGeometry(0.65, 0.04, 0.45);
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x023e8a, roughness: 0.2, metalness: 0.9 });
    const solar = new THREE.Mesh(solarGeo, solarMat);
    solar.position.set(0, 2.15, 0);
    solar.rotation.x = 0.35;
    pillarGroup.add(solar);

    // Blue SOS Emblem
    if (typeof document !== 'undefined') {
      const sosEmblemGeo = new THREE.PlaneGeometry(0.38, 0.38);
      const sosCanvas = document.createElement('canvas');
      sosCanvas.width = 128;
      sosCanvas.height = 128;
      const sctx = sosCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#0077b6';
        sctx.fillRect(0, 0, 128, 128);
        sctx.fillStyle = '#ffffff';
        sctx.font = '900 44px "Segoe UI", Arial, sans-serif';
        sctx.textAlign = 'center';
        sctx.fillText('SOS', 64, 78);
      }
      const sosTex = new THREE.CanvasTexture(sosCanvas);
      const sosMat = new THREE.MeshBasicMaterial({ map: sosTex });
      const emblem = new THREE.Mesh(sosEmblemGeo, sosMat);
      emblem.position.set(-0.26, 1.65, 0);
      emblem.rotation.y = -Math.PI / 2;
      pillarGroup.add(emblem);
    }

    // Flashing amber call-box beacon LED
    const ledGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 2.3, 0);
    pillarGroup.add(led);

    bayGroup.add(pillarGroup);
    this.sceneryGroup.add(bayGroup);
  }

  public setPositionZ(z: number): void {
    this.mesh.position.z = z;
    this.mesh.position.x = 0;
    this.startZ = z;
    this.endZ = z + this.length;
  }

  public update(time: number, _delta: number): void {
    // 1. Dynamic Bosphorus Water shader time update
    RoadSegment.waterUniforms.uTime.value = time;

    // 2. 15 Temmuz Bridge Dynamic Cycling LED light show
    if (this.bridgeLights.length > 0) {
      for (let i = 0; i < this.bridgeLights.length; i++) {
        const puck = this.bridgeLights[i];
        const phase = Math.sin(time * 3.5 + puck.position.z * 0.15 + this.segmentIndex * 1.2);
        const mat = puck.material as THREE.MeshBasicMaterial;
        if (phase > 0.25) {
          mat.color.setHex(0xff0044); // Turkish Flag Red
        } else if (phase > -0.25) {
          mat.color.setHex(0xffffff); // Diamond White
        } else {
          mat.color.setHex(0x00f0ff); // Bosphorus Cyan
        }
      }
    }

    // 3. Strobe aircraft beacons on bridge towers
    if (this.beaconLights.length > 0) {
      const isStrobe = (time * 1.4) % 1.0 < 0.15;
      for (let i = 0; i < this.beaconLights.length; i++) {
        const mat = this.beaconLights[i].material as THREE.MeshBasicMaterial;
        mat.color.setHex(isStrobe ? 0xff1e40 : 0x330009);
      }
    }

    // 4. Rotating Maiden's Tower (Kız Kulesi) Maritime Lighthouse Beacon
    if (this.maidensTowerBeam) {
      this.maidensTowerBeam.rotation.y = time * 1.6;
    }

    // 5. Dynamic Bosphorus Cruise Ship gentle wave motion & sea cruising
    if (this.activeShip) {
      // Gentle ocean wave roll & pitch
      const roll = Math.sin(time * 1.4 + this.segmentIndex * 2.1) * 0.016;
      const pitch = Math.cos(time * 1.1 + this.segmentIndex * 1.7) * 0.012;
      const heave = Math.sin(time * 1.6 + this.segmentIndex * 1.9) * 0.08;

      this.activeShip.rotation.z = roll;
      this.activeShip.rotation.x = pitch;
      this.activeShip.position.y = this.shipBaseY + heave;

      // Slow realistic forward drift along the Bosphorus strait (~3.2 m/s)
      const driftSpeed = 3.2 * this.shipDirection;
      this.activeShip.position.z += driftSpeed * _delta;

      // Keep ship within smooth visible segment range
      const minZ = -this.length * 0.3;
      const maxZ = this.length * 1.3;
      if (this.activeShip.position.z > maxZ) {
        this.activeShip.position.z = minZ;
      } else if (this.activeShip.position.z < minZ) {
        this.activeShip.position.z = maxZ;
      }
    }
  }

  // --- BOLU DAĞI ALPINE FLORA & LANDSCAPE ARCHITECTURE ---

  public createSpruceTreeMesh(scale = 1.0): THREE.Group {
    const spruceGroup = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.4, 6);
    const trunk = new THREE.Mesh(trunkGeo, RoadSegment.treeTrunkMaterial);
    trunk.position.y = 1.2;
    spruceGroup.add(trunk);

    // 4 Conical evergreen spruce tiers with tiered overhangs
    const tiers = [
      { r: 2.2, h: 2.6, y: 3.0, mat: RoadSegment.spruceFoliageMaterials[0] || RoadSegment.treeFoliageMaterials[0] },
      { r: 1.7, h: 2.4, y: 4.8, mat: RoadSegment.spruceFoliageMaterials[1] || RoadSegment.treeFoliageMaterials[1] },
      { r: 1.2, h: 2.2, y: 6.4, mat: RoadSegment.spruceFoliageMaterials[2] || RoadSegment.treeFoliageMaterials[2] },
      { r: 0.7, h: 1.8, y: 7.8, mat: RoadSegment.spruceFoliageMaterials[0] || RoadSegment.treeFoliageMaterials[0] },
    ];

    for (const t of tiers) {
      const coneGeo = new THREE.ConeGeometry(t.r, t.h, 7);
      const cone = new THREE.Mesh(coneGeo, t.mat);
      cone.position.y = t.y;
      cone.castShadow = false;
      spruceGroup.add(cone);
    }

    spruceGroup.scale.set(scale, scale, scale);
    return spruceGroup;
  }

  private addSpruceTree(x: number, z: number, scale = 1.0): void {
    const spruce = this.createSpruceTreeMesh(scale);
    spruce.position.set(x, 0, z);
    this.sceneryGroup.add(spruce);
  }

  private addMountainRockWall(roadBoundaryX: number, segLength: number, isRightSide: boolean): void {
    const rockGroup = new THREE.Group();
    const bx = isRightSide ? roadBoundaryX + 4.5 : -(roadBoundaryX + 4.5);
    rockGroup.position.set(bx, 0, 0);

    const rockCount = Math.floor(segLength / 9);
    for (let i = 0; i < rockCount; i++) {
      const rz = i * 9 + 4.5;
      const rockGeo = new THREE.DodecahedronGeometry(3.5 + Math.random() * 1.5, 1);
      const rock = new THREE.Mesh(rockGeo, RoadSegment.rockWallMaterial);
      rock.position.set((Math.random() - 0.5) * 2, 2.5 + Math.random() * 1.2, rz);
      rock.scale.set(1.4, 2.0, 1.8);
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      rock.receiveShadow = true;
      rockGroup.add(rock);
    }
    this.terrainGroup.add(rockGroup);
  }

  private addBoluChalet(x: number, z: number, facingRoad: 'left' | 'right'): void {
    const chaletGroup = new THREE.Group();
    chaletGroup.position.set(x, 0, z);

    // 1. Log Cabin Main House
    const bodyGeo = new THREE.BoxGeometry(10, 4.6, 7.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.85 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.3;
    body.receiveShadow = true;
    chaletGroup.add(body);

    // 2. Steep Alpine A-Frame Roof
    const roofGeo = new THREE.ConeGeometry(6.4, 3.8, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.6 + 1.9;
    roof.rotation.y = Math.PI / 4;
    chaletGroup.add(roof);

    // 3. Stone Chimney with rising smoke feel
    const chimneyGeo = new THREE.BoxGeometry(0.9, 5.0, 0.9);
    const chimney = new THREE.Mesh(chimneyGeo, RoadSegment.rockWallMaterial);
    chimney.position.set(2.8, 5.0, 1.2);
    chaletGroup.add(chimney);

    // 4. Warm Glowing Alpine Windows
    const winGeo = new THREE.PlaneGeometry(1.6, 1.2);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    const win1 = new THREE.Mesh(winGeo, winMat);
    win1.position.set(facingRoad === 'left' ? -5.01 : 5.01, 2.4, 1.4);
    win1.rotation.y = facingRoad === 'left' ? -Math.PI / 2 : Math.PI / 2;
    chaletGroup.add(win1);

    const win2 = new THREE.Mesh(winGeo, winMat);
    win2.position.set(facingRoad === 'left' ? -5.01 : 5.01, 2.4, -1.4);
    win2.rotation.y = facingRoad === 'left' ? -Math.PI / 2 : Math.PI / 2;
    chaletGroup.add(win2);

    // 5. Lighted Billboard Roof Sign: "BOLU DAĞI ET MANGAL"
    if (typeof document !== 'undefined') {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256;
      signCanvas.height = 64;
      const sctx = signCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#800e13';
        sctx.fillRect(0, 0, 256, 64);
        sctx.strokeStyle = '#ffd166';
        sctx.lineWidth = 4;
        sctx.strokeRect(4, 4, 248, 56);
        sctx.fillStyle = '#ffffff';
        sctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        sctx.textAlign = 'center';
        sctx.fillText('BOLU DAĞI ET MANGAL', 128, 28);
        sctx.fillStyle = '#ffd166';
        sctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        sctx.fillText('MEŞHUR KÖFTE & SUCUK', 128, 50);
      }
      const sTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: sTex });
      const signGeo = new THREE.PlaneGeometry(5.2, 1.4);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(facingRoad === 'left' ? -5.05 : 5.05, 5.0, 0);
      signMesh.rotation.y = facingRoad === 'left' ? -Math.PI / 2 : Math.PI / 2;
      chaletGroup.add(signMesh);
    }

    this.sceneryGroup.add(chaletGroup);
  }

  private addBoluAlpineTerrain(roadBoundaryX: number, segLength: number): void {
    const terrainWidth = 140;
    const slopeGeo = new THREE.PlaneGeometry(terrainWidth, segLength);

    // Left steep forested mountain slope
    const leftSlope = new THREE.Mesh(slopeGeo, RoadSegment.grassMaterial);
    leftSlope.rotation.x = -Math.PI / 2;
    leftSlope.rotation.y = 0.08;
    leftSlope.position.set(-roadBoundaryX - terrainWidth / 2, 3.5, segLength / 2);
    leftSlope.receiveShadow = true;
    this.terrainGroup.add(leftSlope);

    // Right steep forested mountain slope
    const rightSlope = new THREE.Mesh(slopeGeo, RoadSegment.grassMaterial);
    rightSlope.rotation.x = -Math.PI / 2;
    rightSlope.rotation.y = -0.08;
    rightSlope.position.set(roadBoundaryX + terrainWidth / 2, 3.5, segLength / 2);
    rightSlope.receiveShadow = true;
    this.terrainGroup.add(rightSlope);

    // Dark dirt verge on outer shoulder
    const vergeGeo = new THREE.PlaneGeometry(2.4, segLength);
    const leftVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    leftVerge.rotation.x = -Math.PI / 2;
    leftVerge.position.set(-roadBoundaryX - 1.2, 0.04, segLength / 2);
    this.terrainGroup.add(leftVerge);

    const rightVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    rightVerge.rotation.x = -Math.PI / 2;
    rightVerge.position.set(roadBoundaryX + 1.2, 0.04, segLength / 2);
    this.terrainGroup.add(rightVerge);
  }

  private addBoluAlpineScenery(roadBoundaryX: number, segLength: number): void {
    // 1. Rocky mountain cut along roadside
    const rockSideRight = this.segmentIndex % 2 === 0;
    this.addMountainRockWall(roadBoundaryX, segLength, rockSideRight);

    // 2. Dense alpine spruces on both embankments
    const treeSpacing = 9.0;
    const count = Math.floor(segLength / treeSpacing);

    for (let i = 0; i < count; i++) {
      const z = i * treeSpacing + 4.5;
      const s1 = 0.9 + (i % 3) * 0.25;
      const s2 = 0.85 + ((i + 1) % 3) * 0.3;

      // Left spruce forest
      const lx = -(roadBoundaryX + 6.0 + (i % 4) * 4.5);
      this.addSpruceTree(lx, z, s1);

      // Right spruce forest
      const rx = roadBoundaryX + 6.0 + ((i + 2) % 4) * 4.5;
      this.addSpruceTree(rx, z, s2);

      // Deep background forest row
      if (i % 2 === 0) {
        this.addSpruceTree(-(roadBoundaryX + 24.0 + (i % 3) * 6), z + 3, 1.4);
        this.addSpruceTree(roadBoundaryX + 24.0 + ((i + 1) % 3) * 6, z + 3, 1.4);
      }
    }

    // 3. Iconic Bolu Dağı Chalet Mangal
    if (this.segmentIndex % 5 === 2) {
      this.addBoluChalet(roadBoundaryX + 16.0, segLength * 0.5, 'left');
    }

    // 4. Milestone
    if (this.segmentIndex % 2 === 0) {
      this.addKilometerStone(roadBoundaryX + 0.35, segLength * 0.3, 'SUNSET');
    }
    if (this.segmentIndex % 4 === 2) {
      this.addSosBox(roadBoundaryX + 0.45, segLength * 0.75);
    }

    // 5. Cantilever exit sign (Abant / Yedigöller)
    if (this.segmentIndex % 4 === 2) {
      const exitSignIdx = Math.floor(this.segmentIndex / 4);
      this.addCantileverExitSign(roadBoundaryX, segLength * 0.6, exitSignIdx, 'SUNSET');
    }

    // 6. Billboard
    if (this.segmentIndex % 3 === 2) {
      const signs = RoadSegment.billboardMaterialsMap.get('SUNSET') || RoadSegment.billboardMaterials;
      const billboardMat = signs[this.segmentIndex % signs.length];
      if (billboardMat) {
        this.addHighwayBillboard(roadBoundaryX + 16.0, segLength * 0.5, billboardMat, true);
      }
    }
  }

  // --- ANKARA - NİĞDE OTOYOLU BOZKIR STEPPE SCENERY ---

  private addBozkirScrub(x: number, z: number): void {
    const scrubGeo = new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.3, 0);
    const scrub = new THREE.Mesh(scrubGeo, RoadSegment.bozkirBushMaterial);
    scrub.position.set(x, 0.35, z);
    scrub.scale.set(1.5, 0.7, 1.5);
    this.sceneryGroup.add(scrub);
  }

  private addSolarSosTower(x: number, z: number): void {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, 0, z);

    // Slim white Smart Highway sensor mast
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.2, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 2.6;
    towerGroup.add(mast);

    // Solar PV panel
    const solarGeo = new THREE.BoxGeometry(0.9, 0.05, 0.65);
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x03045e, metalness: 0.9, roughness: 0.2 });
    const solar = new THREE.Mesh(solarGeo, solarMat);
    solar.position.set(0, 4.2, 0);
    solar.rotation.x = 0.45;
    towerGroup.add(solar);

    // IoT Sensor Dome & Pulsing LED
    const domeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, 5.2, 0);
    towerGroup.add(dome);

    this.sceneryGroup.add(towerGroup);
  }

  private addBozkirTerrain(roadBoundaryX: number, segLength: number): void {
    const terrainWidth = 240;
    const steppeGeo = new THREE.PlaneGeometry(terrainWidth, segLength);

    // Left flat steppe
    const leftSteppe = new THREE.Mesh(steppeGeo, RoadSegment.bozkirGrassMaterial);
    leftSteppe.rotation.x = -Math.PI / 2;
    leftSteppe.position.set(-roadBoundaryX - terrainWidth / 2, 0, segLength / 2);
    leftSteppe.receiveShadow = true;
    this.terrainGroup.add(leftSteppe);

    // Right flat steppe
    const rightSteppe = new THREE.Mesh(steppeGeo, RoadSegment.bozkirGrassMaterial);
    rightSteppe.rotation.x = -Math.PI / 2;
    rightSteppe.position.set(roadBoundaryX + terrainWidth / 2, 0, segLength / 2);
    rightSteppe.receiveShadow = true;
    this.terrainGroup.add(rightSteppe);

    // Dusty gravel shoulder verge
    const vergeGeo = new THREE.PlaneGeometry(3.0, segLength);
    const leftVerge = new THREE.Mesh(vergeGeo, RoadSegment.bozkirDirtMaterial);
    leftVerge.rotation.x = -Math.PI / 2;
    leftVerge.position.set(-roadBoundaryX - 1.5, 0.04, segLength / 2);
    this.terrainGroup.add(leftVerge);

    const rightVerge = new THREE.Mesh(vergeGeo, RoadSegment.bozkirDirtMaterial);
    rightVerge.rotation.x = -Math.PI / 2;
    rightVerge.position.set(roadBoundaryX + 1.5, 0.04, segLength / 2);
    this.terrainGroup.add(rightVerge);
  }

  private addBozkirScenery(roadBoundaryX: number, segLength: number): void {
    // 1. Low dry steppe scrubs (Geven / Step otları) scattered across horizon
    const scrubSpacing = 10.0;
    const count = Math.floor(segLength / scrubSpacing);

    for (let i = 0; i < count; i++) {
      const z = i * scrubSpacing + 5.0;
      this.addBozkirScrub(-(roadBoundaryX + 3.2 + (i % 3) * 2.5), z);
      this.addBozkirScrub(roadBoundaryX + 3.2 + ((i + 1) % 3) * 2.5, z);

      if (i % 2 === 0) {
        this.addBozkirScrub(-(roadBoundaryX + 12.0 + (i % 4) * 5), z + 3);
        this.addBozkirScrub(roadBoundaryX + 12.0 + ((i + 2) % 4) * 5, z + 3);
      }
    }

    // 2. Smart Highway Solar IoT Sensor Towers
    if (this.segmentIndex % 4 === 1) {
      this.addSolarSosTower(roadBoundaryX + 2.8, segLength * 0.4);
    }

    // 3. Milestone
    if (this.segmentIndex % 2 === 0) {
      this.addKilometerStone(roadBoundaryX + 0.35, segLength * 0.3, 'NIGHT');
    }
    if (this.segmentIndex % 4 === 2) {
      this.addSosBox(roadBoundaryX + 0.45, segLength * 0.75);
    }

    // 4. Cantilever exit sign (Kapadokya)
    if (this.segmentIndex % 4 === 2) {
      const exitSignIdx = Math.floor(this.segmentIndex / 4);
      this.addCantileverExitSign(roadBoundaryX, segLength * 0.6, exitSignIdx, 'NIGHT');
    }

    // 5. Billboard
    if (this.segmentIndex % 3 === 2) {
      const signs = RoadSegment.billboardMaterialsMap.get('NIGHT') || RoadSegment.billboardMaterials;
      const billboardMat = signs[this.segmentIndex % signs.length];
      if (billboardMat) {
        this.addHighwayBillboard(roadBoundaryX + 16.0, segLength * 0.5, billboardMat, true);
      }
    }
  }

  // --- İSTANBUL - İZMİR OTOYOLU (O-5) MEDITERRANEAN SCENERY ---

  private addOksijenRestFacility(x: number, z: number, isRightSide: boolean): void {
    const restGroup = new THREE.Group();
    restGroup.position.set(x, 0, z);

    // 1. Service Station Pavilion Building
    const bldgGeo = new THREE.BoxGeometry(18, 5.2, 10);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.5 });
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.y = 2.6;
    restGroup.add(bldg);

    // Glass facade
    const glassGeo = new THREE.PlaneGeometry(16, 3.8);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 2.5, isRightSide ? -5.02 : 5.02);
    if (isRightSide) glass.rotation.y = Math.PI;
    restGroup.add(glass);

    // 2. Fuel Station Canopy
    const canopyGeo = new THREE.BoxGeometry(14, 0.6, 8);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 5.2, isRightSide ? -9.5 : 9.5);
    restGroup.add(canopy);

    // Canopy fuel columns
    const colGeo = new THREE.CylinderGeometry(0.25, 0.25, 4.8, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
    for (const cx of [-4.5, 4.5]) {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(cx, 2.4, isRightSide ? -9.5 : 9.5);
      restGroup.add(col);
    }

    // 3. Illuminated "OKSİJEN O-3" Logo Sign
    if (typeof document !== 'undefined') {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256;
      signCanvas.height = 64;
      const sctx = signCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#0284c7';
        sctx.fillRect(0, 0, 256, 64);
        sctx.fillStyle = '#ffffff';
        sctx.font = '900 22px "Segoe UI", Arial, sans-serif';
        sctx.textAlign = 'center';
        sctx.fillText('OKSİJEN O-3', 128, 30);
        sctx.fillStyle = '#bae6fd';
        sctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        sctx.fillText('DİNLENME & YAŞAM ALANI', 128, 50);
      }
      const sTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: sTex });
      const signGeo = new THREE.PlaneGeometry(6.4, 1.6);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 5.8, isRightSide ? -5.05 : 5.05);
      if (isRightSide) signMesh.rotation.y = Math.PI;
      restGroup.add(signMesh);
    }

    this.sceneryGroup.add(restGroup);
  }

  private addIzmirOtoyolTerrain(roadBoundaryX: number, segLength: number): void {
    const terrainWidth = 140;
    const terrainGeo = new THREE.PlaneGeometry(terrainWidth, segLength);

    // Left Gulf shoreline terrain
    const leftTerrain = new THREE.Mesh(terrainGeo, RoadSegment.grassMaterial);
    leftTerrain.rotation.x = -Math.PI / 2;
    leftTerrain.position.set(-roadBoundaryX - terrainWidth / 2, 0, segLength / 2);
    leftTerrain.receiveShadow = true;
    this.terrainGroup.add(leftTerrain);

    // Right olive hills terrain
    const rightTerrain = new THREE.Mesh(terrainGeo, RoadSegment.grassMaterial);
    rightTerrain.rotation.x = -Math.PI / 2;
    rightTerrain.position.set(roadBoundaryX + terrainWidth / 2, 0, segLength / 2);
    rightTerrain.receiveShadow = true;
    this.terrainGroup.add(rightTerrain);

    // Dirt verge
    const vergeGeo = new THREE.PlaneGeometry(2.4, segLength);
    const leftVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    leftVerge.rotation.x = -Math.PI / 2;
    leftVerge.position.set(-roadBoundaryX - 1.2, 0.04, segLength / 2);
    this.terrainGroup.add(leftVerge);

    const rightVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    rightVerge.rotation.x = -Math.PI / 2;
    rightVerge.position.set(roadBoundaryX + 1.2, 0.04, segLength / 2);
    this.terrainGroup.add(rightVerge);
  }

  private addIzmirOtoyolScenery(roadBoundaryX: number, segLength: number): void {
    // 1. Acoustic sound barriers on certain segments
    if (this.segmentIndex % 4 === 1) {
      this.addSoundBarrier(roadBoundaryX, segLength, false);
    }
    if (this.segmentIndex % 4 === 3) {
      this.addSoundBarrier(roadBoundaryX, segLength, true);
    }

    // 2. Mediterranean Cypresses & Stone Pines
    const treeSpacing = 12.0;
    const count = Math.floor(segLength / treeSpacing);

    for (let i = 0; i < count; i++) {
      const z = i * treeSpacing + 6;
      if (i % 2 === 0) {
        this.addCypressTree(-(roadBoundaryX + 4.5 + (i % 3) * 1.5), z);
        this.addStonePine(roadBoundaryX + 4.5 + ((i + 1) % 3) * 1.5, z);
      } else {
        this.addStonePine(-(roadBoundaryX + 4.5 + (i % 3) * 1.5), z);
        this.addCypressTree(roadBoundaryX + 4.5 + ((i + 1) % 3) * 1.5, z);
      }
    }

    // 3. Iconic "O-3 Oksijen" Rest Area
    if (this.segmentIndex % 6 === 2) {
      this.addOksijenRestFacility(roadBoundaryX + 18.0, segLength * 0.5, true);
    }

    // 4. Milestone
    if (this.segmentIndex % 2 === 0) {
      this.addKilometerStone(roadBoundaryX + 0.35, segLength * 0.3, 'RAIN');
    }
    if (this.segmentIndex % 4 === 2) {
      this.addSosBox(roadBoundaryX + 0.45, segLength * 0.75);
    }

    // 5. Cantilever exit sign (Bursa / Balıkesir)
    if (this.segmentIndex % 4 === 2) {
      const exitSignIdx = Math.floor(this.segmentIndex / 4);
      this.addCantileverExitSign(roadBoundaryX, segLength * 0.6, exitSignIdx, 'RAIN');
    }

    // 6. Billboard
    if (this.segmentIndex % 3 === 2) {
      const signs = RoadSegment.billboardMaterialsMap.get('RAIN') || RoadSegment.billboardMaterials;
      const billboardMat = signs[this.segmentIndex % signs.length];
      if (billboardMat) {
        this.addHighwayBillboard(roadBoundaryX + 16.0, segLength * 0.5, billboardMat, true);
      }
    }
  }

  // --- DYNAMIC REBUILD FOR SEAMLESS HIGHWAY SWITCHING ---

  public rebuildSegmentTheme(): void {
    const clearGroup = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const child = grp.children[0];
        grp.remove(child);
        if ((child as any).geometry) (child as any).geometry.dispose?.();
      }
    };

    clearGroup(this.terrainGroup);
    clearGroup(this.sceneryGroup);
    clearGroup(this.bridgeMeshGroup);
    clearGroup(this.shipGroup);
    clearGroup(this.tunnelGroup);
    clearGroup(this.gantryGroup);
    clearGroup(this.streetLightsGroup);

    this.bridgeLights = [];
    this.beaconLights = [];
    this.maidensTowerBeam = null;
    this.activeShip = null;

    const totalRoadWidth = laneSystem.getTotalRoadWidth();
    const halfRoad = totalRoadWidth / 2;
    const shoulderWidth = laneSystem.shoulderWidth;
    const roadBoundaryX = halfRoad + shoulderWidth;

    this.buildThemeElements(roadBoundaryX, this.length);
    this.freezeStaticMatrices();
  }
}
