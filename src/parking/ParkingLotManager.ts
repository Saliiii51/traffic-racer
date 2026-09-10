import * as THREE from 'three';
import { gameState } from '../core/GameState';
import { audioManager } from '../audio/AudioManager';
import { eventBus } from '../core/EventBus';

export interface ParkingLevelConfig {
  id: number;
  name: string;
  subtitle: string;
  type: 'dikey' | 'geri' | 'paralel' | 'l_park' | 'capraz';
  difficulty: number; // 1 to 5
  timeLimitSec: number;
  starTimes: [number, number, number]; // [3 stars, 2 stars, 1 star]
  cashReward: number;
  playerStart: { x: number; z: number; yaw: number };
  targetSlot: { x: number; z: number; yaw: number; width: number; length: number };
}

export const PARKING_LEVELS: ParkingLevelConfig[] = [
  {
    id: 1,
    name: 'AVM Açık Otoparkı',
    subtitle: 'Düz Giriş • Temel Park',
    type: 'dikey',
    difficulty: 1,
    timeLimitSec: 45,
    starTimes: [15, 25, 45],
    cashReward: 2500,
    playerStart: { x: 0, z: -18, yaw: 0 },
    targetSlot: { x: 0, z: 6, yaw: 0, width: 2.6, length: 5.2 },
  },
  {
    id: 2,
    name: 'Cevahir Kapalı Otopark',
    subtitle: 'Geri Geri Dikey Park',
    type: 'geri',
    difficulty: 2,
    timeLimitSec: 60,
    starTimes: [25, 40, 60],
    cashReward: 4000,
    playerStart: { x: -4.0, z: -12, yaw: 0.15 },
    targetSlot: { x: 4.2, z: 6, yaw: 0, width: 2.6, length: 5.2 },
  },
  {
    id: 3,
    name: 'Kadıköy Moda Sahili',
    subtitle: 'Kaldırım Kenarı Paralel Park',
    type: 'paralel',
    difficulty: 3,
    timeLimitSec: 70,
    starTimes: [30, 50, 70],
    cashReward: 6000,
    playerStart: { x: -2.0, z: -8, yaw: 0 },
    targetSlot: { x: 2.2, z: 6, yaw: 0, width: 2.4, length: 6.2 },
  },
  {
    id: 4,
    name: 'Sürücü Kursu Pisti',
    subtitle: 'Duba & Koni Arası L-Park',
    type: 'l_park',
    difficulty: 4,
    timeLimitSec: 75,
    starTimes: [35, 55, 75],
    cashReward: 8500,
    playerStart: { x: 0, z: -20, yaw: 0 },
    targetSlot: { x: 6.5, z: 2.0, yaw: -Math.PI / 2, width: 2.6, length: 5.4 },
  },
  {
    id: 5,
    name: 'Cihangir Dar Sokak',
    subtitle: 'Usta İşi Çapraz Park',
    type: 'capraz',
    difficulty: 5,
    timeLimitSec: 80,
    starTimes: [35, 60, 80],
    cashReward: 12000,
    playerStart: { x: -3.0, z: -16, yaw: 0 },
    targetSlot: { x: 2.8, z: 4.0, yaw: 0.52, width: 2.7, length: 5.6 },
  },
];

export class ParkingLotManager {
  public sceneGroup: THREE.Group = new THREE.Group();
  public obstacleBoxes: THREE.Box3[] = [];
  public currentLevel: ParkingLevelConfig = PARKING_LEVELS[0];

  // Target Slot Meshes
  private targetSlotMesh: THREE.Group = new THREE.Group();
  private targetGlowMesh: THREE.Mesh | null = null;
  private targetGlowMaterial: THREE.MeshBasicMaterial | null = null;
  private targetBorderMaterial: THREE.MeshBasicMaterial | null = null;

  // Collision cooldown
  private hitCooldown: number = 0;
  // Dwell timer inside slot
  private dwellTimer: number = 0;
  public isCompleted: boolean = false;
  public elapsedTime: number = 0;

  constructor() {
    this.sceneGroup.name = 'ParkingLotManager_Group';
  }

  public loadLevel(levelId: number): void {
    const config = PARKING_LEVELS.find((l) => l.id === levelId) || PARKING_LEVELS[0];
    this.currentLevel = config;
    this.isCompleted = false;
    this.elapsedTime = 0;
    this.dwellTimer = 0;
    this.hitCooldown = 0;
    gameState.parkingLevel = config.id;
    gameState.parkingDamageCount = 0;
    gameState.parkingAccuracy = 0;
    gameState.isParkedSuccessfully = false;
    gameState.parkingTimeElapsed = 0;

    // Clear previous props
    this.clearScene();
    this.buildLevelEnvironment(config);
  }

