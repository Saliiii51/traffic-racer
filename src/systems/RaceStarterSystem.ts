// RaceStarterSystem.ts - Coordinates multiplayer and singleplayer race start staging sequence
import * as THREE from 'three';
import { Vehicle } from '../vehicles/Vehicle';
import { PlayerVehicle } from '../vehicles/PlayerVehicle';
import { RemotePlayerVehicle } from '../vehicles/RemotePlayerVehicle';
import { RaceStarterCharacter } from './RaceStarterCharacter';
import { ChaseCamera } from '../player/ChaseCamera';
import { UIManager } from '../ui/UIManager';
import { AudioManager } from '../audio/AudioManager';
import { ParticleSystem } from './ParticleSystem';
import { LaneSystem } from '../road/LaneSystem';
import { VEHICLE_CATALOG } from '../vehicles/VehicleStats';
import { gameState } from '../core/GameState';

export type StarterSystemPhase =
  | 'IDLE'
  | 'ROLL_TO_GRID'
  | 'STARTER_FOCUS'
  | 'COUNTDOWN'
  | 'LAUNCH_BURST'
  | 'TRANSITION_TO_DRIVE'
  | 'ACTIVE_RACE';

export interface StagingParticipant {
  id: string;
  name: string;
  vehicleName: string;
  plate: string;
  lane: number;
  isLocal: boolean;
  startX: number;
  startZ: number;
  targetZ: number;
  currentZ: number;
  currentSpeedMps: number;
  vehicle: Vehicle;
  isBraking: boolean;
  isStaged: boolean;
}

export class RaceStarterSystem {
  public phase: StarterSystemPhase = 'IDLE';
  public readonly starterCharacter: RaceStarterCharacter;

  private chaseCamera: ChaseCamera;
  private uiManager: UIManager;
  private audioManager: AudioManager;
  private particleSystem: ParticleSystem;
  private laneSystem: LaneSystem;

  private participants: StagingParticipant[] = [];
  private currentShowcaseIndex = 0;
  private showcaseTimer = 0;
  private readonly showcaseDurationPerCar = 1.9; // seconds per racer showcase

  private countdownTimer = 0;
  private countdownStage = 0; // 0=none, 1=3, 2=2, 3=1, 4=BAŞLA

  private transitionTimer = 0;
  private readonly transitionDuration = 0.65;
  private camTransStartPos = new THREE.Vector3();
  private camTransStartLookAt = new THREE.Vector3();

  // Dynamic Camera tracking vectors
  private tempCamPos = new THREE.Vector3();
  private tempLookAt = new THREE.Vector3();

  // Callback when race starts and controls unlock
  public onRaceStart?: () => void;

  constructor(
    scene: THREE.Scene,
    chaseCamera: ChaseCamera,
    uiManager: UIManager,
    audioManager: AudioManager,
    particleSystem: ParticleSystem
  ) {
    this.chaseCamera = chaseCamera;
    this.uiManager = uiManager;
    this.audioManager = audioManager;
    this.particleSystem = particleSystem;
    this.laneSystem = LaneSystem.getInstance();

    this.starterCharacter = new RaceStarterCharacter(scene);
  }

  public get isActive(): boolean {
    return this.phase !== 'IDLE' && this.phase !== 'ACTIVE_RACE';
  }

  public get isControlsLocked(): boolean {
    return this.isActive;
  }

