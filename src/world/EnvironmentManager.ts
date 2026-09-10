// Environment and Lighting Manager supporting 4 Dynamic Weather & Time Presets

import * as THREE from 'three';
import type { EnvironmentPreset } from '../core/Constants';
import { RoadSegment } from '../road/RoadSegment';
import { isMobileDevice } from '../utils/orientation';

interface CloudData {
  mesh: THREE.Group;
  baseX: number;
  baseY: number;
  relZ: number;
  speed: number;
}

interface SeagullData {
  group: THREE.Group;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  angleOffset: number;
  radius: number;
  speed: number;
  height: number;
  flapPhase: number;
}

export class EnvironmentManager {
  public group: THREE.Group;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private ambientLight!: THREE.AmbientLight;
  private skyDome!: THREE.Mesh;
  private distantMountains!: THREE.Group;
  private scene: THREE.Scene;

  // Sky Textures for each preset
  private skyTextures: Map<EnvironmentPreset, THREE.CanvasTexture> = new Map();

  // Celestial Bodies
  private sunGroup!: THREE.Group;
  private sunMesh!: THREE.Mesh;
  private sunCorona!: THREE.Mesh;
  private moonGroup!: THREE.Group;
  private starfield!: THREE.Points;

  // Cloud System
  private cloudsGroup!: THREE.Group;
  private clouds: CloudData[] = [];
  private cloudMaterial!: THREE.MeshStandardMaterial;

  // Bosphorus Seagull Flock
  private seagullsGroup!: THREE.Group;
  private seagulls: SeagullData[] = [];
  private gullAnimTime = 0;

  // Rain Particle System
  private rainSystem!: THREE.Points;
  private rainActive = false;
  private rainPositions!: Float32Array;
  private rainCount = 1200;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'EnvironmentManager';
    this.scene.add(this.group);