  private clearScene(): void {
    while (this.sceneGroup.children.length > 0) {
      const child = this.sceneGroup.children[0];
      this.sceneGroup.remove(child);
    }
    this.obstacleBoxes = [];
  }

  private buildLevelEnvironment(cfg: ParkingLevelConfig): void {
    // 1. Asphalt Ground
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: cfg.id === 2 ? 0x22262d : 0x2c3038,
      roughness: 0.85,
      metalness: 0.12,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.sceneGroup.add(ground);

    // 2. Build Target Parking Bay
    this.buildTargetSlot(cfg.targetSlot);

    // 3. Level-specific props (Parked Cars, Cones, Columns, Walls)
    if (cfg.id === 1) {
      this.buildLevel1Props();
    } else if (cfg.id === 2) {
      this.buildLevel2Props();
    } else if (cfg.id === 3) {
      this.buildLevel3Props();
    } else if (cfg.id === 4) {
      this.buildLevel4Props();
    } else if (cfg.id === 5) {
      this.buildLevel5Props();
    }

    // Boundary walls so player cannot drive into infinity
    this.buildOuterWalls();
  }

  private buildTargetSlot(slot: ParkingLevelConfig['targetSlot']): void {
    this.targetSlotMesh = new THREE.Group();
    this.targetSlotMesh.position.set(slot.x, 0.02, slot.z);
    this.targetSlotMesh.rotation.y = slot.yaw;

    // Glowing floor pad
    const padGeo = new THREE.PlaneGeometry(slot.width, slot.length);
    this.targetGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.targetGlowMesh = new THREE.Mesh(padGeo, this.targetGlowMaterial);
    this.targetGlowMesh.rotation.x = -Math.PI / 2;
    this.targetSlotMesh.add(this.targetGlowMesh);

    // Yellow / White line borders
    this.targetBorderMaterial = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const lineThickness = 0.12;

    // Left line
    const leftLine = new THREE.Mesh(
      new THREE.PlaneGeometry(lineThickness, slot.length),
      this.targetBorderMaterial
    );
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-slot.width / 2, 0.005, 0);
    this.targetSlotMesh.add(leftLine);

    // Right line
    const rightLine = new THREE.Mesh(
      new THREE.PlaneGeometry(lineThickness, slot.length),
      this.targetBorderMaterial
    );
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(slot.width / 2, 0.005, 0);
    this.targetSlotMesh.add(rightLine);

