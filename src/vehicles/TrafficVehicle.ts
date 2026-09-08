// Traffic Vehicle class with AI, lane keeping, overtaking, turn signals, and object pooling

import * as THREE from 'three';
import { Vehicle, type VehicleDimensions } from './Vehicle';
import { laneSystem } from '../road/LaneSystem';
import type { NPCTemplate } from '../traffic/NPCPackManager';
import { gameState } from '../core/GameState';
import type { PlayerVehicle } from './PlayerVehicle';
import { audioManager } from '../audio/AudioManager';

export type TrafficType = 'sedan' | 'suv' | 'truck' | 'compact' | 'taxi' | 'minibus' | 'courier' | 'bus' | 'ambulance';
export type DriverPersonality = 'aggressive' | 'standard' | 'cautious' | 'heavy';

const TRAFFIC_PRESETS: Record<TrafficType, { dimensions: VehicleDimensions; defaultSpeedRange: [number, number] }> = {
  taxi: {
    dimensions: { length: 4.25, width: 1.82, height: 1.34, wheelBase: 2.6, wheelTrack: 1.62, wheelRadius: 0.38 },
    defaultSpeedRange: [85, 120], // Istanbul taxi drivers drive fast and assertive!
  },
  minibus: {
    dimensions: { length: 5.2, width: 2.1, height: 1.95, wheelBase: 3.2, wheelTrack: 1.75, wheelRadius: 0.42 },
    defaultSpeedRange: [70, 100], // Kadıköy-Kartal / Gebze-Harem dolmuş
  },
  courier: {
    dimensions: { length: 2.4, width: 1.2, height: 1.35, wheelBase: 1.6, wheelTrack: 1.1, wheelRadius: 0.28 },
    defaultSpeedRange: [75, 110], // Nimble Istanbul motokurye
  },
  bus: {
    dimensions: { length: 9.6, width: 2.45, height: 2.7, wheelBase: 5.8, wheelTrack: 2.1, wheelRadius: 0.54 },
    defaultSpeedRange: [55, 80], // İETT / Metrobüs
  },
  compact: {
    dimensions: { length: 3.6, width: 1.75, height: 1.3, wheelBase: 2.3, wheelTrack: 1.5, wheelRadius: 0.34 },
    defaultSpeedRange: [65, 95],
  },
  sedan: {
    dimensions: { length: 4.3, width: 1.85, height: 1.35, wheelBase: 2.6, wheelTrack: 1.65, wheelRadius: 0.38 },
    defaultSpeedRange: [75, 110],
  },
  suv: {
    dimensions: { length: 4.7, width: 2.0, height: 1.65, wheelBase: 2.8, wheelTrack: 1.8, wheelRadius: 0.44 },
    defaultSpeedRange: [65, 95],
  },
  truck: {
    dimensions: { length: 7.2, width: 2.3, height: 2.6, wheelBase: 4.8, wheelTrack: 2.1, wheelRadius: 0.52 },
    defaultSpeedRange: [50, 75],
  },
  ambulance: {
    dimensions: { length: 5.4, width: 2.2, height: 2.5, wheelBase: 3.4, wheelTrack: 1.8, wheelRadius: 0.44 },
    defaultSpeedRange: [90, 125],
  },
};

const TRAFFIC_COLORS = [
  '#f4f1de', '#e07a5f', '#3d405b', '#81b29a', '#f2cc8f',
  '#ced4da', '#495057', '#0077b6', '#023e8a', '#d00000',
  '#ffba08', '#3f37c9', '#4895ef', '#588157', '#344e41'
];

export class TrafficVehicle extends Vehicle {
  public isActive = false;
  public laneIndex = 0;
  public targetLaneIndex = 0;
  public speedKmh = 0;
  public desiredSpeedKmh = 0;
  public speedMps = 0;
  public nearMissChecked = false;
  public overtakenChecked = false;
  public trafficType: TrafficType;
  public isOppositeDirection = false;
  public npcTemplate: NPCTemplate | null = null;

  // AI & Lane Changing state
  public personality: DriverPersonality = 'standard';
  public isChangingLane = false;
  public laneChangeProgress = 0;
  public laneChangeDuration = 1.8;
  public laneChangeCooldown = 0;
  public playerDemandCooldown = 0;
  public turnSignal: 'none' | 'left' | 'right' = 'none';
  public turnSignalTimer = 0;
  public preSignalTimer = 0;
  private prevBlinkOn = false;

  // Oncoming Head-on Proximity Horn & Flash state
  public hasHonkedAtPlayer = false;
  private oncomingFlashTimer = 0;

  // Amber turn signal indicator meshes
  private turnSignalMeshes: {
    fl: THREE.Mesh;
    fr: THREE.Mesh;
    rl: THREE.Mesh;
    rr: THREE.Mesh;
  } | null = null;
  private static turnSignalMaterial: THREE.MeshBasicMaterial;