    this.initSkyTextures();
    this.setupLighting();
    this.setupSky();
    this.setupCelestialBodies();
    this.setupClouds();
    this.setupSeagulls();
    this.setupIstanbulSkyline();
    this.setupRain();
    this.setPreset('DAY');
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xd9e5f5, 0.72);
    this.group.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x70b0ff, 0x384830, 0.85);
    this.group.add(this.hemiLight);

    const isMobile = isMobileDevice();
    this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.45);
    this.dirLight.position.set(45, 70, 30);
    this.dirLight.castShadow = !isMobile;

    if (!isMobile) {
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.dirLight.shadow.camera.near = 10;
      this.dirLight.shadow.camera.far = 180;
      this.dirLight.shadow.camera.left = -25;
      this.dirLight.shadow.camera.right = 25;
      this.dirLight.shadow.camera.top = 40;
      this.dirLight.shadow.camera.bottom = -40;
      this.dirLight.shadow.bias = -0.0005;
    }

    this.group.add(this.dirLight);
    this.group.add(this.dirLight.target);

    // Automotive rim/specular fill light for paint gleam
    this.rimLight = new THREE.DirectionalLight(0xb0d8ff, 0.80);
    this.rimLight.position.set(-35, 45, -35);
    this.group.add(this.rimLight);
    this.group.add(this.rimLight.target);
  }

  private initSkyTextures(): void {
    if (typeof document === 'undefined') return;

    // DAY: Azure cobalt -> Sky blue -> Soft cyan -> Warm golden horizon
    this.skyTextures.set('DAY', this.createSkyGradientTexture([
      { stop: 0.0, color: '#1565c0' },
      { stop: 0.28, color: '#29b6f6' },
      { stop: 0.65, color: '#81d4fa' },
      { stop: 0.88, color: '#fff8e1' },
      { stop: 1.0, color: '#b3e5fc' },
    ]));

    // SUNSET: Deep twilight purple -> Magenta -> Fiery orange -> Golden sun horizon
    this.skyTextures.set('SUNSET', this.createSkyGradientTexture([
      { stop: 0.0, color: '#1b0033' },
      { stop: 0.25, color: '#4a148c' },
      { stop: 0.52, color: '#ad1457' },
      { stop: 0.74, color: '#f57c00' },
      { stop: 0.90, color: '#ffe082' },
      { stop: 1.0, color: '#560bad' },
    ]));

    // NIGHT: Cosmic deep navy -> Midnight indigo -> Soft amber city glow at horizon
    this.skyTextures.set('NIGHT', this.createSkyGradientTexture([
      { stop: 0.0, color: '#050c1f' },
      { stop: 0.28, color: '#0c1a38' },
      { stop: 0.58, color: '#162852' },
      { stop: 0.80, color: '#27345e' },
      { stop: 0.93, color: '#4d3625' }, // warm golden city horizon glow
      { stop: 1.0, color: '#241612' },
    ]));

    // RAIN: Storm slate navy -> Rainy overcast gray -> Misty horizon silver
    this.skyTextures.set('RAIN', this.createSkyGradientTexture([
      { stop: 0.0, color: '#16202c' },
      { stop: 0.35, color: '#273648' },
      { stop: 0.72, color: '#3d4e61' },
      { stop: 0.90, color: '#526377' },
      { stop: 1.0, color: '#242f3d' },
    ]));
  }

  private createSkyGradientTexture(stops: Array<{ stop: number; color: string }>): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      stops.forEach((s) => grad.addColorStop(s.stop, s.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 512);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  private setupSky(): void {
    const skyGeo = new THREE.SphereGeometry(350, 24, 16);
    const initialTex = this.skyTextures.get('DAY');
    const skyMat = new THREE.MeshBasicMaterial({
      map: initialTex || null,
      color: initialTex ? 0xffffff : 0x4ea8de,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.position.y = 30;
    this.group.add(this.skyDome);

    this.scene.fog = new THREE.FogExp2(0x72b4db, 0.0035);
  }

  private setupCelestialBodies(): void {
    // 1. Sun & Outer Corona
    this.sunGroup = new THREE.Group();
    this.sunGroup.position.set(65, 95, 90);

    const sunGeo = new THREE.SphereGeometry(12, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunGroup.add(this.sunMesh);

    // Corona flare plane
    const coronaGeo = new THREE.PlaneGeometry(55, 55);
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = 128;
    coronaCanvas.height = 128;
    const cctx = coronaCanvas.getContext('2d');
    if (cctx) {
      const grad = cctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 230, 0.9)');
      grad.addColorStop(0.3, 'rgba(255, 220, 140, 0.5)');
      grad.addColorStop(0.7, 'rgba(255, 180, 80, 0.15)');
      grad.addColorStop(1, 'rgba(255, 150, 50, 0)');
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, 128, 128);
    }
    const coronaTex = new THREE.CanvasTexture(coronaCanvas);
    const coronaMat = new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunGroup.add(this.sunCorona);
    this.group.add(this.sunGroup);

    // 2. Moon & Starfield
    this.moonGroup = new THREE.Group();
    this.moonGroup.position.set(-80, 105, -70);

    const moonGeo = new THREE.SphereGeometry(8, 14, 14);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf5f8ff });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonGroup.add(moonMesh);

    // Moon soft blue corona
    const moonCoronaGeo = new THREE.PlaneGeometry(35, 35);
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 128;
    moonCanvas.height = 128;
    const mctx = moonCanvas.getContext('2d');
    if (mctx) {
      const grad = mctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(220, 240, 255, 0.8)');
      grad.addColorStop(0.4, 'rgba(140, 200, 255, 0.35)');
      grad.addColorStop(1, 'rgba(100, 160, 255, 0)');
      mctx.fillStyle = grad;
      mctx.fillRect(0, 0, 128, 128);
    }
    const moonCoronaTex = new THREE.CanvasTexture(moonCanvas);
    const moonCoronaMat = new THREE.MeshBasicMaterial({
      map: moonCoronaTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const moonCorona = new THREE.Mesh(moonCoronaGeo, moonCoronaMat);
    this.moonGroup.add(moonCorona);
    this.moonGroup.visible = false;
    this.group.add(this.moonGroup);

    // 3. Twinkling Night Starfield
    const starCount = 500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI * 0.42);
      const radius = 330;
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi) + 20;
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.9,
    });
    this.starfield = new THREE.Points(starGeo, starMat);
    this.starfield.visible = false;
    this.group.add(this.starfield);
  }

  private setupClouds(): void {
    this.cloudsGroup = new THREE.Group();
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    });

    const cloudCount = 14;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffCount = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const puffGeo = new THREE.DodecahedronGeometry(6 + Math.random() * 5, 1);
        const puff = new THREE.Mesh(puffGeo, this.cloudMaterial);
        puff.position.set(
          (p - puffCount / 2) * 6 + (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 5
        );
        puff.scale.set(1.2, 0.75, 1.0);
        cloud.add(puff);
      }

      const baseX = (Math.random() - 0.5) * 320;
      const baseY = 85 + Math.random() * 45;
      const relZ = (Math.random() - 0.5) * 300;
      const speed = 1.5 + Math.random() * 2.0;

      cloud.position.set(baseX, baseY, relZ);
      this.cloudsGroup.add(cloud);
      this.clouds.push({ mesh: cloud, baseX, baseY, relZ, speed });
    }

    this.group.add(this.cloudsGroup);
  }

  private setupSeagulls(): void {
    this.seagullsGroup = new THREE.Group();
    const gullBodyMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5, side: THREE.DoubleSide });
    const beakMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

    const gullCount = 8;
    for (let i = 0; i < gullCount; i++) {
      const gull = new THREE.Group();

      const bodyGeo = new THREE.ConeGeometry(0.18, 1.1, 4);
      bodyGeo.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeo, gullBodyMat);
      gull.add(body);

      const beakGeo = new THREE.ConeGeometry(0.06, 0.35, 4);
      beakGeo.rotateX(Math.PI / 2);
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.position.set(0, -0.02, 0.7);
      gull.add(beak);

      const wingGeo = new THREE.PlaneGeometry(0.9, 0.3);
      wingGeo.translate(-0.45, 0, 0);
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.15, 0.05, 0.1);
      gull.add(wingL);

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.scale.set(-1, 1, 1);
      wingR.position.set(0.15, 0.05, 0.1);
      gull.add(wingR);

      gull.scale.set(1.4, 1.4, 1.4);
      this.seagullsGroup.add(gull);

      this.seagulls.push({
        group: gull,
        wingLeft: wingL,
        wingRight: wingR,
        angleOffset: (i / gullCount) * Math.PI * 2,
        radius: 28 + Math.random() * 18,
        speed: 0.65 + Math.random() * 0.25,
        height: 24 + Math.random() * 12,
        flapPhase: i * 0.8,
      });
    }

    this.group.add(this.seagullsGroup);
  }

  private createSkyscraperNightTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep midnight architectural glass facade
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, 0, 128, 256);

    // Thousands of glowing office windows
    const cols = 12;
    const rows = 32;
    const winW = 6;
    const winH = 4;
    const padX = 4;
    const padY = 4;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rnd = Math.random();
        if (rnd < 0.42) {
          ctx.fillStyle = '#ffeaa7'; // warm amber office
        } else if (rnd < 0.65) {
          ctx.fillStyle = '#74b9ff'; // cool cyan office
        } else if (rnd < 0.78) {
          ctx.fillStyle = '#ffffff'; // bright fluorescent
        } else {
          ctx.fillStyle = '#101726'; // dark office
        }
        ctx.fillRect(c * (winW + padX) + 4, r * (winH + padY) + 6, winW, winH);
      }
    }

    // Neon roof edge highlight
    ctx.fillStyle = '#00f5d4';
    ctx.fillRect(0, 0, 128, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  private setupIstanbulSkyline(): void {
    this.distantMountains = new THREE.Group();
    const silMat = new THREE.MeshBasicMaterial({ color: 0x1a2634 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const goldGlowMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

    // Procedural illuminated skyscraper material
    const towerMat = new THREE.MeshStandardMaterial({
      map: this.createSkyscraperNightTexture(),
      roughness: 0.25,
      metalness: 0.65,
    });

    // 1. Rolling Bosphorus Hills
    const hillCount = 12;
    for (let i = 0; i < hillCount; i++) {
      const radius = 45 + Math.random() * 35;
      const height = 40 + Math.random() * 35;
      const coneGeo = new THREE.ConeGeometry(radius, height, 6);

      const mLeft = new THREE.Mesh(coneGeo, silMat);
      mLeft.position.set(-160 - Math.random() * 60, height / 2 - 8, (i - hillCount / 2) * 60);
      this.distantMountains.add(mLeft);

      const mRight = new THREE.Mesh(coneGeo, silMat);
      mRight.position.set(160 + Math.random() * 60, height / 2 - 8, (i - hillCount / 2) * 60);
      this.distantMountains.add(mRight);
    }

    // 2. GALATA KULESİ (Galata Tower with Illuminated Observation Balcony)
    const galataGroup = new THREE.Group();
    galataGroup.position.set(-175, 18, -40);

    const galataShaft = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 32, 10), silMat);
    galataShaft.position.y = 16;
    galataGroup.add(galataShaft);

    const galataBalcony = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 1.6, 10), silMat);
    galataBalcony.position.y = 32.5;
    galataGroup.add(galataBalcony);

    // Glowing Golden Observation Ring & Arch Windows
    const galataGlowRing = new THREE.Mesh(new THREE.TorusGeometry(6.0, 0.35, 6, 16), goldGlowMat);
    galataGlowRing.rotateX(Math.PI / 2);
    galataGlowRing.position.y = 33.2;
    galataGroup.add(galataGlowRing);

    const galataRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 14, 10), silMat);
    galataRoof.position.y = 40;
    galataGroup.add(galataRoof);

    this.distantMountains.add(galataGroup);

    // 3. ÇAMLICA TV KULESİ (Futuristic Communications Tower with Neon Rings)
    const camlicaGroup = new THREE.Group();
    camlicaGroup.position.set(185, 20, 50);

    const camlicaBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 8.5, 48, 8), silMat);
    camlicaBase.position.y = 24;
    camlicaGroup.add(camlicaBase);

    const camlicaDeck = new THREE.Mesh(new THREE.SphereGeometry(7.5, 10, 8), silMat);
    camlicaDeck.scale.set(1, 1.4, 1);
    camlicaDeck.position.y = 48;
    camlicaGroup.add(camlicaDeck);

    // Glowing LED neon rings on observation deck
    const camlicaNeon1 = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.35, 6, 16), neonCyanMat);
    camlicaNeon1.rotateX(Math.PI / 2);
    camlicaNeon1.position.y = 47;
    camlicaGroup.add(camlicaNeon1);

    const camlicaNeon2 = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.35, 6, 16), neonPinkMat);
    camlicaNeon2.rotateX(Math.PI / 2);
    camlicaNeon2.position.y = 52;
    camlicaGroup.add(camlicaNeon2);

    const camlicaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, 38, 6), silMat);
    camlicaMast.position.y = 74;
    camlicaGroup.add(camlicaMast);

    const camlicaBeacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), beaconMat);
    camlicaBeacon.position.y = 94;
    camlicaGroup.add(camlicaBeacon);

    this.distantMountains.add(camlicaGroup);

    // 4. İSTANBUL CAMİİ VE MİNARELERİ (Historic Mosque with Glowing Kandils)
    const mosqueGroup = new THREE.Group();
    mosqueGroup.position.set(-195, 15, 80);

    const mainDome = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), silMat);
    mainDome.position.y = 12;
    mosqueGroup.add(mainDome);

    const mosqueBase = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), silMat);
    mosqueBase.position.y = 6;
    mosqueGroup.add(mosqueBase);

    // 4 Minarets with Glowing Kandil Rings on Balconies (Şerefe)
    const minaretOffsets = [
      [-16, -16], [16, -16], [-16, 16], [16, 16]
    ];
    for (const [mx, mz] of minaretOffsets) {
      const minaretShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 44, 8), silMat);
      minaretShaft.position.set(mx, 22, mz);
      mosqueGroup.add(minaretShaft);

      // Glowing Kandil Light Ring
      const kandil = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.22, 6, 12), goldGlowMat);
      kandil.rotateX(Math.PI / 2);
      kandil.position.set(mx, 34, mz);
      mosqueGroup.add(kandil);

      const minaretTip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 8), silMat);
      minaretTip.position.set(mx, 47.5, mz);
      mosqueGroup.add(minaretTip);
    }
    this.distantMountains.add(mosqueGroup);

    // 5. MASLAK & LEVENT MODERN GÖKDELENLERİ (Illuminated Window Grids & Neon Crowns)
    const towerConfigs = [
      { x: -160, z: -110, w: 20, d: 20, h: 76 },
      { x: -180, z: -140, w: 24, d: 22, h: 96 },
      { x: 170, z: -80, w: 18, d: 18, h: 68 },
      { x: 190, z: -120, w: 26, d: 24, h: 104 },
    ];
    for (const tc of towerConfigs) {
      const skyscraper = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      skyscraper.position.set(tc.x, tc.h / 2, tc.z);
      this.distantMountains.add(skyscraper);

      // Neon rooftop halo
      const haloGeo = new THREE.BoxGeometry(tc.w + 0.5, 1.2, tc.d + 0.5);
      const haloMat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x00f0ff : 0xff0055 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(tc.x, tc.h, tc.z);
      this.distantMountains.add(halo);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), beaconMat);
      beacon.position.set(tc.x, tc.h + 2.0, tc.z);
      this.distantMountains.add(beacon);
    }

    this.group.add(this.distantMountains);
  }

  private setupRain(): void {
    const geo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() * 2 - 1) * 35; // X
      this.rainPositions[i * 3 + 1] = Math.random() * 25 + 0.5; // Y
      this.rainPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 45; // Z
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x90e0ef,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
    });

    this.rainSystem = new THREE.Points(geo, mat);
    this.rainSystem.visible = false;
    this.group.add(this.rainSystem);
  }

  public setPreset(preset: EnvironmentPreset): void {
    const skyMat = this.skyDome.material as THREE.MeshBasicMaterial;
    const fog = this.scene.fog as THREE.FogExp2;

    // Apply high-res gradient texture to sky dome
    const tex = this.skyTextures.get(preset);
    if (tex) {
      skyMat.map = tex;
      skyMat.needsUpdate = true;
    }

    RoadSegment.setRainWetness(preset === 'RAIN');

    switch (preset) {
      case 'DAY':
        this.dirLight.color.set(0xfff7e6);
        this.dirLight.intensity = 1.50;
        this.rimLight.color.set(0xb0d8ff);
        this.rimLight.intensity = 0.80;
        this.ambientLight.color.set(0xd9e5f5);
        this.ambientLight.intensity = 0.72;
        this.hemiLight.color.set(0x70b0ff);
        this.hemiLight.groundColor.set(0x384830);
        this.hemiLight.intensity = 0.85;

        if (fog) {
          fog.color.set(0x72b4db);
          fog.density = 0.0028;
        }
        this.scene.background = new THREE.Color(0x72b4db);
        this.rainActive = false;
        this.rainSystem.visible = false;

        // Sun active, Moon/Stars off
        this.sunGroup.visible = true;
        this.sunGroup.position.set(65, 95, 90);
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xfffaed);
        this.sunCorona.scale.set(1.0, 1.0, 1.0);
        this.moonGroup.visible = false;
        this.starfield.visible = false;

        this.cloudMaterial.color.set(0xffffff);
        this.cloudMaterial.opacity = 0.88;
        this.seagullsGroup.visible = true;
        break;

      case 'SUNSET':
        this.dirLight.color.set(0xff9e00);
        this.dirLight.intensity = 1.60;
        this.rimLight.color.set(0xff7722);
        this.rimLight.intensity = 0.90;
        this.ambientLight.color.set(0xffa200);
        this.ambientLight.intensity = 0.60;
        this.hemiLight.color.set(0xff5400);
        this.hemiLight.groundColor.set(0x3f37c9);
        this.hemiLight.intensity = 0.80;

        if (fog) {
          fog.color.set(0x560bad);
          fog.density = 0.0025;
        }
        this.scene.background = new THREE.Color(0x560bad);
        this.rainActive = false;
        this.rainSystem.visible = false;

        // Sunset golden sun lowered towards horizon
        this.sunGroup.visible = true;
        this.sunGroup.position.set(80, 48, 120);
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xff6000);
        this.sunCorona.scale.set(1.6, 1.6, 1.6);
        this.moonGroup.visible = false;
        this.starfield.visible = false;

        this.cloudMaterial.color.set(0xffbfa0);
        this.cloudMaterial.opacity = 0.82;
        this.seagullsGroup.visible = true;
        break;

      case 'NIGHT':
        this.dirLight.color.set(0xd0e2ff);
        this.dirLight.intensity = 1.35;
        this.rimLight.color.set(0x7fe3ff);
        this.rimLight.intensity = 0.95;
        this.ambientLight.color.set(0x42587a);
        this.ambientLight.intensity = 0.95;
        this.hemiLight.color.set(0x5c7ea8);
        this.hemiLight.groundColor.set(0x323a48);
        this.hemiLight.intensity = 1.15;

        if (fog) {
          fog.color.set(0x131a2e);
          fog.density = 0.0016;
        }
        this.scene.background = new THREE.Color(0x131a2e);
        this.rainActive = false;
        this.rainSystem.visible = false;

        // Sun off, Moon and Twinkling Starfield on
        this.sunGroup.visible = false;
        this.moonGroup.visible = true;
        this.starfield.visible = true;

        this.cloudMaterial.color.set(0x283042);
        this.cloudMaterial.opacity = 0.55;
        this.seagullsGroup.visible = false;
        break;

      case 'RAIN':
        this.dirLight.color.set(0x778da9);
        this.dirLight.intensity = 0.95;
        this.rimLight.color.set(0x90e0ef);
        this.rimLight.intensity = 0.75;
        this.ambientLight.color.set(0x415a77);
        this.ambientLight.intensity = 0.65;
        this.hemiLight.color.set(0x415a77);
        this.hemiLight.groundColor.set(0x1b263b);
        this.hemiLight.intensity = 0.70;

        if (fog) {
          fog.color.set(0x283044);
          fog.density = 0.0035;
        }
        this.scene.background = new THREE.Color(0x283044);
        this.rainActive = true;
        this.rainSystem.visible = true;

        this.sunGroup.visible = false;
        this.moonGroup.visible = false;
        this.starfield.visible = false;

        this.cloudMaterial.color.set(0x404e5e);
        this.cloudMaterial.opacity = 0.92;
        this.seagullsGroup.visible = false;
        break;
    }
  }

  public update(playerZ: number, delta = 0.016): void {
    // Keep sun shadows centered around player
    this.dirLight.position.z = playerZ + 20;
    this.dirLight.target.position.z = playerZ;
    this.dirLight.target.updateMatrixWorld();

    // Keep rim light following player
    this.rimLight.position.z = playerZ - 25;
    this.rimLight.target.position.z = playerZ;
    this.rimLight.target.updateMatrixWorld();

    // Move distant mountains, celestial bodies, and sky with player
    this.skyDome.position.z = playerZ;
    this.distantMountains.position.z = playerZ;
    this.sunGroup.position.z = playerZ + 90;
    this.moonGroup.position.z = playerZ - 70;
    this.starfield.position.z = playerZ;

    // 1. Animate Drifting Clouds
    this.cloudsGroup.position.z = playerZ;
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * delta;
      if (c.mesh.position.x > 180) {
        c.mesh.position.x = -180;
      }
    }

    // 2. Animate Bosphorus Seagulls
    if (this.seagullsGroup.visible) {
      this.gullAnimTime += delta;
      this.seagullsGroup.position.z = playerZ;

      for (const gull of this.seagulls) {
        const theta = this.gullAnimTime * gull.speed + gull.angleOffset;
        const gx = Math.cos(theta) * gull.radius + 15;
        const gz = Math.sin(theta) * (gull.radius * 0.7) + 35;
        const gy = gull.height + Math.sin(this.gullAnimTime * 1.5 + gull.flapPhase) * 1.8;

        gull.group.position.set(gx, gy, gz);
        gull.group.rotation.y = -theta + Math.PI / 2;

        const flapAngle = Math.sin(this.gullAnimTime * 8.0 + gull.flapPhase) * 0.42;
        gull.wingLeft.rotation.z = flapAngle;
        gull.wingRight.rotation.z = flapAngle;
      }
    }

    // 3. Animate falling rain around player
    if (this.rainActive) {
      this.rainSystem.position.z = playerZ;
      const positions = this.rainPositions;
      for (let i = 0; i < this.rainCount; i++) {
        positions[i * 3 + 1] -= 32 * delta;
        if (positions[i * 3 + 1] < 0.2) {
          positions[i * 3 + 1] = 25;
        }
      }
      this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }
  }
}
