// Core Game Engine orchestrating scenes, simulation, rendering, and lifecycle

import * as THREE from 'three';
import { GAME_CONSTANTS } from './Constants';
import { eventBus } from './EventBus';
import { gameState } from './GameState';
import { inputManager, type InputState } from '../player/InputManager';
import { RoadManager } from '../road/RoadManager';
import { PlayerVehicle } from '../vehicles/PlayerVehicle';
import { TrafficManager } from '../traffic/TrafficManager';
import { ChaseCamera } from '../player/ChaseCamera';
import { EnvironmentManager } from '../world/EnvironmentManager';
import { CollisionSystem, type CollisionResult } from '../systems/CollisionSystem';
import { laneSystem } from '../road/LaneSystem';
import { NearMissSystem } from '../systems/NearMissSystem';
import { NitroSystem } from '../systems/NitroSystem';
import { ScoreManager } from '../systems/ScoreManager';
import { EconomyManager } from '../economy/EconomyManager';
import { MissionManager } from '../progression/MissionManager';
import { ParticleSystem } from '../systems/ParticleSystem';
import { audioManager } from '../audio/AudioManager';
import { radioManager } from '../audio/RadioManager';
import { UIManager } from '../ui/UIManager';
import { npcPackManager } from '../traffic/NPCPackManager';
import { cityPackManager } from '../world/CityPackManager';
import { shipManager } from '../world/ShipManager';
import { setupOrientationAutoLock, requestNativeLandscapeLock, isMobileDevice } from '../utils/orientation';
import { multiplayerManager } from '../network/MultiplayerManager';
import { RemotePlayerVehicle } from '../vehicles/RemotePlayerVehicle';
import { prng } from '../utils/PRNG';
import { cinematicAutopilot } from '../player/CinematicAutopilot';
import { RaceStarterSystem } from '../systems/RaceStarterSystem';

// Garage Idle Cinematic Showcase Angles (Centered around vehicle presentation area x=0)
const GARAGE_IDLE_SHOTS = [
  {
    name: 'GARAJ SERGİ STANDARTI',
    pos: { x: 0, y: 1.85, z: -5.6 },
    lookAt: { x: 0, y: 0.75, z: 0 },
    fov: 54,
    duration: 6.5,
  },
  {
    name: 'ÖN TAMPON & JANT ALÇAK AÇI',
    pos: { x: 0.2, y: 0.95, z: -4.3 },
    lookAt: { x: 0.1, y: 0.65, z: 0 },
    fov: 46,
    duration: 6.0,
  },
  {
    name: 'YAN GÖVDE & AYNA YAKIN PLAN',
    pos: { x: -1.6, y: 1.15, z: -2.6 },
    lookAt: { x: 0, y: 0.72, z: 0 },
    fov: 48,
    duration: 6.0,
  },
  {
    name: 'LÜKS SHOWROOM YÜKSEK 3/4 AÇI',
    pos: { x: 0, y: 2.6, z: -5.8 },
    lookAt: { x: 0, y: 0.72, z: 0 },
    fov: 52,
    duration: 6.5,
  },
  {
    name: 'ARKA EGZOZ & PLAKA AÇISI',
    pos: { x: 0.7, y: 0.85, z: -4.6 },
    lookAt: { x: 0, y: 0.68, z: 0 },
    fov: 44,
    duration: 6.0,
  },
];