  // Oncoming Bright Headlights & Light Projection
  private frontHeadlightsGroup: THREE.Group = new THREE.Group();
  private leftHeadlightLens!: THREE.Mesh;
  private rightHeadlightLens!: THREE.Mesh;
  private leftHeadlightFlare!: THREE.Mesh;
  private rightHeadlightFlare!: THREE.Mesh;
  private headlightGroundPool!: THREE.Mesh;
  private static headlightLensMaterial: THREE.MeshBasicMaterial;
  private static headlightFlareMaterial: THREE.MeshBasicMaterial;
  private static headlightGroundMaterial: THREE.MeshBasicMaterial;

  constructor(id: string, type: TrafficType = 'taxi') {
    const preset = TRAFFIC_PRESETS[type] || TRAFFIC_PRESETS.sedan;
    const initialColor = type === 'taxi' ? '#ffc300' : (type === 'minibus' ? '#118ab2' : TRAFFIC_COLORS[0]);
    super(id, type, preset.dimensions, initialColor);

    this.trafficType = type;
    this.mesh.visible = false;

    // Traffic NPCs do not use extra wheels
    this.wheelsGroup.visible = false;
    while (this.wheelsGroup.children.length > 0) {
      this.wheelsGroup.remove(this.wheelsGroup.children[0]);
    }
    this.wheelMeshes = [];
    this.frontWheels = [];
    this.rearWheels = [];

    this.initHeadlights();
    this.initTurnSignals();
  }