  /**
   * Initiates staging sequence for multiplayer or singleplayer.
   */
  public startStaging(
    playerVehicle: PlayerVehicle,
    opponents: Map<string, RemotePlayerVehicle>,
    isMultiplayer: boolean,
    rawPlayerList?: any[]
  ): void {
    this.participants = [];
    this.currentShowcaseIndex = 0;
    this.showcaseTimer = 0;
    this.countdownTimer = 0;
    this.countdownStage = -1;
    this.transitionTimer = 0;

    // Starter character placed in center divider right in front of start line
    this.starterCharacter.setPosition(0, 0.02, 3.8);
    this.starterCharacter.setRotationY(Math.PI); // Facing oncoming cars coming from -Z
    this.starterCharacter.setState('IDLE');

    // 1. Build Local Player Participant
    const playerDef = VEHICLE_CATALOG.find((v) => v.id === gameState.selectedVehicleId) || VEHICLE_CATALOG[0];
    const myLane = (playerVehicle as any).currentLaneIndex ?? 1;
    const playerPlate = gameState.licensePlate || '34 TR 1923';

    // Staging start: -30m behind start line, target grid box: -2.4m
    const playerStartX = this.laneSystem.getLaneX(myLane);
    const playerTargetZ = -2.4 - (myLane % 2) * 0.4;
    const playerStartZ = -28.0 - (myLane % 2) * 4.0;

    playerVehicle.mesh.position.set(playerStartX, 0.12, playerStartZ);
    playerVehicle.speedMps = 6.0;
    playerVehicle.speedKmh = 21.6;

    const storedName = (typeof localStorage !== 'undefined' && localStorage.getItem('traffic_rush_player_name')) || 'OYUNCU (SEN)';
    this.participants.push({
      id: 'local_player',
      name: storedName,
      vehicleName: playerDef.name,
      plate: playerPlate,
      lane: myLane,
      isLocal: true,
      startX: playerStartX,
      startZ: playerStartZ,
      targetZ: playerTargetZ,
      currentZ: playerStartZ,
      currentSpeedMps: 6.0,
      vehicle: playerVehicle,
      isBraking: false,
      isStaged: false,
    });

    // 2. Build Remote Opponent Participants (if multiplayer)
    if (isMultiplayer && opponents.size > 0) {
      let oppIdx = 0;
      for (const [oppId, oppVehicle] of opponents.entries()) {
        const rawInfo = rawPlayerList?.find((p) => p.id === oppId);
        const oppLane = rawInfo?.lane ?? ((myLane + 1 + oppIdx) % 4);
        const oppDef = VEHICLE_CATALOG.find((v) => v.id === oppVehicle.vehicleId) || VEHICLE_CATALOG[1] || VEHICLE_CATALOG[0];

        const oppStartX = this.laneSystem.getLaneX(oppLane);
        const oppTargetZ = -2.4 - (oppLane % 2) * 0.4;
        const oppStartZ = -30.0 - (oppLane % 2) * 4.0;

        oppVehicle.setInitialPosition(oppStartX, 0.12, oppStartZ);

        this.participants.push({
          id: oppId,
          name: oppVehicle.opponentName || rawInfo?.name || `RAKİP #${oppIdx + 1}`,
          vehicleName: oppDef.name,
          plate: `${(34 + oppIdx).toString().padStart(2, '0')} TR ${1000 + oppIdx * 111}`,
          lane: oppLane,
          isLocal: false,
          startX: oppStartX,
          startZ: oppStartZ,
          targetZ: oppTargetZ,
          currentZ: oppStartZ,
          currentSpeedMps: 6.0,
          vehicle: oppVehicle,
          isBraking: false,
          isStaged: false,
        });
        oppIdx++;
      }
    }

    // Sort participants by lane for aesthetic orderly broadcast showcase
    this.participants.sort((a, b) => a.lane - b.lane);

    // Enter ROLL_TO_GRID phase
    this.phase = 'ROLL_TO_GRID';
    this.uiManager.startCinematicIntro(
      isMultiplayer ? 'ÇOK OYUNCULU YARIŞ' : 'İSTANBUL OTOYOLU',
      'BAŞLANGIÇ ÇİZGİSİ DİZİLİMİ'
    );
    this.audioManager.playCinematicWhoosh();

    // Show first participant broadcast card
    this.updateShowcaseCard();
  }

  public skip(): void {
    if (!this.isActive) return;

    // Immediately snap all cars to their grid staging boxes
    for (const p of this.participants) {
      p.currentZ = p.targetZ;
      p.currentSpeedMps = 0;
      p.vehicle.mesh.position.z = p.targetZ;
      p.vehicle.updateWheels(0, 0, 0.016);
      p.isStaged = true;
    }

    this.uiManager.hideRacerBroadcastCard();

    // Fast-track straight to final launch
    this.phase = 'LAUNCH_BURST';
    this.countdownTimer = 0;
    this.triggerRaceLaunch();
  }

  public update(delta: number): void {
    if (this.phase === 'IDLE') return;

    // Always update starter character procedural bones
    const leadCarZ = this.participants.reduce((max, p) => Math.max(max, p.vehicle.mesh.position.z), -10);
    this.starterCharacter.update(delta, leadCarZ);

    switch (this.phase) {
      case 'ROLL_TO_GRID':
        this.updateRollToGrid(delta);
        break;

      case 'STARTER_FOCUS':
        this.updateStarterFocus(delta);
        break;

      case 'COUNTDOWN':
        this.updateCountdown(delta);
        break;

      case 'LAUNCH_BURST':
        this.updateLaunchBurst(delta);
        break;

      case 'TRANSITION_TO_DRIVE':
        this.updateTransitionToDrive(delta);
        break;

      case 'ACTIVE_RACE':
        // Once race is active, system merely lets starter character react to passing cars
        break;
    }
  }

