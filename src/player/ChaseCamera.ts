// Dynamic Multi-Angle Camera with Chase, Interior (Cockpit), Hood, and Bumper views, FOV warping, and shake

import * as THREE from 'three';
import { GAME_CONSTANTS, type CameraViewMode } from '../core/Constants';
import type { PlayerVehicle } from '../vehicles/PlayerVehicle';
import { isMobileDevice } from '../utils/orientation';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export interface CameraPreset {
  name: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  xLag: number;
  fov: number;
  isRigid: boolean;
}

export const CAMERA_PRESETS: Record<CameraViewMode, CameraPreset> = {
  CHASE: {
    name: 'TAKİP',
    offsetX: 0.0,
    offsetY: 2.65, // Low, athletic 3rd-person arcade view right behind car roof
    offsetZ: -5.8, // Immersive framing showing the entire car cleanly
    lookAtX: 0.0,
    lookAtY: 1.25,
    lookAtZ: 18.0, // High-visibility sightline down highway
    xLag: 0.82,
    fov: 64,
    isRigid: false,
  },
  INTERIOR: {
    name: 'KOKPİT',
    offsetX: 0.34, // Driver's seat matching vehicle steering wheel placement
    offsetY: 1.40, // Natural driver eye level overlooking steering wheel and clear windshield
    offsetZ: -0.12, // Driver's seat position
    lookAtX: 0.32, // Forward down the driver's lane
    lookAtY: 1.30, // Sightline forward towards road horizon
    lookAtZ: 35.0, // Far down the highway
    xLag: 1.0,
    fov: 72, // Authentic wide cockpit FOV
    isRigid: true, // 100% rigidly locked in Z & X! ZERO backward drift or acceleration lag
  },
  HOOD: {
    name: 'KAPUT',
    offsetX: 0.0,
    offsetY: 1.08, // Mounted over center of the hood
    offsetZ: 1.35, // Over the front bonnet overlooking the road
    lookAtX: 0.0,
    lookAtY: 0.95,
    lookAtZ: 30.0,
    xLag: 1.0,
    fov: 68,
    isRigid: true, // 100% rigidly locked!
  },
  BUMPER: {
    name: 'TAMPON',
    offsetX: 0.0,
    offsetY: 0.52, // Low ground rush above asphalt
    offsetZ: 2.25, // Front bumper tip
    lookAtX: 0.0,
    lookAtY: 0.52,
    lookAtZ: 35.0,
    xLag: 1.0,
    fov: 74,
    isRigid: true, // 100% rigidly locked!
  },
};

export interface VehicleCockpitConfig {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  lookAtY?: number;
  fov?: number;
}

export const VEHICLE_COCKPIT_CONFIGS: Record<string, VehicleCockpitConfig> = {
  tofas_gltf: {
    offsetX: 0.35,
    offsetY: 1.08,
    offsetZ: -0.05,
    lookAtY: 1.04,
    fov: 74,
  },
  starter_coupe: {
    offsetX: 0.35,
    offsetY: 1.12,
    offsetZ: -0.06,
    lookAtY: 1.06,
    fov: 74,
  },
  opel_corsa_b: {
    offsetX: 0.34,
    offsetY: 1.38,
    offsetZ: -0.10,
    lookAtY: 1.28,
    fov: 72,
  },
  golf_gti: {
    offsetX: 0.36,
    offsetY: 1.15,
    offsetZ: -0.08,
    lookAtY: 1.10,
    fov: 72,
  },
  mini_cooper: {
    offsetX: 0.33,
    offsetY: 1.12,
    offsetZ: -0.08,
    lookAtY: 1.08,
    fov: 72,
  },
  bmw_e46: {
    offsetX: 0.36,
    offsetY: 1.18,
    offsetZ: -0.10,
    lookAtY: 1.12,
    fov: 72,
  },
};

export interface CinematicIntroPreset {
  id: number;
  name: string;
  tag: string;
  startOffset: { x: number; y: number; z: number };
  midOffset: { x: number; y: number; z: number };
  startLookAtOffset: { x: number; y: number; z: number };
  midLookAtOffset: { x: number; y: number; z: number };
  startFov: number;
}

export const CINEMATIC_INTRO_PRESETS: CinematicIntroPreset[] = [
  {
    id: 0,
    name: 'GÖKYÜZÜ DRONE SÜZÜLÜŞÜ',
    tag: 'HAVADAN GENİŞ AÇI',
    startOffset: { x: 9.0, y: 26.0, z: -72.0 },
    midOffset: { x: -4.5, y: 6.2, z: -24.0 },
    startLookAtOffset: { x: 0, y: 0.8, z: 4.0 },
    midLookAtOffset: { x: 0, y: 1.0, z: 10.0 },
    startFov: 78,
  },
  {
    id: 1,
    name: 'ÖNDEN DÖNÜŞ & YAKIN GEÇİŞ',
    tag: 'BURUN & PROFİL ORBİT',
    startOffset: { x: -7.0, y: 3.5, z: 42.0 },
    midOffset: { x: -6.0, y: 2.4, z: -6.0 },
    startLookAtOffset: { x: 0, y: 0.9, z: 0.0 },
    midLookAtOffset: { x: 0, y: 1.0, z: 4.0 },
    startFov: 72,
  },
  {
    id: 2,
    name: 'KUŞBAKIŞI HELİKOPTER DALIŞI',
    tag: 'DİK UYDU DALIŞI',
    startOffset: { x: 0.0, y: 38.0, z: -14.0 },
    midOffset: { x: 3.2, y: 12.0, z: -18.0 },
    startLookAtOffset: { x: 0, y: 0.2, z: 2.0 },
    midLookAtOffset: { x: 0, y: 1.1, z: 12.0 },
    startFov: 82,
  },
  {
    id: 3,
    name: 'ASFALT SEVİYESİ HIZLI YAKLAŞMA',
    tag: 'YERDEN DÜŞÜK HIZLI ÇEKİM',
    startOffset: { x: -3.8, y: 0.42, z: -62.0 },
    midOffset: { x: 2.2, y: 0.85, z: -22.0 },
    startLookAtOffset: { x: 0, y: 0.85, z: -2.0 },
    midLookAtOffset: { x: 0, y: 1.0, z: 6.0 },
    startFov: 70,
  },
  {
    id: 4,
    name: 'YANDAN SİNEMATİK KÖPRÜ PAN',
    tag: 'EMNİYET ŞERİDİ TAKİP',
    startOffset: { x: 19.0, y: 8.5, z: -35.0 },
    midOffset: { x: 7.0, y: 4.4, z: -16.0 },
    startLookAtOffset: { x: 0, y: 0.9, z: 0.0 },
    midLookAtOffset: { x: 0, y: 1.1, z: 8.0 },
    startFov: 74,
  },
];