  private initHeadlights(): void {
    if (!TrafficVehicle.headlightLensMaterial) {
      TrafficVehicle.headlightLensMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    if (!TrafficVehicle.headlightFlareMaterial) {
      let flareTex: THREE.CanvasTexture | null = null;
      if (typeof document !== 'undefined') {
        const fc = document.createElement('canvas');
        fc.width = 128;
        fc.height = 128;
        const fctx = fc.getContext('2d');
        if (fctx) {
          const grad = fctx.createRadialGradient(64, 64, 0, 64, 64, 64);
          grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
          grad.addColorStop(0.2, 'rgba(224, 242, 254, 0.85)');
          grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.35)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          fctx.fillStyle = grad;
          fctx.fillRect(0, 0, 128, 128);
        }
        flareTex = new THREE.CanvasTexture(fc);
      }
      TrafficVehicle.headlightFlareMaterial = new THREE.MeshBasicMaterial({
        map: flareTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    }

    if (!TrafficVehicle.headlightGroundMaterial) {
      let poolTex: THREE.CanvasTexture | null = null;
      if (typeof document !== 'undefined') {
        const pc = document.createElement('canvas');
        pc.width = 128;
        pc.height = 256;
        const pctx = pc.getContext('2d');
        if (pctx) {
          const grad = pctx.createRadialGradient(64, 30, 0, 64, 120, 120);
          grad.addColorStop(0, 'rgba(255, 255, 235, 0.55)');
          grad.addColorStop(0.4, 'rgba(224, 242, 254, 0.25)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          pctx.fillStyle = grad;
          pctx.fillRect(0, 0, 128, 256);
        }
        poolTex = new THREE.CanvasTexture(pc);
      }
      TrafficVehicle.headlightGroundMaterial = new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    }

    const lensGeo = new THREE.BoxGeometry(0.22, 0.12, 0.08);
    this.leftHeadlightLens = new THREE.Mesh(lensGeo, TrafficVehicle.headlightLensMaterial);
    this.rightHeadlightLens = new THREE.Mesh(lensGeo, TrafficVehicle.headlightLensMaterial);

    const flareGeo = new THREE.PlaneGeometry(0.95, 0.95);
    this.leftHeadlightFlare = new THREE.Mesh(flareGeo, TrafficVehicle.headlightFlareMaterial);
    this.rightHeadlightFlare = new THREE.Mesh(flareGeo, TrafficVehicle.headlightFlareMaterial);

    const poolGeo = new THREE.PlaneGeometry(2.4, 8.0);
    this.headlightGroundPool = new THREE.Mesh(poolGeo, TrafficVehicle.headlightGroundMaterial);
    this.headlightGroundPool.rotation.x = -Math.PI / 2;

    this.frontHeadlightsGroup.add(this.leftHeadlightLens);
    this.frontHeadlightsGroup.add(this.rightHeadlightLens);
    this.frontHeadlightsGroup.add(this.leftHeadlightFlare);
    this.frontHeadlightsGroup.add(this.rightHeadlightFlare);
    this.frontHeadlightsGroup.add(this.headlightGroundPool);

    this.frontHeadlightsGroup.visible = false;
    this.mesh.add(this.frontHeadlightsGroup);
    this.updateHeadlightPositions();
  }

  private updateHeadlightPositions(): void {
    if (!this.leftHeadlightLens || !this.rightHeadlightLens) return;
    const halfW = this.dimensions.width * 0.38;
    const halfL = this.dimensions.length * 0.50;
    const lightY = this.dimensions.height * 0.38;

    this.leftHeadlightLens.position.set(-halfW, lightY, halfL);
    this.rightHeadlightLens.position.set(halfW, lightY, halfL);

    this.leftHeadlightFlare.position.set(-halfW, lightY, halfL + 0.12);
    this.rightHeadlightFlare.position.set(halfW, lightY, halfL + 0.12);

    this.headlightGroundPool.position.set(0, 0.03, halfL + 4.5);
  }

  private initTurnSignals(): void {
    if (!TrafficVehicle.turnSignalMaterial) {
      TrafficVehicle.turnSignalMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    }
    const geo = new THREE.BoxGeometry(0.12, 0.08, 0.1);
    const fl = new THREE.Mesh(geo, TrafficVehicle.turnSignalMaterial);
    const fr = new THREE.Mesh(geo, TrafficVehicle.turnSignalMaterial);
    const rl = new THREE.Mesh(geo, TrafficVehicle.turnSignalMaterial);
    const rr = new THREE.Mesh(geo, TrafficVehicle.turnSignalMaterial);

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

  private updateTurnSignalPositions(): void {
    if (!this.turnSignalMeshes) return;
    const halfW = this.dimensions.width * 0.48;
    const halfL = this.dimensions.length * 0.48;
    const frontY = this.dimensions.height * 0.38;
    const rearY = this.dimensions.height * 0.42;

    this.turnSignalMeshes.fl.position.set(-halfW, frontY, halfL);
    this.turnSignalMeshes.fr.position.set(halfW, frontY, halfL);
    this.turnSignalMeshes.rl.position.set(-halfW, rearY, -halfL);
    this.turnSignalMeshes.rr.position.set(halfW, rearY, -halfL);
    this.updateHeadlightPositions();
  }

  public applyNPCTemplate(template: NPCTemplate): void {
    const isDifferent = !this.npcTemplate || this.npcTemplate.id !== template.id;
    this.npcTemplate = template;
    this.proceduralGroup.visible = false;
    this.wheelsGroup.visible = false;

    if (isDifferent || this.customModelGroup.children.length === 0) {
      while (this.customModelGroup.children.length > 0) {
        this.customModelGroup.remove(this.customModelGroup.children[0]);
      }

      const instance = template.model.clone(true);
      this.customModelGroup.add(instance);
    }

    this.customModelGroup.visible = true;
    this.isUsingCustomModel = true;

    this.dimensions.length = template.dimensions.length;
    this.dimensions.width = template.dimensions.width;
    this.dimensions.height = template.dimensions.height;

    if (this.shadowPlane) {
      this.shadowPlane.scale.set(template.dimensions.width / 1.9, template.dimensions.length / 4.2, 1);
    }

    if (this.headlightBeams.length >= 2) {
      const halfW = template.dimensions.width * 0.35;
      const halfL = template.dimensions.length * 0.5;
      this.headlightBeams[0].position.set(-halfW, 0.04, halfL);
      this.headlightBeams[1].position.set(halfW, 0.04, halfL);
    }
    if (this.brakeLightGlow) {
      this.brakeLightGlow.position.set(0, 0.04, -template.dimensions.length * 0.5);
    }

    this.updateBoundingBox();
    this.updateTurnSignalPositions();
  }

  public spawn(
    laneIndex: number,
    z: number,
    speedKmh: number,
    type?: TrafficType,
    isOpposite = false,
    template?: NPCTemplate | null
  ): void {
    this.isActive = true;
    this.mesh.visible = true;
    this.wheelsGroup.visible = false;
    this.laneIndex = laneIndex;
    this.targetLaneIndex = laneIndex;
    this.isChangingLane = false;
    this.laneChangeProgress = 0;
    this.laneChangeCooldown = 0.8 + Math.random() * 1.5;
    this.playerDemandCooldown = 1.0 + Math.random() * 2.0;
    this.turnSignal = 'none';
    this.turnSignalTimer = 0;
    this.preSignalTimer = 0;

    this.desiredSpeedKmh = speedKmh;
    this.speedKmh = speedKmh;
    this.speedMps = speedKmh / 3.6;
    this.nearMissChecked = false;
    this.overtakenChecked = false;
    this.isOppositeDirection = isOpposite;
    this.hasHonkedAtPlayer = false;
    this.oncomingFlashTimer = 0;

    if (template) {
      this.applyNPCTemplate(template);
      this.trafficType = template.category as TrafficType;
    } else if (type && type !== this.trafficType) {
      this.trafficType = type;
      if (this.trafficType === 'taxi') {
        this.setColor('#ffc300');
      } else if (this.trafficType === 'minibus') {
        this.setColor('#00b4d8');
      } else if (this.trafficType === 'courier') {
        this.setColor('#e63946');
      } else if (this.trafficType === 'bus') {
        this.setColor(Math.random() > 0.5 ? '#fca311' : '#0077b6');
      } else {
        const randomColor = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
        this.setColor(randomColor);
      }
      this.updateTurnSignalPositions();
    } else {
      this.updateTurnSignalPositions();
    }

    // Determine driver personality
    const cat = this.npcTemplate?.category || this.trafficType;
    if (cat === 'taxi' || cat === 'minibus' || cat === 'courier') {
      this.personality = Math.random() < 0.85 ? 'aggressive' : 'standard';
    } else if (cat === 'truck' || cat === 'bus') {
      this.personality = 'heavy';
    } else if (cat === 'ambulance') {
      this.personality = 'aggressive';
    } else {
      const roll = Math.random();
      if (roll < 0.50) this.personality = 'standard';
      else if (roll < 0.80) this.personality = 'cautious';
      else this.personality = 'aggressive';
    }

    const laneX = laneSystem.getLaneX(laneIndex);
    this.mesh.position.set(laneX, 0, z);
    this.mesh.rotation.set(0, isOpposite ? Math.PI : 0, 0);

    // Oncoming traffic turns on intense front headlights facing the player!
    this.frontHeadlightsGroup.visible = isOpposite;
    this.updateHeadlightPositions();

    this.updateBoundingBox();
  }

  public deactivate(): void {
    this.isActive = false;
    this.mesh.visible = false;
    this.mesh.position.set(0, -100, 0);
    this.isChangingLane = false;
    this.turnSignal = 'none';
    this.prevBlinkOn = false;
    this.hasHonkedAtPlayer = false;
    this.oncomingFlashTimer = 0;

    if (this.frontHeadlightsGroup) {
      this.frontHeadlightsGroup.visible = false;
    }

    if (this.turnSignalMeshes) {
      this.turnSignalMeshes.fl.visible = false;
      this.turnSignalMeshes.fr.visible = false;
      this.turnSignalMeshes.rl.visible = false;
      this.turnSignalMeshes.rr.visible = false;
    }
  }

  public update(
    delta: number,
    allTraffic: TrafficVehicle[],
    player?: PlayerVehicle | null,
    didHonk = false,
    didFlash = false
  ): void {
    if (!this.isActive) return;

    // 1. Ambulance flashing strobe lights animation
    if (this.npcTemplate?.category === 'ambulance') {
      const siren = this.customModelGroup.getObjectByName('AmbulanceSiren');
      if (siren && siren.children.length >= 2) {
        const flash = (performance.now() % 360) > 180;
        siren.children[0].visible = flash;
        siren.children[1].visible = !flash;
      }
    }

    // 2. Cooldown timers
    if (this.laneChangeCooldown > 0) {
      this.laneChangeCooldown -= delta;
    }
    if (this.playerDemandCooldown > 0) {
      this.playerDemandCooldown -= delta;
    }

    // 3. Response to Player Horn (Korna) or Selektör (High-Beam Flashing)
    if (!this.isOppositeDirection && player && (didHonk || didFlash)) {
      if (this.playerDemandCooldown <= 0) {
        const distAhead = this.mesh.position.z - player.mesh.position.z;
        // Is this vehicle in front of player within audible/visible distance (3m to 90m)?
        if (distAhead > 3 && distAhead < 90) {
          const playerLane = laneSystem.getClosestLane(player.mesh.position.x);
          const lateralDist = Math.abs(this.mesh.position.x - player.mesh.position.x);
          const isDirectlyInFront = this.laneIndex === playerLane || lateralDist < 2.6;
          const isLeftFastLane = this.laneIndex === 0;

          if (isDirectlyInFront || isLeftFastLane) {
            this.handlePlayerDemand(allTraffic, player);
          }
        }
      }
    }

    // 3b. Karşı Yönden Gelindiğinde Korna Çalma & Selektör (Oncoming Panic Horn & High-Beam Warning)
    if (this.isOppositeDirection && player) {
      if (!this.hasHonkedAtPlayer) {
        const distZ = this.mesh.position.z - player.mesh.position.z;
        const lateralDist = Math.abs(this.mesh.position.x - player.mesh.position.x);

        // Araba karşı yönden (ters şeritten) yaklaştığımızda ya da tehlikeli derecede yakın olduğumuzda
        // 1) Oyuncu karşı yönde (ters şerit, x > -0.6) ve çarpışma tehdidi oluşturacak yakınlıkta (lateralDist < 4.2m)
        // 2) Ya da şerit fark etmeksizin burun buruna aşırı yakın (< 2.6m)
        const isOncomingSide = player.mesh.position.x > -0.6;
        const isDangerouslyClose = lateralDist < 2.6;
        const isHeadOnThreat = (isOncomingSide && lateralDist < 4.2) || isDangerouslyClose;

        if (distZ > 3 && distZ < 55 && isHeadOnThreat) {
          this.hasHonkedAtPlayer = true;
          this.oncomingFlashTimer = 0.70; // 700ms hızlı selektör
          const pan = Math.max(-1, Math.min(1, (this.mesh.position.x - player.mesh.position.x) / 6));
          const isHeavy = this.trafficType === 'truck' || this.trafficType === 'bus' ||
                          this.npcTemplate?.category === 'truck' || this.npcTemplate?.category === 'bus';
          audioManager.playOncomingWarningHorn(pan, isHeavy);

          // Karşıdaki araç panikle hafif fren yapsın
          this.speedKmh = Math.max(25, this.speedKmh - 12);
          this.setBraking(true);
        }
      }

      // Selektör / far yanıp sönme efekti
      if (this.oncomingFlashTimer > 0) {
        this.oncomingFlashTimer -= delta;
        const flashPhase = (Math.floor(this.oncomingFlashTimer * 16) % 2) === 0;
        if (this.frontHeadlightsGroup) {
          this.frontHeadlightsGroup.visible = flashPhase;
        }
      } else if (this.frontHeadlightsGroup && !this.frontHeadlightsGroup.visible) {
        this.frontHeadlightsGroup.visible = true;
      }
    }

    // 4. Scan traffic ahead (detecting cars in our path by lane AND actual continuous physical X position)
    let minGap = Infinity;
    let vehicleAhead: TrafficVehicle | null = null;
    let isAmbulanceBehind = false;

    const currentObservedLane = this.isChangingLane ? this.targetLaneIndex : this.laneIndex;

    for (let i = 0; i < allTraffic.length; i++) {
      const other = allTraffic[i];
      if (other === this || !other.isActive) continue;

      if (other.isOppositeDirection === this.isOppositeDirection) {
        const latDist = Math.abs(other.mesh.position.x - this.mesh.position.x);
        // Is other car in our lane OR physically in our lateral trajectory?
        const isPathConflict = other.laneIndex === currentObservedLane || latDist < 2.3;

        if (isPathConflict) {
          const gap = this.isOppositeDirection
            ? this.mesh.position.z - other.mesh.position.z
            : other.mesh.position.z - this.mesh.position.z;

          if (gap > 0 && gap < minGap) {
            minGap = gap;
            vehicleAhead = other;
          }

          // Check if an emergency vehicle is rushing behind us in our lane
          if (gap < 0 && -gap < 45 && other.npcTemplate?.category === 'ambulance') {
            isAmbulanceBehind = true;
          }
        }
      }
    }

    // 5. Progressive speed adaptation & brake light control
    const safeFollowDist = this.personality === 'cautious' ? 24 : (this.personality === 'aggressive' ? 14 : 18);

    if (minGap < safeFollowDist) {
      const targetSpeed = vehicleAhead ? Math.min(this.speedKmh, vehicleAhead.speedKmh) : 35;
      const decel = Math.max(20, (this.speedKmh - targetSpeed) * 3.5 + (safeFollowDist - minGap) * 5.0);
      this.speedKmh = Math.max(18, this.speedKmh - decel * delta);
      this.setBraking(true);

      // Prevent clipping into front car before physical touch
      if (vehicleAhead && minGap < 4.2) {
        this.speedKmh = Math.min(this.speedKmh, Math.max(15, vehicleAhead.speedKmh - 5));
      }
    } else {
      this.setBraking(false);
      // Accelerate back up to cruising speed!
      if (this.speedKmh < this.desiredSpeedKmh) {
        const accelRate = this.personality === 'aggressive' ? 24 : 14;
        this.speedKmh = Math.min(this.desiredSpeedKmh, this.speedKmh + accelRate * delta);
      }
    }

    // 6. Intelligent Lane Change & Overtaking AI
    if (!this.isChangingLane && this.laneChangeCooldown <= 0) {
      this.evaluateLaneChange(minGap, vehicleAhead, isAmbulanceBehind, allTraffic, player);
    }

    // 7. Handle Lateral Lane Change Movement & Steering
    this.updateLaneChangeMotion(delta);

    // 8. Update Turn Signal Blinkers
    this.updateTurnSignalBlink(delta, player);

    this.speedMps = this.speedKmh / 3.6;

    // Drive forward along heading (+Z for normal, -Z for oncoming)
    if (this.isOppositeDirection) {
      this.mesh.position.z -= this.speedMps * delta;
    } else {
      this.mesh.position.z += this.speedMps * delta;
    }

    // Update collision bounds
    this.updateBoundingBox();
  }

  private evaluateLaneChange(
    gapAhead: number,
    vehicleAhead: TrafficVehicle | null,
    isAmbulanceBehind: boolean,
    allTraffic: TrafficVehicle[],
    player?: PlayerVehicle | null
  ): void {
    const isCustom = gameState.currentMode === 'CUSTOM_TRAFFIC';
    const tSettings = gameState.trafficSettings;
    const laneChangePreset = isCustom ? tSettings.laneChangePreset : 'balanced';

    // If 'none', vehicles stay strictly in their assigned lanes
    if (laneChangePreset === 'none') return;

    const isTwoWay = gameState.currentMode === 'TWO_WAY' || (isCustom && tSettings.direction === 'TWO_WAY');
    const currentLane = this.laneIndex;

    // Crazy Istanbul Taxi Mode: frequent spontaneous cuts
    if (laneChangePreset === 'crazy' && Math.random() < 0.18) {
      const candidates = this.getCandidateLanes(currentLane, isTwoWay);
      for (const target of candidates) {
        if (this.isLaneSafe(target, allTraffic, player)) {
          this.laneChangeDuration = 1.1;
          this.initiateLaneChange(target);
          return;
        }
      }
    }

    // Condition 1: Emergency vehicle behind -> must clear lane!
    if (isAmbulanceBehind) {
      const candidates = this.getCandidateLanes(currentLane, isTwoWay);
      for (const target of candidates) {
        if (this.isLaneSafe(target, allTraffic, player)) {
          this.initiateLaneChange(target);
          return;
        }
      }
    }

    // Condition 2: Fast lane yielding to player (sol şerit boşaltma)
    const isFastLane = isTwoWay ? currentLane === 1 : currentLane === 0;
    if (!this.isOppositeDirection && isFastLane && player) {
      const playerDistBehind = this.mesh.position.z - player.mesh.position.z;
      const isPlayerRushingBehind = playerDistBehind > 0 && playerDistBehind < 75 && player.speedKmh > this.speedKmh + 8;

      if (isPlayerRushingBehind) {
        const yieldLane = this.findBestYieldLane(allTraffic);
        if (yieldLane !== null && yieldLane !== this.laneIndex) {
          this.initiateEmergencyYield(yieldLane, player);
          return;
        }
      }
    }

    // Condition 3: Highway lane discipline (don't hog fast lane forever)
    if (!this.isOppositeDirection && isFastLane && !player) {
      if (Math.random() < 0.08) {
        const targetSlowLane = isTwoWay ? 0 : 1;
        if (this.isLaneSafe(targetSlowLane, allTraffic, player)) {
          this.initiateLaneChange(targetSlowLane);
          return;
        }
      }
    }

    // Condition 4: Overtaking slower traffic ahead
    const overtakeThreshold = this.personality === 'aggressive' ? 36 : (this.personality === 'standard' ? 28 : 22);
    const speedThreshold = this.personality === 'aggressive' ? 2 : 5;

    if (vehicleAhead && gapAhead < overtakeThreshold && this.desiredSpeedKmh > vehicleAhead.speedKmh + speedThreshold) {
      if (this.personality === 'heavy' && Math.random() < 0.6) return;

      const candidates = this.getCandidateLanes(currentLane, isTwoWay);
      for (const target of candidates) {
        if (this.isLaneSafe(target, allTraffic, player)) {
          this.initiateLaneChange(target);
          return;
        }
      }
    }
  }

  private findBestYieldLane(allTraffic: TrafficVehicle[]): number | null {
    const isTwoWay = gameState.currentMode === 'TWO_WAY' || (gameState.currentMode === 'CUSTOM_TRAFFIC' && gameState.trafficSettings.direction === 'TWO_WAY');
    const current = this.isChangingLane ? this.targetLaneIndex : this.laneIndex;
    let candidates: number[] = [];

    if (isTwoWay) {
      if (!this.isOppositeDirection) {
        // Forward traffic (Lanes 0 & 1): Lane 1 (fast inner) yields right into Lane 0 (slow outer)
        if (current === 1) candidates = [0];
        else if (current === 0) candidates = [1];
      } else {
        // Oncoming traffic (Lanes 2 & 3): Lane 2 (fast inner) yields into Lane 3 (slow outer)
        if (current === 2) candidates = [3];
        else if (current === 3) candidates = [2];
      }
    } else {
      // 4-lane one-way highway: prefer moving right (towards slower lanes)
      if (current === 0) candidates = [1];
      else if (current === 1) candidates = [2, 0];
      else if (current === 2) candidates = [3, 1];
      else if (current === 3) candidates = [2];
    }

    for (const target of candidates) {
      const isOccupied = allTraffic.some((other) => {
        if (other === this || !other.isActive || other.isOppositeDirection !== this.isOppositeDirection) return false;
        const oLane = other.isChangingLane ? other.targetLaneIndex : other.laneIndex;
        if (oLane !== target) return false;
        return Math.abs(other.mesh.position.z - this.mesh.position.z) < 7.5;
      });

      if (!isOccupied) {
        return target;
      }
    }

    return null;
  }

  private handlePlayerDemand(allTraffic: TrafficVehicle[], player: PlayerVehicle): void {
    // 1. Set cooldown so vehicle doesn't react repeatedly without interval
    this.playerDemandCooldown = 4.0 + Math.random() * 3.5;

    // 2. Personality & Settings based reaction:
    const isCustom = gameState.currentMode === 'CUSTOM_TRAFFIC';
    const yieldPreset = isCustom ? gameState.trafficSettings.yieldPreset : 'normal';

    let willYield = false;
    let willSpeedUp = false;

    if (yieldPreset === 'stubborn') {
      willYield = false;
      willSpeedUp = Math.random() < 0.85;
    } else if (yieldPreset === 'polite') {
      willYield = true;
      willSpeedUp = false;
    } else if (this.personality === 'aggressive') {
      // Aggressive drivers (taxis/dolmuş): 65% refuse & accelerate aggressively, 35% yield
      if (Math.random() < 0.65) {
        willSpeedUp = true;
      } else {
        willYield = true;
      }
    } else if (this.personality === 'heavy') {
      // Heavy vehicles: 50% yield if room, 50% stay/ignore
      if (Math.random() < 0.50) {
        willYield = true;
      }
    } else if (this.personality === 'cautious') {
      // Cautious drivers: 75% yield, 15% speed up, 10% stay
      const r = Math.random();
      if (r < 0.75) willYield = true;
      else if (r < 0.90) willSpeedUp = true;
    } else {
      // Standard drivers: 55% yield, 30% speed up, 15% stay
      const r = Math.random();
      if (r < 0.55) willYield = true;
      else if (r < 0.85) willSpeedUp = true;
    }

    if (willYield) {
      const yieldLane = this.findBestYieldLane(allTraffic);
      if (yieldLane !== null && yieldLane !== this.laneIndex) {
        this.initiateEmergencyYield(yieldLane, player);
        return;
      } else {
        // Yield lane is occupied, fallback to accelerating!
        willSpeedUp = true;
      }
    }

    if (willSpeedUp) {
      // "bazen de yol vermesin hızlansın" -> Steps on the gas and pulls away!
      const speedBoost = 22 + Math.random() * 18;
      this.speedKmh = Math.max(this.speedKmh + speedBoost, player.speedKmh + 10);
      this.desiredSpeedKmh = Math.max(this.desiredSpeedKmh, this.speedKmh);
      this.setBraking(false);

      // Aggressive NPC honks horn back in protest!
      if (Math.random() < 0.45) {
        const pan = Math.max(-1, Math.min(1, (this.mesh.position.x - player.mesh.position.x) / 10));
        audioManager.playNpcHorn(pan, 0.28);
      }
    }
  }

  public onBumperTouched(rearSpeedKmh: number): void {
    // "biri birine deydiğinde hızlansın" -> When touched from behind, accelerate away!
    const boost = 22 + Math.random() * 16;
    this.speedKmh = Math.max(this.speedKmh + boost, rearSpeedKmh + 14);
    this.desiredSpeedKmh = Math.max(this.desiredSpeedKmh, this.speedKmh);
    this.setBraking(false);
  }

  public onFrontBumped(frontSpeedKmh: number): void {
    // The vehicle that bumped into the car ahead slows down
    this.speedKmh = Math.min(this.speedKmh, Math.max(15, frontSpeedKmh - 6));
    this.setBraking(true);
  }

  public cancelLaneChange(): void {
    if (this.isChangingLane) {
      this.isChangingLane = false;
      this.targetLaneIndex = this.laneIndex;
      this.turnSignal = 'none';
      this.laneChangeCooldown = 1.8;
    }
  }

  private initiateEmergencyYield(targetLane: number, player: PlayerVehicle): void {
    this.isChangingLane = true;
    this.targetLaneIndex = targetLane;
    this.laneChangeProgress = 0;
    this.turnSignal = targetLane < this.laneIndex ? 'left' : 'right';
    this.preSignalTimer = 0.08; // 80ms: reacts with lightning speed to horn/flash!
    this.laneChangeDuration = 0.85; // Swift lane change to clear the path
    this.laneChangeCooldown = 1.2;

    // Keep pace up so player doesn't crash into our rear during the maneuver
    const minPace = player.speedKmh * 0.78 + 12;
    if (this.speedKmh < minPace) {
      this.speedKmh = Math.min(this.desiredSpeedKmh + 25, minPace);
    }
  }

  private getCandidateLanes(currentLane: number, isTwoWay: boolean): number[] {
    const candidates: number[] = [];

    if (isTwoWay) {
      if (!this.isOppositeDirection) {
        // Forward lanes (Right side): 1 (inner/fast) and 0 (outer/slow)
        if (currentLane === 1) candidates.push(0);
        else if (currentLane === 0) candidates.push(1);
      } else {
        // Oncoming lanes (Left side): 2 (inner/fast) and 3 (outer/slow)
        if (currentLane === 2) candidates.push(3);
        else if (currentLane === 3) candidates.push(2);
      }
    } else {
      if (currentLane === 0) {
        candidates.push(1);
      } else if (currentLane === 1) {
        candidates.push(0, 2); // Prefer left for overtaking, then right
      } else if (currentLane === 2) {
        candidates.push(1, 3);
      } else if (currentLane === 3) {
        candidates.push(2);
      }
    }

    return candidates;
  }

  private isLaneSafe(
    targetLane: number,
    allTraffic: TrafficVehicle[],
    player?: PlayerVehicle | null
  ): boolean {
    const requiredGapAhead = this.personality === 'aggressive' ? 18 : 24;
    const requiredGapBehind = this.personality === 'aggressive' ? 14 : 20;

    for (let i = 0; i < allTraffic.length; i++) {
      const other = allTraffic[i];
      if (other === this || !other.isActive) continue;

      const otherLane = other.isChangingLane ? other.targetLaneIndex : other.laneIndex;
      if (otherLane === targetLane && other.isOppositeDirection === this.isOppositeDirection) {
        const gap = this.isOppositeDirection
          ? this.mesh.position.z - other.mesh.position.z
          : other.mesh.position.z - this.mesh.position.z;

        if (gap > 0 && gap < requiredGapAhead) {
          return false;
        }

        if (gap < 0 && -gap < requiredGapBehind) {
          return false;
        }

        if (gap < 0 && -gap < 30 && other.speedKmh > this.speedKmh + 18) {
          return false;
        }
      }
    }

    // Check player vehicle
    if (!this.isOppositeDirection && player) {
      const playerLaneX = laneSystem.getLaneX(targetLane);
      const isPlayerInTargetLane = Math.abs(player.mesh.position.x - playerLaneX) < 2.2;

      if (isPlayerInTargetLane) {
        const playerGap = player.mesh.position.z - this.mesh.position.z;

        if (playerGap > 0 && playerGap < 20) {
          return false;
        }

        if (playerGap < 0) {
          const distBehind = -playerGap;
          const playerRelativeSpeed = player.speedKmh - this.speedKmh;

          if (distBehind < 50 && playerRelativeSpeed > 15) {
            return false;
          }
          if (distBehind < 22) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private initiateLaneChange(targetLane: number): void {
    this.isChangingLane = true;
    this.targetLaneIndex = targetLane;
    this.laneChangeProgress = 0;

    if (this.personality === 'aggressive') {
      this.laneChangeDuration = 1.1 + Math.random() * 0.3;
      this.preSignalTimer = 0.45;
    } else if (this.personality === 'heavy') {
      this.laneChangeDuration = 2.4 + Math.random() * 0.4;
      this.preSignalTimer = 0.85;
    } else {
      this.laneChangeDuration = 1.6 + Math.random() * 0.4;
      this.preSignalTimer = 0.65;
    }

    this.turnSignal = targetLane < this.laneIndex ? 'left' : 'right';
  }

  private updateLaneChangeMotion(delta: number): void {
    const baseRotY = this.isOppositeDirection ? Math.PI : 0;

    if (this.isChangingLane) {
      if (this.preSignalTimer > 0) {
        this.preSignalTimer -= delta;
        const targetX = laneSystem.getLaneX(this.laneIndex);
        this.mesh.position.x += (targetX - this.mesh.position.x) * Math.min(1.0, delta * 8);
        this.mesh.rotation.y = baseRotY;
        this.mesh.rotation.z = 0;
        this.updateWheels(this.speedMps, 0, delta);
      } else {
        this.laneChangeProgress += delta / this.laneChangeDuration;
        const t = Math.min(1.0, this.laneChangeProgress);
        const smoothT = t * t * (3 - 2 * t);

        const startX = laneSystem.getLaneX(this.laneIndex);
        const targetX = laneSystem.getLaneX(this.targetLaneIndex);
        const currentX = THREE.MathUtils.lerp(startX, targetX, smoothT);
        this.mesh.position.x = currentX;

        // Wheel steering angle during maneuver
        const steerDir = Math.sign(targetX - startX);
        const steerMagnitude = Math.sin(t * Math.PI) * 0.25;
        const steerAngle = steerDir * steerMagnitude * (this.isOppositeDirection ? -1 : 1);

        // Body roll & yaw
        const yawOffset = steerDir * Math.sin(t * Math.PI) * 0.08 * (this.isOppositeDirection ? -1 : 1);
        const rollOffset = -steerDir * Math.sin(t * Math.PI) * 0.035;

        this.mesh.rotation.y = baseRotY + yawOffset;
        this.mesh.rotation.z = rollOffset;

        this.updateWheels(this.speedMps, steerAngle, delta);

        if (this.laneChangeProgress >= 1.0) {
          this.isChangingLane = false;
          this.laneIndex = this.targetLaneIndex;
          this.mesh.position.x = targetX;
          this.mesh.rotation.y = baseRotY;
          this.mesh.rotation.z = 0;
          this.turnSignal = 'none';
          this.laneChangeCooldown = 1.4 + Math.random() * 2.2;
        }
      }
    } else {
      const targetX = laneSystem.getLaneX(this.laneIndex);
      this.mesh.position.x += (targetX - this.mesh.position.x) * Math.min(1.0, delta * 6);
      this.mesh.rotation.y = baseRotY;
      this.mesh.rotation.z = 0;
      this.updateWheels(this.speedMps, 0, delta);
    }
  }

  private updateTurnSignalBlink(delta: number, player?: PlayerVehicle | null): void {
    if (!this.turnSignalMeshes) return;

    if (this.turnSignal !== 'none') {
      this.turnSignalTimer += delta;
      const isBlinkOn = (this.turnSignalTimer % 0.38) < 0.20;
      const isLeft = this.turnSignal === 'left';
      const actualLeft = this.isOppositeDirection ? !isLeft : isLeft;

      this.turnSignalMeshes.fl.visible = actualLeft && isBlinkOn;
      this.turnSignalMeshes.rl.visible = actualLeft && isBlinkOn;
      this.turnSignalMeshes.fr.visible = !actualLeft && isBlinkOn;
      this.turnSignalMeshes.rr.visible = !actualLeft && isBlinkOn;

      // Spatial turn signal click sound if near player
      if (isBlinkOn !== this.prevBlinkOn) {
        this.prevBlinkOn = isBlinkOn;
        if (player) {
          const dist = this.mesh.position.distanceTo(player.mesh.position);
          if (dist < 32) {
            const pan = Math.max(-1, Math.min(1, (this.mesh.position.x - player.mesh.position.x) / 10));
            const vol = Math.max(0.04, 0.26 * (1 - dist / 32));
            audioManager.playTurnSignalClick(isBlinkOn, vol, pan);
          }
        }
      }
    } else {
      this.turnSignalTimer = 0;
      this.prevBlinkOn = false;
      this.turnSignalMeshes.fl.visible = false;
      this.turnSignalMeshes.fr.visible = false;
      this.turnSignalMeshes.rl.visible = false;
      this.turnSignalMeshes.rr.visible = false;
    }
  }

  public override updateWheels(_speedMps: number, _steerAngle: number, _delta: number): void {
    // Traffic NPCs do not use extra wheels
  }
}