    // Back stop line
    const backLine = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.width, lineThickness),
      this.targetBorderMaterial
    );
    backLine.rotation.x = -Math.PI / 2;
    backLine.position.set(0, 0.005, slot.length / 2);
    this.targetSlotMesh.add(backLine);

    // Rubber / Concrete wheel stop curb at back
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width * 0.75, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
    );
    curb.position.set(0, 0.07, slot.length / 2 - 0.4);
    this.targetSlotMesh.add(curb);

    this.sceneGroup.add(this.targetSlotMesh);
  }

  // --- LEVEL 1: AVM Açık Otoparkı ---
  private buildLevel1Props(): void {
    // Left parked car (Sedan, silver)
    this.addParkedCar(-3.0, 6.0, 0, 0x94a3b8, 'sedan');
    // Right parked car (SUV, navy)
    this.addParkedCar(3.0, 6.0, 0, 0x1e3a8a, 'suv');

    // Additional parking rows across the lane
    this.addParkedCar(-6.0, 6.0, 0, 0xb91c1c, 'sedan');
    this.addParkedCar(6.0, 6.0, 0, 0x0f766e, 'coupe');

    // Opposite parked row (facing south)
    this.addParkedCar(-3.0, -8.0, Math.PI, 0x374151, 'sedan');
    this.addParkedCar(0, -8.0, Math.PI, 0xd97706, 'coupe');
    this.addParkedCar(3.0, -8.0, Math.PI, 0x475569, 'suv');

    // Concrete curb stop at the back of parking bays
    this.addObstacleBox(0, 0.4, 9.5, 24, 0.8, 0.6, 0x64748b);

    // Light poles
    this.addLightPole(-8.0, 9.0);
    this.addLightPole(8.0, 9.0);
  }

  // --- LEVEL 2: Cevahir Kapalı Otoparkı ---
  private buildLevel2Props(): void {
    // Ceiling slab
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.95 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.2;
    this.sceneGroup.add(ceiling);

    // Concrete pillars with yellow/black warning stripes
    this.addConcretePillar(1.8, 6.0);
    this.addConcretePillar(6.6, 6.0);
    this.addConcretePillar(1.8, -4.0);
    this.addConcretePillar(6.6, -4.0);
    this.addConcretePillar(-6.6, 6.0);
    this.addConcretePillar(-6.6, -4.0);

    // Parked car on the right of target slot
    this.addParkedCar(7.6, 6.0, 0, 0x1e293b, 'suv');
    // Parked car on the left
    this.addParkedCar(0.8, 6.0, 0, 0xd90429, 'sedan');

    // Rear wall behind slots
    this.addObstacleBox(4.2, 1.8, 9.5, 18, 3.6, 0.8, 0x475569);
  }

  // --- LEVEL 3: Kadıköy Moda Sahili Paralel Park ---
  private buildLevel3Props(): void {
    // Sidewalk curb along right side (x = 3.6)
    this.addObstacleBox(4.4, 0.25, 6.0, 1.6, 0.4, 35, 0x94a3b8);

    // Seaside railing
    this.addObstacleBox(5.3, 0.9, 6.0, 0.2, 1.1, 35, 0x1d3557);

    // Front parked car
    this.addParkedCar(2.2, 13.5, 0, 0x0284c7, 'sedan');
    // Rear parked car
    this.addParkedCar(2.2, -1.8, 0, 0x334155, 'suv');

    // Left road barrier
    this.addObstacleBox(-5.0, 0.4, 6.0, 0.6, 0.8, 35, 0x64748b);
  }

  // --- LEVEL 4: Sürücü Kursu L-Park & Dubalar ---
  private buildLevel4Props(): void {
    // Main driving corridor boundaries (traffic cones)
    // Left boundary
    for (let z = -20; z <= 8; z += 2.0) {
      if (z >= -1 && z <= 5) continue; // gap for side box
      this.addTrafficCone(2.0, z);
    }
    for (let z = -20; z <= 8; z += 2.0) {
      this.addTrafficCone(-2.5, z);
    }

    // Side L-box boundaries (target is at x = 6.5, z = 2.0)
    for (let x = 2.0; x <= 9.5; x += 1.8) {
      this.addTrafficCone(x, -1.2); // south side of box
      this.addTrafficCone(x, 5.2);  // north side of box
    }
    // Rear back cones of L-box
    for (let z = -1.2; z <= 5.2; z += 1.6) {
      this.addTrafficCone(9.8, z);
    }
  }

  // --- LEVEL 5: Cihangir Dar Sokak Çapraz Park ---
  private buildLevel5Props(): void {
    const angle = 0.52; // ~30 deg
    // Parked car to the left of target (angled)
    this.addParkedCar(0.2, 2.8, angle, 0x15803d, 'sedan');
    // Parked car to the right of target (angled)
    this.addParkedCar(5.4, 5.2, angle, 0xb91c1c, 'coupe');

    // Pedestrian pavement with bollards (mantarlar)
    this.addObstacleBox(5.8, 0.25, 4.0, 2.0, 0.4, 30, 0x64748b);
    for (let z = -10; z <= 18; z += 3.5) {
      this.addBollard(4.6, z);
    }

    // Opposite buildings / wall
    this.addObstacleBox(-6.5, 2.5, 4.0, 1.2, 5.0, 32, 0x78716c);
  }

  // --- HELPER BUILDERS ---

  private addParkedCar(x: number, z: number, yaw: number, colorHex: number, type: 'sedan' | 'suv' | 'coupe'): void {
    const carGroup = new THREE.Group();
    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = yaw;

    const w = type === 'suv' ? 2.0 : 1.8;
    const l = type === 'coupe' ? 4.0 : (type === 'suv' ? 4.6 : 4.3);
    const h = type === 'suv' ? 1.65 : 1.35;

    // Body lower mesh
    const bodyGeo = new THREE.BoxGeometry(w, h * 0.55, l);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.85,
      roughness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = h * 0.35;
    bodyMesh.castShadow = true;
    bodyGroupAdd(carGroup, bodyMesh);

    // Cabin upper mesh (roof)
    const cabinGeo = new THREE.BoxGeometry(w * 0.88, h * 0.45, l * 0.55);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, h * 0.75, -l * 0.05);
    carGroup.add(cabinMesh);

    // Headlights & Taillights
    const hlGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(-w * 0.36, h * 0.38, l * 0.50);
    carGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(w * 0.36, h * 0.38, l * 0.50);
    carGroup.add(hlRight);

    const tlMat = new THREE.MeshBasicMaterial({ color: 0xd90429 });
    const tlLeft = new THREE.Mesh(hlGeo, tlMat);
    tlLeft.position.set(-w * 0.36, h * 0.42, -l * 0.50);
    carGroup.add(tlLeft);

    const tlRight = new THREE.Mesh(hlGeo, tlMat);
    tlRight.position.set(w * 0.36, h * 0.42, -l * 0.50);
    carGroup.add(tlRight);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

    const wheelOffsets = [
      { x: -w * 0.5, z: l * 0.32 },
      { x: w * 0.5, z: l * 0.32 },
      { x: -w * 0.5, z: -l * 0.32 },
      { x: w * 0.5, z: -l * 0.32 },
    ];
    for (const off of wheelOffsets) {
      const wh = new THREE.Mesh(wheelGeo, wheelMat);
      wh.position.set(off.x, 0.34, off.z);
      carGroup.add(wh);
    }

    this.sceneGroup.add(carGroup);

    // Compute oriented bounding box
    const box = new THREE.Box3();
    box.setFromObject(carGroup);
    // Add small buffer
    box.min.x -= 0.05;
    box.max.x += 0.05;
    box.min.z -= 0.05;
    box.max.z += 0.05;
    this.obstacleBoxes.push(box);
  }

  private addTrafficCone(x: number, z: number): void {
    const coneGroup = new THREE.Group();
    coneGroup.position.set(x, 0, z);

    // Base square
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.04, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x111827 })
    );
    base.position.y = 0.02;
    coneGroup.add(base);

    // Orange Cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.4 })
    );
    cone.position.y = 0.345;
    coneGroup.add(cone);

    // White reflective stripe band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    band.position.y = 0.32;
    coneGroup.add(band);

    this.sceneGroup.add(coneGroup);

    const box = new THREE.Box3();
    box.setFromObject(coneGroup);
    this.obstacleBoxes.push(box);
  }

  private addConcretePillar(x: number, z: number): void {
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(x, 2.1, z);

    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 4.2, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 })
    );
    pillarGroup.add(pillar);

    // Yellow and black warning bumper base
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.8, 0.82),
      new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.6 })
    );
    band.position.y = -1.4;
    pillarGroup.add(band);

    this.sceneGroup.add(pillarGroup);

    const box = new THREE.Box3();
    box.setFromObject(pillarGroup);
    this.obstacleBoxes.push(box);
  }

  private addBollard(x: number, z: number): void {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
    );
    b.position.set(x, 0.375, z);
    this.sceneGroup.add(b);

    const box = new THREE.Box3();
    box.setFromObject(b);
    this.obstacleBoxes.push(box);
  }

  private addLightPole(x: number, z: number): void {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(x, 0, z);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.14, 7.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 })
    );
    mast.position.y = 3.75;
    poleGroup.add(mast);

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffedd5 })
    );
    lamp.position.set(0, 7.4, 0.3);
    poleGroup.add(lamp);

    this.sceneGroup.add(poleGroup);

    const box = new THREE.Box3();
    box.setFromObject(poleGroup);
    this.obstacleBoxes.push(box);
  }

  private addObstacleBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorHex: number
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85 })
    );
    mesh.position.set(x, y, z);
    this.sceneGroup.add(mesh);

    const box = new THREE.Box3();
    box.setFromObject(mesh);
    this.obstacleBoxes.push(box);
  }

  private buildOuterWalls(): void {
    const wallHeight = 2.0;
    const boundarySize = 28;
    // North wall
    this.addObstacleBox(0, wallHeight / 2, boundarySize, boundarySize * 2, wallHeight, 0.8, 0x334155);
    // South wall
    this.addObstacleBox(0, wallHeight / 2, -boundarySize, boundarySize * 2, wallHeight, 0.8, 0x334155);
    // East wall
    this.addObstacleBox(boundarySize, wallHeight / 2, 0, 0.8, wallHeight, boundarySize * 2, 0x334155);
    // West wall
    this.addObstacleBox(-boundarySize, wallHeight / 2, 0, 0.8, wallHeight, boundarySize * 2, 0x334155);
  }

  // --- UPDATE & COLLISION CHECKING ---

  public update(
    delta: number,
    carPos: THREE.Vector3,
    carYaw: number,
    carDimensions: { width: number; length: number },
    carSpeedKmh: number
  ): {
    accuracyPercent: number;
    angleErrorDeg: number;
    isInsideSlot: boolean;
    isColliding: boolean;
    isSuccess: boolean;
  } {
    this.elapsedTime += delta;
    gameState.parkingTimeElapsed = this.elapsedTime;
    if (this.hitCooldown > 0) this.hitCooldown -= delta;

    // 1. Calculate accuracy and slot containment
    const slot = this.currentLevel.targetSlot;
    const dx = carPos.x - slot.x;
    const dz = carPos.z - slot.z;
    const distCenter = Math.sqrt(dx * dx + dz * dz);

    // Normalize angle difference between -PI and PI
    let dYaw = Math.abs(carYaw - slot.yaw) % (Math.PI * 2);
    if (dYaw > Math.PI) dYaw = Math.PI * 2 - dYaw;
    // For symmetric parking, 180 degrees backwards is also valid if dikey
    if (this.currentLevel.type === 'dikey') {
      const dYawOpposite = Math.abs(dYaw - Math.PI);
      dYaw = Math.min(dYaw, dYawOpposite);
    }
    const angleErrorDeg = (dYaw * 180) / Math.PI;

    // Distance threshold based on slot dimensions
    const maxDist = Math.sqrt(slot.width * slot.width + slot.length * slot.length) * 0.45;
    const distScore = Math.max(0, 1.0 - distCenter / maxDist);
    const angleScore = Math.max(0, 1.0 - angleErrorDeg / 30);
    const accuracyPercent = Math.round(Math.min(100, Math.max(0, (distScore * 0.65 + angleScore * 0.35) * 100)));

    gameState.parkingAccuracy = accuracyPercent;
    gameState.parkingAlignment = Math.max(0, 100 - Math.round(angleErrorDeg * 3.3));

    const isInsideSlot = distCenter < 0.95 && angleErrorDeg < 14;

    // Pulse target glow color (Green if inside, Cyan/Yellow if navigating)
    if (this.targetGlowMaterial) {
      if (isInsideSlot) {
        this.targetGlowMaterial.color.set(0x00ff88);
        this.targetGlowMaterial.opacity = 0.55 + Math.sin(this.elapsedTime * 6) * 0.15;
      } else {
        this.targetGlowMaterial.color.set(0x00f0ff);
        this.targetGlowMaterial.opacity = 0.30;
      }
    }

    // 2. Check Victory condition (Stopped inside slot for 1.2 seconds)
    let isSuccess = false;
    if (isInsideSlot && Math.abs(carSpeedKmh) < 1.0) {
      this.dwellTimer += delta;
      if (this.dwellTimer >= 1.2 && !this.isCompleted) {
        this.isCompleted = true;
        isSuccess = true;
        gameState.isParkedSuccessfully = true;
        this.onLevelVictory();
      }
    } else {
      this.dwellTimer = 0;
    }

    // 3. Collision Detection against obstacle bounding boxes
    const carBox = new THREE.Box3();
    const halfW = (carDimensions.width || 1.8) * 0.46;
    const halfL = (carDimensions.length || 4.2) * 0.46;
    carBox.min.set(carPos.x - halfW, carPos.y, carPos.z - halfL);
    carBox.max.set(carPos.x + halfW, carPos.y + 1.4, carPos.z + halfL);

    let isColliding = false;
    for (const obstacle of this.obstacleBoxes) {
      if (carBox.intersectsBox(obstacle)) {
        isColliding = true;
        if (this.hitCooldown <= 0) {
          this.hitCooldown = 0.75;
          this.onObstacleCollision();
        }
        break;
      }
    }

    return {
      accuracyPercent,
      angleErrorDeg,
      isInsideSlot,
      isColliding,
      isSuccess,
    };
  }

  private onObstacleCollision(): void {
    gameState.parkingDamageCount += 1;
    gameState.vehicleHealth = Math.max(0, gameState.vehicleHealth - 25);
    audioManager.playCrash();
    eventBus.emit('parkingCollision', { damageCount: gameState.parkingDamageCount, maxDamage: 3 });
  }

  private onLevelVictory(): void {
    const times = this.currentLevel.starTimes;
    let stars = 1;
    if (this.elapsedTime <= times[0] && gameState.parkingDamageCount === 0) {
      stars = 3;
    } else if (this.elapsedTime <= times[1] && gameState.parkingDamageCount <= 1) {
      stars = 2;
    }

    gameState.setParkingStars(this.currentLevel.id, stars);
    const earnedCash = Math.round(this.currentLevel.cashReward * (stars / 3));
    gameState.addMoney(earnedCash);

    audioManager.playVictoryHorn();
    eventBus.emit('parkingLevelCompleted', {
      levelId: this.currentLevel.id,
      stars,
      timeSec: Math.round(this.elapsedTime),
      damageCount: gameState.parkingDamageCount,
      rewardCash: earnedCash,
    });
  }
}

function bodyGroupAdd(group: THREE.Group, mesh: THREE.Mesh): void {
  group.add(mesh);
}

export const parkingLotManager = new ParkingLotManager();