export interface MenuCinematicShot {
  name: string;
  startOffset: { x: number; y: number; z: number };
  endOffset: { x: number; y: number; z: number };
  startLookAt: { x: number; y: number; z: number };
  endLookAt: { x: number; y: number; z: number };
  fov: number;
  duration: number;
}

export const MENU_CINEMATIC_SHOTS: MenuCinematicShot[] = [
  {
    name: 'ÖN ÇAPRAZ DİNAMİK SÜZÜLÜŞ',
    startOffset: { x: -2.8, y: 0.85, z: 3.8 },
    endOffset: { x: -1.8, y: 1.25, z: 4.6 },
    startLookAt: { x: 0.0, y: 0.65, z: 0.6 },
    endLookAt: { x: 0.1, y: 0.75, z: 0.1 },
    fov: 46,
    duration: 6.5,
  },
  {
    name: 'ARKA ÇAPRAZ EGZOZ & JANT DETAYI',
    startOffset: { x: 2.5, y: 0.52, z: -2.9 },
    endOffset: { x: 3.0, y: 0.88, z: -1.7 },
    startLookAt: { x: 0.3, y: 0.45, z: -1.0 },
    endLookAt: { x: 0.0, y: 0.65, z: -0.4 },
    fov: 45,
    duration: 6.5,
  },
  {
    name: 'KUŞBAKIŞI DRONE SÜZÜLÜŞÜ',
    startOffset: { x: 3.6, y: 3.5, z: 2.2 },
    endOffset: { x: -3.2, y: 3.0, z: 2.8 },
    startLookAt: { x: 0.0, y: 0.70, z: 0.0 },
    endLookAt: { x: 0.0, y: 0.70, z: 0.2 },
    fov: 52,
    duration: 7.0,
  },
  {
    name: 'ÖN IZGARA & FARLAR KARŞIDAN YAKIN PLAN',
    startOffset: { x: -1.4, y: 0.52, z: 4.8 },
    endOffset: { x: 1.4, y: 0.58, z: 4.4 },
    startLookAt: { x: -0.2, y: 0.55, z: 0.5 },
    endLookAt: { x: 0.2, y: 0.55, z: 0.5 },
    fov: 42,
    duration: 6.5,
  },
  {
    name: 'YAN PROFİL & SİLÜET TAKİBİ',
    startOffset: { x: -4.2, y: 1.05, z: -1.2 },
    endOffset: { x: -3.4, y: 1.45, z: 1.5 },
    startLookAt: { x: 0.0, y: 0.72, z: 0.0 },
    endLookAt: { x: 0.0, y: 0.72, z: 0.5 },
    fov: 48,
    duration: 6.5,
  },
];

// Idle Cinematic Showcase System (Dynamic rotating perspectives when player is inactive)
export interface IdleCinematicShot {
  name: string;
  startOffset: { x: number; y: number; z: number };
  endOffset: { x: number; y: number; z: number };
  startLookAt: { x: number; y: number; z: number };
  endLookAt: { x: number; y: number; z: number };
  fov: number;
  duration: number;
}

export const IDLE_CINEMATIC_SHOTS: IdleCinematicShot[] = [
  {
    name: 'ÖN ALÇAK HERO & BOĞAZİÇİ MANZARASI',
    startOffset: { x: -2.2, y: 0.65, z: 5.4 },
    endOffset: { x: 2.2, y: 0.88, z: 4.6 },
    startLookAt: { x: 0.0, y: 0.65, z: 0.3 },
    endLookAt: { x: 0.0, y: 0.65, z: 0.3 },
    fov: 44,
    duration: 6.0,
  },
  {
    name: 'YAN JANT & GÖVDE PROFİLİ',
    startOffset: { x: -4.2, y: 0.80, z: -1.2 },
    endOffset: { x: -3.6, y: 1.25, z: 2.2 },
    startLookAt: { x: 0.0, y: 0.68, z: 0.2 },
    endLookAt: { x: 0.0, y: 0.68, z: 0.5 },
    fov: 48,
    duration: 6.5,
  },
  {
    name: 'ARKA EGZOZ & ÖZEL PLAKA DETAYI',
    startOffset: { x: 1.8, y: 0.54, z: -3.8 },
    endOffset: { x: -1.6, y: 0.78, z: -4.2 },
    startLookAt: { x: 0.0, y: 0.55, z: 0.0 },
    endLookAt: { x: 0.0, y: 0.55, z: 0.0 },
    fov: 42,
    duration: 6.0,
  },
  {
    name: 'DRON SİNEMATİK KUŞBAKIŞI YÖRÜNGE',
    startOffset: { x: 3.6, y: 4.2, z: 3.6 },
    endOffset: { x: -3.4, y: 3.5, z: -3.2 },
    startLookAt: { x: 0.0, y: 0.55, z: 0.0 },
    endLookAt: { x: 0.0, y: 0.55, z: 0.0 },
    fov: 54,
    duration: 7.0,
  },
  {
    name: 'ÖN SAĞ DİNAMİK SİNEMATİK',
    startOffset: { x: 3.0, y: 1.25, z: 4.6 },
    endOffset: { x: 1.8, y: 0.70, z: 5.8 },
    startLookAt: { x: -0.1, y: 0.65, z: 0.1 },
    endLookAt: { x: 0.1, y: 0.65, z: 0.1 },
    fov: 46,
    duration: 6.0,
  },
];

// Ad Studio & Instagram Reels Cinematic Shot Presets (Dynamic Fly-In / Fly-Out Breathing)
export interface AdStudioShot {
  id: string;
  name: string;
  // Dynamic fly-in close framing (intimate peak of the sweep)
  closeOffsetX: number;
  closeOffsetY: number;
  closeOffsetZ: number;
  closeFov: number;

  // Dynamic fly-out far framing (wide overview & approach)
  farOffsetX: number;
  farOffsetY: number;
  farOffsetZ: number;
  farFov: number;

  // Target lookAt coordinates
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  closeLookAtZ?: number;

  // Motion dynamics
  rollTilt: number;
  lagX: number;
  swayAmpX?: number;
  swayFreq?: number;
  dollyFreq?: number;
  isRigid?: boolean;

  // Backward compatibility fields
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  fov?: number;
}