  private updateRollToGrid(delta: number): void {
    // 1. Advance all vehicles towards their target grid box
    this.advanceVehiclesToGrid(delta);

    // 2. Camera Showcase Cycling: Orbit & frame each racer sequentially
    this.showcaseTimer += delta;
    const activeParticipant = this.participants[this.currentShowcaseIndex];

    if (activeParticipant) {
      this.positionCameraForCarShowcase(activeParticipant, this.showcaseTimer / this.showcaseDurationPerCar);
    }

    if (this.showcaseTimer >= this.showcaseDurationPerCar) {
      this.showcaseTimer = 0;
      this.currentShowcaseIndex++;

      if (this.currentShowcaseIndex < this.participants.length) {
        // Next racer showcase
        this.updateShowcaseCard();
        this.audioManager.playCinematicWhoosh();
      } else {
        // All racers presented! Cut to Starter Character
        this.uiManager.hideRacerBroadcastCard();
        this.phase = 'STARTER_FOCUS';
        this.showcaseTimer = 0;
        this.starterCharacter.setState('RAISE_ARMS');
        this.audioManager.playCinematicWhoosh();

        const charPos = this.starterCharacter.group.position;
        this.chaseCamera.camera.position.set(0.55, 0.95, charPos.z - 2.4);
        this.chaseCamera.camera.lookAt(0.0, 1.35, charPos.z);
        this.chaseCamera.camera.fov = 54;
        this.chaseCamera.camera.updateProjectionMatrix();
      }
    }
  }

  private advanceVehiclesToGrid(delta: number): void {
    for (const p of this.participants) {
      if (p.isStaged) continue;
      const distToTarget = p.targetZ - p.currentZ;

      if (distToTarget > 0.05) {
        // Smooth deceleration curve as car approaches grid mark
        const desiredSpeed = Math.max(1.5, Math.min(12.0, distToTarget * 1.8));
        p.currentSpeedMps = THREE.MathUtils.damp(p.currentSpeedMps, desiredSpeed, 4.0, delta);

        p.currentZ += p.currentSpeedMps * delta;
        p.vehicle.mesh.position.z = p.currentZ;

        // Realistic wheel roll forward
        p.vehicle.updateWheels(p.currentSpeedMps, 0, delta);

        if (distToTarget < 2.5 && !p.isBraking) {
          p.isBraking = true;
          this.audioManager.playBrakeScreech();
        }
      } else {
        // Staged in box
        p.currentZ = p.targetZ;
        p.currentSpeedMps = 0;
        p.vehicle.mesh.position.z = p.targetZ;
        p.vehicle.updateWheels(0, 0, delta);
        p.isStaged = true;
      }
    }
  }

  private positionCameraForCarShowcase(p: StagingParticipant, progress: number): void {
    const carPos = p.vehicle.mesh.position;
    const t = Math.min(1.0, progress);

    // Dynamic sweeping shot: Low front-quarter angle panning smoothly to dynamic profile
    const startOffset = new THREE.Vector3(-2.4, 0.75, 4.2);
    const endOffset = new THREE.Vector3(-1.8, 1.1, 2.0);

    this.tempCamPos.lerpVectors(startOffset, endOffset, t).add(carPos);
    this.tempLookAt.set(carPos.x, carPos.y + 0.65, carPos.z + 0.5);

    this.chaseCamera.camera.position.copy(this.tempCamPos);
    this.chaseCamera.camera.lookAt(this.tempLookAt);
    this.chaseCamera.camera.fov = 58;
    this.chaseCamera.camera.updateProjectionMatrix();
  }

  private updateShowcaseCard(): void {
    const p = this.participants[this.currentShowcaseIndex];
    if (!p) return;

    this.uiManager.showRacerBroadcastCard({
      driverName: p.name,
      carName: p.vehicleName,
      laneNumber: p.lane + 1,
      plate: p.plate,
      isLocal: p.isLocal,
      statusText: p.isStaged ? 'KAREYE YANAŞTI • MOTOR HAZIR 🟢' : 'BAŞLANGIÇ KAREYİNE GİRİYOR... 🟡',
    });
  }

  private updateStarterFocus(delta: number): void {
    this.showcaseTimer += delta;
    this.advanceVehiclesToGrid(delta);

    // Front-view dramatic low shot framing the Starter Character
    const charPos = this.starterCharacter.group.position;
    const sway = Math.sin(this.showcaseTimer * 1.5) * 0.04;
    this.chaseCamera.camera.position.set(0.55 + sway, 0.95, charPos.z - 2.4);
    this.chaseCamera.camera.lookAt(0.0, 1.35, charPos.z);

    if (this.showcaseTimer >= 0.85) {
      this.phase = 'COUNTDOWN';
      this.countdownTimer = 0;
      this.countdownStage = 0;
    }
  }

