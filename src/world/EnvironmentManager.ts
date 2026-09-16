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

  // Turkish Highway Horizon Groups
  private istanbulSkylineGroup!: THREE.Group;
  private boluMountainsGroup!: THREE.Group;
  private bozkirGroup!: THREE.Group;
  private izmirOtoyolGroup!: THREE.Group;
  private windTurbineRotors: THREE.Group[] = [];
  private windTurbineBeacons: THREE.Mesh[] = [];
  private turbineAnimTime = 0;

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

    // DAY: E-5 Otobanı (İstanbul) - Azure cobalt -> Sky blue -> Soft cyan -> Warm golden horizon
    this.skyTextures.set('DAY', this.createSkyGradientTexture([
      { stop: 0.0, color: '#1565c0' },
      { stop: 0.28, color: '#29b6f6' },
      { stop: 0.65, color: '#81d4fa' },
      { stop: 0.88, color: '#fff8e1' },
      { stop: 1.0, color: '#b3e5fc' },
    ]));

    // SUNSET: Anadolu Otoyolu (Bolu Dağı) - Alpine mountain sunset:
    // Deep twilight violet-indigo -> Alpine magenta -> Fiery amber & golden mountain horizon
    this.skyTextures.set('SUNSET', this.createSkyGradientTexture([
      { stop: 0.0, color: '#140626' },
      { stop: 0.25, color: '#380e54' },
      { stop: 0.52, color: '#8a1c5d' },
      { stop: 0.74, color: '#e65100' },
      { stop: 0.90, color: '#ffb74d' },
      { stop: 1.0, color: '#ffd54f' },
    ]));

    // NIGHT: Ankara - Niğde Otoyolu (Bozkır) - Crystal-clear infinite midnight steppe cosmos:
    // Void black -> Deep cosmic abyss navy -> Midnight indigo -> Clean dust-horizon twilight
    this.skyTextures.set('NIGHT', this.createSkyGradientTexture([
      { stop: 0.0, color: '#02050e' },
      { stop: 0.28, color: '#060d22' },
      { stop: 0.58, color: '#0c1736' },
      { stop: 0.80, color: '#152145' },
      { stop: 0.94, color: '#1e2844' },
      { stop: 1.0, color: '#12141a' },
    ]));

    // RAIN: İstanbul - İzmir Otoyolu (Osmangazi Körfezi) - Coastal storm slate & ocean rain:
    this.skyTextures.set('RAIN', this.createSkyGradientTexture([
      { stop: 0.0, color: '#111822' },
      { stop: 0.35, color: '#1f2b3a' },
      { stop: 0.70, color: '#334454' },
      { stop: 0.90, color: '#455668' },
      { stop: 1.0, color: '#1d2732' },
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
    this.istanbulSkylineGroup = new THREE.Group();

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
      this.istanbulSkylineGroup.add(mLeft);

      const mRight = new THREE.Mesh(coneGeo, silMat);
      mRight.position.set(160 + Math.random() * 60, height / 2 - 8, (i - hillCount / 2) * 60);
      this.istanbulSkylineGroup.add(mRight);
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

    this.istanbulSkylineGroup.add(galataGroup);

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

    this.istanbulSkylineGroup.add(camlicaGroup);

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
    this.istanbulSkylineGroup.add(mosqueGroup);

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
      this.istanbulSkylineGroup.add(skyscraper);

      // Neon rooftop halo
      const haloGeo = new THREE.BoxGeometry(tc.w + 0.5, 1.2, tc.d + 0.5);
      const haloMat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x00f0ff : 0xff0055 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(tc.x, tc.h, tc.z);
      this.istanbulSkylineGroup.add(halo);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), beaconMat);
      beacon.position.set(tc.x, tc.h + 2.0, tc.z);
      this.istanbulSkylineGroup.add(beacon);
    }

    // 6. MERKEZ BOĞAZİÇİ KÖPRÜSÜ SİLÜETİ (Directly Behind Road Horizon at Z = -250)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, -250);

    const bridgeSteelMat = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4, metalness: 0.6 });
    const bridgeCableMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bridgeLedMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Bridge road deck
    const deckGeo = new THREE.BoxGeometry(260, 2.5, 9);
    const bridgeDeck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8 }));
    bridgeDeck.position.set(0, 18, 0);
    bridgeGroup.add(bridgeDeck);

    // Glowing traffic light streak on bridge deck
    const trafficStreakGeo = new THREE.PlaneGeometry(258, 0.5);
    const trafficStreakMat = new THREE.MeshBasicMaterial({ color: 0xffb703, side: THREE.DoubleSide });
    const trafficStreak = new THREE.Mesh(trafficStreakGeo, trafficStreakMat);
    trafficStreak.position.set(0, 19.5, 4.5);
    bridgeGroup.add(trafficStreak);

    // Left & Right Suspension Towers
    const towerX = [-52, 52];
    for (const tx of towerX) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tx, 0, 0);

      // 2 tall steel pylons
      const pylonGeo = new THREE.CylinderGeometry(1.6, 2.8, 72, 8);
      const pylonL = new THREE.Mesh(pylonGeo, bridgeSteelMat);
      pylonL.position.set(-3.2, 36, 0);
      towerGroup.add(pylonL);

      const pylonR = new THREE.Mesh(pylonGeo, bridgeSteelMat);
      pylonR.position.set(3.2, 36, 0);
      towerGroup.add(pylonR);

      // Cross braces
      for (const by of [28, 48, 66]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.8, 2.2), bridgeSteelMat);
        brace.position.set(0, by, 0);
        towerGroup.add(brace);
      }

      // Aircraft warning beacons
      const beaconL = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), beaconMat);
      beaconL.position.set(-3.2, 73, 0);
      towerGroup.add(beaconL);

      const beaconR = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), beaconMat);
      beaconR.position.set(3.2, 73, 0);
      towerGroup.add(beaconR);

      bridgeGroup.add(towerGroup);
    }

    // Suspension catenary cables
    const cablePoints: THREE.Vector3[] = [];
    for (let x = -130; x <= 130; x += 5) {
      const sag = Math.pow(x / 52, 2) * 16;
      const y = Math.max(19, 70 - 45 + sag);
      cablePoints.push(new THREE.Vector3(x, y, 0));
    }
    const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
    const mainCable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x90caf9, linewidth: 2 }));
    bridgeGroup.add(mainCable);

    // Vertical suspender cables with glowing LED beads
    for (let x = -120; x <= 120; x += 12) {
      if (Math.abs(x - 52) < 4 || Math.abs(x + 52) < 4) continue;
      const sag = Math.pow(x / 52, 2) * 16;
      const topY = Math.max(20, 70 - 45 + sag);
      const suspenderGeo = new THREE.CylinderGeometry(0.08, 0.08, topY - 18, 4);
      const suspender = new THREE.Mesh(suspenderGeo, bridgeCableMat);
      suspender.position.set(x, (topY + 18) / 2, 0);
      bridgeGroup.add(suspender);

      const led = new THREE.Mesh(new THREE.SphereGeometry(0.35, 4, 4), bridgeLedMat);
      led.position.set(x, topY, 0);
      bridgeGroup.add(led);
    }
    this.istanbulSkylineGroup.add(bridgeGroup);

    // 7. MERKEZ İSTANBUL GÖKDELEN SİLÜETİ (Directly Filling the Center View)
    const centerTowers = [
      { x: -38, z: -210, w: 22, d: 20, h: 84, color: 0x00f0ff },
      { x: 38, z: -215, w: 24, d: 22, h: 88, color: 0xff0055 },
      { x: 0, z: -285, w: 32, d: 30, h: 120, color: 0xffb703 },
      { x: -75, z: -235, w: 20, d: 20, h: 72, color: 0x00f0ff },
      { x: 75, z: -230, w: 22, d: 22, h: 76, color: 0xff007f },
    ];
    for (const tc of centerTowers) {
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      bldg.position.set(tc.x, tc.h / 2, tc.z);
      this.istanbulSkylineGroup.add(bldg);

      const halo = new THREE.Mesh(
        new THREE.BoxGeometry(tc.w + 0.6, 1.4, tc.d + 0.6),
        new THREE.MeshBasicMaterial({ color: tc.color })
      );
      halo.position.set(tc.x, tc.h, tc.z);
      this.istanbulSkylineGroup.add(halo);

      const bcn = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), beaconMat);
      bcn.position.set(tc.x, tc.h + 2.5, tc.z);
      this.istanbulSkylineGroup.add(bcn);
    }

    this.distantMountains.add(this.istanbulSkylineGroup);

    // Setup the other 3 Turkish Highway horizons
    this.setupBoluMountainsHorizon();
    this.setupBozkirHorizon();
    this.setupIzmirHorizon();

    this.group.add(this.distantMountains);
  }

  // --- 2. ANADOLU OTOYOLU (BOLU DAĞI) ALPINE MOUNTAINS HORIZON ---
  private setupBoluMountainsHorizon(): void {
    this.boluMountainsGroup = new THREE.Group();
    this.boluMountainsGroup.name = 'BoluMountainsHorizon';

    const pineDarkMat = new THREE.MeshStandardMaterial({ color: 0x14281b, roughness: 0.9 });
    const mountainRockMat = new THREE.MeshStandardMaterial({ color: 0x222a25, roughness: 0.95 });
    const mountainPeakMat = new THREE.MeshStandardMaterial({ color: 0x2e3831, roughness: 0.9 });
    const ridgeFoliageMat = new THREE.MeshBasicMaterial({ color: 0x0f1c13 });

    // Grand Alpine Mountain Peaks (Flanking Bolu Mountain Pass)
    const peakConfigs = [
      // Left Bolu Mountain Ridge
      { x: -160, z: -80, r: 85, h: 105, mat: mountainRockMat },
      { x: -210, z: -160, r: 110, h: 135, mat: mountainPeakMat },
      { x: -180, z: 0, r: 90, h: 98, mat: pineDarkMat },
      { x: -190, z: 80, r: 95, h: 110, mat: mountainRockMat },
      { x: -150, z: 160, r: 80, h: 90, mat: pineDarkMat },
      // Right Aladağlar / Abant Mountain Ridge
      { x: 160, z: -90, r: 85, h: 100, mat: mountainRockMat },
      { x: 220, z: -170, r: 115, h: 140, mat: mountainPeakMat },
      { x: 175, z: -10, r: 92, h: 102, mat: pineDarkMat },
      { x: 195, z: 75, r: 96, h: 115, mat: mountainRockMat },
      { x: 155, z: 155, r: 82, h: 92, mat: pineDarkMat },
      // Distant Horizon Mountain Pass Massif (Directly ahead Z = -270)
      { x: -70, z: -270, r: 95, h: 118, mat: mountainRockMat },
      { x: 50, z: -285, r: 105, h: 125, mat: mountainPeakMat },
      { x: 0, z: -310, r: 130, h: 150, mat: mountainPeakMat },
      { x: -120, z: -300, r: 100, h: 120, mat: pineDarkMat },
      { x: 115, z: -290, r: 95, h: 115, mat: pineDarkMat },
    ];

    for (const p of peakConfigs) {
      const coneGeo = new THREE.ConeGeometry(p.r, p.h, 7);
      const peak = new THREE.Mesh(coneGeo, p.mat);
      peak.position.set(p.x, p.h / 2 - 12, p.z);
      this.boluMountainsGroup.add(peak);
    }

    // Serrated Coniferous Pine Forest Crests along Mountain Ridges
    const ridgeTreesCount = 90;
    const treeGeo = new THREE.ConeGeometry(3.5, 12.0, 4);
    for (let i = 0; i < ridgeTreesCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const rx = side * (125 + (i * 17) % 75);
      const rz = ((i * 37) % 360) - 180;
      const ry = 42 + ((i * 23) % 45);

      const tree = new THREE.Mesh(treeGeo, ridgeFoliageMat);
      tree.position.set(rx, ry, rz);
      this.boluMountainsGroup.add(tree);
    }

    // Mountain Valley Sunset Mist Ribbons
    const hazeGeo = new THREE.PlaneGeometry(320, 28);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0xffb799,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    const haze1 = new THREE.Mesh(hazeGeo, hazeMat);
    haze1.position.set(0, 24, -220);
    this.boluMountainsGroup.add(haze1);

    const haze2 = new THREE.Mesh(hazeGeo, hazeMat);
    haze2.position.set(0, 18, -150);
    this.boluMountainsGroup.add(haze2);

    this.distantMountains.add(this.boluMountainsGroup);
  }

  // --- 3. ANKARA - NİĞDE OTOYOLU (BOZKIR) VAST STEPPE & WIND TURBINES ---
  private setupBozkirHorizon(): void {
    this.bozkirGroup = new THREE.Group();
    this.bozkirGroup.name = 'BozkirHorizon';

    const steppeGroundMat = new THREE.MeshStandardMaterial({ color: 0x1c1710, roughness: 0.95 });
    const turbinePylonMat = new THREE.MeshStandardMaterial({ color: 0xdde5ed, roughness: 0.35, metalness: 0.2 });
    const turbineBladeMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.3 });
    const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff002b, transparent: true, opacity: 1.0 });

    // Broad, gentle low-rolling Central Anatolian steppe ridges (Bozkır tepeleri)
    const steppeHills = [
      { x: -170, z: -100, r: 160, h: 26 },
      { x: -210, z: -200, r: 190, h: 32 },
      { x: 170, z: -90, r: 155, h: 24 },
      { x: 210, z: -190, r: 185, h: 30 },
      { x: 0, z: -280, r: 240, h: 36 },
      { x: -110, z: -270, r: 180, h: 28 },
      { x: 120, z: -260, r: 175, h: 28 },
    ];

    for (const h of steppeHills) {
      const geo = new THREE.SphereGeometry(h.r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(geo, steppeGroundMat);
      mesh.scale.set(1.4, h.h / h.r, 1.0);
      mesh.position.set(h.x, -2, h.z);
      this.bozkirGroup.add(mesh);
    }

    // Modern Wind Farm (Rüzgar Enerji Santrali - RES) across the distant steppe
    const turbineConfigs = [
      { x: -140, z: -160, h: 58, scale: 0.95 },
      { x: -185, z: -220, h: 66, scale: 1.1 },
      { x: -115, z: -240, h: 62, scale: 1.0 },
      { x: 135, z: -170, h: 56, scale: 0.92 },
      { x: 175, z: -215, h: 68, scale: 1.12 },
      { x: 120, z: -250, h: 60, scale: 1.0 },
      { x: 0, z: -320, h: 72, scale: 1.2 },
    ];

    for (const tc of turbineConfigs) {
      const turbineGroup = new THREE.Group();
      turbineGroup.position.set(tc.x, 0, tc.z);

      // Slender tapered tubular steel tower
      const towerGeo = new THREE.CylinderGeometry(0.7 * tc.scale, 1.8 * tc.scale, tc.h, 8);
      const tower = new THREE.Mesh(towerGeo, turbinePylonMat);
      tower.position.y = tc.h / 2;
      turbineGroup.add(tower);

      // Nacelle (generator housing on top)
      const nacelleGeo = new THREE.BoxGeometry(2.4 * tc.scale, 1.8 * tc.scale, 4.2 * tc.scale);
      const nacelle = new THREE.Mesh(nacelleGeo, turbinePylonMat);
      nacelle.position.set(0, tc.h, 0);
      turbineGroup.add(nacelle);

      // Red flashing aviation safety beacon
      const beaconGeo = new THREE.SphereGeometry(0.9 * tc.scale, 6, 6);
      const beacon = new THREE.Mesh(beaconGeo, redBeaconMat);
      beacon.position.set(0, tc.h + 1.6 * tc.scale, 0);
      turbineGroup.add(beacon);
      this.windTurbineBeacons.push(beacon);

      // Rotating Rotor Hub & 3 Aerodynamic Blades
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, tc.h, 2.2 * tc.scale);

      const hubGeo = new THREE.CylinderGeometry(0.9 * tc.scale, 0.9 * tc.scale, 1.2 * tc.scale, 8);
      hubGeo.rotateX(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, turbinePylonMat);
      rotorGroup.add(hub);

      const bladeLen = 22.0 * tc.scale;
      for (let b = 0; b < 3; b++) {
        const bladeGroup = new THREE.Group();
        bladeGroup.rotation.z = (b * Math.PI * 2) / 3;

        const bladeGeo = new THREE.ConeGeometry(0.7 * tc.scale, bladeLen, 5);
        const bladeMesh = new THREE.Mesh(bladeGeo, turbineBladeMat);
        bladeMesh.position.y = bladeLen / 2;
        bladeGroup.add(bladeMesh);
        rotorGroup.add(bladeGroup);
      }

      turbineGroup.add(rotorGroup);
      this.windTurbineRotors.push(rotorGroup);
      this.bozkirGroup.add(turbineGroup);
    }

    this.distantMountains.add(this.bozkirGroup);
  }

  // --- 4. İSTANBUL - İZMİR OTOYOLU (OSMANGAZİ KÖRFEZİ) HORIZON ---
  private setupIzmirHorizon(): void {
    this.izmirOtoyolGroup = new THREE.Group();
    this.izmirOtoyolGroup.name = 'IzmirHorizon';

    const gulfHillMat = new THREE.MeshStandardMaterial({ color: 0x16242c, roughness: 0.9 });
    const osmangaziMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.4, metalness: 0.5 });
    const cableMat = new THREE.LineBasicMaterial({ color: 0x90caf9, linewidth: 2 });
    const amberStreakMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

    // Coastal Gulf Hills (Samanlı Dağları & Dilovası / Hersek Burunları)
    const gulfHills = [
      { x: -160, z: -110, r: 100, h: 52 },
      { x: -210, z: -190, r: 130, h: 68 },
      { x: 160, z: -100, r: 95, h: 50 },
      { x: 210, z: -180, r: 125, h: 64 },
      { x: -80, z: -270, r: 110, h: 58 },
      { x: 80, z: -270, r: 110, h: 58 },
    ];
    for (const h of gulfHills) {
      const geo = new THREE.ConeGeometry(h.r, h.h, 7);
      const mesh = new THREE.Mesh(geo, gulfHillMat);
      mesh.position.set(h.x, h.h / 2 - 6, h.z);
      this.izmirOtoyolGroup.add(mesh);
    }

    // Osmangazi Suspension Bridge distant silhouette across the gulf horizon (Z = -260)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, -260);

    // Elevated bridge deck spanning the gulf
    const deck = new THREE.Mesh(new THREE.BoxGeometry(260, 2.4, 8), osmangaziMat);
    deck.position.set(0, 20, 0);
    bridgeGroup.add(deck);

    // Glowing traffic streak on bridge deck
    const trafficLine = new THREE.Mesh(new THREE.PlaneGeometry(258, 0.6), amberStreakMat);
    trafficLine.position.set(0, 21.3, 4.1);
    bridgeGroup.add(trafficLine);

    // 2 Majestic Osmangazi Bridge Pylons
    for (const tx of [-48, 48]) {
      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(tx, 0, 0);

      // Slender steel columns
      const colL = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.5, 78, 8), osmangaziMat);
      colL.position.set(-3.2, 39, 0);
      pylonGroup.add(colL);

      const colR = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.5, 78, 8), osmangaziMat);
      colR.position.set(3.2, 39, 0);
      pylonGroup.add(colR);

      // Cross struts
      for (const by of [30, 52, 72]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.8, 2.0), osmangaziMat);
        strut.position.set(0, by, 0);
        pylonGroup.add(strut);
      }

      bridgeGroup.add(pylonGroup);
    }

    // Suspension cables
    const cablePoints: THREE.Vector3[] = [];
    for (let x = -130; x <= 130; x += 5) {
      const sag = Math.pow(x / 48, 2) * 16;
      const y = Math.max(21, 74 - 48 + sag);
      cablePoints.push(new THREE.Vector3(x, y, 0));
    }
    const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
    const mainCable = new THREE.Line(cableGeo, cableMat);
    bridgeGroup.add(mainCable);

    this.izmirOtoyolGroup.add(bridgeGroup);
    this.distantMountains.add(this.izmirOtoyolGroup);
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

    // Toggle distant Turkish Highway horizon groups
    if (this.istanbulSkylineGroup) this.istanbulSkylineGroup.visible = (preset === 'DAY');
    if (this.boluMountainsGroup) this.boluMountainsGroup.visible = (preset === 'SUNSET');
    if (this.bozkirGroup) this.bozkirGroup.visible = (preset === 'NIGHT');
    if (this.izmirOtoyolGroup) this.izmirOtoyolGroup.visible = (preset === 'RAIN');

    switch (preset) {
      case 'DAY': // 🛣️ E-5 Otobanı
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

      case 'SUNSET': // 🌲 Anadolu Otoyolu (Bolu Dağı)
        this.dirLight.color.set(0xff9010);
        this.dirLight.intensity = 1.65;
        this.rimLight.color.set(0xff6622);
        this.rimLight.intensity = 0.90;
        this.ambientLight.color.set(0xb8682a);
        this.ambientLight.intensity = 0.72;
        this.hemiLight.color.set(0xff7043);
        this.hemiLight.groundColor.set(0x1c2b1e); // deep evergreen pine floor bounce
        this.hemiLight.intensity = 0.82;

        if (fog) {
          fog.color.set(0x42233b); // Bolu mountain pine sunset mist
          fog.density = 0.0024;
        }
        this.scene.background = new THREE.Color(0x42233b);
        this.rainActive = false;
        this.rainSystem.visible = false;

        // Sunset golden sun lowered towards mountain horizon
        this.sunGroup.visible = true;
        this.sunGroup.position.set(80, 42, 130);
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xff5500);
        this.sunCorona.scale.set(1.7, 1.7, 1.7);
        this.moonGroup.visible = false;
        this.starfield.visible = false;

        this.cloudMaterial.color.set(0xffbfa0);
        this.cloudMaterial.opacity = 0.82;
        this.seagullsGroup.visible = false;
        break;

      case 'NIGHT': // 🌾 Ankara - Niğde Otoyolu (Bozkır)
        this.dirLight.color.set(0xb8d4ff);
        this.dirLight.intensity = 1.25;
        this.rimLight.color.set(0x6edbff);
        this.rimLight.intensity = 0.90;
        this.ambientLight.color.set(0x283850);
        this.ambientLight.intensity = 0.85;
        this.hemiLight.color.set(0x405a7d);
        this.hemiLight.groundColor.set(0x1f1b14); // dry Central Anatolian steppe soil
        this.hemiLight.intensity = 1.05;

        if (fog) {
          fog.color.set(0x0a101d); // crystal clear high-altitude steppe night
          fog.density = 0.0013;
        }
        this.scene.background = new THREE.Color(0x0a101d);
        this.rainActive = false;
        this.rainSystem.visible = false;

        // Sun off, Moon and Twinkling Starfield on
        this.sunGroup.visible = false;
        this.moonGroup.visible = true;
        this.starfield.visible = true;

        this.cloudMaterial.color.set(0x1c2434);
        this.cloudMaterial.opacity = 0.45;
        this.seagullsGroup.visible = false;
        break;

      case 'RAIN': // 🌧️ İstanbul - İzmir Otoyolu (Osmangazi Körfezi)
        this.dirLight.color.set(0x6a8094);
        this.dirLight.intensity = 0.92;
        this.rimLight.color.set(0x82b4cc);
        this.rimLight.intensity = 0.75;
        this.ambientLight.color.set(0x384a5c);
        this.ambientLight.intensity = 0.65;
        this.hemiLight.color.set(0x3e5062);
        this.hemiLight.groundColor.set(0x1a2430);
        this.hemiLight.intensity = 0.70;

        if (fog) {
          fog.color.set(0x232e3b); // marine storm overcast mist
          fog.density = 0.0035;
        }
        this.scene.background = new THREE.Color(0x232e3b);
        this.rainActive = true;
        this.rainSystem.visible = true;

        this.sunGroup.visible = false;
        this.moonGroup.visible = false;
        this.starfield.visible = false;

        this.cloudMaterial.color.set(0x3a4856);
        this.cloudMaterial.opacity = 0.92;
        this.seagullsGroup.visible = true; // coastal gulf gulls
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

    // 2. Animate Bosphorus / Gulf Seagulls
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

    // 4. Animate Wind Turbines in Bozkır map
    if (this.bozkirGroup?.visible) {
      this.turbineAnimTime += delta;
      for (const rotor of this.windTurbineRotors) {
        rotor.rotation.z += 0.75 * delta;
      }
      // Pulse red aviation beacons
      const beaconFlash = (Math.sin(this.turbineAnimTime * 4.5) > 0.25) ? 1.0 : 0.12;
      for (const b of this.windTurbineBeacons) {
        (b.material as THREE.MeshBasicMaterial).opacity = beaconFlash;
      }
    }
  }
}