export const AD_STUDIO_SHOTS: AdStudioShot[] = [
  {
    id: 'DRONE_SWOOP',
    name: '🚁 DİNAMİK DALIŞ DRONE',
    farOffsetX: 1.8,
    farOffsetY: 7.5,
    farOffsetZ: -16.5,
    farFov: 68,
    closeOffsetX: 0.35,
    closeOffsetY: 1.15,
    closeOffsetZ: -3.8,
    closeFov: 60,
    lookAtX: 0.0,
    lookAtY: 0.95,
    lookAtZ: 22.0,
    closeLookAtZ: 14.0,
    rollTilt: 0.04,
    lagX: 0.65,
    swayAmpX: 0.55,
    swayFreq: 1.5,
    dollyFreq: 0.85,
    offsetX: 0.35,
    offsetY: 1.15,
    offsetZ: -3.8,
    fov: 60,
  },
  {
    id: 'FRONT_DRONE',
    name: '🎬 REVERSE ÖN DRONE',
    farOffsetX: -1.4,
    farOffsetY: 5.0,
    farOffsetZ: 15.0,
    farFov: 72,
    closeOffsetX: 0.25,
    closeOffsetY: 0.88,
    closeOffsetZ: 3.2,
    closeFov: 62,
    lookAtX: 0.0,
    lookAtY: 0.78,
    lookAtZ: -1.5,
    closeLookAtZ: 0.2,
    rollTilt: -0.06,
    lagX: 0.78,
    swayAmpX: 0.85,
    swayFreq: 1.3,
    dollyFreq: 0.80,
    offsetX: 0.25,
    offsetY: 0.88,
    offsetZ: 3.2,
    fov: 62,
  },
  {
    id: 'LOW_EXHAUST',
    name: '🔥 ALÇAK EGZOZ & PUNCH',
    farOffsetX: 1.5,
    farOffsetY: 1.6,
    farOffsetZ: -9.0,
    farFov: 76,
    closeOffsetX: 0.82,
    closeOffsetY: 0.46,
    closeOffsetZ: -2.6,
    closeFov: 66,
    lookAtX: -0.15,
    lookAtY: 0.65,
    lookAtZ: 20.0,
    closeLookAtZ: 12.0,
    rollTilt: 0.08,
    lagX: 0.72,
    swayAmpX: 0.40,
    swayFreq: 1.9,
    dollyFreq: 0.90,
    offsetX: 0.82,
    offsetY: 0.46,
    offsetZ: -2.6,
    fov: 66,
  },
  {
    id: 'SIDE_FENDER',
    name: '⚡ YAN ÇAMURLUK MAKAS',
    farOffsetX: 4.5,
    farOffsetY: 2.4,
    farOffsetZ: -4.8,
    farFov: 68,
    closeOffsetX: 2.35,
    closeOffsetY: 0.92,
    closeOffsetZ: -0.75,
    closeFov: 62,
    lookAtX: -0.30,
    lookAtY: 0.75,
    lookAtZ: 16.0,
    closeLookAtZ: 9.0,
    rollTilt: 0.04,
    lagX: 0.86,
    swayAmpX: 0.30,
    swayFreq: 2.0,
    dollyFreq: 0.82,
    offsetX: 2.35,
    offsetY: 0.92,
    offsetZ: -0.75,
    fov: 62,
  },
  {
    id: 'BRIDGE_ORBIT',
    name: '🌉 BOĞAZ KÖPRÜSÜ ORBİT',
    farOffsetX: -5.2,
    farOffsetY: 8.8,
    farOffsetZ: -17.5,
    farFov: 66,
    closeOffsetX: -2.1,
    closeOffsetY: 2.2,
    closeOffsetZ: -5.5,
    closeFov: 58,
    lookAtX: 0.15,
    lookAtY: 0.80,
    lookAtZ: 18.0,
    closeLookAtZ: 12.0,
    rollTilt: -0.05,
    lagX: 0.62,
    swayAmpX: 1.2,
    swayFreq: 1.1,
    dollyFreq: 0.72,
    offsetX: -2.1,
    offsetY: 2.2,
    offsetZ: -5.5,
    fov: 58,
  },
  {
    id: 'COCKPIT_ACTION',
    name: '🏎️ DİREKSİYON & MAKAS',
    farOffsetX: -0.28,
    farOffsetY: 1.40,
    farOffsetZ: 0.05,
    farFov: 74,
    closeOffsetX: -0.28,
    closeOffsetY: 1.36,
    closeOffsetZ: 0.22,
    closeFov: 70,
    lookAtX: -0.28,
    lookAtY: 1.26,
    lookAtZ: 35.0,
    closeLookAtZ: 30.0,
    rollTilt: 0.0,
    lagX: 1.0,
    isRigid: true,
    dollyFreq: 1.0,
    offsetX: -0.28,
    offsetY: 1.36,
    offsetZ: 0.22,
    fov: 70,
  },
  {
    id: 'HELI_SWOOP',
    name: '🚁 HELİKOPTER KUŞBAKIŞI',
    farOffsetX: 0.0,
    farOffsetY: 17.0,
    farOffsetZ: -12.5,
    farFov: 62,
    closeOffsetX: 1.2,
    closeOffsetY: 4.8,
    closeOffsetZ: -5.8,
    closeFov: 54,
    lookAtX: 0.0,
    lookAtY: 0.50,
    lookAtZ: 14.0,
    closeLookAtZ: 10.0,
    rollTilt: -0.03,
    lagX: 0.55,
    swayAmpX: 1.4,
    swayFreq: 0.95,
    dollyFreq: 0.70,
    offsetX: 1.2,
    offsetY: 4.8,
    offsetZ: -5.8,
    fov: 54,
  },
  {
    id: 'BUMPER_RUSH',
    name: '🚀 ASFALT TAMPON RUSH',
    farOffsetX: 0.0,
    farOffsetY: 0.68,
    farOffsetZ: 5.2,
    farFov: 82,
    closeOffsetX: 0.0,
    closeOffsetY: 0.34,
    closeOffsetZ: 2.20,
    closeFov: 76,
    lookAtX: 0.0,
    lookAtY: 0.40,
    lookAtZ: 40.0,
    closeLookAtZ: 30.0,
    rollTilt: 0.0,
    lagX: 1.0,
    isRigid: true,
    dollyFreq: 0.92,
    offsetX: 0.0,
    offsetY: 0.34,
    offsetZ: 2.20,
    fov: 76,
  },
];