  private updateCountdown(delta: number): void {
    this.countdownTimer += delta;
    this.advanceVehiclesToGrid(delta);

    // Dynamic starter camera view: breathing sway & dramatic tension
    const charPos = this.starterCharacter.group.position;
    const sway = Math.sin(this.countdownTimer * 1.8) * 0.05;
    const camPos = new THREE.Vector3(0.55 + sway, 0.95, charPos.z - 2.4);
    const lookAtPos = new THREE.Vector3(0.0, 1.35, charPos.z);

    this.chaseCamera.camera.position.copy(camPos);
    this.chaseCamera.camera.lookAt(lookAtPos);

    // 3.. 2.. 1.. BAŞLA! Timing
    if (this.countdownTimer >= 3.65 && this.countdownStage < 4) {
      this.countdownStage = 4;
      this.phase = 'LAUNCH_BURST';
      this.triggerRaceLaunch();
    } else if (this.countdownTimer >= 2.45 && this.countdownStage < 3) {
      this.countdownStage = 3;
      this.uiManager.updateCinematicCountdown('1');
      this.audioManager.playCountdownBeep(false);
      this.starterCharacter.triggerPulse(1);
    } else if (this.countdownTimer >= 1.25 && this.countdownStage < 2) {
      this.countdownStage = 2;
      this.uiManager.updateCinematicCountdown('2');
      this.audioManager.playCountdownBeep(false);
      this.starterCharacter.triggerPulse(2);
    } else if (this.countdownTimer >= 0.1 && this.countdownStage < 1) {
      this.countdownStage = 1;
      this.uiManager.updateCinematicCountdown('3');
      this.audioManager.playCountdownBeep(false);
      this.starterCharacter.triggerPulse(3);
    }
  }

  private triggerRaceLaunch(): void {
    // 1. Starter Character explosive downward arm whip
    this.starterCharacter.triggerStartDrop();

    // 2. High-energy audio and visual fanfare
    this.audioManager.playCountdownBeep(true);
    this.audioManager.playBackfire();
    this.uiManager.updateCinematicCountdown('BAŞLA! 🏁', true);

    // 3. Emit exhaust flames and tire smoke burst for local player and all cars
    for (const p of this.participants) {
      if (p.isLocal && p.vehicle instanceof PlayerVehicle) {
        p.vehicle.updateExhaustFlames(true, 0.016);
        this.particleSystem.emitBackfireSparks(p.vehicle.getExhaustTipWorldPosition(), true);
      }
      this.particleSystem.emitTireSmoke(p.vehicle.mesh.position, true);
    }

    // 4. Save camera pose for smooth transition into player's driving camera
    this.camTransStartPos.copy(this.chaseCamera.camera.position);
    this.camTransStartLookAt.copy(this.starterCharacter.group.position);
    this.transitionTimer = 0;
    this.phase = 'TRANSITION_TO_DRIVE';

    // 5. Unlock player driving controls immediately!
    this.onRaceStart?.();
  }

  private updateLaunchBurst(_delta: number): void {
    // Handled in triggerRaceLaunch
  }

  private updateTransitionToDrive(delta: number): void {
    this.transitionTimer += delta;
    const t = Math.min(1.0, this.transitionTimer / this.transitionDuration);
    // Smooth cubic ease out
    const easeT = 1 - Math.pow(1 - t, 3);

    const localP = this.participants.find((p) => p.isLocal);
    if (localP) {
      const targetPreset = this.chaseCamera.getEffectivePreset(localP.vehicle);
      const playerPos = localP.vehicle.mesh.position;

      const destCamPos = new THREE.Vector3(
        playerPos.x + targetPreset.offsetX,
        playerPos.y + targetPreset.offsetY,
        playerPos.z + targetPreset.offsetZ
      );
      const destLookAt = new THREE.Vector3(
        playerPos.x + targetPreset.lookAtX,
        playerPos.y + targetPreset.lookAtY,
        playerPos.z + targetPreset.lookAtZ
      );

      this.tempCamPos.lerpVectors(this.camTransStartPos, destCamPos, easeT);
      this.tempLookAt.lerpVectors(this.camTransStartLookAt, destLookAt, easeT);

      this.chaseCamera.camera.position.copy(this.tempCamPos);
      this.chaseCamera.camera.lookAt(this.tempLookAt);
      this.chaseCamera.camera.fov = THREE.MathUtils.lerp(62, targetPreset.fov, easeT);
      this.chaseCamera.camera.updateProjectionMatrix();
    }

    if (t >= 1.0) {
      this.phase = 'ACTIVE_RACE';
      this.uiManager.finishCinematicIntro();
      this.starterCharacter.setState('WATCH_CARS');
    }
  }

  public dispose(): void {
    this.starterCharacter.dispose();
  }
}