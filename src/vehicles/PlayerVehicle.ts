import * as THREE from 'three';
import { Vehicle } from './Vehicle';
import { GAME_CONSTANTS, type VehicleDefinition } from '../core/Constants';
import { laneSystem } from '../road/LaneSystem';
import { computeVehicleStats, VEHICLE_CATALOG } from './VehicleStats';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { gltfModelLoader } from './GLTFModelLoader';
import { audioManager } from '../audio/AudioManager';

export class PlayerVehicle extends Vehicle {
  public speedKmh: number = 0;
  public speedMps: number = 0;
  public targetSteerTilt: number = 0;
  public currentSteerTilt: number = 0;
  public currentYaw: number = 0;
  public currentPitch: number = 0;

  // Active stats
  public currentTopSpeedKmh: number;
  public currentAccel: number;
  public currentHandling: number;
  public currentBraking: number;
  public modelReadyPromise: Promise<boolean>;

  // High-Beams / Selektör System (Straight-Forward Powerful Projection)
  public isHighBeamActive: boolean = false;
  public highBeamTimer: number = 0;
  private highBeamLight: THREE.SpotLight | null = null;
  private highBeamLightTarget: THREE.Object3D | null = null;
  private highBeamRoadMesh: THREE.Mesh | null = null;
  private highBeamShaftLeft: THREE.Mesh | null = null;
  private highBeamShaftRight: THREE.Mesh | null = null;
  private highBeamFlareLeft: THREE.Mesh | null = null;
  private highBeamFlareRight: THREE.Mesh | null = null;

  // 3D Custom Exhaust System (Warex, Akrapovic, Popcorn, Standard) & Dynamic Flame Lighting
  private exhaustMufflerGroup: THREE.Group | null = null;
  private exhaustMeshSubGroup: THREE.Group | null = null;
  private exhaustFlameOuter: THREE.Mesh | null = null;
  private exhaustFlameInner: THREE.Mesh | null = null;
  private exhaustFlameCore: THREE.Mesh | null = null;
  private exhaustFlashLight: THREE.PointLight | null = null;
  public exhaustPopTimer: number = 0;

  // Turn Signals (Sinyaller) System
  public turnSignal: 'none' | 'left' | 'right' | 'hazard' = 'none';
  public turnSignalTimer: number = 0;
  private prevBlinkState: boolean = false;
  private turnSignalMeshes: {
    fl: THREE.Mesh;
    fr: THREE.Mesh;
    rl: THREE.Mesh;
    rr: THREE.Mesh;
  } | null = null;
  private static turnSignalMaterial: THREE.MeshBasicMaterial;

  constructor() {
    const selectedId = gameState.selectedVehicleId;
    const def = VEHICLE_CATALOG.find((v) => v.id === selectedId) || VEHICLE_CATALOG[0];
    const upgrades = gameState.getVehicleUpgrades(def.id);
    const stats = computeVehicleStats(def, upgrades);
    const color = gameState.getVehicleColor(def.id);

    super(def.id, def.modelType, undefined, color);

    this.currentTopSpeedKmh = stats.topSpeedKmh;
    this.currentAccel = stats.acceleration;
    this.currentHandling = stats.handling;
    this.currentBraking = stats.braking;

    // Initially hide the vehicle mesh and procedural group so old model is NEVER shown during loading
    this.mesh.visible = false;
    this.proceduralGroup.visible = false;

    // Center player on the road: Lane 1 (right-hand traffic forward lane, x = -1.9)
    const startLane = 1;
    this.mesh.position.set(laneSystem.getLaneX(startLane), 0, 0);
    this.updateBoundingBox();

    // High beams / Selektör light and beam projection
    this.initHighBeams();

    // Turn signal corner blinkers
    this.initTurnSignals();

    // 3D Abartı Egzoz & Alev Kiti
    this.initAbartiExhaust();

    // 3D Turkish License Plates (Front & Rear)
    this.initLicensePlates();

    // 3D Cockpit Working Instrument Cluster (Speedometer, Tachometer & Gauges)
    this.initCockpitCluster();

    // Dedicated Cockpit Interior Cabin Fill / Dome Light (prevents pitch-black interior)
    this.initCabinLighting();

    // Auto-detect and load model for currently selected vehicle
    this.modelReadyPromise = this.loadCurrentVehicleModel();
  }

  private static cachedModels: Map<string, THREE.Group> = new Map();
  private currentLoadedModelPath: string | null = null;
  public currentVehicleId: string = 'opel_corsa_b';

  public async loadCurrentVehicleModel(): Promise<boolean> {
    const selectedId = gameState.selectedVehicleId;
    const def = VEHICLE_CATALOG.find((v) => v.id === selectedId) || VEHICLE_CATALOG[0];
    this.currentVehicleId = def.id;
    return this.loadVehicleModel(def);
  }

  public async loadVehicleModel(def: VehicleDefinition): Promise<boolean> {
    this.currentVehicleId = def.id;
    this.id = def.id;
    this.reconfigureStats();
    this.updateLicensePlatePositions(def.id);
    this.updateWheelPositions(def.id);
    this.updateCockpitClusterPositions();
    const modelPath = def.modelPath;

    if (!modelPath) {
      this.currentLoadedModelPath = null;
      this.resetToProceduralModel();
      this.setColor(gameState.getVehicleColor(def.id));
      this.updateLicensePlatePositions(def.id);
      this.updateWheelPositions(def.id);
      this.updateCockpitClusterPositions();
      this.mesh.visible = true;
      return true;
    }

    if (this.currentLoadedModelPath === modelPath) {
      this.setColor(gameState.getVehicleColor(def.id));
      this.updateLicensePlatePositions(def.id);
      this.updateWheelPositions(def.id);
      this.updateCockpitClusterPositions();
      this.mesh.visible = true;
      return true;
    }

    try {
      let modelGroup: THREE.Group;
      if (PlayerVehicle.cachedModels.has(modelPath)) {
        modelGroup = PlayerVehicle.cachedModels.get(modelPath)!.clone();
      } else {
        console.log(`[PlayerVehicle] Loading 3D model for ${def.name} from ${modelPath}...`);
        const loaded = await gltfModelLoader.loadFromUrl(modelPath);
        PlayerVehicle.cachedModels.set(modelPath, loaded);
        modelGroup = loaded.clone();
      }

      this.applyCustomGLTF(modelGroup);
      this.currentLoadedModelPath = modelPath;
      this.setColor(gameState.getVehicleColor(def.id));
      this.updateLicensePlatePositions(def.id);
      this.updateWheelPositions(def.id);
      this.updateCockpitClusterPositions();
      this.mesh.visible = true;
      console.log(`[PlayerVehicle] Custom model loaded successfully for ${def.name}`);
      return true;
    } catch (err) {
      console.error(`[PlayerVehicle] Failed loading model for ${def.name} from ${modelPath}:`, err);
      return false;
    }
  }

  public async tryLoadDefaultModel(): Promise<boolean> {
    return this.loadCurrentVehicleModel();
  }

  public async loadFromFiles(files: FileList | File[]): Promise<boolean> {
    try {
      const modelGroup = await gltfModelLoader.loadFromFiles(files);
      this.applyCustomGLTF(modelGroup);
      this.setColor(gameState.getVehicleColor(this.id));
      return true;
    } catch (err) {
      console.error('[PlayerVehicle] Failed to load custom model from files:', err);
      throw err;
    }
  }

  public reconfigureStats(): void {
    const selectedId = gameState.selectedVehicleId;
    const def = VEHICLE_CATALOG.find((v) => v.id === selectedId) || VEHICLE_CATALOG[0];
    const upgrades = gameState.getVehicleUpgrades(def.id);
    const stats = computeVehicleStats(def, upgrades);
    const color = gameState.getVehicleColor(def.id);

    this.currentTopSpeedKmh = stats.topSpeedKmh;
    this.currentAccel = stats.acceleration;
    this.currentHandling = stats.handling;
    this.currentBraking = stats.braking;
    this.setColor(color);
  }