export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraViewMode = 'CHASE';

  private currentPosition = new THREE.Vector3();
  private lookAtTarget = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private modeJustChanged = false;

  // Cockpit Free-Look (Interactive Looking Around inside the car)
  public cockpitYaw: number = 0;   // Horizontal look rotation (radians)
  public cockpitPitch: number = 0; // Vertical look rotation (radians)
  private targetCockpitYaw: number = 0;
  private targetCockpitPitch: number = 0;
  private isPointerDown: boolean = false;
  private activeCameraTouchId: number | null = null;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private returnTimer: number = 0;
  private isKeyLooking: boolean = false;

  // Camera Shake
  private shakeTrauma = 0;
  private shakeTimer = 0;

  // Cinematic Drone Fly-In Intro System (5 Variations)
  public isIntroActive: boolean = false;
  public introProgress: number = 0;
  private introDuration: number = 5.8;
  public currentIntroIndex: number = -1;
  private introStartPos = new THREE.Vector3();
  private introMidPos = new THREE.Vector3();
  private introStartLookAt = new THREE.Vector3();
  private introMidLookAt = new THREE.Vector3();
  private introStartFov: number = 76;

  // Main Menu Cinematic Showcase System (5 Rotating Camera Angles)
  public menuShotIndex: number = 0;
  private menuShotTimer: number = 0;

  // Idle Inactive Showcase System (Dynamic camera angles when player goes idle)
  public isIdleActive: boolean = false;
  public idleShotIndex: number = 0;
  private idleShotTimer: number = 0;
  private idleBlendProgress: number = 1.0;

  // Instagram Reel / Ad Studio Cinematic Director
  public isAdStudioActive: boolean = false;
  public adStudioShotIndex: number = 0;
  public isAutoDirector: boolean = true;
  public adStudioShotDuration: number = 7.4;
  private adStudioTimer: number = 0;

  constructor(aspect: number) {
    const isMobile = isMobileDevice();
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_PRESETS.CHASE.fov,
      aspect,
      0.08, // 8cm near plane prevents cockpit geometry clipping
      isMobile ? 420 : 650
    );
    this.setupFreeLookListeners();
    this.reset(0, 0);
  }

  private setupFreeLookListeners(): void {
    if (typeof window === 'undefined') return;

    // 1. Mouse Drag (Look around by clicking and dragging anywhere on screen, interior only)
    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.mode !== 'INTERIOR') return;
      // Don't intercept UI button clicks
      if ((e.target as HTMLElement)?.closest('button, input, select, .ui-screen:not(#screen-hud), .touch-btn, .hud-pause-btn, .hud-camera-btn')) return;
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.returnTimer = 0;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPointerDown || this.mode !== 'INTERIOR') return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const sensitivity = 0.0055;
      this.targetCockpitYaw -= dx * sensitivity;
      this.targetCockpitPitch -= dy * sensitivity * 0.75;

      // Clamp yaw: -170° to +170°
      const maxYaw = Math.PI * 0.95;
      this.targetCockpitYaw = Math.max(-maxYaw, Math.min(maxYaw, this.targetCockpitYaw));

      // Clamp pitch: -38° to +30°
      this.targetCockpitPitch = Math.max(-0.65, Math.min(0.52, this.targetCockpitPitch));
      this.returnTimer = 0;
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
      this.returnTimer = 0;
    });

    // 2. Touch Swipe for Mobile (Interior view only, specific pointer track)
    window.addEventListener('touchstart', (e: TouchEvent) => {
      if (this.mode !== 'INTERIOR') return;
      if (this.activeCameraTouchId !== null) return;

      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, .btn, .touch-btn, .icon-btn, .choice-pill, .hud-pause-btn, .hud-camera-btn, .hud-stat-box, .speedometer-card, .mobile-controls-container, .hud-telemetry')) {
        return;
      }

      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        // Only upper-middle area (away from virtual controls)
        if (touch.clientY < window.innerHeight * 0.60) {
          this.activeCameraTouchId = touch.identifier;
          this.isPointerDown = true;
          this.lastPointerX = touch.clientX;
          this.lastPointerY = touch.clientY;
          this.returnTimer = 0;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (this.mode !== 'INTERIOR' || !this.isPointerDown || this.activeCameraTouchId === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === this.activeCameraTouchId) {
          const dx = touch.clientX - this.lastPointerX;
          const dy = touch.clientY - this.lastPointerY;
          this.lastPointerX = touch.clientX;
          this.lastPointerY = touch.clientY;

          const sensitivity = 0.006;
          this.targetCockpitYaw -= dx * sensitivity;
          this.targetCockpitPitch -= dy * sensitivity * 0.75;

          const maxYaw = Math.PI * 0.95;
          this.targetCockpitYaw = Math.max(-maxYaw, Math.min(maxYaw, this.targetCockpitYaw));
          this.targetCockpitPitch = Math.max(-0.65, Math.min(0.52, this.targetCockpitPitch));
          this.returnTimer = 0;
          break;
        }
      }
    }, { passive: true });

    const handleTouchEnd = (e: TouchEvent) => {
      if (this.activeCameraTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.activeCameraTouchId) {
            this.activeCameraTouchId = null;
            this.isPointerDown = false;
            this.returnTimer = 0;
            break;
          }
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // 3. Quick Glance Keys:
    // Q: Look Left (out driver window)
    // E: Look Right (at passenger seat / right mirror)
    // R: Look Behind (at rear seats & rear window)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.mode !== 'INTERIOR') return;
      const key = e.key.toLowerCase();
      if (key === 'q') {
        this.targetCockpitYaw = 1.35; // Glance Left
        this.isKeyLooking = true;
      } else if (key === 'e') {
        this.targetCockpitYaw = -1.35; // Glance Right
        this.isKeyLooking = true;
      } else if (key === 'r') {
        this.targetCockpitYaw = Math.PI; // Glance Behind
        this.isKeyLooking = true;
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'q' || key === 'e' || key === 'r') {
        this.targetCockpitYaw = 0;
        this.isKeyLooking = false;
        this.returnTimer = 0;
      }
    });
  }

  public reset(playerZ = 0, playerX = 0): void {
    const preset = CAMERA_PRESETS[this.mode];
    this.cockpitYaw = 0;
    this.cockpitPitch = 0;
    this.targetCockpitYaw = 0;
    this.targetCockpitPitch = 0;
    this.isPointerDown = false;
    this.isKeyLooking = false;
    this.returnTimer = 0;

    this.currentPosition.set(
      playerX + preset.offsetX,
      preset.offsetY,
      playerZ + preset.offsetZ
    );
    this.currentLookAt.set(
      playerX + preset.lookAtX,
      preset.lookAtY,
      playerZ + preset.lookAtZ
    );

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();

    this.shakeTrauma = 0;
    this.shakeTimer = 0;
    this.modeJustChanged = false;
    this.isIntroActive = false;
    this.introProgress = 0;
    this.isIdleActive = false;
    this.idleShotTimer = 0;
    this.idleBlendProgress = 1.0;
  }

  public startIntro(playerPos: THREE.Vector3, duration = 5.8, forcedIndex?: number): CinematicIntroPreset {
    this.isIntroActive = true;
    this.introProgress = 0;
    this.introDuration = Math.max(1.0, duration);

    if (typeof forcedIndex === 'number' && forcedIndex >= 0 && forcedIndex < CINEMATIC_INTRO_PRESETS.length) {
      this.currentIntroIndex = forcedIndex;
    } else {
      // Pick a random cinematic preset among the 5 variations (avoiding immediate repetition)
      const count = CINEMATIC_INTRO_PRESETS.length;
      let nextIndex = Math.floor(Math.random() * count);
      if (count > 1 && nextIndex === this.currentIntroIndex) {
        nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (count - 1))) % count;
      }
      this.currentIntroIndex = nextIndex;
    }

    const introPreset = CINEMATIC_INTRO_PRESETS[this.currentIntroIndex];
    this.introStartFov = introPreset.startFov;

    this.introStartPos.set(
      playerPos.x + introPreset.startOffset.x,
      playerPos.y + introPreset.startOffset.y,
      playerPos.z + introPreset.startOffset.z
    );
    this.introMidPos.set(
      playerPos.x + introPreset.midOffset.x,
      playerPos.y + introPreset.midOffset.y,
      playerPos.z + introPreset.midOffset.z
    );
    this.introStartLookAt.set(
      playerPos.x + introPreset.startLookAtOffset.x,
      playerPos.y + introPreset.startLookAtOffset.y,
      playerPos.z + introPreset.startLookAtOffset.z
    );
    this.introMidLookAt.set(
      playerPos.x + introPreset.midLookAtOffset.x,
      playerPos.y + introPreset.midLookAtOffset.y,
      playerPos.z + introPreset.midLookAtOffset.z
    );

    this.currentPosition.copy(this.introStartPos);
    this.currentLookAt.copy(this.introStartLookAt);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = introPreset.startFov;
    this.camera.updateProjectionMatrix();

    return introPreset;
  }

  public getEffectivePreset(player?: PlayerVehicle): CameraPreset {
    const preset = CAMERA_PRESETS[this.mode];
    if (this.mode !== 'INTERIOR' || !player) {
      return preset;
    }
    const vehicleId = player.id || (player as any).currentVehicleId;
    const cfg = VEHICLE_COCKPIT_CONFIGS[vehicleId];
    if (cfg) {
      return {
        ...preset,
        offsetX: cfg.offsetX,
        offsetY: cfg.offsetY,
        offsetZ: cfg.offsetZ,
        lookAtX: cfg.offsetX,
        lookAtY: cfg.lookAtY ?? (cfg.offsetY - 0.05),
        fov: cfg.fov ?? preset.fov,
      };
    }
    return preset;
  }

  public updateIntro(delta: number, player: PlayerVehicle): boolean {
    if (!this.isIntroActive) return true;

    this.introProgress += delta / this.introDuration;
    const t = Math.min(1.0, this.introProgress);

    // Smooth cubic ease in-out
    const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const preset = this.getEffectivePreset(player);
    const playerPos = player.mesh.position;

    const targetX = playerPos.x + preset.offsetX;
    const targetY = playerPos.y + preset.offsetY;
    const targetZ = playerPos.z + preset.offsetZ;

    const targetLookAtX = playerPos.x + preset.lookAtX;
    const targetLookAtY = playerPos.y + preset.lookAtY;
    const targetLookAtZ = playerPos.z + preset.lookAtZ;

    // Quadratic Bezier interpolation for camera position:
    const oneMinusT = 1.0 - easeT;
    const w0 = oneMinusT * oneMinusT;
    const w1 = 2.0 * oneMinusT * easeT;
    const w2 = easeT * easeT;

    this.currentPosition.x = w0 * this.introStartPos.x + w1 * this.introMidPos.x + w2 * targetX;
    this.currentPosition.y = w0 * this.introStartPos.y + w1 * this.introMidPos.y + w2 * targetY;
    this.currentPosition.z = w0 * this.introStartPos.z + w1 * this.introMidPos.z + w2 * targetZ;

    // Quadratic Bezier interpolation for lookAt target
    this.currentLookAt.x = w0 * this.introStartLookAt.x + w1 * this.introMidLookAt.x + w2 * targetLookAtX;
    this.currentLookAt.y = w0 * this.introStartLookAt.y + w1 * this.introMidLookAt.y + w2 * targetLookAtY;
    this.currentLookAt.z = w0 * this.introStartLookAt.z + w1 * this.introMidLookAt.z + w2 * targetLookAtZ;

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);

    // Smoothly transition FOV from startFov to driver FOV
    this.camera.fov = THREE.MathUtils.lerp(this.introStartFov, preset.fov, easeT);
    this.camera.updateProjectionMatrix();

    if (this.introProgress >= 1.0) {
      this.isIntroActive = false;
      this.modeJustChanged = true;
      return true;
    }

    return false;
  }

  public skipIntro(player: PlayerVehicle): void {
    if (!this.isIntroActive) return;
    this.isIntroActive = false;
    this.introProgress = 1.0;
    const preset = this.getEffectivePreset(player);
    const playerPos = player.mesh.position;
    this.currentPosition.set(
      playerPos.x + preset.offsetX,
      playerPos.y + preset.offsetY,
      playerPos.z + preset.offsetZ
    );
    this.currentLookAt.set(
      playerPos.x + preset.lookAtX,
      playerPos.y + preset.lookAtY,
      playerPos.z + preset.lookAtZ
    );
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    this.modeJustChanged = true;
  }

  public resetMenuCinematic(): void {
    this.menuShotIndex = 0;
    this.menuShotTimer = 0;
  }

  public nextMenuCinematicShot(): void {
    this.menuShotTimer = 0;
    this.menuShotIndex = (this.menuShotIndex + 1) % MENU_CINEMATIC_SHOTS.length;
  }

  public updateMenuCinematic(delta: number, carPos: THREE.Vector3): void {
    this.menuShotTimer += delta;
    const shot = MENU_CINEMATIC_SHOTS[this.menuShotIndex];

    if (this.menuShotTimer >= shot.duration) {
      this.menuShotTimer = 0;
      this.menuShotIndex = (this.menuShotIndex + 1) % MENU_CINEMATIC_SHOTS.length;
    }

    const currentShot = MENU_CINEMATIC_SHOTS[this.menuShotIndex];
    const t = Math.min(1.0, this.menuShotTimer / currentShot.duration);
    // Smooth cinematic ease (smoothstep)
    const easeT = t * t * (3 - 2 * t);

    const targetX = carPos.x + THREE.MathUtils.lerp(currentShot.startOffset.x, currentShot.endOffset.x, easeT);
    const targetY = carPos.y + THREE.MathUtils.lerp(currentShot.startOffset.y, currentShot.endOffset.y, easeT);
    const targetZ = carPos.z + THREE.MathUtils.lerp(currentShot.startOffset.z, currentShot.endOffset.z, easeT);

    const lookX = carPos.x + THREE.MathUtils.lerp(currentShot.startLookAt.x, currentShot.endLookAt.x, easeT);
    const lookY = carPos.y + THREE.MathUtils.lerp(currentShot.startLookAt.y, currentShot.endLookAt.y, easeT);
    const lookZ = carPos.z + THREE.MathUtils.lerp(currentShot.startLookAt.z, currentShot.endLookAt.z, easeT);

    this.camera.position.set(targetX, targetY, targetZ);
    this.camera.lookAt(lookX, lookY, lookZ);
    this.camera.fov = currentShot.fov;
    this.camera.updateProjectionMatrix();
  }

  public get currentIdleShotName(): string {
    return IDLE_CINEMATIC_SHOTS[this.idleShotIndex]?.name || '';
  }

  public startIdleCinematic(_playerPos?: THREE.Vector3): void {
    if (this.isIdleActive) return;
    this.isIdleActive = true;
    this.idleShotTimer = 0;
    this.idleShotIndex = Math.floor(Math.random() * IDLE_CINEMATIC_SHOTS.length);
    this.idleBlendProgress = 0;
  }

  public exitIdleCinematic(): void {
    if (!this.isIdleActive) return;
    this.isIdleActive = false;
    this.idleShotTimer = 0;
    this.idleBlendProgress = 1.0;
    this.modeJustChanged = true;
  }

  public nextIdleCinematicShot(): void {
    this.idleShotTimer = 0;
    this.idleShotIndex = (this.idleShotIndex + 1) % IDLE_CINEMATIC_SHOTS.length;
    this.idleBlendProgress = 0;
  }

  public updateIdleCinematic(delta: number, player: PlayerVehicle): void {
    if (!this.isIdleActive) return;

    this.idleShotTimer += delta;
    const shot = IDLE_CINEMATIC_SHOTS[this.idleShotIndex];

    if (this.idleShotTimer >= shot.duration) {
      this.idleShotTimer = 0;
      this.idleShotIndex = (this.idleShotIndex + 1) % IDLE_CINEMATIC_SHOTS.length;
      this.idleBlendProgress = 0;
    }

    const currentShot = IDLE_CINEMATIC_SHOTS[this.idleShotIndex];
    const t = Math.min(1.0, this.idleShotTimer / currentShot.duration);
    const easeT = t * t * (3 - 2 * t);

    const playerPos = player.mesh.position;

    const targetX = playerPos.x + THREE.MathUtils.lerp(currentShot.startOffset.x, currentShot.endOffset.x, easeT);
    const targetY = playerPos.y + THREE.MathUtils.lerp(currentShot.startOffset.y, currentShot.endOffset.y, easeT);
    const targetZ = playerPos.z + THREE.MathUtils.lerp(currentShot.startOffset.z, currentShot.endOffset.z, easeT);

    const lookX = playerPos.x + THREE.MathUtils.lerp(currentShot.startLookAt.x, currentShot.endLookAt.x, easeT);
    const lookY = playerPos.y + THREE.MathUtils.lerp(currentShot.startLookAt.y, currentShot.endLookAt.y, easeT);
    const lookZ = playerPos.z + THREE.MathUtils.lerp(currentShot.startLookAt.z, currentShot.endLookAt.z, easeT);

    if (this.idleBlendProgress < 1.0) {
      this.idleBlendProgress += delta * 2.2;
      const blendT = Math.min(1.0, this.idleBlendProgress);
      this.currentPosition.lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1.0, delta * 5.0 + blendT * 0.1));
      this.currentLookAt.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1.0, delta * 6.0 + blendT * 0.1));
    } else {
      this.currentPosition.set(targetX, targetY, targetZ);
      this.currentLookAt.set(lookX, lookY, lookZ);
    }

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);

    const fovLerp = Math.min(1.0, delta * 3.5);
    this.camera.fov += (currentShot.fov - this.camera.fov) * fovLerp;
    this.camera.updateProjectionMatrix();
  }

  public startAdStudio(): void {
    this.isAdStudioActive = true;
    this.adStudioShotIndex = 0;
    this.adStudioTimer = 0;
    this.isAutoDirector = true;
    this.modeJustChanged = true;
  }

  public exitAdStudio(): void {
    this.isAdStudioActive = false;
    this.adStudioTimer = 0;
    this.modeJustChanged = true;
  }

  public setAdStudioShot(index: number): void {
    if (index >= 0 && index < AD_STUDIO_SHOTS.length) {
      this.adStudioShotIndex = index;
      this.adStudioTimer = 0;
      this.modeJustChanged = true;
      const shot = AD_STUDIO_SHOTS[this.adStudioShotIndex];
      eventBus.emit('adStudioCameraSwitched', { index: this.adStudioShotIndex, shotName: shot.name });
      audioManager.playCinematicWhoosh();
    }
  }

  public nextAdStudioShot(): number {
    this.adStudioShotIndex = (this.adStudioShotIndex + 1) % AD_STUDIO_SHOTS.length;
    this.adStudioTimer = 0;
    this.modeJustChanged = true;
    const shot = AD_STUDIO_SHOTS[this.adStudioShotIndex];
    eventBus.emit('adStudioCameraSwitched', { index: this.adStudioShotIndex, shotName: shot.name });
    audioManager.playCinematicWhoosh();
    return this.adStudioShotIndex;
  }

  public getCurrentAdStudioShot(): AdStudioShot {
    return AD_STUDIO_SHOTS[this.adStudioShotIndex];
  }

  public updateAdStudio(
    delta: number,
    player: PlayerVehicle,
    steerInput: number = 0,
    isNitroActive: boolean = false
  ): void {
    if (!this.isAdStudioActive) return;

    if (this.isAutoDirector) {
      this.adStudioTimer += delta;
      if (this.adStudioTimer >= this.adStudioShotDuration) {
        this.nextAdStudioShot();
      }
    } else {
      this.adStudioTimer += delta;
    }

    const shot = AD_STUDIO_SHOTS[this.adStudioShotIndex];
    const playerPos = player.mesh.position;
    const speedRatio = Math.min(1.0, player.speedKmh / 220);
    const timeSec = performance.now() * 0.001;

    // Dynamic Fly-In / Fly-Out Curve:
    // At beginning of shot (progress=0), inOutFactor = 0 (FAR away scenic view).
    // In the middle of shot (progress=0.5), inOutFactor = 1 (CLOSE intimate action).
    // Toward the end (progress=1.0), inOutFactor = 0 (FAR away, smooth pull-back).
    let inOutFactor: number;
    if (this.isAutoDirector) {
      const progress = Math.min(1.0, Math.max(0.0, this.adStudioTimer / this.adStudioShotDuration));
      inOutFactor = Math.sin(progress * Math.PI);
    } else {
      // Continuous harmonic breathing for manual selection
      const cycle = (this.adStudioTimer * (shot.dollyFreq || 0.85)) - Math.PI * 0.5;
      inOutFactor = (Math.sin(cycle) + 1.0) * 0.5;
    }

    // Smoothstep interpolation for natural cinematic ease
    const smoothT = inOutFactor * inOutFactor * (3.0 - 2.0 * inOutFactor);

    // Interpolate between FAR and CLOSE camera frames
    const basePathX = THREE.MathUtils.lerp(shot.farOffsetX, shot.closeOffsetX, smoothT);
    const basePathY = THREE.MathUtils.lerp(shot.farOffsetY, shot.closeOffsetY, smoothT);
    const basePathZ = THREE.MathUtils.lerp(shot.farOffsetZ, shot.closeOffsetZ, smoothT);
    const baseFov = THREE.MathUtils.lerp(shot.farFov, shot.closeFov, smoothT);
    const baseLookAtZ = shot.closeLookAtZ !== undefined
      ? THREE.MathUtils.lerp(shot.lookAtZ, shot.closeLookAtZ, smoothT)
      : shot.lookAtZ;

    // Organic floating sway motion
    const swayX = (shot.swayAmpX || 0) * Math.sin(timeSec * (shot.swayFreq || 1.6));
    const swayY = Math.cos(timeSec * 2.2) * 0.04;

    // Steering momentum & Makas adrenaline surge
    const steerAbs = Math.abs(steerInput);
    const steerPunchZ = (shot.isRigid ? 0 : 1) * (steerAbs > 0.4 ? (steerAbs - 0.4) * 0.75 : 0);
    const nitroPunchZ = isNitroActive ? (shot.closeOffsetZ < 0 ? -0.8 : 0.8) : 0;

    const targetX = playerPos.x * shot.lagX + basePathX + swayX;
    const targetY = playerPos.y + basePathY + swayY;
    const targetZ = playerPos.z + basePathZ + steerPunchZ + nitroPunchZ;

    const targetLookAt = new THREE.Vector3(
      playerPos.x * (shot.isRigid ? 1.0 : shot.lagX) + shot.lookAtX,
      playerPos.y + shot.lookAtY,
      playerPos.z + baseLookAtZ
    );

    if (this.modeJustChanged) {
      this.modeJustChanged = false;
      this.currentPosition.set(targetX, targetY, targetZ);
      this.currentLookAt.copy(targetLookAt);
      this.camera.fov = baseFov;
      this.camera.updateProjectionMatrix();
    } else {
      const xLerp = Math.min(1.0, delta * (shot.isRigid ? 30.0 : 14.0));
      this.currentPosition.x += (targetX - this.currentPosition.x) * xLerp;
      this.currentPosition.y = THREE.MathUtils.lerp(this.currentPosition.y, targetY, Math.min(1.0, delta * 16.0));
      this.currentPosition.z = targetZ;

      const lookLerp = Math.min(1.0, delta * (shot.isRigid ? 30.0 : 18.0));
      this.currentLookAt.lerp(targetLookAt, lookLerp);
    }

    // Speed rumble & subtle camera vibration
    let shakeX = 0;
    let shakeY = 0;
    if (player.speedKmh > 30) {
      const rumble = 0.005 * speedRatio;
      shakeX = Math.sin(timeSec * 48.0) * rumble;
      shakeY = Math.cos(timeSec * 56.0) * (rumble * 0.5);
    }

    this.camera.position.set(
      this.currentPosition.x + shakeX,
      this.currentPosition.y + shakeY,
      this.currentPosition.z
    );
    this.camera.lookAt(this.currentLookAt);

    // Dynamic Dutch roll leaning into the turn
    const steerRoll = (player.currentSteerTilt || (steerInput * -0.06)) * 0.85;
    this.camera.rotation.z += shot.rollTilt + steerRoll;

    // Dynamic FOV with speed kick and Nitro burst warp
    const nitroBoost = isNitroActive || player.speedKmh > 130 ? 6.5 : 0.0;
    const desiredFov = baseFov + speedRatio * 4.5 + nitroBoost;
    const fovLerp = Math.min(1.0, delta * 7.0);
    this.camera.fov += (desiredFov - this.camera.fov) * fovLerp;
    this.camera.updateProjectionMatrix();
  }

  public setMode(mode: CameraViewMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.modeJustChanged = true;
      this.targetCockpitYaw = 0;
      this.targetCockpitPitch = 0;
      this.cockpitYaw = 0;
      this.cockpitPitch = 0;
    }
  }

  public cycleMode(): CameraViewMode {
    switch (this.mode) {
      case 'CHASE':
        this.setMode('INTERIOR');
        break;
      case 'INTERIOR':
        this.setMode('HOOD');
        break;
      case 'HOOD':
        this.setMode('BUMPER');
        break;
      case 'BUMPER':
        this.setMode('CHASE');
        break;
      default:
        this.setMode('CHASE');
        break;
    }
    return this.mode;
  }

  public triggerShake(intensity = 0.35, duration = 0.5): void {
    this.shakeTrauma = intensity;
    this.shakeTimer = duration;
  }

  public update(
    delta: number,
    player: PlayerVehicle,
    steerInput: number,
    isNitroActive: boolean
  ): void {
    if (this.isAdStudioActive) {
      this.updateAdStudio(delta, player, steerInput, isNitroActive);
      return;
    }

    if (this.isIdleActive) {
      this.updateIdleCinematic(delta, player);
      return;
    }

    const cfg = GAME_CONSTANTS.CAMERA;
    const preset = this.getEffectivePreset(player);
    const playerPos = player.mesh.position;
    const speedRatio = Math.min(1.0, player.speedKmh / 220);

    // If camera mode was just switched, snap instantly to prevent disorienting fly-through
    if (this.modeJustChanged) {
      this.modeJustChanged = false;
      this.currentPosition.set(
        playerPos.x + preset.offsetX,
        playerPos.y + preset.offsetY,
        playerPos.z + preset.offsetZ
      );
      this.lookAtTarget.set(
        playerPos.x + preset.lookAtX,
        playerPos.y + preset.lookAtY,
        playerPos.z + preset.lookAtZ
      );
      this.currentLookAt.copy(this.lookAtTarget);
      this.camera.position.copy(this.currentPosition);
      this.camera.lookAt(this.currentLookAt);
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
    }

    // 1. Cockpit Free-Look smoothing and auto-center
    const lookLerpSpeed = this.isPointerDown || this.isKeyLooking ? 22.0 : 8.0;
    this.cockpitYaw = THREE.MathUtils.lerp(this.cockpitYaw, this.targetCockpitYaw, Math.min(1.0, delta * lookLerpSpeed));
    this.cockpitPitch = THREE.MathUtils.lerp(this.cockpitPitch, this.targetCockpitPitch, Math.min(1.0, delta * lookLerpSpeed));

    // Smooth return to forward center after 0.8s when mouse or touch is released
    if (!this.isPointerDown && !this.isKeyLooking) {
      this.returnTimer += delta;
      if (this.returnTimer > 0.8) {
        this.targetCockpitYaw = THREE.MathUtils.lerp(this.targetCockpitYaw, 0, Math.min(1.0, delta * 4.5));
        this.targetCockpitPitch = THREE.MathUtils.lerp(this.targetCockpitPitch, 0, Math.min(1.0, delta * 4.5));
      }
    }

    // 2. Camera Positioning
    if (preset.isRigid) {
      // RIGID VIEWS (INTERIOR, HOOD, BUMPER):
      // Camera is physically anchored to the vehicle chassis.
      // Positional coordinates in Z and X are rigidly locked 1:1 to the player.
      this.currentPosition.x = playerPos.x + preset.offsetX;
      this.currentPosition.y = playerPos.y + preset.offsetY;
      this.currentPosition.z = playerPos.z + preset.offsetZ;

      if (this.mode === 'INTERIOR') {
        // Spherical 360-degree look direction inside cockpit
        const cosP = Math.cos(this.cockpitPitch);
        const sinP = Math.sin(this.cockpitPitch);
        const sinY = Math.sin(this.cockpitYaw);
        const cosY = Math.cos(this.cockpitYaw);

        const lookDist = 25.0;
        // Direction vector: -sinY points left when yaw > 0, right when yaw < 0
        const dirX = -sinY * cosP;
        const dirY = sinP;
        const dirZ = cosY * cosP;

        this.lookAtTarget.set(
          this.currentPosition.x + dirX * lookDist,
          this.currentPosition.y + dirY * lookDist - 0.05,
          this.currentPosition.z + dirZ * lookDist
        );
      } else {
        this.lookAtTarget.set(
          playerPos.x + preset.lookAtX,
          playerPos.y + preset.lookAtY,
          playerPos.z + preset.lookAtZ
        );
      }
      this.currentLookAt.copy(this.lookAtTarget);
    } else {
      // CHASE VIEW (3rd person dynamic follow):
      // Controlled, subtle speed pullback (max 35cm, NOT meters)
      const dynamicOffsetY = preset.offsetY - speedRatio * 0.2;
      const dynamicOffsetZ = preset.offsetZ - speedRatio * 0.35;

      // Deterministic Z tracking so the car NEVER pulls away during acceleration!
      this.currentPosition.z = playerPos.z + dynamicOffsetZ;
      this.currentPosition.y = playerPos.y + dynamicOffsetY;

      // Lateral (X) smooth lag for organic arcade lane changes
      const desiredX = playerPos.x * preset.xLag;
      const xLerp = Math.min(1.0, delta * cfg.SMOOTH_FACTOR);
      this.currentPosition.x += (desiredX - this.currentPosition.x) * xLerp;

      // Dynamic LookAt target looking far ahead down the highway
      const dynamicLookZ = preset.lookAtZ + speedRatio * 5.0;
      this.lookAtTarget.set(
        playerPos.x * preset.xLag,
        playerPos.y + preset.lookAtY,
        playerPos.z + dynamicLookZ
      );
      const lookLerp = Math.min(1.0, delta * 16.0);
      this.currentLookAt.lerp(this.lookAtTarget, lookLerp);
    }

    // 2. Camera Shake calculation + Speed Vibration
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const shakeAmount = this.shakeTrauma * (this.shakeTimer > 0 ? this.shakeTimer : 0);
      shakeOffsetX = (Math.random() * 2 - 1) * shakeAmount;
      shakeOffsetY = (Math.random() * 2 - 1) * shakeAmount;
    }

    // High-speed asphalt rumble & subtle road texture vibration
    if (player.speedKmh > 25) {
      const speedNorm = Math.min(1.0, player.speedKmh / 220);
      const vibeAmp = (preset.isRigid ? 0.006 : 0.010) * speedNorm + (isNitroActive ? 0.015 : 0);
      const timeSec = performance.now() * 0.001;
      shakeOffsetX += Math.sin(timeSec * 45.0) * vibeAmp;
      shakeOffsetY += Math.cos(timeSec * 55.0) * (vibeAmp * 0.6);
    }

    this.camera.position.set(
      this.currentPosition.x + shakeOffsetX,
      this.currentPosition.y + shakeOffsetY,
      this.currentPosition.z
    );

    this.camera.lookAt(this.currentLookAt);

    // 3. Dynamic Chassis Tilt and Roll
    if (this.mode === 'CHASE') {
      // Dynamic Dutch roll when cornering in 3rd person
      const targetRoll = steerInput * cfg.STEER_TILT_AMOUNT * (player.speedKmh > 20 ? 1 : 0);
      this.camera.rotation.z += targetRoll;
    } else if (this.mode === 'INTERIOR') {
      // Cockpit body lean and suspension pitch matching the car body
      if (player.speedKmh > 15) {
        this.camera.rotation.z += player.currentSteerTilt * 0.65;
        this.camera.rotation.x += player.currentPitch * 0.45;
      }
    }

    // 4. Dynamic FOV expansion (speed sensation without fisheye distortion)
    let desiredFov = preset.fov + Math.pow(speedRatio, 1.2) * 6.5;
    if (isNitroActive) {
      desiredFov += 4.5;
    }

    const fovLerp = Math.min(1.0, delta * cfg.FOV_LERP_SPEED);
    this.camera.fov += (desiredFov - this.camera.fov) * fovLerp;
    this.camera.updateProjectionMatrix();
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
