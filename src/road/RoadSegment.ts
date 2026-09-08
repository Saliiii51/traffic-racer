// Reusable Road Segment for infinite highway generation

import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/Constants';
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

  // 3D City, Bridge, Ship and Tunnel Groups
  public sceneryGroup: THREE.Group = new THREE.Group();
  public bridgeMeshGroup: THREE.Group = new THREE.Group();
  public shipGroup: THREE.Group = new THREE.Group();
  public tunnelGroup: THREE.Group = new THREE.Group();

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
  private static barrierMaterial: THREE.MeshStandardMaterial;
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
    this.mesh.add(this.sceneryGroup);
    this.mesh.add(this.bridgeMeshGroup);
    this.mesh.add(this.shipGroup);
    this.mesh.add(this.tunnelGroup);

    // Segment rhythm:
    // 0: Highway corridor with Pedestrian Overpass & SOS bay
    // 1: Bosphorus Bridge with LED Cables & Maiden's Tower
    // 2: Highway corridor with Green Gantry Signs & Rolling Hills
    // 3: Avrasya / TEM Highway Tunnel with LED Strips & Exhaust Echo
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

    this.barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x9a8c98,
      metalness: 0.65,
      roughness: 0.3,
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

    this.streetlightGlowDecalMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });

    // Generate authentic Turkish green highway sign textures & billboards & km stones
    this.initHighwaySignMaterials();
    this.initBillboardMaterials();
    this.initKmStoneMaterial();
  }

  private static initHighwaySignMaterials(): void {
    if (typeof document === 'undefined') return;

    const signConfigs = [
      {
        line1: '15 TEMMUZ ŞEHİTLER KÖPRÜSÜ',
        line2: 'KADIKÖY - BEŞİKTAŞ | BOĞAZİÇİ',
        sub: 'HGS / OGS GİRİŞİ',
      },
      {
        line1: 'E-5 KARAYOLU (D100)',
        line2: 'MECİDİYEKÖY - LEVENT - MASLAK',
        sub: '70 KM/S - ELEKTRONİK DENETLEME (EDS)',
      },
      {
        line1: 'FATİH SULTAN MEHMET KÖPRÜSÜ',
        line2: 'TEM OTOYOLU | EDİRNE - ANKARA',
        sub: 'OTOYOL BAĞLANTISI',
      },
      {
        line1: 'İSTANBUL ÇEVRE YOLU (O-1)',
        line2: 'ÜSKÜDAR - ÇAMLICA - ALTUNİZADE',
        sub: 'HIZ KORİDORU KONTROL NOKTASI',
      },
    ];

    for (const cfg of signConfigs) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Turkish Highway Green (RAL 6024)
        ctx.fillStyle = '#007f3d';
        ctx.fillRect(0, 0, 512, 160);

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, 496, 144);

        // Inner frame
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, 480, 128);

        // Text
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
      this.signMaterials.push(new THREE.MeshBasicMaterial({ map: texture }));
    }
  }

  private static initBillboardMaterials(): void {
    if (typeof document === 'undefined') return;

    const billboardConfigs = [
      {
        header: 'TÜRK HAVA YOLLARI',
        sub: 'WIDEN YOUR WORLD',
        badge: '✈ TURKISH AIRLINES',
        bg: '#c9182b',
        textColor: '#ffffff',
        accent: '#ffffff',
      },
      {
        header: 'İSTANBUL BOĞAZI',
        sub: 'İKİ KITAYI BİRLEŞTİREN ŞEHİR',
        badge: '⚓ HOŞ GELDİNİZ',
        bg: '#0077b6',
        textColor: '#ffffff',
        accent: '#90e0ef',
      },
      {
        header: 'TRAFİKTE DİKKAT HAYAT KURTARIR',
        sub: 'EMNİYET KEMERİNİZİ TAKINIZ',
        badge: '⚠ 112 ACİL ÇAĞRI',
        bg: '#14213d',
        textColor: '#fca311',
        accent: '#ffffff',
      },
      {
        header: "TÜRKİYE'NİN OTOMOBİLİ - TOGG",
        sub: 'DOĞUŞTAN ELEKTRİKLİ T10X',
        badge: '⚡ YOLCULUK BAŞLASIN',
        bg: '#03045e',
        textColor: '#00f5d4',
        accent: '#caf0f8',
      },
      {
        header: 'EDS ORTALAMA HIZ KORİDORU',
        sub: '70 KM/S - GÜVENLİ SÜRÜŞ',
        badge: '📷 RADAR DENETİMİ',
        bg: '#2b2d42',
        textColor: '#edf2f4',
        accent: '#d90429',
      },
    ];

    for (const cfg of billboardConfigs) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = cfg.bg;
        ctx.fillRect(0, 0, 512, 256);

        // Frame
        ctx.strokeStyle = cfg.accent;
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 492, 236);

        // Badge pill
        ctx.fillStyle = cfg.accent;
        ctx.fillRect(26, 24, 210, 36);
        ctx.fillStyle = cfg.bg;
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillText(cfg.badge, 36, 49);

        // Header
        ctx.fillStyle = cfg.textColor;
        ctx.font = '900 28px "Segoe UI", Arial, sans-serif';
        ctx.fillText(cfg.header, 26, 120);

        // Sub
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = cfg.accent;
        ctx.fillText(cfg.sub, 26, 175);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      this.billboardMaterials.push(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.4,
          metalness: 0.2,
        })
      );
    }
  }

  private static initKmStoneMaterial(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // White concrete base
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, 128, 256);

      // Red curved top cap
      ctx.fillStyle = '#d90429';
      ctx.fillRect(0, 0, 128, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KGM', 64, 42);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillText('O-1', 64, 110);
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('34', 64, 160);
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillStyle = '#d90429';
      ctx.fillText('KM', 64, 215);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    this.kmStoneMaterial = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
    });
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
    this.mesh.add(asphalt);

    // 2. Yellow Outer Shoulder Lines
    const shoulderLineGeo = new THREE.PlaneGeometry(0.2, segLength);
    const leftShoulder = new THREE.Mesh(shoulderLineGeo, RoadSegment.shoulderLineMaterial);
    leftShoulder.rotation.x = -Math.PI / 2;
    leftShoulder.position.set(-halfRoad + 0.15, 0.01, segLength / 2);
    this.mesh.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderLineGeo, RoadSegment.shoulderLineMaterial);
    rightShoulder.rotation.x = -Math.PI / 2;
    rightShoulder.position.set(halfRoad - 0.15, 0.01, segLength / 2);
    this.mesh.add(rightShoulder);

    // 3. Lane Divider Lines & Center Median
    const dashLength = 4.0;
    const dashGap = 4.0;
    const dashesCount = Math.floor(segLength / (dashLength + dashGap));
    const dashGeo = new THREE.PlaneGeometry(0.18, dashLength);

    this.oneWayCenterLineGroup = new THREE.Group();
    this.oneWayCenterLineGroup.name = 'OneWayCenterLineGroup';
    this.twoWayDividerGroup = new THREE.Group();
    this.twoWayDividerGroup.name = 'TwoWayDividerGroup';
    this.mesh.add(this.oneWayCenterLineGroup);
    this.mesh.add(this.twoWayDividerGroup);

    for (let l = 1; l < laneSystem.laneCount; l++) {
      const lineX = -halfRoad + l * laneSystem.laneWidth;
      const isCenterDivider = l === 2; // In 4-lane highway, l=2 is the center divider at x = 0

      if (!isCenterDivider) {
        // Outer lane dividers: InstancedMesh for 1 draw call per line
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
        this.mesh.add(instDashes);
      } else {
        // CENTER DIVIDER (x = 0):
        // 1) ONE-WAY MODE: InstancedMesh for dashed white line
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

        // 2) TWO-WAY MODE:
        // A. Double Solid Continuous Yellow Lines (Çift Düz Sarı Çizgi)
        const doubleYellowGeo = new THREE.PlaneGeometry(0.14, segLength);
        const leftYellow = new THREE.Mesh(doubleYellowGeo, RoadSegment.twoWayYellowMaterial);
        leftYellow.rotation.x = -Math.PI / 2;
        leftYellow.position.set(-0.13, 0.012, segLength / 2);
        this.twoWayDividerGroup.add(leftYellow);

        const rightYellow = new THREE.Mesh(doubleYellowGeo, RoadSegment.twoWayYellowMaterial);
        rightYellow.rotation.x = -Math.PI / 2;
        rightYellow.position.set(0.13, 0.012, segLength / 2);
        this.twoWayDividerGroup.add(rightYellow);

        // B. Amber Road Studs (Kedi Gözleri / Reflektörler) via single InstancedMesh
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

        // C. 3D Flexible Traffic Warning Delineators (Reflektörlü Yol Dubaları) at z = 7.5m and z = 22.5m
        const del1 = RoadSegment.createDelineatorPost();
        del1.position.set(0, 0, 7.5);
        this.twoWayDividerGroup.add(del1);

        const del2 = RoadSegment.createDelineatorPost();
        del2.position.set(0, 0, 22.5);
        this.twoWayDividerGroup.add(del2);

        // D. Asphalt Directional Warning Arrows (Asfalt Okları)
        const arrowGeo = new THREE.PlaneGeometry(1.9, 4.4);

        // Forward Driving Lanes (Right side of road, Lanes 0 & 1, x < 0): Forward White Arrows pointing ahead (▲)
        const fwdArrow0 = new THREE.Mesh(arrowGeo, RoadSegment.forwardArrowMaterial);
        fwdArrow0.rotation.set(-Math.PI / 2, 0, Math.PI);
        fwdArrow0.position.set(laneSystem.getLaneX(0), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(fwdArrow0);

        const fwdArrow1 = new THREE.Mesh(arrowGeo, RoadSegment.forwardArrowMaterial);
        fwdArrow1.rotation.set(-Math.PI / 2, 0, Math.PI);
        fwdArrow1.position.set(laneSystem.getLaneX(1), 0.015, segLength * 0.5);
        this.twoWayDividerGroup.add(fwdArrow1);

        // Oncoming Lanes (Left side of road, Lanes 2 & 3, x > 0): Reverse Warning Arrows pointing towards driver (▼)
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

    // Cat-eye highway reflectors (Kedi Gözü Reflektör) via single InstancedMesh
    const reflectorCount = Math.floor(segLength / 10);
    const reflectorGeo = new THREE.BoxGeometry(0.12, 0.05, 0.22);
    const reflectorMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const instReflectors = new THREE.InstancedMesh(reflectorGeo, reflectorMat, reflectorCount * 2);
    const dummyRefl = new THREE.Object3D();
    let rIdx = 0;
    for (let r = 0; r < reflectorCount; r++) {
      const refZ = r * 10 + 5;
      dummyRefl.position.set(-halfRoad + 0.2, 0.04, refZ);
      dummyRefl.updateMatrix();
      instReflectors.setMatrixAt(rIdx++, dummyRefl.matrix);

      dummyRefl.position.set(halfRoad - 0.2, 0.04, refZ);
      dummyRefl.updateMatrix();
      instReflectors.setMatrixAt(rIdx++, dummyRefl.matrix);
    }
    instReflectors.instanceMatrix.needsUpdate = true;
    this.mesh.add(instReflectors);

    // 4. Concrete Shoulders / Curbs
    const curbGeo = new THREE.BoxGeometry(shoulderWidth, 0.2, segLength);

    const leftCurb = new THREE.Mesh(curbGeo, RoadSegment.curbMaterial);
    leftCurb.position.set(-halfRoad - shoulderWidth / 2, 0.08, segLength / 2);
    leftCurb.receiveShadow = true;
    this.mesh.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, RoadSegment.curbMaterial);
    rightCurb.position.set(halfRoad + shoulderWidth / 2, 0.08, segLength / 2);
    rightCurb.receiveShadow = true;
    this.mesh.add(rightCurb);

    // 5. Guardrails / Crash Barriers
    const barrierHeight = GAME_CONSTANTS.ROAD.BARRIER_HEIGHT;
    const barrierGeo = new THREE.BoxGeometry(0.25, barrierHeight, segLength);

    const leftBarrier = new THREE.Mesh(barrierGeo, RoadSegment.barrierMaterial);
    leftBarrier.position.set(-halfRoad - shoulderWidth, barrierHeight / 2 + 0.1, segLength / 2);
    leftBarrier.castShadow = false;
    leftBarrier.receiveShadow = true;
    this.mesh.add(leftBarrier);

    const rightBarrier = new THREE.Mesh(barrierGeo, RoadSegment.barrierMaterial);
    rightBarrier.position.set(halfRoad + shoulderWidth, barrierHeight / 2 + 0.1, segLength / 2);
    rightBarrier.castShadow = false;
    rightBarrier.receiveShadow = true;
    this.mesh.add(rightBarrier);

    // 6. Theme specific layout: Bosphorus Bridge vs Avrasya Tunnel vs E-5 Highway
    if (this.isBridge) {
      // BOSPHORUS BRIDGE (15 Temmuz Şehitler Köprüsü / FSM)
      this.addBosphorusWater(roadBoundaryX, segLength);
      this.addSuspensionBridgeTower(roadBoundaryX, segLength);
      this.addMaidensTower(roadBoundaryX, segLength);

      // Add passing Istanbul Marine Vessel (Cruise Ship / Ferry)
      this.setupBosphorusShip();
    } else if (this.isTunnel) {
      // AVRASYA / TEM HIGHWAY TUNNEL
      this.buildTunnel(roadBoundaryX, segLength);
    } else {
      // E-5 / TEM CONTINENTAL HIGHWAY CORRIDOR
      this.addGrassTerrain(roadBoundaryX, segLength);
      this.addRoadsideScenery(roadBoundaryX, segLength);

      // Turkish Green Highway Sign Gantry with EDS Radar
      const signIndex = this.segmentIndex % (RoadSegment.signMaterials.length || 1);
      this.addHighwayGantry(roadBoundaryX, segLength * 0.65, signIndex);

      // Add modern pedestrian overpasses and emergency breakdown bays
      const cycle = this.segmentIndex % 4;
      if (cycle === 0) {
        this.addPedestrianOverpass(roadBoundaryX, segLength * 0.4);
      } else if (cycle === 2) {
        this.addEmergencyBay(roadBoundaryX, segLength * 0.5);
      }
    }

    // 7. Streetlights along highway (only outside tunnel!)
    if (!this.isTunnel) {
      const lightSpacing = 40;
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
    // Subdivided shared geometry for GPU Gerstner wave displacement
    if (!RoadSegment.waterGeometry) {
      RoadSegment.waterGeometry = new THREE.PlaneGeometry(waterWidth, segLength, 36, 24);
    }
    const leftWater = new THREE.Mesh(RoadSegment.waterGeometry, RoadSegment.bosphorusWaterMaterial);
    leftWater.rotation.x = -Math.PI / 2;
    leftWater.position.set(-roadBoundaryX - waterWidth / 2, -1.2, segLength / 2);
    this.mesh.add(leftWater);

    const rightWater = new THREE.Mesh(RoadSegment.waterGeometry, RoadSegment.bosphorusWaterMaterial);
    rightWater.rotation.x = -Math.PI / 2;
    rightWater.position.set(roadBoundaryX + waterWidth / 2, -1.2, segLength / 2);
    this.mesh.add(rightWater);
  }

  private addSuspensionBridgeTower(roadBoundaryX: number, segLength: number): void {
    const towerGroup = new THREE.Group();
    const towerZ = segLength / 2;
    towerGroup.position.set(0, 0, towerZ);

    const pylonHeight = 32.0;
    const pylonWidth = 1.8;
    const pylonDepth = 2.2;
    const pylonGeo = new THREE.BoxGeometry(pylonWidth, pylonHeight, pylonDepth);

    // Left Vertical Pylon (Red)
    const leftPylon = new THREE.Mesh(pylonGeo, RoadSegment.bridgeTowerMaterial);
    leftPylon.position.set(-roadBoundaryX - 1.2, pylonHeight / 2 - 1.2, 0);
    leftPylon.castShadow = false;
    towerGroup.add(leftPylon);

    // Right Vertical Pylon (Red)
    const rightPylon = new THREE.Mesh(pylonGeo, RoadSegment.bridgeTowerMaterial);
    rightPylon.position.set(roadBoundaryX + 1.2, pylonHeight / 2 - 1.2, 0);
    rightPylon.castShadow = false;
    towerGroup.add(rightPylon);

    // White horizontal crossbeams connecting left & right towers
    const crossWidth = (roadBoundaryX + 1.2) * 2;
    const beamGeo = new THREE.BoxGeometry(crossWidth, 1.4, 1.6);

    const lowerBeam = new THREE.Mesh(beamGeo, RoadSegment.bridgeWhiteMaterial);
    lowerBeam.position.set(0, 13.5, 0);
    towerGroup.add(lowerBeam);

    const upperBeam = new THREE.Mesh(beamGeo, RoadSegment.bridgeWhiteMaterial);
    upperBeam.position.set(0, 26.5, 0);
    towerGroup.add(upperBeam);

    // Aircraft warning flashing red beacons on pylon tips
    const beaconGeo = new THREE.SphereGeometry(0.45, 8, 8);
    const leftBeacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff0033 }));
    leftBeacon.position.set(-roadBoundaryX - 1.2, pylonHeight - 1.0, 0);
    towerGroup.add(leftBeacon);
    this.beaconLights.push(leftBeacon);

    const rightBeacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff0033 }));
    rightBeacon.position.set(roadBoundaryX + 1.2, pylonHeight - 1.0, 0);
    towerGroup.add(rightBeacon);
    this.beaconLights.push(rightBeacon);

    // Suspension cables stretching from tower top along the segment
    this.addBridgeCables(towerGroup, roadBoundaryX, segLength);

    this.mesh.add(towerGroup);
  }

  private addBridgeCables(towerGroup: THREE.Group, roadBoundaryX: number, segLength: number): void {
    const halfLen = segLength / 2;
    const cableSteps = 6;
    const cableRadius = 0.08;

    for (let side = -1; side <= 1; side += 2) {
      const pylonX = side * (roadBoundaryX + 1.2);

      // Vertical hanger cables
      for (let i = -cableSteps; i <= cableSteps; i++) {
        if (i === 0) continue;
        const z = (i / cableSteps) * (halfLen * 0.95);
        const heightFactor = Math.pow(Math.abs(i) / cableSteps, 1.6);
        const cableTopY = 2.0 + (28.0 - 2.0) * (1.0 - heightFactor * 0.7);
        const hangerHeight = cableTopY - 0.5;

        const hangerGeo = new THREE.CylinderGeometry(cableRadius * 0.6, cableRadius * 0.6, hangerHeight, 4);
        const hanger = new THREE.Mesh(hangerGeo, RoadSegment.bridgeCableMaterial);
        hanger.position.set(pylonX, hangerHeight / 2 + 0.5, z);
        towerGroup.add(hanger);

        // Glowing bridge LED puck at deck level with dynamic colors
        const lightPuckGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
        const puckMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lightPuck = new THREE.Mesh(lightPuckGeo, puckMat);
        lightPuck.position.set(pylonX, 0.9, z);
        towerGroup.add(lightPuck);
        this.bridgeLights.push(lightPuck);

        // Glowing bridge LED node along main suspension cable curve
        const cableLedGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const cableLedMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const cableLed = new THREE.Mesh(cableLedGeo, cableLedMat);
        cableLed.position.set(pylonX, cableTopY, z);
        towerGroup.add(cableLed);
        this.bridgeLights.push(cableLed);
      }
    }
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

  private addHighwayGantry(roadBoundaryX: number, z: number, signIndex: number): void {
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

    // Large Green Turkish Highway Signboard
    const signMat = RoadSegment.signMaterials[signIndex % RoadSegment.signMaterials.length] || RoadSegment.gantryMaterial;
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

    this.mesh.add(gantryGroup);
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
    this.mesh.add(instTufts);

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
        this.mesh.add(instFlowers);
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
    this.mesh.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(sidewalkGeo, RoadSegment.sidewalkMaterial);
    rightSidewalk.rotation.x = -Math.PI / 2;
    rightSidewalk.position.set(roadBoundaryX + sidewalkWidth / 2, 0.04, segLength / 2);
    rightSidewalk.receiveShadow = true;
    this.mesh.add(rightSidewalk);

    // 2. Earthy Highway Roadside Verge (Banket) Transition Strip (1.6m width)
    const vergeWidth = 1.6;
    const vergeGeo = new THREE.PlaneGeometry(vergeWidth, segLength);

    const leftVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    leftVerge.rotation.x = -Math.PI / 2;
    leftVerge.position.set(-roadBoundaryX - sidewalkWidth - vergeWidth / 2, 0.02, segLength / 2);
    leftVerge.receiveShadow = true;
    this.mesh.add(leftVerge);

    const rightVerge = new THREE.Mesh(vergeGeo, RoadSegment.dirtVergeMaterial);
    rightVerge.rotation.x = -Math.PI / 2;
    rightVerge.position.set(roadBoundaryX + sidewalkWidth + vergeWidth / 2, 0.02, segLength / 2);
    rightVerge.receiveShadow = true;
    this.mesh.add(rightVerge);

    // 3. Sculpted Rolling Highway Embankment Terrain (60m width each side)
    const terrainWidth = 60;
    const vergeEdgeX = roadBoundaryX + sidewalkWidth + vergeWidth;

    const leftGeo = this.createEmbankmentGeometry(terrainWidth, segLength, false);
    const leftTerrain = new THREE.Mesh(leftGeo, RoadSegment.grassMaterial);
    leftTerrain.rotation.x = -Math.PI / 2;
    leftTerrain.position.set(-vergeEdgeX - terrainWidth / 2, 0, segLength / 2);
    leftTerrain.receiveShadow = true;
    this.mesh.add(leftTerrain);

    const rightGeo = this.createEmbankmentGeometry(terrainWidth, segLength, true);
    const rightTerrain = new THREE.Mesh(rightGeo, RoadSegment.grassMaterial);
    rightTerrain.rotation.x = -Math.PI / 2;
    rightTerrain.position.set(vergeEdgeX + terrainWidth / 2, 0, segLength / 2);
    rightTerrain.receiveShadow = true;
    this.mesh.add(rightTerrain);

    // 4. Dense 3D Volumetric Grass Blade Tufts & Wildflower Meadows (InstancedMesh)
    this.addGrassTuftsAndFlowers(vergeEdgeX, segLength);
  }

  private addRoadsideScenery(roadBoundaryX: number, segLength: number): void {
    // 1. Varied Botanical Greenery: Stylized Plane Trees, Italian Cypress, Judas Blossom Trees, and Flowering Bushes
    // Strictly lined up outside safety barrier (x >= 12.8m)
    const floraSpacing = 20;
    const floraCount = Math.floor(segLength / floraSpacing);

    for (let i = 0; i < floraCount; i++) {
      const z = i * floraSpacing + 10;
      const type = (i + this.segmentIndex) % 3;

      // Left side flora
      const leftX = -(roadBoundaryX + 2.7);
      if (type === 0) {
        this.addLushPlaneTree(leftX, z);
      } else if (type === 1) {
        this.addCypressTree(leftX, z);
      } else {
        this.addJudasTree(leftX, z);
      }

      // Right side flora
      const rightX = roadBoundaryX + 2.7;
      if (type === 0) {
        this.addCypressTree(rightX, z);
      } else if (type === 1) {
        this.addJudasTree(rightX, z);
      } else {
        this.addLushPlaneTree(rightX, z);
      }

      // Small flower bushes along barrier verge
      if (i % 2 === 0) {
        this.addRoadsideBush(-(roadBoundaryX + 1.6), z + 5);
        this.addRoadsideBush(roadBoundaryX + 1.6, z + 5);
      }
    }

    // 2. Turkish Highway Kilometer Stone (KGM) on every 2nd segment
    if (this.segmentIndex % 2 === 0) {
      this.addKilometerStone(roadBoundaryX + 0.35, segLength * 0.3);
    }

    // 3. Elevated Highway Advertising Billboard on alternating segments
    if (this.segmentIndex % 3 === 2) {
      const billboardMat = RoadSegment.billboardMaterials[this.segmentIndex % RoadSegment.billboardMaterials.length];
      if (billboardMat) {
        this.addHighwayBillboard(roadBoundaryX + 15.0, segLength * 0.5, billboardMat, true);
      }
    } else if (this.segmentIndex % 3 === 0) {
      const billboardMat = RoadSegment.billboardMaterials[(this.segmentIndex + 1) % RoadSegment.billboardMaterials.length];
      if (billboardMat) {
        this.addHighwayBillboard(-(roadBoundaryX + 15.0), segLength * 0.5, billboardMat, false);
      }
    }

    // 4. Authentic Istanbul Architecture (Clean, modern, aesthetic buildings - ZERO airplane pieces!)
    this.addRoadsideBuildings(roadBoundaryX, segLength);
  }

  private addRoadsideBuildings(roadBoundaryX: number, segLength: number): void {
    // Only place on open highway segments (skip bridge and tunnel)
    if (this.isBridge || this.isTunnel) return;
    if (!cityPackManager.hasBuildings) return;

    // Spaced intervals: place 1 lightweight Kenney building every 2nd segment, alternating sides
    // Segment 0: Right side (visible at race start)
    // Segment 2: Left side
    // Segment 4: Right side
    // Segment 6: Left side
    if (this.segmentIndex % 2 !== 0) return;

    const isRight = (this.segmentIndex / 2) % 2 === 0;
    const z = segLength * 0.45;

    if (isRight) {
      const rightX = roadBoundaryX + 15.0;
      const bldg = cityPackManager.createBuildingInstance('building-a', { facingRoad: 'right' });
      if (bldg) {
        bldg.position.set(rightX, 0, z);
        this.sceneryGroup.add(bldg);
      }
    } else {
      const leftX = -(roadBoundaryX + 15.0);
      const bldg = cityPackManager.createBuildingInstance('building-a', { facingRoad: 'left' });
      if (bldg) {
        bldg.position.set(leftX, 0, z);
        this.sceneryGroup.add(bldg);
      }
    }
  }

  public rebuildScenery(): void {
    if (this.isBridge) {
      this.rebuildShip();
      return;
    }
    // If building is not placed yet (e.g. loaded asynchronously), add it without touching other scenery
    const hasBldg = this.sceneryGroup.children.some((c) => c.name.startsWith('Building_'));
    if (!hasBldg) {
      const totalRoadWidth = laneSystem.getTotalRoadWidth();
      const halfRoad = totalRoadWidth / 2;
      const shoulderWidth = laneSystem.shoulderWidth;
      const roadBoundaryX = halfRoad + shoulderWidth;
      this.addRoadsideBuildings(roadBoundaryX, this.length);
    }
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
    this.mesh.add(treeGroup);
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
    this.mesh.add(judasGroup);
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
    this.mesh.add(cypressGroup);
  }

  private addRoadsideBush(x: number, z: number): void {
    const mat = RoadSegment.bushMaterials[Math.floor(Math.random() * RoadSegment.bushMaterials.length)];
    const bushGeo = new THREE.DodecahedronGeometry(0.42 + Math.random() * 0.25, 0);
    const bush = new THREE.Mesh(bushGeo, mat);
    bush.position.set(x, 0.3, z);
    bush.scale.set(1.2, 0.8, 1.2);
    this.mesh.add(bush);
  }

  private addKilometerStone(x: number, z: number): void {
    const stoneGroup = new THREE.Group();
    stoneGroup.position.set(x, 0, z);

    // Authentic Turkish KGM milestone prism
    const stoneGeo = new THREE.BoxGeometry(0.45, 0.75, 0.32);
    const stone = new THREE.Mesh(stoneGeo, RoadSegment.kmStoneMaterial);
    stone.position.y = 0.38;
    stone.castShadow = false;
    stoneGroup.add(stone);

    this.mesh.add(stoneGroup);
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

    this.mesh.add(billboardGroup);
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
    const decalGeo = new THREE.PlaneGeometry(8.5, 9.5);
    const groundDecal = new THREE.Mesh(decalGeo, RoadSegment.streetlightGlowDecalMaterial);
    groundDecal.rotation.x = -Math.PI / 2;
    groundDecal.position.set(isRightSide ? -2.2 : 2.2, 0.025, 0);
    poleGroup.add(groundDecal);

    this.mesh.add(poleGroup);
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

  private buildTunnel(roadBoundaryX: number, segLength: number): void {
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

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.strokeRect(6, 6, 500, 84);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AVRASYA TÜNELİ', 256, 42);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.fillText('HIZ SINIRI: 70 KM/S • RADAR EDS', 256, 74);
      }
      const portalTex = new THREE.CanvasTexture(canvas);
      const portalMat = new THREE.MeshBasicMaterial({ map: portalTex });
      const bannerGeo = new THREE.PlaneGeometry(tunnelSpan * 0.65, 1.4);
      const banner = new THREE.Mesh(bannerGeo, portalMat);
      banner.position.set(0, tunnelHeight + 1.1, -1.0);
      banner.rotation.y = Math.PI;
      portalGroup.add(banner);
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
}