  public resetPosition(): void {
    this.speedKmh = 0;
    this.speedMps = 0;
    this.currentSteerTilt = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.mesh.rotation.set(0, 0, 0);
    const startLane = 1;
    this.mesh.position.set(laneSystem.getLaneX(startLane), 0, 0);
    this.setBraking(false);
    this.setNitroFlames(false);
    this.updateBoundingBox();
  }

  public stop(): void {
    this.speedKmh = 0;
    this.speedMps = 0;
    this.setBraking(true);
    this.setNitroFlames(false);
  }

  public updatePhysics(
    delta: number,
    steerInput: number, // -1 to 1
    isAccelerating: boolean,
    isBraking: boolean,
    isNitroActive: boolean
  ): void {
    // 1. Calculate Acceleration / Deceleration & Aerodynamic Resistance
    let effectiveTopSpeed = this.currentTopSpeedKmh;
    let effectiveAccel = this.currentAccel;

    if (isNitroActive) {
      effectiveTopSpeed += GAME_CONSTANTS.NITRO.BOOST_TOP_SPEED_KMH;
      effectiveAccel *= GAME_CONSTANTS.NITRO.BOOST_ACCEL_MULT;
    }

    if (isBraking) {
      // Progressive automotive braking (~12-16 m/s^2 stopping force)
      // Realistic ABS brake modulation
      const brakeForce = this.currentBraking;
      this.speedKmh -= brakeForce * 3.6 * delta;
      if (this.speedKmh < 0) this.speedKmh = 0;
      this.setBraking(true);
    } else if (isAccelerating || isNitroActive) {
      // Powertrain power delivery:
      // High launch torque in lower speeds, steady mid-range pull,
      // and quadratic aerodynamic resistance as vehicle approaches top speed
      const speedRatio = Math.min(1.0, this.speedKmh / effectiveTopSpeed);

      // Low gear mechanical torque punch
      const torqueCurve = speedRatio < 0.2
        ? 1.25 // Punchy launch from idle/low speed
        : Math.max(0.12, 1.0 - Math.pow(speedRatio, 1.35));

      // Aerodynamic drag resistance opposing engine power (m/s^2)
      const aeroResistanceMps2 = 0.00030 * Math.pow(this.speedKmh, 2);
      const netAccelMps2 = Math.max(0.35, effectiveAccel * torqueCurve - aeroResistanceMps2);

      this.speedKmh += netAccelMps2 * 3.6 * delta;
      if (this.speedKmh > effectiveTopSpeed) {
        this.speedKmh = Math.max(effectiveTopSpeed, this.speedKmh - 10 * delta);
      }
      this.setBraking(false);
    } else {
      // Natural Coasting: Rolling resistance + Aerodynamic drag
      const rollingDecelMps2 = GAME_CONSTANTS.DRIVING.NATURAL_DECELERATION; // ~1.2 m/s^2
      const aeroDecelMps2 = 0.00042 * Math.pow(this.speedKmh, 2); // Wind drag increases with square of speed
      const totalCoastMps2 = rollingDecelMps2 + aeroDecelMps2;

      this.speedKmh -= totalCoastMps2 * 3.6 * delta;
      if (this.speedKmh < 0) this.speedKmh = 0;
      this.setBraking(false);
    }

    this.speedMps = this.speedKmh / 3.6;

    // 2. Forward Movement along +Z
    this.mesh.position.z += this.speedMps * delta;

    // 3. Lateral Steering Movement along X
    // In Three.js with camera behind facing +Z, world +X is screen LEFT, world -X is screen RIGHT.
    if (this.speedKmh > GAME_CONSTANTS.DRIVING.MIN_MOVING_SPEED_KMH) {
      // Trail-braking agility bonus: braking transfers weight forward, giving sharper front-end bite
      const brakeAgilityBonus = isBraking ? 1.16 : 1.0;

      // Speed-dependent steering ratio: responsive at urban speeds, stable at high highway speeds
      const speedFactor = Math.min(1.0, Math.max(0.42, this.speedKmh / 55));
      const highSpeedStability = this.speedKmh > 125
        ? Math.max(0.72, 1.0 - (this.speedKmh - 125) * 0.0018)
        : 1.0;

      // Balanced, realistic lateral lane-change speed (adjusted by steeringSensitivity)
      const sensitivity = gameState.settings.steeringSensitivity || 1.0;
      const lateralVelocity = -steerInput * (this.currentHandling * 0.58) * speedFactor * brakeAgilityBonus * highSpeedStability * sensitivity;
      this.mesh.position.x += lateralVelocity * delta;

      // Clamp cleanly within road boundaries
      if (gameState.isAdStudioMode) {
        // In Ad Studio promo mode, keep vehicle strictly on asphalt lanes, away from curbs and sidewalks
        const edgeBuffer = this.dimensions.width * 0.55 + 0.20;
        this.mesh.position.x = Math.max(laneSystem.roadLeftEdge + edgeBuffer, Math.min(laneSystem.roadRightEdge - edgeBuffer, this.mesh.position.x));
      } else {
        this.mesh.position.x = laneSystem.clampToRoad(this.mesh.position.x, this.dimensions.width * 0.55);
      }
    }

    // 4. Visual Dynamics: Roll (tilt), Yaw (heading), and Pitch (dive/squat)
    // Chassis centrifugal body roll: vehicle leans into the maneuver
    const targetRoll = steerInput * GAME_CONSTANTS.DRIVING.MAX_STEER_TILT * (this.speedKmh > 8 ? 1 : 0);
    // Heading angle: car points diagonally into lane change, then snaps straight
    const targetYaw = -steerInput * GAME_CONSTANTS.DRIVING.MAX_STEER_YAW * (this.speedKmh > 8 ? 1 : 0);

    // Dynamic pitch: suspension squat under acceleration, nose-dive on braking
    let targetPitch = 0;
    if (isBraking && this.speedKmh > 15) {
      targetPitch = 0.032; // Nose dips under brake load
    } else if (isAccelerating && this.speedKmh < this.currentTopSpeedKmh * 0.8) {
      targetPitch = -0.018; // Rear squats under acceleration load
    }

    // Smooth chassis recovery with progressive damping
    const isSteering = Math.abs(steerInput) > 0.05;
    const rollLerp = Math.min(1.0, delta * (isSteering ? 8.0 : 12.0));
    const pitchLerp = Math.min(1.0, delta * 10.0);

    this.currentSteerTilt += (targetRoll - this.currentSteerTilt) * rollLerp;
    this.currentYaw += (targetYaw - this.currentYaw) * rollLerp;
    this.currentPitch += (targetPitch - this.currentPitch) * pitchLerp;

    this.mesh.rotation.z = this.currentSteerTilt;
    this.mesh.rotation.y = this.currentYaw;
    this.mesh.rotation.x = this.currentPitch;

    // 5. Wheel turning and Nitro flame animations
    const steerAngle = -steerInput * 0.26; // Realistic wheel turning angle
    this.updateWheels(this.speedMps, steerAngle, delta);
    this.setNitroFlames(isNitroActive);
    this.updateExhaustFlames(isNitroActive, delta);

    // 6. High-Beam / Selektör: active as long as button/key is held, turns off the instant released
    const isHighBeamOn = this.isHighBeamActive || this.highBeamTimer > 0;
    if (this.highBeamTimer > 0) {
      this.highBeamTimer -= delta;
    }

    if (isHighBeamOn) {
      // Ensure world-stabilized elements are parented to the main scene (so road illumination NEVER tilts with chassis roll)
      if (this.mesh.parent) {
        if (this.highBeamRoadMesh && this.highBeamRoadMesh.parent !== this.mesh.parent) {
          this.mesh.parent.add(this.highBeamRoadMesh);
        }
        if (this.highBeamLightTarget && this.highBeamLightTarget.parent !== this.mesh.parent) {
          this.mesh.parent.add(this.highBeamLightTarget);
        }
      }

      const frontZ = (this.dimensions.length || 4.2) * 0.50 + 0.05;
      const hlY = (this.dimensions.height || 1.4) * 0.52;

      // Stabilize SpotLight target: projects straight down the road at vehicle level (zero roll, zero pitch)
      if (this.highBeamLightTarget) {
        this.highBeamLightTarget.position.set(
          this.mesh.position.x + Math.sin(this.currentYaw * 0.4) * 110,
          hlY,
          this.mesh.position.z + 110
        );
      }

      if (this.highBeamLight) {
        this.highBeamLight.intensity = 32.0;
      }

      // Stabilize Road Projection: ALWAYS flat on the asphalt (Y = 0.04), zero roll, zero pitch
      if (this.highBeamRoadMesh) {
        this.highBeamRoadMesh.visible = true;
        (this.highBeamRoadMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
        this.highBeamRoadMesh.position.set(
          this.mesh.position.x,
          0.04,
          this.mesh.position.z + frontZ
        );
        // Swivel gently across lanes with steering, but strictly 0 roll and 0 pitch
        this.highBeamRoadMesh.rotation.set(-Math.PI / 2, 0, this.currentYaw * 0.45);
      }

      // Stabilize 3D Volumetric Light Shafts: counter-rotate against chassis roll and pitch to stay level with the horizon
      if (this.highBeamShaftLeft && this.highBeamShaftRight) {
        this.highBeamShaftLeft.visible = true;
        this.highBeamShaftRight.visible = true;
        (this.highBeamShaftLeft.material as THREE.MeshBasicMaterial).opacity = 0.85;
        (this.highBeamShaftRight.material as THREE.MeshBasicMaterial).opacity = 0.85;

        // Active roll and pitch compensation so light shafts NEVER tilt sideways like crooked sticks
        this.highBeamShaftLeft.rotation.z = -this.currentSteerTilt;
        this.highBeamShaftLeft.rotation.x = -this.currentPitch;
        this.highBeamShaftRight.rotation.z = -this.currentSteerTilt;
        this.highBeamShaftRight.rotation.x = -this.currentPitch;
      }

      // Headlight optical glare discs: counter-rotate against roll
      if (this.highBeamFlareLeft && this.highBeamFlareRight) {
        this.highBeamFlareLeft.visible = true;
        this.highBeamFlareRight.visible = true;
        (this.highBeamFlareLeft.material as THREE.MeshBasicMaterial).opacity = 1.0;
        (this.highBeamFlareRight.material as THREE.MeshBasicMaterial).opacity = 1.0;

        this.highBeamFlareLeft.rotation.z = -this.currentSteerTilt;
        this.highBeamFlareRight.rotation.z = -this.currentSteerTilt;
      }

      if (this.headLightMaterial) {
        this.headLightMaterial.color.set(0xffffff);
      }
      // Blinding white emissive flash on 3D car model headlights
      if (this.isUsingCustomModel && this.customModelGroup) {
        this.customModelGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && /far|headlight|sinyal|lights_lod/i.test((child as THREE.Mesh).name || '')) {
            const mesh = child as THREE.Mesh;
            const mats: any[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m: any) => {
              if (m && m.emissive) {
                m.emissiveIntensity = 3.2;
                m.emissive.set(0xffffff);
              }
            });
          }
        });
      }
    } else {
      if (this.highBeamLight && this.highBeamLight.intensity > 0) {
        this.highBeamLight.intensity = 0;
      }
      if (this.highBeamRoadMesh && this.highBeamRoadMesh.visible) {
        this.highBeamRoadMesh.visible = false;
        (this.highBeamRoadMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      if (this.highBeamShaftLeft && this.highBeamShaftLeft.visible) {
        this.highBeamShaftLeft.visible = false;
        (this.highBeamShaftLeft.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      if (this.highBeamShaftRight && this.highBeamShaftRight.visible) {
        this.highBeamShaftRight.visible = false;
        (this.highBeamShaftRight.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      if (this.highBeamFlareLeft && this.highBeamFlareLeft.visible) {
        this.highBeamFlareLeft.visible = false;
        (this.highBeamFlareLeft.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      if (this.highBeamFlareRight && this.highBeamFlareRight.visible) {
        this.highBeamFlareRight.visible = false;
        (this.highBeamFlareRight.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      if (this.headLightMaterial) {
        this.headLightMaterial.color.set(0xcccccc);
      }
      if (this.isUsingCustomModel && this.customModelGroup) {
        this.customModelGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && /far|headlight|sinyal|lights_lod/i.test((child as THREE.Mesh).name || '')) {
            const mesh = child as THREE.Mesh;
            const mats: any[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m: any) => {
              if (m && m.emissive) {
                m.emissiveIntensity = 0.35;
              }
            });
          }
        });
      }
    }

    // 7. Turn Signal Blinker & Audio Relay Update
    if (this.turnSignal !== 'none') {
      this.turnSignalTimer += delta;
      const isBlinkOn = (this.turnSignalTimer % 0.38) < 0.20;
      if (isBlinkOn !== this.prevBlinkState) {
        this.prevBlinkState = isBlinkOn;
        const pan = this.turnSignal === 'left' ? -0.28 : (this.turnSignal === 'right' ? 0.28 : 0);
        audioManager.playTurnSignalClick(isBlinkOn, 0.45, pan);
      }

      const isLeft = this.turnSignal === 'left' || this.turnSignal === 'hazard';
      const isRight = this.turnSignal === 'right' || this.turnSignal === 'hazard';
      if (this.turnSignalMeshes) {
        this.turnSignalMeshes.fl.visible = isLeft && isBlinkOn;
        this.turnSignalMeshes.rl.visible = isLeft && isBlinkOn;
        this.turnSignalMeshes.fr.visible = isRight && isBlinkOn;
        this.turnSignalMeshes.rr.visible = isRight && isBlinkOn;
      }
    } else {
      this.turnSignalTimer = 0;
      this.prevBlinkState = false;
      if (this.turnSignalMeshes) {
        this.turnSignalMeshes.fl.visible = false;
        this.turnSignalMeshes.fr.visible = false;
        this.turnSignalMeshes.rl.visible = false;
        this.turnSignalMeshes.rr.visible = false;
      }
    }

    // 8. Update Bounding Box for Collision
    this.updateBoundingBox();

    // 9. Update Cockpit Instrument Cluster needles (speedometer & tachometer)
    this.updateCockpitCluster(delta);
  }

  public override applyCustomGLTF(model: THREE.Group): void {
    super.applyCustomGLTF(model);
    this.updateTurnSignalPositions();
    this.updateHighBeamPositions();
    this.updateExhaustPosition();
    this.updateLicensePlatePositions();
    this.updateCockpitClusterPositions();
    this.updateWheelPositions();

    // Hide any foreign / placeholder license plate meshes and baked static hubcap/wheel meshes embedded in models (e.g. Corsa's Object_2..5 and Object_58..75)
    const isCorsa = this.currentVehicleId === 'opel_corsa_b';
    model.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      const matName = (((child as any).material?.name) || '').toLowerCase();
      if (
        /licplate|plaka|license_plate|lic_plate/i.test(name + ' ' + matName) ||
        (isCorsa && /^object_([2345]|5[8-9]|6\d|7[0-5])$/i.test(name))
      ) {
        child.visible = false;
      }
    });
  }

  // 3D Turkish License Plate System (Özel Plaka)
  private frontPlateGroup: THREE.Group | null = null;
  private rearPlateGroup: THREE.Group | null = null;
  private plateTexture: THREE.CanvasTexture | null = null;
  private plateCanvas: HTMLCanvasElement | null = null;
  private plateMaterial: THREE.MeshStandardMaterial | null = null;

  private initLicensePlates(): void {
    this.updateLicensePlateTexture(gameState.licensePlate);

    const backingGeo = new THREE.BoxGeometry(0.58, 0.138, 0.012);
    const backingMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.85,
      metalness: 0.1,
    });

    // 1. Front Plate Group
    this.frontPlateGroup = new THREE.Group();
    this.frontPlateGroup.name = 'FrontLicensePlateGroup';
    const frontBacking = new THREE.Mesh(backingGeo, backingMat);
    const frontPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.568, 0.128), this.plateMaterial!);
    frontPlane.position.z = 0.0075;
    this.frontPlateGroup.add(frontBacking);
    this.frontPlateGroup.add(frontPlane);

    // 2. Rear Plate Group
    this.rearPlateGroup = new THREE.Group();
    this.rearPlateGroup.name = 'RearLicensePlateGroup';
    const rearBacking = new THREE.Mesh(backingGeo, backingMat);
    const rearPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.568, 0.128), this.plateMaterial!);
    rearPlane.position.z = 0.0075;
    this.rearPlateGroup.add(rearBacking);
    this.rearPlateGroup.add(rearPlane);

    this.mesh.add(this.frontPlateGroup);
    this.mesh.add(this.rearPlateGroup);

    this.updateLicensePlatePositions();

    eventBus.on('licensePlateChanged', ({ plate }) => {
      this.updateLicensePlateTexture(plate);
    });

    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => {
        this.updateLicensePlateTexture(gameState.licensePlate);
      });
    }
  }

  public updateLicensePlateTexture(plateText: string): void {
    if (!this.plateCanvas) {
      this.plateCanvas = document.createElement('canvas');
      this.plateCanvas.width = 2048;
      this.plateCanvas.height = 480;
    }
    const ctx = this.plateCanvas.getContext('2d')!;
    let text = (plateText || '34 TR 1998').trim().toUpperCase();
    const match = text.match(/^(\d{2})\s*([A-Z]+)\s*(\d+)$/);
    if (match) {
      text = `${match[1]} ${match[2]} ${match[3]}`;
    }

    ctx.clearRect(0, 0, 2048, 480);

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number | number[]) => {
      if (typeof (ctx as any).roundRect === 'function') {
        ctx.beginPath();
        (ctx as any).roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
      }
    };

    // 1. Black outer plastic plakalık frame
    ctx.fillStyle = '#0a0d12';
    drawRoundRect(0, 0, 2048, 480, 28);
    ctx.fill();

    // 2. Pure bright white retro-reflective plate sheet
    ctx.fillStyle = '#ffffff';
    drawRoundRect(18, 18, 2012, 444, 20);
    ctx.fill();

    // 3. Black thin embossed border inside white plate
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#151515';
    drawRoundRect(28, 28, 1992, 424, 16);
    ctx.stroke();

    // 4. Blue TR European band on the left
    const trWidth = 224;
    ctx.save();
    drawRoundRect(35, 35, trWidth, 410, [14, 0, 0, 14]);
    ctx.clip();
    ctx.fillStyle = '#003399';
    ctx.fillRect(35, 35, trWidth, 410);

    // European stars circle
    ctx.fillStyle = '#ffcc00';
    const cx = 35 + trWidth / 2;
    const cy = 120;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const sx = cx + Math.cos(angle) * 48;
      const sy = cy + Math.sin(angle) * 48;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // TR Text inside blue band
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 134px "Arial", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TR', cx, 290);
    ctx.restore();

    // 5. Authentic Turkish Plate Typography (Open loops for 6, 8, 0, B with clean letter spacing)
    const len = text.length;
    const fontSize = len <= 8 ? 245 : (len <= 10 ? 225 : (len <= 12 ? 205 : 185));
    ctx.font = `800 ${fontSize}px "Arial", "Segoe UI", "DIN Alternate", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textCenter = 35 + trWidth + (2012 - trWidth) / 2;

    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = '8px';
    }

    // Clean, crisp text fill without blobby stroke
    ctx.fillStyle = '#0a0a0a';
    ctx.fillText(text, textCenter, 246);

    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = '0px';
    }

    // Official embossed blue seal dot between city and letters
    const parts = text.split(' ');
    if (parts.length >= 2) {
      ctx.fillStyle = '#1a56cc';
      ctx.beginPath();
      ctx.arc(textCenter - Math.min(380, len * 36), 140, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!this.plateTexture) {
      this.plateTexture = new THREE.CanvasTexture(this.plateCanvas);
      this.plateTexture.colorSpace = THREE.SRGBColorSpace;
      this.plateTexture.generateMipmaps = true;
      this.plateTexture.minFilter = THREE.LinearMipmapLinearFilter;
      this.plateTexture.magFilter = THREE.LinearFilter;
      this.plateTexture.anisotropy = 16;
      this.plateMaterial = new THREE.MeshStandardMaterial({
        map: this.plateTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: this.plateTexture,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.FrontSide,
      });
    } else {
      this.plateTexture.needsUpdate = true;
      if (this.plateMaterial) this.plateMaterial.needsUpdate = true;
    }
  }

  public updateLicensePlatePositions(vehicleId?: string): void {
    if (!this.frontPlateGroup || !this.rearPlateGroup) return;
    const id = vehicleId || this.currentVehicleId || gameState.selectedVehicleId;

    if (id === 'opel_corsa_b') {
      // Precise Opel Corsa B bumper coordinates (flush on front & rear bumpers)
      this.frontPlateGroup.position.set(0, 0.40, 2.065);
      this.frontPlateGroup.rotation.set(-0.05, 0, 0);

      this.rearPlateGroup.position.set(0, 0.52, -2.092);
      this.rearPlateGroup.rotation.set(0.04, Math.PI, 0);
    } else if (id === 'starter_coupe' || id === 'tofas_gltf') {
      // Precise Tofaş Doğan SLX bumper coordinates
      this.frontPlateGroup.position.set(0, 0.28, 2.102);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.50, -2.102);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    } else if (id === 'golf_gti') {
      // Precise Volkswagen Golf GTI bumper coordinates
      this.frontPlateGroup.position.set(0, 0.38, 2.142);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.52, -2.142);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    } else if (id === 'mini_cooper') {
      // Precise Mini Cooper bumper coordinates
      this.frontPlateGroup.position.set(0, 0.34, 1.912);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.50, -1.912);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    } else if (id === 'bmw_e46') {
      // Precise BMW 3 (E46 1998) bumper coordinates
      this.frontPlateGroup.position.set(0, 0.38, 2.238);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.56, -2.238);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    } else if (id === 'phantom_super') {
      // Precise Ferrari 458 Italia bumper coordinates
      this.frontPlateGroup.position.set(0, 0.32, 2.24);
      this.frontPlateGroup.rotation.set(-0.06, 0, 0);

      this.rearPlateGroup.position.set(0, 0.48, -2.25);
      this.rearPlateGroup.rotation.set(0.04, Math.PI, 0);
    } else if (id === 'luxury_sedan') {
      // Precise Dodge Charger R/T bumper coordinates
      this.frontPlateGroup.position.set(0, 0.38, 2.38);
      this.frontPlateGroup.rotation.set(-0.04, 0, 0);

      this.rearPlateGroup.position.set(0, 0.54, -2.40);
      this.rearPlateGroup.rotation.set(0.04, Math.PI, 0);
    } else if (id === 'sport_racer') {
      // Precise Volkswagen Scirocco R bumper coordinates
      this.frontPlateGroup.position.set(0, 0.36, 2.14);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.50, -2.12);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    } else {
      // Procedural & generic vehicles
      const halfL = (this.dimensions.length || 4.2) * 0.50 + 0.018;
      this.frontPlateGroup.position.set(0, 0.44, halfL);
      this.frontPlateGroup.rotation.set(0, 0, 0);

      this.rearPlateGroup.position.set(0, 0.46, -halfL);
      this.rearPlateGroup.rotation.set(0, Math.PI, 0);
    }
  }

  public updateWheelPositions(vehicleId?: string): void {
    if (this.customWheels.length >= 4) {
      // Custom 3D model already has its own 4 animated wheels (e.g. Tofaş Doğan SLX FBX)
      this.wheelsGroup.visible = false;
      return;
    }

    // Models without separate wheel nodes use high-fidelity procedural wheels
    this.wheelsGroup.visible = true;

    const id = vehicleId || this.currentVehicleId || gameState.selectedVehicleId;

    let halfTrack = this.dimensions.width * 0.44;
    let frontZ = this.dimensions.length * 0.28;
    let rearZ = -this.dimensions.length * 0.29;
    let wheelRadius = this.dimensions.wheelRadius || 0.33;
    let wheelScale = 1.0;

    switch (id) {
      case 'mini_cooper':
        halfTrack = 0.76;
        frontZ = 1.08;
        rearZ = -1.14;
        wheelRadius = 0.315;
        wheelScale = 0.93;
        break;
      case 'opel_corsa_b':
        halfTrack = 0.78;
        frontZ = 1.292;
        rearZ = -1.470;
        wheelRadius = 0.324;
        wheelScale = 0.98;
        break;
      case 'golf_gti':
        halfTrack = 0.77;
        frontZ = 1.26;
        rearZ = -1.28;
        wheelRadius = 0.33;
        wheelScale = 0.96;
        break;
      case 'bmw_e46':
        halfTrack = 0.79;
        frontZ = 1.34;
        rearZ = -1.36;
        wheelRadius = 0.34;
        wheelScale = 1.0;
        break;
      case 'sport_racer':
        halfTrack = 0.78;
        frontZ = 1.25;
        rearZ = -1.35;
        wheelRadius = 0.32;
        wheelScale = 0.98;
        break;
      default:
        halfTrack = this.dimensions.width * 0.44;
        frontZ = this.dimensions.length * 0.28;
        rearZ = -this.dimensions.length * 0.29;
        wheelRadius = this.dimensions.wheelRadius || 0.33;
        wheelScale = 1.0;
        break;
    }

    if (this.frontWheels.length >= 2 && this.rearWheels.length >= 2) {
      // Front Left (-X) & Front Right (+X)
      this.frontWheels[0].position.set(-halfTrack, wheelRadius, frontZ);
      this.frontWheels[1].position.set(halfTrack, wheelRadius, frontZ);
      this.frontWheels[0].scale.set(wheelScale, wheelScale, wheelScale);
      this.frontWheels[1].scale.set(wheelScale, wheelScale, wheelScale);

      // Rear Left (-X) & Rear Right (+X)
      this.rearWheels[0].position.set(-halfTrack, wheelRadius, rearZ);
      this.rearWheels[1].position.set(halfTrack, wheelRadius, rearZ);
      this.rearWheels[0].scale.set(wheelScale, wheelScale, wheelScale);
      this.rearWheels[1].scale.set(wheelScale, wheelScale, wheelScale);
    }
  }

  // Dedicated Cockpit Interior Cabin Dome / Fill Light (illuminates dashboard, wheel & interior)
  private cabinLight: THREE.PointLight | null = null;

  private initCabinLighting(): void {
    if (this.cabinLight) return;
    // Soft, natural warm daylight fill light inside the cabin
    this.cabinLight = new THREE.PointLight(0xfff5e6, 3.8, 3.8, 1.1);
    this.cabinLight.position.set(0.20, 1.20, 0.15);
    this.cabinLight.castShadow = false;
    this.mesh.add(this.cabinLight);
  }

  // Cockpit Working Instrument Cluster (Speedometer, Tachometer & Backlit Gauges)
  private cockpitClusterMesh: THREE.Mesh | null = null;
  private clusterCanvas: HTMLCanvasElement | null = null;
  private clusterTexture: THREE.CanvasTexture | null = null;
  private clusterMaterial: THREE.MeshStandardMaterial | null = null;
  private clusterUpdateTimer: number = 0;

  private initCockpitCluster(): void {
    if (this.cockpitClusterMesh) return;
    this.clusterCanvas = document.createElement('canvas');
    this.clusterCanvas.width = 512;
    this.clusterCanvas.height = 256;

    this.clusterTexture = new THREE.CanvasTexture(this.clusterCanvas);
    this.clusterTexture.colorSpace = THREE.SRGBColorSpace;
    this.clusterTexture.minFilter = THREE.LinearFilter;
    this.clusterTexture.magFilter = THREE.LinearFilter;

    this.clusterMaterial = new THREE.MeshStandardMaterial({
      map: this.clusterTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.clusterTexture,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.FrontSide,
    });

    const geo = new THREE.PlaneGeometry(0.24, 0.095);
    this.cockpitClusterMesh = new THREE.Mesh(geo, this.clusterMaterial);
    this.cockpitClusterMesh.name = 'CockpitInstrumentCluster';
    this.mesh.add(this.cockpitClusterMesh);

    this.updateCockpitClusterPositions();
    this.renderCockpitCluster(0);
  }

  public updateCockpitClusterPositions(): void {
    if (!this.cockpitClusterMesh) return;
    const id = this.currentVehicleId || gameState.selectedVehicleId;
    if (id === 'opel_corsa_b') {
      this.cockpitClusterMesh.visible = true;
      this.cockpitClusterMesh.position.set(0.35, 1.285, 0.54);
      this.cockpitClusterMesh.rotation.set(-0.16, 0, 0);
    } else {
      this.cockpitClusterMesh.visible = false;
    }
  }

  public updateCockpitCluster(delta: number): void {
    if (!this.cockpitClusterMesh || !this.cockpitClusterMesh.visible) return;
    // Performance optimization: only draw 2D canvas and re-upload texture when in cockpit view
    if (gameState.currentCameraView !== 'INTERIOR') return;
    this.clusterUpdateTimer += delta;
    if (this.clusterUpdateTimer >= 0.04) {
      this.clusterUpdateTimer = 0;
      this.renderCockpitCluster(this.speedKmh);
    }
  }

  private renderCockpitCluster(speedKmh: number): void {
    if (!this.clusterCanvas) return;
    const ctx = this.clusterCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);

    // Instrument Binnacle Background (Matte Dark Charcoal)
    ctx.fillStyle = '#080a0f';
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(4, 4, 504, 248, 20);
    } else {
      ctx.rect(4, 4, 504, 248);
    }
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e222a';
    ctx.stroke();

    // 1. TACHOMETER (Left Dial - 0 to 7000 RPM)
    const tX = 145, tY = 128, r = 85;
    ctx.strokeStyle = '#2b303c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tX, tY, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();

    // Ticks & Numbers
    for (let i = 0; i <= 7; i++) {
      const angle = Math.PI * 0.75 + (i / 7) * (Math.PI * 1.5);
      const isRedline = i >= 6;
      ctx.strokeStyle = isRedline ? '#ff3333' : '#d8dce2';
      ctx.lineWidth = isRedline ? 4 : 3;
      const x1 = tX + Math.cos(angle) * (r - 12);
      const y1 = tY + Math.sin(angle) * (r - 12);
      const x2 = tX + Math.cos(angle) * r;
      const y2 = tY + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const tx = tX + Math.cos(angle) * (r - 24);
      const ty = tY + Math.sin(angle) * (r - 24);
      ctx.fillStyle = isRedline ? '#ff4444' : '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i}`, tx, ty);
    }
    ctx.fillStyle = '#8e96a3';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('x1000 RPM', tX, tY + 45);

    // RPM Needle
    const rpm = Math.min(7000, 850 + (speedKmh / 220) * 5600);
    const rpmAngle = Math.PI * 0.75 + (rpm / 7000) * (Math.PI * 1.5);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tX, tY);
    ctx.lineTo(tX + Math.cos(rpmAngle) * (r - 8), tY + Math.sin(rpmAngle) * (r - 8));
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(tX, tY, 8, 0, Math.PI * 2);
    ctx.fill();

    // 2. SPEEDOMETER (Right Dial - 0 to 220 km/h)
    const sX = 367, sY = 128;
    ctx.strokeStyle = '#2b303c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sX, sY, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();

    for (let s = 0; s <= 220; s += 20) {
      const angle = Math.PI * 0.75 + (s / 220) * (Math.PI * 1.5);
      ctx.strokeStyle = '#d8dce2';
      ctx.lineWidth = 3;
      const x1 = sX + Math.cos(angle) * (r - 12);
      const y1 = sY + Math.sin(angle) * (r - 12);
      const x2 = sX + Math.cos(angle) * r;
      const y2 = sY + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const tx = sX + Math.cos(angle) * (r - 24);
      const ty = sY + Math.sin(angle) * (r - 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${s}`, tx, ty);
    }
    ctx.fillStyle = '#8e96a3';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('KM/H', sX, sY + 45);

    // Speed Needle
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh / 220));
    const speedAngle = Math.PI * 0.75 + speedRatio * (Math.PI * 1.5);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sX, sY);
    ctx.lineTo(sX + Math.cos(speedAngle) * (r - 8), sY + Math.sin(speedAngle) * (r - 8));
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(sX, sY, 8, 0, Math.PI * 2);
    ctx.fill();

    // 3. CENTER CONSOLE (Digital Display & Status Icons)
    ctx.fillStyle = '#05070a';
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(228, 65, 56, 125, 8);
    } else {
      ctx.rect(228, 65, 56, 125);
    }
    ctx.fill();
    ctx.strokeStyle = '#222834';
    ctx.stroke();

    // Digital Speed LCD
    ctx.fillStyle = '#ffaa33';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(speedKmh)}`, 256, 100);
    ctx.fillStyle = '#888';
    ctx.font = '8px sans-serif';
    ctx.fillText('KM/H', 256, 114);

    // Fuel & Status
    ctx.fillStyle = '#ffaa33';
    ctx.font = '11px sans-serif';
    ctx.fillText('⛽ 98L', 256, 138);

    ctx.fillStyle = '#00ffaa';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('OPEL', 256, 164);

    if (this.clusterTexture) {
      this.clusterTexture.needsUpdate = true;
    }
  }

  private initTurnSignals(): void {
    if (!PlayerVehicle.turnSignalMaterial) {
      PlayerVehicle.turnSignalMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    }
    const geo = new THREE.BoxGeometry(0.14, 0.09, 0.12);
    const fl = new THREE.Mesh(geo, PlayerVehicle.turnSignalMaterial);
    const fr = new THREE.Mesh(geo, PlayerVehicle.turnSignalMaterial);
    const rl = new THREE.Mesh(geo, PlayerVehicle.turnSignalMaterial);
    const rr = new THREE.Mesh(geo, PlayerVehicle.turnSignalMaterial);

    fl.visible = false;
    fr.visible = false;
    rl.visible = false;
    rr.visible = false;

    this.mesh.add(fl);
    this.mesh.add(fr);
    this.mesh.add(rl);
    this.mesh.add(rr);

    this.turnSignalMeshes = { fl, fr, rl, rr };
    this.updateTurnSignalPositions();
  }

  public updateTurnSignalPositions(): void {
    if (!this.turnSignalMeshes) return;
    const halfW = (this.dimensions.width || 1.8) * 0.48;
    const halfL = (this.dimensions.length || 4.2) * 0.48;
    const frontY = (this.dimensions.height || 1.4) * 0.38;
    const rearY = (this.dimensions.height || 1.4) * 0.42;

    this.turnSignalMeshes.fl.position.set(-halfW, frontY, halfL);
    this.turnSignalMeshes.fr.position.set(halfW, frontY, halfL);
    this.turnSignalMeshes.rl.position.set(-halfW, rearY, -halfL);
    this.turnSignalMeshes.rr.position.set(halfW, rearY, -halfL);
  }

  public toggleTurnSignal(side: 'left' | 'right'): void {
    if (this.turnSignal === side) {
      this.turnSignal = 'none';
      this.turnSignalTimer = 0;
      this.prevBlinkState = false;
      audioManager.playTurnSignalClick(false, 0.35, side === 'left' ? -0.25 : 0.25);
    } else {
      this.turnSignal = side;
      this.turnSignalTimer = 0;
      this.prevBlinkState = true;
      audioManager.playTurnSignalClick(true, 0.45, side === 'left' ? -0.25 : 0.25);
    }
  }

  private initHighBeams(): void {
    // 1. High-beam forward spotlight (pointing straight horizontally forward down the highway)
    this.highBeamLight = new THREE.SpotLight(0xf2f8ff, 0, 160, Math.PI / 6.5, 0.28, 1.0);
    this.highBeamLightTarget = new THREE.Object3D();
    this.highBeamLight.target = this.highBeamLightTarget;
    this.mesh.add(this.highBeamLight);

    // 2. High-beam road projection beam (visible bright 52m road illumination on asphalt ahead)
    const beamGeo = new THREE.PlaneGeometry(8.0, 52);
    beamGeo.translate(0, 26, 0);

    let beamTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.15, 'rgba(235, 248, 255, 0.75)');
        grad.addColorStop(0.40, 'rgba(200, 235, 255, 0.38)');
        grad.addColorStop(0.72, 'rgba(170, 215, 255, 0.12)');
        grad.addColorStop(1.0, 'rgba(160, 210, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 256);
      }
      beamTex = new THREE.CanvasTexture(canvas);
    }

    const beamMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.highBeamRoadMesh = new THREE.Mesh(beamGeo, beamMat);
    this.highBeamRoadMesh.rotation.x = -Math.PI / 2;
    this.highBeamRoadMesh.visible = false;

    // 3. Volumetric 3D Light Shafts (realistic 22m atmospheric beam cones projecting straight ahead)
    const shaftGeo = new THREE.CylinderGeometry(0.12, 0.90, 22, 16, 1, true);
    // Cylinder by default is along Y axis. Rotate to align with +Z forward, translate so base is at headlight
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.translate(0, 0, 11);

    let shaftTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        grad.addColorStop(0.10, 'rgba(225, 245, 255, 0.50)');
        grad.addColorStop(0.35, 'rgba(180, 225, 255, 0.20)');
        grad.addColorStop(0.70, 'rgba(150, 210, 255, 0.05)');
        grad.addColorStop(1.0, 'rgba(140, 200, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 256);
      }
      shaftTex = new THREE.CanvasTexture(canvas);
    }

    const shaftMat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.highBeamShaftLeft = new THREE.Mesh(shaftGeo, shaftMat);
    this.highBeamShaftRight = new THREE.Mesh(shaftGeo, shaftMat.clone());
    this.highBeamShaftLeft.visible = false;
    this.highBeamShaftRight.visible = false;
    this.mesh.add(this.highBeamShaftLeft);
    this.mesh.add(this.highBeamShaftRight);

    // 4. Headlight Lens Flares / Glare Discs (blinding optical corona right in front of headlights)
    const flareGeo = new THREE.PlaneGeometry(0.70, 0.70);
    let flareTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.18, 'rgba(245, 252, 255, 0.85)');
        grad.addColorStop(0.42, 'rgba(175, 220, 255, 0.45)');
        grad.addColorStop(0.70, 'rgba(140, 195, 255, 0.15)');
        grad.addColorStop(1.0, 'rgba(130, 190, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      flareTex = new THREE.CanvasTexture(canvas);
    }

    const flareMat = new THREE.MeshBasicMaterial({
      map: flareTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.highBeamFlareLeft = new THREE.Mesh(flareGeo, flareMat);
    this.highBeamFlareRight = new THREE.Mesh(flareGeo, flareMat.clone());
    this.highBeamFlareLeft.visible = false;
    this.highBeamFlareRight.visible = false;
    this.mesh.add(this.highBeamFlareLeft);
    this.mesh.add(this.highBeamFlareRight);

    this.updateHighBeamPositions();
  }

  public updateHighBeamPositions(): void {
    const halfW = (this.dimensions.width || 1.8) * 0.36; // Headlight lateral separation
    const frontZ = (this.dimensions.length || 4.2) * 0.50 + 0.05; // Headlight front position
    const hlY = (this.dimensions.height || 1.4) * 0.52; // Headlight vertical position

    if (this.highBeamLight) {
      this.highBeamLight.position.set(0, hlY, frontZ);
    }

    if (this.highBeamShaftLeft && this.highBeamShaftRight) {
      this.highBeamShaftLeft.position.set(-halfW, hlY, frontZ);
      this.highBeamShaftRight.position.set(halfW, hlY, frontZ);
    }

    if (this.highBeamFlareLeft && this.highBeamFlareRight) {
      this.highBeamFlareLeft.position.set(-halfW, hlY, frontZ + 0.04);
      this.highBeamFlareRight.position.set(halfW, hlY, frontZ + 0.04);
    }
  }

  public setHighBeamsActive(active: boolean): void {
    this.isHighBeamActive = active;
  }

  public triggerHighBeams(): void {
    this.highBeamTimer = 0.35;
  }

  // --- 3D Custom Exhaust System (Warex, Akrapovic, Popcorn, Standard) & Dynamic Flame Lighting ---
  private initAbartiExhaust(): void {
    this.exhaustMufflerGroup = new THREE.Group();
    this.exhaustMufflerGroup.name = 'CustomExhaustGroup';

    this.exhaustMeshSubGroup = new THREE.Group();
    this.exhaustMeshSubGroup.name = 'ExhaustMeshSubGroup';
    this.exhaustMufflerGroup.add(this.exhaustMeshSubGroup);

    // 1. Volumetric 3-Layer Flame Jet (Outer Plume + Mid Flame + Hot Core Needle)
    // Outer flame plume (fiery orange-red)
    const outerFlameGeo = new THREE.ConeGeometry(0.13, 0.85, 10);
    outerFlameGeo.rotateX(-Math.PI / 2); // point -Z backward
    outerFlameGeo.translate(0, 0, -0.80);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.exhaustFlameOuter = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    this.exhaustFlameOuter.visible = false;
    this.exhaustMufflerGroup.add(this.exhaustFlameOuter);

    // Mid flame cone (hot neon orange/yellow)
    const innerFlameGeo = new THREE.ConeGeometry(0.075, 0.55, 10);
    innerFlameGeo.rotateX(-Math.PI / 2);
    innerFlameGeo.translate(0, 0, -0.62);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.exhaustFlameInner = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.exhaustFlameInner.visible = false;
    this.exhaustMufflerGroup.add(this.exhaustFlameInner);

    // Core flame needle (ultra-hot white plasma core)
    const coreFlameGeo = new THREE.ConeGeometry(0.038, 0.36, 8);
    coreFlameGeo.rotateX(-Math.PI / 2);
    coreFlameGeo.translate(0, 0, -0.48);
    const coreFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.exhaustFlameCore = new THREE.Mesh(coreFlameGeo, coreFlameMat);
    this.exhaustFlameCore.visible = false;
    this.exhaustMufflerGroup.add(this.exhaustFlameCore);

    // 2. Dynamic Real-time Flame Flash PointLight (illuminates car rear bumper & road tarmac)
    this.exhaustFlashLight = new THREE.PointLight(0xff6600, 0, 7.0, 1.8);
    this.exhaustFlashLight.position.set(0, 0, -0.42);
    this.exhaustMufflerGroup.add(this.exhaustFlashLight);

    this.mesh.add(this.exhaustMufflerGroup);

    // Initialize with current saved preset
    this.updateExhaustStyle(gameState.exhaustPreset as any);
    this.updateExhaustPosition();

    // Hot-swap exhaust 3D style when changed from garage
    eventBus.on('exhaustPresetChanged', ({ preset }) => {
      this.updateExhaustStyle(preset);
    });
  }

  // Dynamically builds authentic 3D geometry matching chosen exhaust style
  public updateExhaustStyle(preset: 'Standard' | 'Deep' | 'Light' | 'Abarti'): void {
    if (!this.exhaustMeshSubGroup) return;

    // Dispose and clear previous sub-meshes
    while (this.exhaustMeshSubGroup.children.length > 0) {
      const child = this.exhaustMeshSubGroup.children[0] as THREE.Mesh;
      this.exhaustMeshSubGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    if (preset === 'Deep') {
      // 🏎️ AKRAPOVIC TITANIUM DUAL (Twin Carbon-Fiber Sleeved Tips with Titanium Core)
      const tipOffsets = [-0.065, 0.065];
      tipOffsets.forEach((xOff) => {
        // Outer Matte Carbon-Fiber Barrel
        const carbonGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.30, 16);
        carbonGeo.rotateX(Math.PI / 2);
        carbonGeo.translate(xOff, 0, -0.12);
        const carbonMat = new THREE.MeshStandardMaterial({
          color: 0x18191c,
          roughness: 0.72,
          metalness: 0.25,
        });
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(carbonGeo, carbonMat));

        // Inner Polished Titanium Lip with Slant Cut
        const titanGeo = new THREE.CylinderGeometry(0.042, 0.046, 0.16, 16, 1, true);
        titanGeo.rotateX(Math.PI / 2);
        titanGeo.translate(xOff, 0, -0.25);
        const titanMat = new THREE.MeshStandardMaterial({
          color: 0xa8b8cc,
          metalness: 0.98,
          roughness: 0.12,
          side: THREE.DoubleSide,
        });
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(titanGeo, titanMat));

        // Akrapovic Signature Red Accent Ring
        const redRingGeo = new THREE.TorusGeometry(0.052, 0.005, 8, 20);
        redRingGeo.translate(xOff, 0, -0.23);
        const redRingMat = new THREE.MeshStandardMaterial({
          color: 0xee2222,
          emissive: 0x550000,
          emissiveIntensity: 0.45,
          metalness: 0.8,
        });
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(redRingGeo, redRingMat));

        // Dark Interior Hole
        const holeGeo = new THREE.CircleGeometry(0.040, 16);
        holeGeo.translate(xOff, 0, -0.32);
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x050505 })));
      });
    } else if (preset === 'Light') {
      // 🍿 POPCORN TUNE (Direct Straight-Pipe Race Exhaust with TIG Weld Rings)
      const pipeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.46, 16);
      pipeGeo.rotateX(Math.PI / 2);
      pipeGeo.translate(0, 0, -0.06);
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0xcdd6df,
        metalness: 0.94,
        roughness: 0.18,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(pipeGeo, pipeMat));

      // 3 TIG Weld Bead Rings along the pipe
      [-0.18, -0.08, 0.04].forEach((zOff) => {
        const weldGeo = new THREE.TorusGeometry(0.066, 0.005, 8, 20);
        weldGeo.translate(0, 0, zOff);
        const weldMat = new THREE.MeshStandardMaterial({
          color: 0xcc9955,
          metalness: 0.88,
          roughness: 0.35,
        });
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(weldGeo, weldMat));
      });

      // Aggressive Flared Slash Tip
      const tipGeo = new THREE.CylinderGeometry(0.065, 0.084, 0.20, 16, 1, true);
      tipGeo.rotateX(Math.PI / 2);
      tipGeo.translate(0, 0, -0.27);
      const tipMat = new THREE.MeshStandardMaterial({
        color: 0xdde5ee,
        metalness: 0.98,
        roughness: 0.10,
        side: THREE.DoubleSide,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(tipGeo, tipMat));

      // Incandescent Heat Tint Ring inside
      const heatGeo = new THREE.TorusGeometry(0.076, 0.007, 8, 20);
      heatGeo.translate(0, 0, -0.34);
      const heatMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0x992200,
        emissiveIntensity: 0.55,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(heatGeo, heatMat));

      // Dark Hole
      const holeGeo = new THREE.CircleGeometry(0.062, 16);
      holeGeo.translate(0, 0, -0.36);
      this.exhaustMeshSubGroup.add(new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x050505 })));
    } else if (preset === 'Standard') {
      // 🔉 STANDART (Clean OEM Dual Oval Exhaust)
      const tipOffsets = [-0.055, 0.055];
      tipOffsets.forEach((xOff) => {
        const tipGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16);
        tipGeo.rotateX(Math.PI / 2);
        tipGeo.translate(xOff, 0, -0.15);
        const tipMat = new THREE.MeshStandardMaterial({
          color: 0xb0b8c2,
          metalness: 0.86,
          roughness: 0.32,
        });
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(tipGeo, tipMat));

        const holeGeo = new THREE.CircleGeometry(0.038, 16);
        holeGeo.translate(xOff, 0, -0.25);
        this.exhaustMeshSubGroup!.add(new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a })));
      });
    } else {
      // 💥 ABARTI / WAREX (Massive Stainless Canister + Giant 4.2" Slanted Burnt-Titanium Cannon)
      // 1. Polished Stainless Steel Warex Muffler Barrel
      const canGeo = new THREE.CylinderGeometry(0.086, 0.086, 0.44, 18);
      canGeo.rotateX(Math.PI / 2);
      const canMat = new THREE.MeshStandardMaterial({
        color: 0xe2e9f0,
        metalness: 0.95,
        roughness: 0.14,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(canGeo, canMat));

      // Steel Mounting Band Clamp
      const clampGeo = new THREE.TorusGeometry(0.090, 0.007, 8, 24);
      clampGeo.translate(0, 0, 0.06);
      const clampMat = new THREE.MeshStandardMaterial({
        color: 0x778899,
        metalness: 0.90,
        roughness: 0.30,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(clampGeo, clampMat));

      // 2. Slant-Cut Big-Bore 4.2" Cannon Tip
      const tipGeo = new THREE.CylinderGeometry(0.076, 0.094, 0.24, 18, 1, true);
      tipGeo.rotateX(Math.PI / 2);
      tipGeo.translate(0, 0, -0.27);
      const tipMat = new THREE.MeshStandardMaterial({
        color: 0xd8e2ec,
        metalness: 0.98,
        roughness: 0.10,
        side: THREE.DoubleSide,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(tipGeo, tipMat));

      // 3. Heat-Burnt Iridescent Titanium Rainbow Blue/Violet Ring
      const burnGeo = new THREE.TorusGeometry(0.088, 0.008, 8, 24);
      burnGeo.translate(0, 0, -0.38);
      const burnMat = new THREE.MeshStandardMaterial({
        color: 0x2266ff,
        metalness: 0.95,
        roughness: 0.18,
        emissive: 0x113399,
        emissiveIntensity: 0.65,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(burnGeo, burnMat));

      // Secondary Burnt Gold/Amber Gradient Transition Ring
      const goldRingGeo = new THREE.TorusGeometry(0.084, 0.006, 8, 24);
      goldRingGeo.translate(0, 0, -0.32);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xddaa22,
        metalness: 0.92,
        roughness: 0.25,
        emissive: 0x443300,
        emissiveIntensity: 0.30,
      });
      this.exhaustMeshSubGroup.add(new THREE.Mesh(goldRingGeo, goldMat));

      // 4. Dark Hollow Pipe Interior
      const holeGeo = new THREE.CircleGeometry(0.072, 18);
      holeGeo.translate(0, 0, -0.37);
      this.exhaustMeshSubGroup.add(new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x050505 })));
    }
  }

  public updateExhaustPosition(): void {
    if (!this.exhaustMufflerGroup) return;
    const halfW = (this.dimensions.width || 1.8) * 0.48;
    const halfL = (this.dimensions.length || 4.2) * 0.48;
    const exhaustY = (this.dimensions.height || 1.4) * 0.17;

    // Mounted cleanly under rear left bumper (classic street racer layout)
    this.exhaustMufflerGroup.position.set(-halfW * 0.54, exhaustY, -halfL + 0.06);
    // Slight aggressive slant tilt
    this.exhaustMufflerGroup.rotation.set(0.03, -0.05, 0);
  }

  public updateExhaustFlames(isNitro: boolean, delta: number): void {
    if (this.exhaustPopTimer > 0) {
      this.exhaustPopTimer -= delta;
    }
    const isFlameActive = isNitro || this.exhaustPopTimer > 0;

    if (this.exhaustFlameOuter && this.exhaustFlameInner && this.exhaustFlameCore) {
      if (isFlameActive) {
        this.exhaustFlameOuter.visible = true;
        this.exhaustFlameInner.visible = true;
        this.exhaustFlameCore.visible = true;

        if (isNitro) {
          // Electric cyan/blue afterburner jet
          const pulseScale = 1.35 + Math.random() * 0.35;
          this.exhaustFlameOuter.scale.set(pulseScale, pulseScale, pulseScale * 1.95);
          this.exhaustFlameInner.scale.set(pulseScale * 0.85, pulseScale * 0.85, pulseScale * 1.70);
          this.exhaustFlameCore.scale.set(pulseScale * 0.60, pulseScale * 0.60, pulseScale * 1.40);

          (this.exhaustFlameOuter.material as THREE.MeshBasicMaterial).color.setHex(0x0055ff);
          (this.exhaustFlameOuter.material as THREE.MeshBasicMaterial).opacity = 0.90;

          (this.exhaustFlameInner.material as THREE.MeshBasicMaterial).color.setHex(0x00e5ff);
          (this.exhaustFlameInner.material as THREE.MeshBasicMaterial).opacity = 1.0;

          (this.exhaustFlameCore.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
          (this.exhaustFlameCore.material as THREE.MeshBasicMaterial).opacity = 1.0;

          if (this.exhaustFlashLight) {
            this.exhaustFlashLight.color.setHex(0x00d4ff);
            this.exhaustFlashLight.intensity = 4.2 + Math.random() * 1.8;
          }
        } else {
          // Fiery explosive backfire spit (Warex / Popcorn / Kesici)
          const popRatio = Math.max(0, Math.min(1.0, this.exhaustPopTimer / 0.12));
          const popSize = 1.0 + popRatio * 0.65 + Math.random() * 0.50;

          this.exhaustFlameOuter.scale.set(popSize * 1.20, popSize * 1.20, popSize * 1.60);
          this.exhaustFlameInner.scale.set(popSize * 0.88, popSize * 0.88, popSize * 1.35);
          this.exhaustFlameCore.scale.set(popSize * 0.55, popSize * 0.55, popSize * 1.05);

          (this.exhaustFlameOuter.material as THREE.MeshBasicMaterial).color.setHex(0xff3300);
          (this.exhaustFlameOuter.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.random() * 0.15;

          (this.exhaustFlameInner.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00);
          (this.exhaustFlameInner.material as THREE.MeshBasicMaterial).opacity = 0.95;

          (this.exhaustFlameCore.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
          (this.exhaustFlameCore.material as THREE.MeshBasicMaterial).opacity = 1.0;

          if (this.exhaustFlashLight) {
            this.exhaustFlashLight.color.setHex(0xff6600);
            this.exhaustFlashLight.intensity = 5.8 + Math.random() * 3.0;
          }
        }

        // Turbulent rotational flicker
        const rotFlicker = Math.random() * Math.PI * 2;
        this.exhaustFlameOuter.rotation.z = rotFlicker;
        this.exhaustFlameInner.rotation.z = rotFlicker + 0.5;
        this.exhaustFlameCore.rotation.z = rotFlicker + 1.0;
      } else {
        this.exhaustFlameOuter.visible = false;
        this.exhaustFlameInner.visible = false;
        this.exhaustFlameCore.visible = false;

        if (this.exhaustFlashLight && this.exhaustFlashLight.intensity > 0) {
          this.exhaustFlashLight.intensity = Math.max(0, this.exhaustFlashLight.intensity - delta * 30);
        }
      }
    }
  }

  public triggerExhaustPop(): void {
    this.exhaustPopTimer = 0.12 + Math.random() * 0.05;
  }

  public getExhaustTipWorldPosition(): THREE.Vector3 {
    if (this.exhaustMufflerGroup) {
      const v = new THREE.Vector3();
      this.exhaustMufflerGroup.getWorldPosition(v);
      v.z -= 0.38;
      return v;
    }
    const pos = this.mesh.position.clone();
    pos.z -= 2.1;
    pos.y += 0.22;
    return pos;
  }
}