const _defaultCamPos = new THREE.Vector3(0, 1.85, -5.6);
const _defaultLookAt = new THREE.Vector3(0, 0.75, 0);
const _tempTargetPos = new THREE.Vector3();
const _tempTargetLookAt = new THREE.Vector3();

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private chaseCamera: ChaseCamera;
  private fpsFrameCount = 0;
  private fpsLastCalcTime = performance.now();
  private currentFps = 60;
  private renderFrameCount = 0;

  // World & Game Systems
  private environment: EnvironmentManager;
  private roadManager: RoadManager;
  private playerVehicle: PlayerVehicle;
  private trafficManager: TrafficManager;
  private collisionSystem: CollisionSystem;
  private nearMissSystem: NearMissSystem;
  private nitroSystem: NitroSystem;
  private scoreManager: ScoreManager;
  private economyManager: EconomyManager;
  private missionManager: MissionManager;
  private particleSystem: ParticleSystem;
  private uiManager: UIManager;

  // Turntable platform & showroom for Garage
  private garageTurntable!: THREE.Group;
  private garageLightsGroup!: THREE.Group;
  private isGarageDragging = false;
  private garageDragPrevX = 0;

  // Timing & states
  private lastTime = 0;
  private isRunning = false;
  private wasNitroActive = false;
  private wasFlashActive = false;
  private isCrashed = false;
  private istanbulAmbienceTimer = 6;
  private lastRadarPassedZ = 0;
  private scrapeCooldown = 0;
  private remoteOpponentVehicles: Map<string, RemotePlayerVehicle> = new Map();
  private raceTime = 0;
  private isSpectatorActive = false;
  private spectateTargetId: string | null = null;

  // Cinematic Camera Intro & Race Starter System
  private isIntroActive = false;
  private introTimer = 0;
  private introDuration = 5.8;
  private introCountdownStage = -1;
  private raceStarterSystem!: RaceStarterSystem;

  // Inactive / Idle Camera Showcase System
  private idleTimer = 0;
  private readonly IDLE_THRESHOLD = 5.2; // seconds without input before auto-cam triggers
  private garageIdleTimer = 0;
  private garageIdleShotIndex = 0;
  private garageIdleShotTimer = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element #game-canvas not found');
    }

    const isMobile = isMobileDevice();
    // 1. Initialize Three.js WebGLRenderer with mobile optimizations
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobile && window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 2. Initialize Scene
    this.scene = new THREE.Scene();

    // 3. Initialize Camera
    this.chaseCamera = new ChaseCamera(window.innerWidth / window.innerHeight);

    // 4. Initialize Systems & Managers
    this.environment = new EnvironmentManager(this.scene);

    this.roadManager = new RoadManager();
    this.scene.add(this.roadManager.group);

    this.playerVehicle = new PlayerVehicle();
    this.scene.add(this.playerVehicle.mesh);

    this.trafficManager = new TrafficManager();
    this.scene.add(this.trafficManager.group);

    this.particleSystem = new ParticleSystem();
    this.scene.add(this.particleSystem.group);

    this.collisionSystem = new CollisionSystem();
    this.nearMissSystem = new NearMissSystem();
    this.nitroSystem = new NitroSystem();
    this.scoreManager = new ScoreManager();
    this.economyManager = new EconomyManager();
    this.missionManager = MissionManager.getInstance();

    eventBus.on('nearMiss', () => {
      if (gameState.currentMode === 'TIME_ATTACK' && gameState.isPlaying) {
        gameState.addTimeAttackSeconds(GAME_CONSTANTS.TIME_ATTACK.NEAR_MISS_BONUS_SEC, 'NEAR MISS +3s');
      }
    });

    eventBus.on('environmentChanged', (payload: any) => {
      if (payload?.env) {
        this.environment.setPreset(payload.env);
      }
    });

    eventBus.on('graphicsQualityChanged', (payload: any) => {
      const q = typeof payload === 'string' ? payload : payload?.quality;
      if (q) this.applyGraphicsQuality(q);
    });

    // Apply saved graphics quality
    this.applyGraphicsQuality(gameState.settings.graphicsQuality || 'high');

    // Menu Cinematic Camera Next Shot
    eventBus.on('menuCinematicNext', () => {
      this.chaseCamera.nextMenuCinematicShot();
    });

    // Hook Abartı Egzoz Backfire flame & spark synchronizer
    audioManager.onExhaustPop = () => {
      this.playerVehicle.triggerExhaustPop();
      this.particleSystem.emitBackfireSparks(this.playerVehicle.getExhaustTipWorldPosition());
    };

    // 5. Luxury Showroom Podium & Studio Lighting
    this.initGarageShowroom();
    this.setupGaragePointerListeners();

    // 6. UI Manager & Race Starter System
    this.uiManager = new UIManager();
    this.setupUICallbacks();

    this.raceStarterSystem = new RaceStarterSystem(
      this.scene,
      this.chaseCamera,
      this.uiManager,
      audioManager,
      this.particleSystem
    );
    this.raceStarterSystem.onRaceStart = () => {
      this.isIntroActive = false;
    };

    // 7. Window resize & automatic landscape orientation handling
    setupOrientationAutoLock(() => this.handleResize());
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => {
      this.handleResize();
      setTimeout(() => this.handleResize(), 150);
    });

    // 8. Global User Activity Tracker (Resets Idle Camera timers on any key, click, or touch)
    const onUserActivity = () => {
      this.idleTimer = 0;
      this.garageIdleTimer = 0;
      if (this.chaseCamera.isIdleActive) {
        this.chaseCamera.exitIdleCinematic();
        this.uiManager.setIdleCinematicBadge(false);
      }
    };
    window.addEventListener('keydown', onUserActivity);
    window.addEventListener('pointerdown', onUserActivity);
    window.addEventListener('touchstart', onUserActivity, { passive: true });

    // 9. Start loop and boot sequence
    this.setScreen('BOOT');
    this.startLoop();
    this.boot();
  }

  private setupUICallbacks(): void {
    this.uiManager.onStartGame = () => {
      this.startRace();
    };

    this.uiManager.onRestartGame = () => {
      this.startRace();
    };

    this.uiManager.onResumeGame = () => {
      this.resumeRace();
    };

    this.uiManager.onStartMultiplayerRace = () => {
      this.startMultiplayerRace();
    };

    this.uiManager.onSpectatorTargetCycle = (dir: 1 | -1) => {
      this.cycleSpectatorTarget(dir);
    };

    this.uiManager.onSpectatorCameraCycle = () => {
      const nextMode = this.chaseCamera.cycleMode();
      this.uiManager.showScrapeNotification('📷 KAMERA', `Açı: ${nextMode}`);
    };

    this.uiManager.onSpectatorLeave = () => {
      this.exitSpectatorMode();
    };

    this.uiManager.onSkipIntro = () => {
      this.skipIntro();
    };

    this.uiManager.onNavigate = (screen) => {
      this.setScreen(screen);
    };

    this.uiManager.onStartAdStudio = (config) => {
      this.startAdStudioMode(config);
    };

    this.uiManager.onExitAdStudio = () => {
      this.exitAdStudioMode();
    };

    this.uiManager.onCycleAdStudioShot = () => {
      return this.chaseCamera.nextAdStudioShot();
    };

    this.uiManager.onLoadCustomModel = async (files: FileList | File[]) => {
      await this.playerVehicle.loadFromFiles(files);
      if (gameState.currentScreen === 'GARAGE') {
        this.playerVehicle.mesh.position.set(0, 0.12, 0);
      }
    };

    this.uiManager.onRotateCustomModel = (deg: number) => {
      this.playerVehicle.rotateCustomModel((deg * Math.PI) / 180);
    };

    this.uiManager.onResetCustomModel = () => {
      this.playerVehicle.resetToProceduralModel();
      this.playerVehicle.reconfigureStats();
    };

    this.uiManager.onGarageVehiclePreview = async (def) => {
      await this.playerVehicle.loadVehicleModel(def);
      if (gameState.currentScreen === 'GARAGE') {
        this.playerVehicle.mesh.position.set(0, 0.12, 0);
      }
    };

    this.uiManager.onGarageColorChange = (hex) => {
      this.playerVehicle.setColor(hex);
    };

    this.uiManager.onStartMultiplayerRace = () => {
      this.startMultiplayerRace();
    };

    eventBus.on('vehicleSelected', async () => {
      await this.playerVehicle.loadCurrentVehicleModel();
    });

    eventBus.on('mp:opponentUpdate', (update: any) => {
      const oppCar = this.remoteOpponentVehicles.get(update.playerId);
      if (oppCar) {
        oppCar.applyStateUpdate(update);
      }
    });

    eventBus.on('mp:opponentCrashed', (data) => {
      const oppCar = this.remoteOpponentVehicles.get(data.playerId);
      if (oppCar) {
        oppCar.updateNameplateText(`${data.playerName || oppCar.opponentName} (💥 KAZA)`, 0);
      }
      this.uiManager.showScrapeNotification('💥 RAKİP KAZA YAPTI!', `${data.playerName || 'Bir rakip'} kaza yaptı! Gazlamaya devam et.`);
      audioManager.playCrash();
    });

    eventBus.on('mp:opponentLeft', (data) => {
      const oppCar = this.remoteOpponentVehicles.get(data.playerId);
      if (oppCar) {
        oppCar.dispose();
        this.remoteOpponentVehicles.delete(data.playerId);
      }
      this.uiManager.showScrapeNotification('⚠️ OYUNCU AYRILDI', `${data.playerName || 'Bir rakip'} odadan ayrıldı.`);
    });

    eventBus.on('mp:spectatorJoined', () => {
      this.isSpectatorActive = true;
      this.startMultiplayerRace();
    });

    eventBus.on('mp:raceFinished', (data: any) => {
      if (data.isMeWinner && data.totalPot) {
        gameState.addMoney(data.totalPot);
      } else if (data.spectatorPayout && data.spectatorPayout > 0) {
        gameState.addMoney(data.spectatorPayout);
      }
      this.uiManager.setSpectatorHudVisible(false);
    });
  }

  private initGarageShowroom(): void {
    // 1. Garage Turntable Platform
    this.garageTurntable = new THREE.Group();
    this.garageTurntable.position.set(0, 0, 0);

    // Multi-tier Luxury Showroom Podium
    // A. Outer beveled podium base
    const baseGeo = new THREE.CylinderGeometry(3.6, 4.0, 0.22, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e1a,
      metalness: 0.85,
      roughness: 0.28,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.11;
    baseMesh.receiveShadow = true;
    this.garageTurntable.add(baseMesh);

    // B. Upper rotating disc platform (brushed dark carbon/titanium)
    const topGeo = new THREE.CylinderGeometry(3.45, 3.45, 0.08, 48);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x141a29,
      metalness: 0.9,
      roughness: 0.15,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = 0.02;
    topMesh.receiveShadow = true;
    this.garageTurntable.add(topMesh);

    // C. Outer Illuminated Neon Halo Ring (Vivid Turquoise Glow)
    const haloGeo = new THREE.TorusGeometry(3.47, 0.045, 16, 64);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
    });
    const haloRing = new THREE.Mesh(haloGeo, haloMat);
    haloRing.position.y = 0.04;
    this.garageTurntable.add(haloRing);

    // D. Inner Concentric LED Ring (Cyan)
    const innerRingGeo = new THREE.TorusGeometry(2.2, 0.025, 12, 64);
    innerRingGeo.rotateX(Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.y = 0.062;
    this.garageTurntable.add(innerRing);

    // E. Radial LED Runway Lines (4 cardinal markers)
    for (let i = 0; i < 4; i++) {
      const lineGeo = new THREE.BoxGeometry(0.04, 0.01, 1.1);
      const lineMesh = new THREE.Mesh(lineGeo, innerRingMat);
      const angle = (i * Math.PI) / 2;
      lineMesh.position.set(Math.sin(angle) * 2.8, 0.062, Math.cos(angle) * 2.8);
      lineMesh.rotation.y = angle;
      this.garageTurntable.add(lineMesh);
    }

    // F. Soft floor ground halo underglow
    const glowGeo = new THREE.PlaneGeometry(9.5, 9.5);
    glowGeo.rotateX(-Math.PI / 2);
    let glowTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
        grad.addColorStop(0, 'rgba(0, 245, 212, 0.45)');
        grad.addColorStop(0.45, 'rgba(0, 180, 216, 0.25)');
        grad.addColorStop(0.8, 'rgba(0, 119, 182, 0.08)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
      }
      glowTex = new THREE.CanvasTexture(canvas);
    }
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const floorGlow = new THREE.Mesh(glowGeo, glowMat);
    floorGlow.position.y = 0.01;
    this.garageTurntable.add(floorGlow);

    this.garageTurntable.visible = false;
    this.scene.add(this.garageTurntable);

    // 2. Studio Showroom Lighting Group
    this.garageLightsGroup = new THREE.Group();

    // Overhead Key Spotlight focusing on the vehicle
    const keySpot = new THREE.SpotLight(0xffffff, 5.2, 24, Math.PI / 3.8, 0.35, 1.2);
    keySpot.position.set(0, 6.5, -0.5);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0.5, 0);
    this.garageLightsGroup.add(spotTarget);
    keySpot.target = spotTarget;
    keySpot.castShadow = true;
    this.garageLightsGroup.add(keySpot);

    // Cyan Rim Light from behind
    const rimSpot = new THREE.SpotLight(0x00f0ff, 3.8, 18, Math.PI / 3, 0.5, 1.0);
    rimSpot.position.set(0, 3.5, 4.5);
    rimSpot.target = spotTarget;
    this.garageLightsGroup.add(rimSpot);

    // Warm Front-Left Fill Light for wheels & front grill
    const fillLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    fillLight.position.set(-3.7, 3.2, -4.5);
    this.garageLightsGroup.add(fillLight);

    // Ambient studio base
    const ambLight = new THREE.AmbientLight(0x101a28, 0.85);
    this.garageLightsGroup.add(ambLight);

    this.garageLightsGroup.visible = false;
    this.scene.add(this.garageLightsGroup);
  }

  private setupGaragePointerListeners(): void {
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if (gameState.currentScreen !== 'GARAGE') return;
      const target = e.target as HTMLElement;
      if (target && target.closest('.garage-sidebar')) return;

      this.isGarageDragging = true;
      this.garageDragPrevX = document.body.classList.contains('forced-landscape') ? e.clientY : e.clientX;
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isGarageDragging || gameState.currentScreen !== 'GARAGE') return;
      const currentPos = document.body.classList.contains('forced-landscape') ? e.clientY : e.clientX;
      const dx = currentPos - this.garageDragPrevX;
      this.garageDragPrevX = currentPos;
      this.garageTurntable.rotation.y += dx * 0.009;
      this.playerVehicle.mesh.rotation.y = this.garageTurntable.rotation.y;
    });

    window.addEventListener('pointerup', () => {
      this.isGarageDragging = false;
    });

    window.addEventListener('pointercancel', () => {
      this.isGarageDragging = false;
    });
  }

  private async boot(): Promise<void> {
    this.uiManager.setLoadingProgress(15, 'İstanbul Haritası & Yollar...');

    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5500));

    // Parallel load
    const playerModelPromise = this.playerVehicle.modelReadyPromise.catch(() => false);

    this.uiManager.setLoadingProgress(35, '3D Araçlar ve Tofaş Paketi...');

    // Trigger loads for packs in background
    npcPackManager.load().catch(() => false);
    cityPackManager.load().catch(() => false);
    shipManager.load().catch(() => false);

    this.uiManager.setLoadingProgress(65, 'Kaplamalar ve Detaylar Hazırlanıyor...');

    // Wait until player vehicle is loaded (or 5.5s timeout)
    await Promise.race([
      playerModelPromise,
      timeoutPromise,
    ]);

    this.uiManager.setLoadingProgress(92, 'Tamamlanıyor...');

    setTimeout(() => {
      this.uiManager.setLoadingProgress(100, 'Hazır!');

      // If custom model failed to load, fall back to procedural
      if (!this.playerVehicle.isUsingCustomModel) {
        this.playerVehicle.proceduralGroup.visible = true;
      }

      this.playerVehicle.mesh.visible = true;

      setTimeout(() => {
        this.setScreen('MAIN_MENU');
      }, 350);
    }, 250);
  }

  private handleResize(): void {
    const isForced = document.body.classList.contains('forced-landscape');
    let width: number;
    let height: number;

    if (isForced) {
      width = Math.max(window.innerWidth, window.innerHeight);
      height = Math.min(window.innerWidth, window.innerHeight);
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
    }

    this.renderer.setSize(width, height);
    this.chaseCamera.setAspect(width / height);

    if (gameState.currentScreen === 'GARAGE') {
      this.updateGarageViewOffset(width, height);
    } else {
      this.chaseCamera.camera.clearViewOffset();
      this.chaseCamera.camera.updateProjectionMatrix();
    }
  }

  private updateGarageViewOffset(width?: number, height?: number): void {
    const isForced = document.body.classList.contains('forced-landscape');
    const w = width ?? (isForced ? Math.max(window.innerWidth, window.innerHeight) : window.innerWidth);
    const h = height ?? (isForced ? Math.min(window.innerWidth, window.innerHeight) : window.innerHeight);

    const sidebar = document.querySelector('.garage-sidebar') as HTMLElement | null;
    let sidebarW = sidebar ? (sidebar.clientWidth || 360) : 360;

    if (sidebarW <= 0 || sidebarW > w * 0.60) {
      sidebarW = Math.min(360, w * 0.38);
    }

    // Set view offset so optical center aligns with the center of the left showcase area:
    // Left area width = w - sidebarW
    // Center of left area = (w - sidebarW) / 2
    // Offset from screen center = w / 2 - (w - sidebarW) / 2 = sidebarW / 2
    this.chaseCamera.camera.setViewOffset(w, h, sidebarW / 2, 0, w, h);
    this.chaseCamera.camera.updateProjectionMatrix();
  }

  public setScreen(screen: 'BOOT' | 'MAIN_MENU' | 'PLAYING' | 'GAME_OVER' | 'GARAGE' | 'MISSIONS'): void {
    gameState.isPaused = false;
    gameState.setScreen(screen);
    this.uiManager.showScreen(screen);

    if (screen !== 'PLAYING') {
      this.isIntroActive = false;
      this.uiManager.finishCinematicIntro();
      if (gameState.isAdStudioMode) {
        gameState.isAdStudioMode = false;
        gameState.timeScale = 1.0;
        this.chaseCamera.exitAdStudio();
        this.uiManager.hideAdStudioHud();
      }
    }

    if (screen !== 'GARAGE') {
      this.chaseCamera.camera.clearViewOffset();
      this.chaseCamera.camera.updateProjectionMatrix();
    }

    this.idleTimer = 0;
    this.garageIdleTimer = 0;
    this.garageIdleShotIndex = 0;
    this.garageIdleShotTimer = 0;
    if (this.chaseCamera.isIdleActive) {
      this.chaseCamera.exitIdleCinematic();
      this.uiManager.setIdleCinematicBadge(false);
    }

    if (screen === 'BOOT') {
      this.garageTurntable.visible = false;
      if (this.garageLightsGroup) this.garageLightsGroup.visible = false;
      this.playerVehicle.mesh.visible = false;
    } else if (screen === 'MAIN_MENU') {
      this.garageTurntable.visible = false;
      if (this.garageLightsGroup) this.garageLightsGroup.visible = false;
      this.playerVehicle.mesh.visible = true;
      this.playerVehicle.loadCurrentVehicleModel().catch(() => {});
      this.playerVehicle.reconfigureStats();
      this.playerVehicle.resetPosition();
      this.chaseCamera.reset(0);
      this.chaseCamera.resetMenuCinematic();
      audioManager.stopEngine();
      audioManager.stopNitroSound();
      audioManager.stopTrafficAudio();
      audioManager.startMusic();
    } else if (screen === 'GARAGE') {
      this.garageTurntable.visible = true;
      if (this.garageLightsGroup) this.garageLightsGroup.visible = true;
      this.playerVehicle.mesh.visible = true;
      this.playerVehicle.reconfigureStats();
      this.playerVehicle.updateLicensePlatePositions();
      this.playerVehicle.mesh.position.set(0, 0.12, 0);
      const initialGarageAngle = Math.PI - 0.35; // 3/4 angle facing camera so user immediately sees the front plate
      this.playerVehicle.mesh.rotation.set(0, initialGarageAngle, 0);
      this.garageTurntable.rotation.set(0, initialGarageAngle, 0);

      const isMobile = isMobileDevice() || document.body.classList.contains('forced-landscape');
      const camZ = isMobile ? -6.0 : -5.6;
      this.chaseCamera.camera.position.set(0, 1.85, camZ);
      this.chaseCamera.camera.lookAt(0, 0.75, 0);
      this.updateGarageViewOffset();
      audioManager.stopTrafficAudio();
    } else if (screen === 'MISSIONS') {
      this.garageTurntable.visible = false;
      if (this.garageLightsGroup) this.garageLightsGroup.visible = false;
      audioManager.stopTrafficAudio();
    } else if (screen === 'GAME_OVER') {
      this.garageTurntable.visible = false;
      if (this.garageLightsGroup) this.garageLightsGroup.visible = false;
      audioManager.stopEngine();
      audioManager.stopNitroSound();
      audioManager.stopTrafficAudio();
      this.playerVehicle.stop();
    }
  }

  public startAdStudioMode(config: { vehicleId?: string; environment?: any; aggressive?: boolean } = {}): void {
    gameState.isAdStudioMode = true;
    gameState.timeScale = 1.0;
    gameState.adStudioAggressive = config.aggressive !== false;
    cinematicAutopilot.reset(1, gameState.adStudioAggressive ? 'AGGRESSIVE' : 'NORMAL');

    if (config.vehicleId) {
      gameState.selectVehicle(config.vehicleId);
    }
    if (config.environment) {
      gameState.setEnvironment(config.environment);
    }

    this.startRace();
  }

  public exitAdStudioMode(): void {
    gameState.isAdStudioMode = false;
    gameState.timeScale = 1.0;
    this.chaseCamera.exitAdStudio();
    this.uiManager.hideAdStudioHud();
    this.setScreen('MAIN_MENU');
  }

  public startRace(): void {
    requestNativeLandscapeLock().catch(() => {});
    this.isCrashed = false;
    gameState.isPaused = false;
    this.uiManager.hidePauseMenu();
    gameState.startSession();
    this.garageTurntable.visible = false;
    if (this.garageLightsGroup) this.garageLightsGroup.visible = false;
    this.playerVehicle.mesh.visible = true;

    // Reset systems
    this.environment.setPreset(gameState.currentEnvironment);
    this.chaseCamera.setMode(gameState.currentCameraView);
    this.playerVehicle.reconfigureStats();
    this.playerVehicle.resetPosition();
    this.roadManager.reset(0);
    this.trafficManager.reset();
    this.nearMissSystem.reset();
    this.nitroSystem.reset();
    this.scoreManager.reset(0);
    this.economyManager.reset();
    this.particleSystem.reset();
    this.chaseCamera.reset(0);
    this.wasNitroActive = false;
    this.lastRadarPassedZ = 0;
    this.scrapeCooldown = 0;
    this.istanbulAmbienceTimer = 5;
    this.idleTimer = 0;
    this.chaseCamera.exitIdleCinematic();
    this.uiManager.setIdleCinematicBadge(false);

    audioManager.startEngine();
    audioManager.startMusic();

    if (gameState.isAdStudioMode) {
      this.isIntroActive = false;
      this.chaseCamera.startAdStudio();
      cinematicAutopilot.reset(1, gameState.adStudioAggressive ? 'AGGRESSIVE' : 'NORMAL');
      this.uiManager.finishCinematicIntro();
      this.uiManager.showAdStudioHud();
    } else {
      this.isIntroActive = true;
      this.raceStarterSystem.startStaging(
        this.playerVehicle,
        this.remoteOpponentVehicles,
        false
      );
    }

    this.setScreen('PLAYING');
  }

  public startMultiplayerRace(): void {
    prng.setSeed(multiplayerManager.seed);
    gameState.currentMode = 'ONE_WAY';
    this.raceTime = 0;
    this.isCrashed = false;

    this.startRace();

    // Clean up previous opponent vehicles if any
    for (const vehicle of this.remoteOpponentVehicles.values()) {
      vehicle.dispose();
    }
    this.remoteOpponentVehicles.clear();

    if (multiplayerManager.isSpectator) {
      this.isSpectatorActive = true;
      if (this.playerVehicle) {
        this.playerVehicle.mesh.visible = false;
        this.playerVehicle.speedMps = 0;
      }
    } else {
      this.isSpectatorActive = false;
      if (this.playerVehicle) {
        this.playerVehicle.mesh.visible = true;
        const myLane = multiplayerManager.myAssignedLane;
        this.playerVehicle.mesh.position.set(laneSystem.getLaneX(myLane), 0.12, 0);
      }
    }

    // Spawn 3D vehicle for every opponent in the room
    for (const opp of multiplayerManager.opponents.values()) {
      const remoteVehicle = new RemotePlayerVehicle(
        opp.id,
        opp.name,
        opp.vehicleId,
        opp.colorHex
      );
      const oppLane = opp.lane ?? 2;
      const initialX = laneSystem.getLaneX(oppLane);
      remoteVehicle.setInitialPosition(initialX, 0, opp.distance || 0);
      this.scene.add(remoteVehicle.mesh);
      this.remoteOpponentVehicles.set(opp.id, remoteVehicle);
    }

    if (this.isSpectatorActive) {
      const firstTarget = Array.from(multiplayerManager.opponents.values()).find(p => !p.isCrashed) || multiplayerManager.opponents.values().next().value;
      if (firstTarget) {
        this.spectateTargetId = firstTarget.id;
        multiplayerManager.spectateTargetId = firstTarget.id;
        const targetVehicle = this.remoteOpponentVehicles.get(firstTarget.id);
        if (targetVehicle) {
          this.chaseCamera.snapToTarget(targetVehicle);
        }
        this.uiManager.updateSpectatorTargetInfo(firstTarget.name, firstTarget.vehicleId);
      }
      this.uiManager.setSpectatorHudVisible(true);
      this.skipIntro();
    } else {
      this.uiManager.setSpectatorHudVisible(false);
      // Launch multiplayer staging sequence with 3D starter character
      this.isIntroActive = true;
      this.raceStarterSystem.startStaging(
        this.playerVehicle,
        this.remoteOpponentVehicles,
        true,
        multiplayerManager.roomPlayers
      );
    }

    this.uiManager.setMultiplayerHudVisible(true);
  }

  public cycleSpectatorTarget(direction: 1 | -1 = 1): void {
    const nextTarget = multiplayerManager.cycleSpectateTarget(direction);
    if (nextTarget) {
      this.spectateTargetId = nextTarget.id;
      const targetVehicle = this.remoteOpponentVehicles.get(nextTarget.id);
      if (targetVehicle) {
        this.chaseCamera.snapToTarget(targetVehicle);
      }
      this.uiManager.updateSpectatorTargetInfo(nextTarget.name, nextTarget.vehicleId);
      this.uiManager.showScrapeNotification('👁️ İZLENEN SÜRÜCÜ', `${nextTarget.name} takip ediliyor.`);
    }
  }

  public exitSpectatorMode(): void {
    this.isSpectatorActive = false;
    this.spectateTargetId = null;
    this.uiManager.setSpectatorHudVisible(false);
    multiplayerManager.leaveRoom();
    if (this.playerVehicle) {
      this.playerVehicle.mesh.visible = true;
    }
    this.setScreen('MAIN_MENU');
  }

  private updateSpectatorMode(delta: number, inputs: InputState): void {
    // 1. Spectator target cycling and camera mode
    if (inputs.spectatePrevJustPressed) {
      this.cycleSpectatorTarget(-1);
    } else if (inputs.spectateNextJustPressed) {
      this.cycleSpectatorTarget(1);
    }

    if (inputs.cameraToggleJustPressed) {
      const nextMode = this.chaseCamera.cycleMode();
      this.uiManager.showScrapeNotification('📷 KAMERA', `Açı: ${nextMode}`);
    }

    // 2. Resolve target vehicle
    let targetVehicle = this.spectateTargetId ? this.remoteOpponentVehicles.get(this.spectateTargetId) : null;
    let targetOpponent = this.spectateTargetId ? multiplayerManager.opponents.get(this.spectateTargetId) : null;

    if (!targetVehicle || !targetOpponent || targetOpponent.isCrashed) {
      const active = Array.from(multiplayerManager.opponents.values()).find(o => !o.isCrashed);
      if (active) {
        this.spectateTargetId = active.id;
        multiplayerManager.spectateTargetId = active.id;
        targetVehicle = this.remoteOpponentVehicles.get(active.id);
        targetOpponent = active;
        if (targetVehicle) {
          this.chaseCamera.snapToTarget(targetVehicle);
        }
      }
    }

    const targetPos = targetVehicle ? targetVehicle.mesh.position : new THREE.Vector3(0, 0, 0);
    const targetSpeedKmh = targetVehicle ? targetVehicle.speedKmh : 0;

    // 3. Update all remote opponents
    this.raceTime += delta;
    for (const remoteVehicle of this.remoteOpponentVehicles.values()) {
      remoteVehicle.update(delta, targetPos.z);
    }

    // 4. Endless Road & Environment follow target
    this.roadManager.update(targetPos.z, delta, performance.now() * 0.001);
    this.environment.update(targetPos.z, delta);

    // 5. Camera follow
    if (targetVehicle) {
      this.chaseCamera.update(delta, targetVehicle, targetVehicle.steerInput, false);
      audioManager.updateEnginePitch(targetSpeedKmh, true, false);
    }

    // 6. Live leaderboard & Spectator HUD
    const liveStandings = this.getLiveStandings();
    this.uiManager.updateMultiplayerLeaderboard(liveStandings);

    const currentRank = liveStandings.findIndex(s => s.id === this.spectateTargetId) + 1 || 1;
    this.uiManager.updateSpectatorHud({
      racerName: targetOpponent?.name || 'Yarışçı',
      speedKmh: Math.round(targetSpeedKmh),
      distanceMeters: Math.round(targetPos.z),
      rank: currentRank,
      totalRacers: liveStandings.length,
      totalPot: multiplayerManager.totalPot,
      spectatorCount: multiplayerManager.spectatorCount,
      targetId: this.spectateTargetId || '',
      currentBet: multiplayerManager.currentBet,
    });
  }

  public skipIntro(): void {
    if (this.raceStarterSystem && this.raceStarterSystem.isActive) {
      this.raceStarterSystem.skip();
    }
    if (!this.isIntroActive) return;
    this.chaseCamera.skipIntro(this.playerVehicle);
    this.finishIntro();
  }

  private finishIntro(): void {
    if (!this.isIntroActive) return;
    this.isIntroActive = false;
    audioManager.playCountdownBeep(true);
    this.uiManager.updateCinematicCountdown('BAŞLA! 🏁', true);
    this.uiManager.hideRacerBroadcastCard();
    this.uiManager.finishCinematicIntro();
  }

  public resumeRace(): void {
    gameState.isPaused = false;
    audioManager.startEngine();
    eventBus.emit('gameResumed');
    this.uiManager.hidePauseMenu();
  }

  public pauseRace(): void {
    if (!gameState.isPlaying || this.isCrashed || gameState.currentScreen !== 'PLAYING') return;
    gameState.isPaused = true;
    audioManager.stopEngine();
    audioManager.stopNitroSound();
    audioManager.stopBrakeAudio();
    audioManager.stopTrafficAudio();
    eventBus.emit('gamePaused');
    this.uiManager.showPauseMenu();
  }

  private onTimeUp(): void {
    if (this.isCrashed) return;
    this.isCrashed = true;
    gameState.isPlaying = false;
    this.playerVehicle.stop();
    audioManager.stopEngine();
    audioManager.stopNitroSound();
    audioManager.stopBrakeAudio();
    audioManager.stopTrafficAudio();
    gameState.setWrongWay(false);

    const result = gameState.endSession();
    this.missionManager.updateDistance(gameState.currentDistanceMeters);
    this.missionManager.trackScore(gameState.currentScore);

    this.setScreen('GAME_OVER');
    this.uiManager.showGameOver(
      gameState.currentDistanceMeters,
      gameState.currentScore,
      result.earnings,
      gameState.currentNearMisses,
      result.isNewHighScore,
      'SÜRE BİTTİ!'
    );
  }

  private onCrash(title = 'KAZA YAPTIN!'): void {
    if (this.isCrashed) return;
    this.isCrashed = true;
    gameState.isPlaying = false;

    // Halt player vehicle immediately
    this.playerVehicle.stop();

    audioManager.playCrash();
    audioManager.stopEngine();
    audioManager.stopNitroSound();
    audioManager.stopBrakeAudio();
    audioManager.stopTrafficAudio();
    this.chaseCamera.triggerShake(0.85, 0.8);
    gameState.setWrongWay(false);

    // Visual debris
    this.particleSystem.triggerCrashExplosion(
      this.playerVehicle.mesh.position,
      gameState.getVehicleColor(gameState.selectedVehicleId)
    );

    // End session in GameState
    const result = gameState.endSession();

    // Update mission progression
    this.missionManager.updateDistance(gameState.currentDistanceMeters);
    this.missionManager.trackScore(gameState.currentScore);

    if (multiplayerManager.isRacing) {
      multiplayerManager.sendCrashed(this.playerVehicle.mesh.position.z);
      this.isCrashed = true;
      if (this.playerVehicle) {
        this.playerVehicle.speedMps = 0;
      }

      // Transition to spectator mode or end race if all done
      setTimeout(() => {
        const activeOpponents = Array.from(multiplayerManager.opponents.values()).filter(o => !o.isCrashed);
        if (activeOpponents.length > 0) {
          // Transition to spectator mode to watch the rest of the race
          this.isSpectatorActive = true;
          this.playerVehicle.mesh.visible = false;
          this.spectateTargetId = activeOpponents[0].id;
          multiplayerManager.spectateTargetId = this.spectateTargetId;
          const targetVeh = this.remoteOpponentVehicles.get(this.spectateTargetId);
          if (targetVeh) {
            this.chaseCamera.snapToTarget(targetVeh);
          }
          this.uiManager.updateSpectatorTargetInfo(activeOpponents[0].name, activeOpponents[0].vehicleId);
          this.uiManager.showScrapeNotification('💥 ELENDİN!', 'Seyirci moduna geçildi. Kalan yarışçıları izliyorsun!');
          this.uiManager.setSpectatorHudVisible(true);
        } else {
          this.setScreen('GAME_OVER');
          const standings = this.getLiveStandings();
          const winner = standings[0];
          this.uiManager.showMultiplayerResult({
            isWinner: false,
            winnerName: winner?.name || 'Rakip',
            reason: 'OPPONENT_CRASHED',
            myDist: this.playerVehicle.mesh.position.z,
            oppDist: standings.find((s) => !s.isMe)?.distance || 0,
            standings,
            totalPot: multiplayerManager.totalPot,
          });
        }
      }, 700);
      return;
    }

    // Single Player: Trigger Game Over screen after a brief dramatic moment
    setTimeout(() => {
      this.setScreen('GAME_OVER');
      this.uiManager.showGameOver(
        gameState.currentDistanceMeters,
        gameState.currentScore,
        result.earnings,
        gameState.currentNearMisses,
        result.isNewHighScore,
        title
      );
    }, 700);
  }

  private handleScrape(colResult: CollisionResult): void {
    this.scrapeCooldown = 0.32; // 320ms immunity to clear bounding boxes

    const pushDir = colResult.pushDirectionX;
    const overlapX = colResult.overlapX;

    // 1. Physical lateral push to bounce vehicles apart
    const pushDist = Math.max(0.24, overlapX + 0.10);
    this.playerVehicle.mesh.position.x += pushDir * pushDist;
    this.playerVehicle.mesh.position.x = laneSystem.clampToRoad(
      this.playerVehicle.mesh.position.x,
      this.playerVehicle.dimensions.width * 0.55
    );

    if (colResult.collidedWith) {
      colResult.collidedWith.mesh.position.x -= pushDir * 0.16;
    }

    // 2. Speed penalty
    const speedDrop = Math.min(22, this.playerVehicle.speedKmh * 0.14 + 8);
    this.playerVehicle.speedKmh = Math.max(20, this.playerVehicle.speedKmh - speedDrop);
    this.playerVehicle.speedMps = this.playerVehicle.speedKmh / 3.6;

    // 3. Makas Sarsıntısı: Camera Trauma & Chassis Tilt Shock
    this.chaseCamera.triggerShake(0.62, 0.44);
    this.playerVehicle.currentSteerTilt += pushDir * 0.15;
    this.playerVehicle.currentYaw -= pushDir * 0.08;

    // 4. Sound effects
    audioManager.playBumperThump(0.82, pushDir * 0.45);
    audioManager.playBrakeScreech();
    if (Math.random() < 0.65) {
      audioManager.playNpcHorn(pushDir * 0.35, 0.8);
    }

    // 5. Metal sparks
    this.particleSystem.emitScrapeSparks(colResult.contactPoint, 14);

    // 6. Apply vehicle damage (20 - 26 HP)
    const dmg = Math.round(20 + Math.min(6, (this.playerVehicle.speedKmh / 140) * 6));
    const damageResult = gameState.applyDamage(dmg);

    if (damageResult.isTotaled) {
      this.uiManager.showScrapeNotification('💥 ARAÇ PERT OLDU!', 'Yüksek Hasar Aldı');
      this.onCrash('ARABA YÜKSEK HASAR ALDI!');
      return;
    }

    // 7. UI notification banner with remaining health
    this.uiManager.showScrapeNotification(
      '⚡ SIYIRMA!',
      `-%${dmg} Hasar • Kalan Sağlık: %${Math.round(damageResult.currentHealth)}`
    );
  }

  private handleSlowBump(colResult: CollisionResult): void {
    this.scrapeCooldown = 0.45; // 450ms immunity

    const overlapZ = colResult.overlapZ;
    const vehicle = colResult.collidedWith;

    // 1. Separate along Z axis
    const sepZ = Math.max(0.32, overlapZ + 0.16);
    this.playerVehicle.mesh.position.z -= sepZ * 0.5;

    if (vehicle) {
      vehicle.mesh.position.z += sepZ * 0.5;
      vehicle.onBumperTouched(this.playerVehicle.speedKmh);
    }

    // 2. Speed matches / drops below front vehicle
    const targetSpeed = vehicle
      ? Math.max(15, Math.min(this.playerVehicle.speedKmh - 22, vehicle.speedKmh - 4))
      : Math.max(15, this.playerVehicle.speedKmh - 25);
    this.playerVehicle.speedKmh = targetSpeed;
    this.playerVehicle.speedMps = this.playerVehicle.speedKmh / 3.6;

    // 3. Heavy bumper jolt & nose dive
    this.chaseCamera.triggerShake(0.78, 0.54);
    this.playerVehicle.currentPitch = 0.055;

    // 4. Sound effects
    audioManager.playBumperThump(0.95, 0);
    audioManager.playBrakeScreech();
    audioManager.playNpcHorn(0, 0.95);

    // 5. Sparks and tire smoke
    this.particleSystem.emitScrapeSparks(colResult.contactPoint, 16);
    this.particleSystem.emitTireSmoke(this.playerVehicle.mesh.position, false);

    // 6. Apply vehicle damage (30 - 38 HP)
    const dmg = Math.round(30 + Math.min(8, colResult.relativeSpeedKmh * 0.22));
    const damageResult = gameState.applyDamage(dmg);

    if (damageResult.isTotaled) {
      this.uiManager.showScrapeNotification('💥 ARAÇ PERT OLDU!', 'Yüksek Hasar Aldı');
      this.onCrash('ARABA YÜKSEK HASAR ALDI!');
      return;
    }

    // 7. UI notification banner with remaining health
    this.uiManager.showScrapeNotification(
      '💥 TAMPON TEMASI!',
      `-%${dmg} Hasar • Kalan Sağlık: %${Math.round(damageResult.currentHealth)}`
    );
  }

  private startLoop(): void {
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      const rawDelta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Cap delta time to prevent simulation explosion on tab blur, scaled by timeScale for slow-mo
      const delta = Math.min(rawDelta, 0.1) * gameState.timeScale;

      this.fpsFrameCount++;
      if (currentTime - this.fpsLastCalcTime >= 250) {
        this.currentFps = (this.fpsFrameCount * 1000) / (currentTime - this.fpsLastCalcTime);
        this.fpsFrameCount = 0;
        this.fpsLastCalcTime = currentTime;
        this.uiManager.updateFPS(this.currentFps);
      }

      this.update(delta);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  private update(delta: number): void {
    const screen = gameState.currentScreen;

    if (screen === 'BOOT') {
      const carPos = this.playerVehicle.mesh.position;
      this.chaseCamera.updateMenuCinematic(delta, carPos);
    } else if (screen === 'PLAYING') {
      this.updateRaceSimulation(delta);
    } else if (screen === 'GAME_OVER') {
      // Simulation is completely frozen; keep particles animating until they fade
      this.particleSystem.update(delta, this.playerVehicle.mesh.position);
      this.chaseCamera.update(delta, this.playerVehicle, 0, false);
    } else if (screen === 'GARAGE') {
      // Rotate vehicle slowly on turntable if not dragging manually
      if (!this.isGarageDragging) {
        this.garageTurntable.rotation.y += delta * 0.28;
        this.garageIdleTimer += delta;
      } else {
        this.garageIdleTimer = 0;
      }
      this.playerVehicle.mesh.rotation.y = this.garageTurntable.rotation.y;
      this.playerVehicle.mesh.position.set(0, 0.12, 0);
      this.playerVehicle.updateExhaustFlames(false, delta);
      this.particleSystem.update(delta, this.playerVehicle.mesh.position);

      if (this.garageIdleTimer >= 6.5) {
        this.updateGarageIdleCamera(delta);
      } else {
        this.chaseCamera.camera.position.lerp(_defaultCamPos, Math.min(1.0, delta * 5.0));
        this.chaseCamera.camera.lookAt(_defaultLookAt);
        this.chaseCamera.camera.fov = 54;
        this.chaseCamera.camera.updateProjectionMatrix();
      }
    } else if (screen === 'MAIN_MENU') {
      // Dynamic rotating cinematic camera showcase (5 distinct angles)
      const carPos = this.playerVehicle.mesh.position;
      const t = performance.now() * 0.001;
      this.chaseCamera.updateMenuCinematic(delta, carPos);
      this.roadManager.update(carPos.z, delta, t);
      this.environment.update(delta);
      this.playerVehicle.updateExhaustFlames(false, delta);
      this.particleSystem.update(delta, carPos);
    }
  }

  private updateGarageIdleCamera(delta: number): void {
    this.garageIdleShotTimer += delta;
    const shot = GARAGE_IDLE_SHOTS[this.garageIdleShotIndex];

    if (this.garageIdleShotTimer >= shot.duration) {
      this.garageIdleShotTimer = 0;
      this.garageIdleShotIndex = (this.garageIdleShotIndex + 1) % GARAGE_IDLE_SHOTS.length;
    }

    const currentShot = GARAGE_IDLE_SHOTS[this.garageIdleShotIndex];
    _tempTargetPos.set(currentShot.pos.x, currentShot.pos.y, currentShot.pos.z);
    _tempTargetLookAt.set(currentShot.lookAt.x, currentShot.lookAt.y, currentShot.lookAt.z);

    this.chaseCamera.camera.position.lerp(_tempTargetPos, Math.min(1.0, delta * 3.2));
    this.chaseCamera.camera.lookAt(_tempTargetLookAt);

    const fovLerp = Math.min(1.0, delta * 3.0);
    this.chaseCamera.camera.fov += (currentShot.fov - this.chaseCamera.camera.fov) * fovLerp;
    this.chaseCamera.camera.updateProjectionMatrix();
  }

  private updateRaceSimulation(delta: number): void {
    if (this.isCrashed) {
      // Freeze simulation during dramatic 700ms crash pause
      this.particleSystem.update(delta, this.playerVehicle.mesh.position);
      this.chaseCamera.update(delta, this.playerVehicle, 0, false);
      return;
    }

    const rawInputs = inputManager.update(delta);
    const aiOutput = gameState.isAdStudioMode
      ? cinematicAutopilot.update(delta, this.playerVehicle, this.trafficManager)
      : null;

    const inputs: InputState = aiOutput
      ? {
          steer: aiOutput.steer,
          accelerate: aiOutput.accelerate,
          brake: aiOutput.brake,
          nitro: aiOutput.nitro,
          hornJustPressed: false,
          flash: aiOutput.flashHighBeams,
          flashJustPressed: aiOutput.flashHighBeams && !this.wasFlashActive,
          signalLeftJustPressed: false,
          signalRightJustPressed: false,
          cameraToggleJustPressed: false,
          pauseJustPressed: rawInputs.pauseJustPressed,
          radioNextJustPressed: rawInputs.radioNextJustPressed,
          radioToggleJustPressed: rawInputs.radioToggleJustPressed,
          spectatePrevJustPressed: false,
          spectateNextJustPressed: false,
        }
      : rawInputs;

    // Handle pause
    if (inputs.pauseJustPressed && !this.isCrashed) {
      if (gameState.isPaused) {
        this.resumeRace();
      } else if (gameState.isPlaying && gameState.currentScreen === 'PLAYING') {
        this.pauseRace();
        return;
      }
    }

    if (gameState.isPaused) return;

    if (this.scrapeCooldown > 0) {
      this.scrapeCooldown -= delta;
    }

    // Handle camera cycle
    if (inputs.cameraToggleJustPressed) {
      const nextView = this.chaseCamera.cycleMode();
      gameState.setCameraView(nextView);
      audioManager.playClick();
    }

    // Istanbul Radio & Cassette Player Hotkeys (R: İstasyon Değiştir, M: Radyo Aç/Kapa)
    if (inputs.radioNextJustPressed) {
      audioManager.init();
      radioManager.nextStation();
    }
    if (inputs.radioToggleJustPressed) {
      audioManager.init();
      radioManager.togglePlay();
    }

    // Istanbul Car Horn
    if (inputs.hornJustPressed) {
      audioManager.playCarHorn();
    }

    // High-Beam Flashing (Selektör Atma - F key / Touch Button: Hold to keep on, release to turn off)
    if (inputs.flashJustPressed) {
      audioManager.playHighBeamClick(true);
    } else if (this.wasFlashActive && !inputs.flash) {
      audioManager.playHighBeamClick(false);
    }
    this.wasFlashActive = inputs.flash;
    this.playerVehicle.setHighBeamsActive(inputs.flash);

    // Turn Signals (Sinyal Verme - Q: Sol, E: Sağ)
    if (inputs.signalLeftJustPressed) {
      this.playerVehicle.toggleTurnSignal('left');
    }
    if (inputs.signalRightJustPressed) {
      this.playerVehicle.toggleTurnSignal('right');
    }

    // Istanbul Bosphorus Atmosphere (Distant ferry foghorn & seagulls)
    this.istanbulAmbienceTimer -= delta;
    if (this.istanbulAmbienceTimer <= 0) {
      this.istanbulAmbienceTimer = 18 + Math.random() * 16;
      if (Math.random() > 0.45) {
        audioManager.playFerryHorn();
      } else {
        audioManager.playSeagulls();
      }
    }

    // Inactivity / Idle Camera Showcase Detection (Automatically triggered when inactive)
    const hasActiveInput =
      Math.abs(inputs.steer) > 0.08 ||
      inputs.accelerate ||
      inputs.brake ||
      inputs.nitro ||
      inputs.hornJustPressed ||
      inputs.flash ||
      inputs.cameraToggleJustPressed ||
      inputs.signalLeftJustPressed ||
      inputs.signalRightJustPressed ||
      inputs.radioNextJustPressed ||
      inputs.radioToggleJustPressed;

    if (hasActiveInput || this.isSpectatorActive) {
      this.idleTimer = 0;
      if (this.chaseCamera.isIdleActive) {
        this.chaseCamera.exitIdleCinematic();
        this.uiManager.setIdleCinematicBadge(false);
      }
    } else if (!this.isIntroActive && !this.isCrashed && gameState.isPlaying && gameState.currentScreen === 'PLAYING') {
      this.idleTimer += delta;
      if (this.idleTimer >= this.IDLE_THRESHOLD) {
        if (!this.chaseCamera.isIdleActive) {
          this.chaseCamera.startIdleCinematic(this.playerVehicle.mesh.position);
        }
        this.uiManager.setIdleCinematicBadge(true, this.chaseCamera.currentIdleShotName);
      }
    }

    // Handle Race Starter System (Staging roll-up, broadcast showcase & 3D character countdown)
    if (this.raceStarterSystem.isActive) {
      if (inputs.accelerate || inputs.nitro || inputs.brake) {
        this.skipIntro();
      } else {
        this.raceStarterSystem.update(delta);
        this.playerVehicle.updateBoundingBox();
        this.particleSystem.update(delta, this.playerVehicle.mesh.position);
        this.trafficManager.update(delta, this.playerVehicle, 0, inputs.hornJustPressed, inputs.flash);
        this.environment.update(delta);
        this.uiManager.updateHUD(0, 0, 0, 0, 100);
        this.uiManager.updateRadioVisuals(radioManager.getSpectrumLevels(), radioManager.isPlaying);
        return;
      }
    } else if (this.isIntroActive) {
      if (inputs.accelerate || inputs.nitro || inputs.brake) {
        this.skipIntro();
      } else {
        this.introTimer += delta;

        if (this.introTimer >= 1.50 && this.introCountdownStage < 0) {
          this.introCountdownStage = 0;
          this.uiManager.updateCinematicCountdown('3');
          audioManager.playCountdownBeep(false);
        } else if (this.introTimer >= 2.90 && this.introCountdownStage < 1) {
          this.introCountdownStage = 1;
          this.uiManager.updateCinematicCountdown('2');
          audioManager.playCountdownBeep(false);
        } else if (this.introTimer >= 4.30 && this.introCountdownStage < 2) {
          this.introCountdownStage = 2;
          this.uiManager.updateCinematicCountdown('1');
          audioManager.playCountdownBeep(false);
        }

        const isFinished = this.chaseCamera.updateIntro(delta, this.playerVehicle);
        if (isFinished || this.introTimer >= this.introDuration) {
          this.finishIntro();
        }

        this.playerVehicle.speedKmh = 0;
        this.playerVehicle.speedMps = 0;
        this.playerVehicle.updateExhaustFlames(false, delta);
        this.playerVehicle.updateBoundingBox();
        audioManager.updateEnginePitch(0, false, false);
        this.particleSystem.update(delta, this.playerVehicle.mesh.position);
        this.trafficManager.update(delta, this.playerVehicle, 0, inputs.hornJustPressed, inputs.flash);
        this.environment.update(delta);
        this.uiManager.updateHUD(0, 0, 0, 0, 100);
        this.uiManager.updateRadioVisuals(radioManager.getSpectrumLevels(), radioManager.isPlaying);
        return;
      }
    }

    // Spectator mode handling (watch active racers, no local physics or collision updates)
    if (this.isSpectatorActive) {
      this.updateSpectatorMode(delta, inputs);
      return;
    }

    // Check nitro
    const isNitroActive = this.nitroSystem.update(delta, inputs.nitro, this.playerVehicle.speedKmh);
    if (isNitroActive) {
      this.missionManager.trackNitro(delta);
    }

    // Update player driving physics
    this.playerVehicle.updatePhysics(delta, inputs.steer, inputs.accelerate, inputs.brake, isNitroActive);
    this.raceStarterSystem.update(delta);

    const playerPos = this.playerVehicle.mesh.position;
    const speedKmh = this.playerVehicle.speedKmh;

    // Nitro backfire sparks & sound
    if (this.wasNitroActive && !isNitroActive) {
      this.particleSystem.emitBackfireSparks(this.playerVehicle.getExhaustTipWorldPosition(), true);
      audioManager.playBackfire();
    }
    this.wasNitroActive = isNitroActive;

    // Tire smoke on hard braking or sharp steering/drifting
    if ((inputs.brake && speedKmh > 35) || (Math.abs(inputs.steer) > 0.65 && speedKmh > 85)) {
      this.particleSystem.emitTireSmoke(playerPos, Math.abs(inputs.steer) > 0.65);
    }

    // Engine smoke when vehicle is heavily damaged (< 40% health)
    if (gameState.vehicleHealth < 40 && speedKmh > 5) {
      const smokeChance = gameState.vehicleHealth <= 20 ? 0.65 : 0.35;
      if (Math.random() < smokeChance) {
        this.particleSystem.emitEngineSmoke(playerPos, gameState.vehicleHealth <= 20);
      }
    }

    // Speed effects (particles, lines)
    this.particleSystem.setSpeedEffects(speedKmh > 170 || isNitroActive, playerPos);
    this.particleSystem.update(delta, playerPos);

    // Two-Way Mode Wrong Way scoring & cash bonus
    const isTwoWayActive = gameState.currentMode === 'TWO_WAY' || (gameState.currentMode === 'CUSTOM_TRAFFIC' && gameState.trafficSettings.direction === 'TWO_WAY');
    if (isTwoWayActive) {
      const isWrongWay = playerPos.x > 0 && speedKmh > 30;
      gameState.setWrongWay(isWrongWay);
      if (isWrongWay) {
        this.scoreManager.addScore(GAME_CONSTANTS.ECONOMY.WRONG_WAY_SCORE_PER_SEC * delta);
        this.economyManager.addSessionCash(GAME_CONSTANTS.ECONOMY.WRONG_WAY_CASH_PER_SEC * delta, 'WRONG_WAY', false);
        this.missionManager.trackWrongWay(this.playerVehicle.speedMps * delta);
      }
    } else {
      gameState.setWrongWay(false);
    }

    // Time Attack Mode countdown & checkpoints
    if (gameState.currentMode === 'TIME_ATTACK') {
      gameState.timeAttackRemaining -= delta;
      eventBus.emit('timeAttackTick', { remainingSeconds: Math.max(0, Math.ceil(gameState.timeAttackRemaining)) });

      if (gameState.currentDistanceMeters - gameState.lastCheckpointMeters >= GAME_CONSTANTS.TIME_ATTACK.CHECKPOINT_INTERVAL_METERS) {
        gameState.lastCheckpointMeters = Math.floor(gameState.currentDistanceMeters / GAME_CONSTANTS.TIME_ATTACK.CHECKPOINT_INTERVAL_METERS) * GAME_CONSTANTS.TIME_ATTACK.CHECKPOINT_INTERVAL_METERS;
        gameState.addTimeAttackSeconds(GAME_CONSTANTS.TIME_ATTACK.CHECKPOINT_BONUS_SEC, 'CHECKPOINT +10s');
        audioManager.playCheckpoint();
      }

      if (gameState.timeAttackRemaining <= 0) {
        this.onTimeUp();
        return;
      }
    }

    // EDS Speed Radar Camera check (every 240m along highway overhead gantries)
    const radarInterval = 240;
    if (playerPos.z - this.lastRadarPassedZ >= radarInterval) {
      this.lastRadarPassedZ = Math.floor(playerPos.z / radarInterval) * radarInterval;
      if (speedKmh > 125) {
        audioManager.playRadarBeep();
        this.uiManager.triggerRadarFlash(Math.round(speedKmh));
      }
    }

    // Update traffic
    this.trafficManager.update(
      delta,
      this.playerVehicle,
      gameState.currentDistanceMeters,
      inputs.hornJustPressed,
      inputs.flash
    );

    // Collision Detection
    const activeTraffic = this.trafficManager.getActiveVehicles();

    // Dynamic 3D spatial traffic audio (engine hums, diesel trucks, emergency sirens, pass-bys)
    audioManager.updateTrafficAudio(activeTraffic, playerPos, speedKmh, delta);

    const colResult = this.collisionSystem.checkCollisions(this.playerVehicle, activeTraffic);

    if (colResult.hasCollided) {
      if (gameState.isAdStudioMode) {
        if (this.scrapeCooldown <= 0) {
          this.handleSlowBump(colResult);
        }
      } else {
        const isGodMode = gameState.currentMode === 'CUSTOM_TRAFFIC' && gameState.trafficSettings.godMode;
        if (colResult.type === 'fatal_crash') {
          if (isGodMode) {
            if (this.scrapeCooldown <= 0) {
              this.handleSlowBump(colResult);
              this.uiManager.showScrapeNotification('🛡️ ÖLÜMSÜZLÜK AKTİF!', 'Çarpışma Engellendi • Gazlamaya Devam Et');
            }
          } else {
            this.onCrash();
            return;
          }
        } else if (this.scrapeCooldown <= 0) {
          if (colResult.type === 'scrape') {
            this.handleScrape(colResult);
          } else if (colResult.type === 'slow_bump') {
            this.handleSlowBump(colResult);
          }
        }
      }
    }

    // Near Miss System
    this.nearMissSystem.update(delta, this.playerVehicle, activeTraffic);

    // Score & Economy
    this.scoreManager.update(delta, playerPos.z, speedKmh);
    this.economyManager.update(gameState.currentDistanceMeters, speedKmh, delta);

    // Missions tracking
    this.missionManager.trackSpeed(speedKmh);

    // Road Endless Recycling and dynamic element animations
    this.roadManager.update(playerPos.z, delta, performance.now() * 0.001);

    // Environment follows player with animated rain
    this.environment.update(playerPos.z, delta);

    // Wet road spray particles behind tires during rain mode
    if (gameState.currentEnvironment === 'RAIN' && speedKmh > 25) {
      this.particleSystem.emitWetRoadSpray(playerPos, speedKmh);
    }

    // Tunnel Reverb Acoustics (Detect if player is driving inside Avrasya / TEM tunnel)
    const currentSeg = this.roadManager.getSegmentAtZ(playerPos.z);
    audioManager.setTunnelReverb(currentSeg ? currentSeg.isTunnel : false);

    // Camera follow
    this.chaseCamera.update(delta, this.playerVehicle, inputs.steer, isNitroActive);

    // Audio pitch modulation
    audioManager.updateEnginePitch(speedKmh, inputs.accelerate, isNitroActive);

    // Dynamic continuous braking audio (rotor friction, metallic pad squeal, ABS judder)
    audioManager.updateBrakeAudio(inputs.brake, speedKmh, delta);

    // Update HUD
    const isSignalBlinking = (this.playerVehicle.turnSignalTimer % 0.38) < 0.20;
    this.uiManager.updateHUD(
      speedKmh,
      gameState.currentDistanceMeters,
      gameState.currentScore,
      gameState.currentSessionCash,
      gameState.currentNitroPercent,
      this.playerVehicle.turnSignal,
      isSignalBlinking,
      gameState.vehicleHealth
    );

    this.uiManager.updateRadioVisuals(radioManager.getSpectrumLevels(), radioManager.isPlaying);

    if (gameState.isAdStudioMode) {
      this.uiManager.updateAdStudioHud(
        this.chaseCamera.getCurrentAdStudioShot().name,
        speedKmh,
        gameState.timeScale
      );
    }

    // Multiplayer synchronization and Remote Opponents update
    this.raceTime += delta;
    for (const remoteVehicle of this.remoteOpponentVehicles.values()) {
      remoteVehicle.update(delta, playerPos.z);
    }

    if (multiplayerManager.isRacing) {
      const liveStandings = this.getLiveStandings();
      this.uiManager.updateMultiplayerLeaderboard(liveStandings);

      const speedMps = speedKmh / 3.6;
      const steerTilt = this.playerVehicle.currentSteerTilt || 0;
      const lateralVx = Math.sin(steerTilt * -0.12) * speedMps;

      multiplayerManager.sendState({
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        speed: speedKmh,
        steer: steerTilt,
        brake: speedKmh > 10 && inputs.brake,
        nitro: isNitroActive,
        horn: inputs.hornJustPressed,
        flash: inputs.flash,
        signal: this.playerVehicle.turnSignal,
        distance: playerPos.z,
        vx: lateralVx,
        vz: speedMps,
      });

      // Goal reach check for SPRINT mode
      if (multiplayerManager.mode === 'SPRINT' && playerPos.z >= multiplayerManager.targetDistance) {
        multiplayerManager.sendGoalReached(playerPos.z, this.raceTime);
      }
    }
  }

  public getLiveStandings(): Array<{
    rank: number;
    id: string;
    name: string;
    distance: number;
    deltaMeters: number;
    isMe: boolean;
    isCrashed: boolean;
    lane: number;
  }> {
    const racers: Array<{
      id: string;
      name: string;
      distance: number;
      isMe: boolean;
      isCrashed: boolean;
      lane: number;
    }> = [];

    if (!multiplayerManager.isSpectator) {
      const myDist = this.playerVehicle?.mesh?.position?.z || 0;
      racers.push({
        id: multiplayerManager.myPlayerId || 'local_me',
        name: multiplayerManager.myPlayerName || 'Sen',
        distance: Math.round(myDist),
        isMe: true,
        isCrashed: this.isCrashed,
        lane: multiplayerManager.myAssignedLane,
      });
    }

    for (const opp of multiplayerManager.opponents.values()) {
      racers.push({
        id: opp.id,
        name: opp.name,
        distance: Math.round(opp.distance || 0),
        isMe: false,
        isCrashed: !!opp.isCrashed,
        lane: opp.lane ?? 2,
      });
    }

    racers.sort((a, b) => {
      if (!a.isCrashed && b.isCrashed) return -1;
      if (a.isCrashed && !b.isCrashed) return 1;
      return b.distance - a.distance;
    });

    const leaderDist = racers[0]?.distance || 0;

    return racers.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      deltaMeters: idx === 0 ? 0 : r.distance - leaderDist,
    }));
  }

  public applyGraphicsQuality(quality: 'low' | 'medium' | 'high'): void {
    if (!this.renderer) return;
    const isMobile = isMobileDevice();

    if (quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
      if (this.chaseCamera?.camera) {
        this.chaseCamera.camera.far = 340;
        this.chaseCamera.camera.updateProjectionMatrix();
      }
    } else if (quality === 'medium') {
      // On mobile, disabling dynamic shadow map avoids double rendering geometry passes,
      // while vehicles still have high-res contact shadow decals on the road.
      this.renderer.shadowMap.enabled = !isMobile;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 1.25));
      if (this.chaseCamera?.camera) {
        this.chaseCamera.camera.far = isMobile ? 360 : 420;
        this.chaseCamera.camera.updateProjectionMatrix();
      }
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFShadowMap;
      this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 1.5));
      if (this.chaseCamera?.camera) {
        this.chaseCamera.camera.far = isMobile ? 400 : 480;
        this.chaseCamera.camera.updateProjectionMatrix();
      }
    }
  }

  private render(): void {
    this.renderFrameCount++;
    // Shadow throttling: compute shadow maps every 2nd frame (30 Hz at 60 FPS) to halve shadow draw calls
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = (this.renderFrameCount % 2 === 0);
    }
    this.renderer.render(this.scene, this.chaseCamera.camera);
  }
}
