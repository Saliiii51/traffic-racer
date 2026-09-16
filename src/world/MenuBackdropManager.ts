// MenuBackdropManager.ts - Cinematic Istanbul Highway Backdrop for Main Menu
// Adds:
// 1. Overhead Highway Gantry Sign with Turkish KGM Signage ('15 Temmuz Şehitler Köprüsü', 'Beşiktaş / Levent')
// 2. Highway Streetlights with warm asphalt light pools and Turkish roadside plane trees / cypresses
// 3. Ambient cruising highway traffic (Istanbul Yellow Taxi & Commuter Sedan) with headlights & taillights

import * as THREE from 'three';
import { laneSystem } from '../road/LaneSystem';

interface AmbientCar {
  mesh: THREE.Group;
  wheels: THREE.Mesh[];
  lane: number;
  z: number;
  baseSpeedKmh: number;
  speedKmh: number;
  speedMps: number;
  wheelRadius: number;
}

export class MenuBackdropManager {
  public group: THREE.Group;
  private ambientCars: AmbientCar[] = [];
  private warningBeacons: THREE.Mesh[] = [];
  private groundDecalTexture: THREE.CanvasTexture | null = null;
  private signTexture: THREE.CanvasTexture | null = null;
  private taxiSignTexture: THREE.CanvasTexture | null = null;
  private isVisible: boolean = true;
  private beaconTimer: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'MenuBackdropManager';

    this.createTextures();
    this.buildGantrySign();
    this.buildRoadsideStreetlights();
    this.buildRoadsideTrees();
    this.buildAmbientTraffic();
  }

  // ---------------------------------------------------------------------------
  // TEXTURES CREATION (KGM Highway Sign, Streetlight Decal, Taxi Sign)
  // ---------------------------------------------------------------------------
  private createTextures(): void {
    if (typeof document === 'undefined') return;

    // 1. Streetlight warm asphalt pool decal
    const decalCanvas = document.createElement('canvas');
    decalCanvas.width = 256;
    decalCanvas.height = 256;
    const dCtx = decalCanvas.getContext('2d');
    if (dCtx) {
      const grad = dCtx.createRadialGradient(128, 128, 8, 128, 128, 126);
      grad.addColorStop(0.0, 'rgba(255, 238, 190, 0.48)');
      grad.addColorStop(0.35, 'rgba(255, 220, 150, 0.28)');
      grad.addColorStop(0.70, 'rgba(255, 195, 110, 0.09)');
      grad.addColorStop(1.0, 'rgba(255, 180, 90, 0.0)');
      dCtx.fillStyle = grad;
      dCtx.fillRect(0, 0, 256, 256);
    }
    this.groundDecalTexture = new THREE.CanvasTexture(decalCanvas);

    // 2. Turkish KGM Green Highway Signboard Texture
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 256;
    const sCtx = signCanvas.getContext('2d');
    if (sCtx) {
      // Dark highway green background
      sCtx.fillStyle = '#005936';
      sCtx.fillRect(0, 0, 1024, 256);

      // Outer white border
      sCtx.lineWidth = 10;
      sCtx.strokeStyle = '#ffffff';
      sCtx.strokeRect(8, 8, 1008, 240);

      // Inner divider line separating sections
      sCtx.lineWidth = 6;
      sCtx.beginPath();
      sCtx.moveTo(560, 16);
      sCtx.lineTo(560, 240);
      sCtx.stroke();

      // LEFT SECTION: 15 TEMMUZ ŞEHİTLER KÖPRÜSÜ (Bosphorus Bridge)
      // Route badge: O-1 / E-5
      sCtx.fillStyle = '#004085';
      sCtx.fillRect(36, 26, 110, 42);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 24px "Segoe UI", sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('O - 1', 91, 56);

      // Main bridge text
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 32px "Segoe UI", sans-serif';
      sCtx.textAlign = 'left';
      sCtx.fillText('15 TEMMUZ ŞEHİTLER KÖPRÜSÜ', 162, 57);

      // Destination subtext
      sCtx.font = 'bold 24px "Segoe UI", sans-serif';
      sCtx.fillStyle = '#f8f9fa';
      sCtx.fillText('BOĞAZİÇİ • ANADOLU YAKASI', 162, 105);

      // Lane arrows (straight forward)
      sCtx.font = 'bold 54px "Segoe UI", sans-serif';
      sCtx.fillStyle = '#ffffff';
      sCtx.fillText('▲       ▲       ▲', 180, 205);

      // RIGHT SECTION: BEŞİKTAŞ • LEVENT • KADIKÖY
      // Exit badge
      sCtx.fillStyle = '#b7094c';
      sCtx.fillRect(590, 26, 140, 42);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 22px "Segoe UI", sans-serif';
      sCtx.fillText('AYRIM / EXIT', 660, 56);

      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 28px "Segoe UI", sans-serif';
      sCtx.textAlign = 'left';
      sCtx.fillText('BEŞİKTAŞ • LEVENT', 590, 112);

      sCtx.font = 'bold 24px "Segoe UI", sans-serif';
      sCtx.fillStyle = '#f8f9fa';
      sCtx.fillText('KADIKÖY • ÜSKÜDAR', 590, 160);

      // Exit arrow
      sCtx.font = 'bold 64px "Segoe UI", sans-serif';
      sCtx.fillStyle = '#ffffff';
      sCtx.textAlign = 'right';
      sCtx.fillText('↗', 990, 215);
    }
    this.signTexture = new THREE.CanvasTexture(signCanvas);

    // 3. Taxi Rooftop Sign Texture
    const taxiCanvas = document.createElement('canvas');
    taxiCanvas.width = 256;
    taxiCanvas.height = 64;
    const tCtx = taxiCanvas.getContext('2d');
    if (tCtx) {
      tCtx.fillStyle = '#ffbe0b';
      tCtx.fillRect(0, 0, 256, 64);
      tCtx.fillStyle = '#111111';
      tCtx.font = '900 36px "Segoe UI", sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText('TAKSİ', 128, 46);
    }
    this.taxiSignTexture = new THREE.CanvasTexture(taxiCanvas);
  }

  // ---------------------------------------------------------------------------
  // LAYER 2: OVERHEAD HIGHWAY GANTRY SIGN (Z = -22m)
  // ---------------------------------------------------------------------------
  private buildGantrySign(): void {
    const gantryGroup = new THREE.Group();
    const gantryZ = -22.0;
    gantryGroup.position.set(0, 0, gantryZ);

    const roadHalfW = (laneSystem.laneCount * laneSystem.laneWidth) / 2; // ~7.6m
    const pillarX = roadHalfW + laneSystem.shoulderWidth + 0.6; // ~10.7m
    const gantryHeight = 6.2;
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x495057, metalness: 0.7, roughness: 0.4 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.85 });

    // 1. Left and Right Vertical Pillars
    for (const side of [-1, 1]) {
      const pX = side * pillarX;

      // Concrete crash foundation barrier
      const barrierGeo = new THREE.BoxGeometry(1.2, 1.4, 1.6);
      const barrier = new THREE.Mesh(barrierGeo, concreteMat);
      barrier.position.set(pX, 0.7, 0);
      gantryGroup.add(barrier);

      // Dual steel uprights with cross bracing
      const postGeo = new THREE.CylinderGeometry(0.18, 0.20, gantryHeight, 8);
      const post1 = new THREE.Mesh(postGeo, steelMat);
      post1.position.set(pX, gantryHeight / 2 + 0.5, -0.4);
      gantryGroup.add(post1);

      const post2 = new THREE.Mesh(postGeo, steelMat);
      post2.position.set(pX, gantryHeight / 2 + 0.5, 0.4);
      gantryGroup.add(post2);

      // Warning Flashing Amber Beacon on Top of Pillar
      const beaconGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.45, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(pX, gantryHeight + 0.75, 0);
      gantryGroup.add(beacon);
      this.warningBeacons.push(beacon);
    }

    // 2. Horizontal Overhead Lattice Truss across all lanes
    const trussSpan = pillarX * 2;
    const mainTrussGeo = new THREE.BoxGeometry(trussSpan, 0.22, 0.22);
    
    // Top and bottom chords
    const chordTop = new THREE.Mesh(mainTrussGeo, steelMat);
    chordTop.position.set(0, gantryHeight + 0.5, 0);
    gantryGroup.add(chordTop);

    const chordBottom = new THREE.Mesh(mainTrussGeo, steelMat);
    chordBottom.position.set(0, gantryHeight - 1.2, 0);
    gantryGroup.add(chordBottom);

    // Cross brace members across span
    const crossBarMat = new THREE.MeshStandardMaterial({ color: 0x6c757d, metalness: 0.5, roughness: 0.5 });
    for (let x = -pillarX + 1.5; x < pillarX - 1.0; x += 2.2) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.75, 6), crossBarMat);
      brace.position.set(x, gantryHeight - 0.35, 0);
      brace.rotation.z = Math.PI / 4;
      gantryGroup.add(brace);
    }

    // 3. Central Green Highway Directional Signboard
    const signWidth = 14.2;
    const signHeight = 2.4;
    const signGeo = new THREE.BoxGeometry(signWidth, signHeight, 0.16);

    const signFaceMat = this.signTexture
      ? new THREE.MeshBasicMaterial({ map: this.signTexture })
      : new THREE.MeshStandardMaterial({ color: 0x005936 });
    const signBackMat = new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.7 });

    const signMaterials = [
      signBackMat, // px
      signBackMat, // nx
      signBackMat, // py
      signBackMat, // ny
      signFaceMat, // pz (Facing toward +Z, into the camera view)
      signBackMat, // nz
    ];

    const signBoard = new THREE.Mesh(signGeo, signMaterials);
    signBoard.position.set(0, gantryHeight - 0.25, 0.12);
    gantryGroup.add(signBoard);

    // 4. Overhead Luminaire Brackets illuminating the sign
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let lx = -signWidth / 2 + 1.8; lx <= signWidth / 2 - 1.8; lx += 3.2) {
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), steelMat);
      bracket.position.set(lx, gantryHeight + 1.1, 0.45);
      bracket.rotation.x = Math.PI / 3;
      gantryGroup.add(bracket);

      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.25), lampMat);
      lampHead.position.set(lx, gantryHeight + 1.35, 0.82);
      lampHead.rotation.x = Math.PI / 6;
      gantryGroup.add(lampHead);
    }

    // 5. Circular Speed Limit Sign (120 km/h) mounted on the gantry
    const speedLimitGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.08, 24);
    speedLimitGeo.rotateX(Math.PI / 2);
    const speedCanvas = document.createElement('canvas');
    speedCanvas.width = 128;
    speedCanvas.height = 128;
    const spCtx = speedCanvas.getContext('2d');
    if (spCtx) {
      spCtx.fillStyle = '#ffffff';
      spCtx.beginPath();
      spCtx.arc(64, 64, 62, 0, Math.PI * 2);
      spCtx.fill();

      spCtx.lineWidth = 12;
      spCtx.strokeStyle = '#d90429';
      spCtx.stroke();

      spCtx.fillStyle = '#111111';
      spCtx.font = '900 48px "Segoe UI", sans-serif';
      spCtx.textAlign = 'center';
      spCtx.fillText('120', 64, 80);
    }
    const speedTex = new THREE.CanvasTexture(speedCanvas);
    const speedMat = new THREE.MeshBasicMaterial({ map: speedTex });
    const speedSign = new THREE.Mesh(speedLimitGeo, speedMat);
    speedSign.position.set(-signWidth / 2 - 1.1, gantryHeight - 0.25, 0.25);
    gantryGroup.add(speedSign);

    this.group.add(gantryGroup);
  }

  // ---------------------------------------------------------------------------
  // LAYER 3: ROADSIDE HIGHWAY STREETLIGHTS & ASPHALT LIGHT POOLS
  // ---------------------------------------------------------------------------
  private buildRoadsideStreetlights(): void {
    const roadHalfW = (laneSystem.laneCount * laneSystem.laneWidth) / 2;
    const shoulderX = roadHalfW + 1.2; // ~8.8m
    const zPositions = [-12.0, -34.0, -56.0];

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6c757d, metalness: 0.6, roughness: 0.4 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });

    const decalMat = this.groundDecalTexture
      ? new THREE.MeshBasicMaterial({
          map: this.groundDecalTexture,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      : new THREE.MeshBasicMaterial({ color: 0xffe899, transparent: true, opacity: 0.25 });

    const decalGeo = new THREE.PlaneGeometry(8.5, 8.5);

    for (const z of zPositions) {
      for (const side of [-1, 1]) {
        const x = side * shoulderX;
        const poleGroup = new THREE.Group();
        poleGroup.position.set(x, 0, z);

        // Vertical tapered steel pole (height ~7.2m)
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.20, 7.2, 8);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(0, 3.6, 0);
        poleGroup.add(pole);

        // Arched cobra arm extending slightly towards the highway
        const armGeo = new THREE.CylinderGeometry(0.08, 0.10, 2.4, 6);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(-side * 0.9, 7.2, 0);
        arm.rotation.z = side * (Math.PI / 4);
        poleGroup.add(arm);

        // Cobra-head luminaire fixture
        const headGeo = new THREE.BoxGeometry(0.42, 0.16, 0.85);
        const head = new THREE.Mesh(headGeo, poleMat);
        head.position.set(-side * 1.8, 7.5, 0);
        poleGroup.add(head);

        // Underside warm glowing LED surface
        const lensGeo = new THREE.PlaneGeometry(0.36, 0.75);
        const lens = new THREE.Mesh(lensGeo, lampGlowMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(-side * 1.8, 7.41, 0);
        poleGroup.add(lens);

        // Asphalt ground light pool decal directly below/under lane edge
        const decal = new THREE.Mesh(decalGeo, decalMat);
        decal.rotation.x = -Math.PI / 2;
        decal.position.set(-side * 2.8, 0.02, 0);
        poleGroup.add(decal);

        this.group.add(poleGroup);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // LAYER 3 (CONT.): ROADSIDE TREES & GREENERY (Framing Left & Right Horizon)
  // ---------------------------------------------------------------------------
  private buildRoadsideTrees(): void {
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const cypressMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.8 });
    const planeTreeMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.75 });

    const treeConfigs = [
      { x: -12.5, z: -16.0, type: 'cypress', h: 9.5, r: 1.2 },
      { x: 12.5, z: -18.0, type: 'plane', h: 8.5, r: 2.8 },
      { x: -13.2, z: -28.0, type: 'plane', h: 9.0, r: 3.0 },
      { x: 13.0, z: -30.0, type: 'cypress', h: 10.5, r: 1.3 },
      { x: -13.0, z: -42.0, type: 'cypress', h: 10.0, r: 1.2 },
      { x: 12.8, z: -44.0, type: 'plane', h: 8.8, r: 2.9 },
      { x: -13.5, z: -58.0, type: 'plane', h: 9.2, r: 3.1 },
      { x: 13.2, z: -60.0, type: 'cypress', h: 10.2, r: 1.3 },
    ];

    for (const tc of treeConfigs) {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tc.x, 0, tc.z);

      // Trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, tc.h * 0.4, 6), treeTrunkMat);
      trunk.position.set(0, (tc.h * 0.4) / 2, 0);
      treeGroup.add(trunk);

      if (tc.type === 'cypress') {
        // Slender conical Mediterranean cypress
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(tc.r, tc.h * 0.75, 7), cypressMat);
        foliage.position.set(0, tc.h * 0.55, 0);
        treeGroup.add(foliage);
      } else {
        // Spreading Turkish plane tree (Çınar)
        const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(tc.r, 1), planeTreeMat);
        canopy1.position.set(0, tc.h * 0.65, 0);
        treeGroup.add(canopy1);

        const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(tc.r * 0.8, 1), planeTreeMat);
        canopy2.position.set(0.4, tc.h * 0.85, 0.2);
        treeGroup.add(canopy2);
      }

      this.group.add(treeGroup);
    }
  }

  // ---------------------------------------------------------------------------
  // LAYER 4: AMBIENT HIGHWAY TRAFFIC (Istanbul Yellow Taxi & Commuter Sedan)
  // ---------------------------------------------------------------------------
  private buildAmbientTraffic(): void {
    // Car 1: Istanbul Yellow Taxi cruising in Lane 2 (X = +1.9m)
    const taxiMesh = this.createTaxiMesh();
    this.ambientCars.push({
      mesh: taxiMesh,
      wheels: (taxiMesh as any)._wheels || [],
      lane: 2,
      z: -48.0, // starts comfortably mid-distance
      baseSpeedKmh: 62,
      speedKmh: 62,
      speedMps: 62 / 3.6,
      wheelRadius: 0.38,
    });
    this.group.add(taxiMesh);

    // Car 2: Commuter Sedan in Lane 0 (X = -5.7m, left lane)
    const sedanMesh = this.createSedanMesh(0x1d3557); // Metallic midnight navy
    this.ambientCars.push({
      mesh: sedanMesh,
      wheels: (sedanMesh as any)._wheels || [],
      lane: 0,
      z: -78.0, // further back
      baseSpeedKmh: 76,
      speedKmh: 76,
      speedMps: 76 / 3.6,
      wheelRadius: 0.38,
    });
    this.group.add(sedanMesh);
  }

  private createTaxiMesh(): THREE.Group {
    const carGroup = new THREE.Group();
    carGroup.name = 'Ambient_Istanbul_Taxi';

    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.28, metalness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.1, metalness: 0.85 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd6ccc2, metalness: 0.8, roughness: 0.2 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff002b });

    // Lower Chassis Body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 4.3), yellowMat);
    lowerBody.position.set(0, 0.52, 0);
    carGroup.add(lowerBody);

    // Upper Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.58, 2.3), glassMat);
    cabin.position.set(0, 1.05, -0.15);
    carGroup.add(cabin);

    // Cabin Roof Plate
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.08, 2.15), yellowMat);
    roof.position.set(0, 1.36, -0.15);
    carGroup.add(roof);

    // Taxi Rooftop Sign ('TAKSİ')
    const taxiSignGeo = new THREE.BoxGeometry(0.55, 0.16, 0.28);
    const taxiSignMat = this.taxiSignTexture
      ? new THREE.MeshBasicMaterial({ map: this.taxiSignTexture })
      : new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const taxiSign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
    taxiSign.position.set(0, 1.48, -0.15);
    carGroup.add(taxiSign);

    // Headlights (facing +Z forward)
    for (const hx of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), headlightMat);
      hl.position.set(hx, 0.56, 2.16);
      carGroup.add(hl);
    }

    // Taillights (facing -Z rear)
    for (const rx of [-0.68, 0.68]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), taillightMat);
      tl.position.set(rx, 0.58, -2.16);
      carGroup.add(tl);
    }

    // Wheels
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      { x: -0.92, z: 1.25 },
      { x: 0.92, z: 1.25 },
      { x: -0.92, z: -1.25 },
      { x: 0.92, z: -1.25 },
    ];
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12);
    rimGeo.rotateZ(Math.PI / 2);

    for (const wp of wheelPositions) {
      const wGroup = new THREE.Mesh(tireGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);
      wGroup.position.set(wp.x, 0.36, wp.z);
      carGroup.add(wGroup);
      wheels.push(wGroup);
    }

    (carGroup as any)._wheels = wheels;
    return carGroup;
  }

  private createSedanMesh(bodyColor: number): THREE.Group {
    const carGroup = new THREE.Group();
    carGroup.name = 'Ambient_Sedan';

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xced4da, metalness: 0.85, roughness: 0.15 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // Lower Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.64, 4.45), bodyMat);
    lowerBody.position.set(0, 0.54, 0);
    carGroup.add(lowerBody);

    // Upper Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.56, 2.4), glassMat);
    cabin.position.set(0, 1.06, -0.1);
    carGroup.add(cabin);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 2.25), bodyMat);
    roof.position.set(0, 1.36, -0.1);
    carGroup.add(roof);

    // Headlights
    for (const hx of [-0.70, 0.70]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), headlightMat);
      hl.position.set(hx, 0.58, 2.24);
      carGroup.add(hl);
    }

    // Taillights
    for (const rx of [-0.70, 0.70]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.08), taillightMat);
      tl.position.set(rx, 0.60, -2.24);
      carGroup.add(tl);
    }

    // Wheels
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      { x: -0.94, z: 1.30 },
      { x: 0.94, z: 1.30 },
      { x: -0.94, z: -1.30 },
      { x: 0.94, z: -1.30 },
    ];
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12);
    rimGeo.rotateZ(Math.PI / 2);

    for (const wp of wheelPositions) {
      const wGroup = new THREE.Mesh(tireGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);
      wGroup.position.set(wp.x, 0.36, wp.z);
      carGroup.add(wGroup);
      wheels.push(wGroup);
    }

    (carGroup as any)._wheels = wheels;
    return carGroup;
  }

  // ---------------------------------------------------------------------------
  // UPDATE & LIFECYCLE
  // ---------------------------------------------------------------------------
  public setVisible(visible: boolean): void {
    if (this.isVisible === visible) return;
    this.isVisible = visible;
    this.group.visible = visible;
  }

  public update(delta: number): void {
    if (!this.isVisible) return;

    // 1. Animate Warning Beacons atop gantry (pulsing amber blink)
    this.beaconTimer += delta * 5.0;
    const isLit = (Math.floor(this.beaconTimer) % 2) === 0;
    for (const b of this.warningBeacons) {
      b.visible = isLit;
    }

    // 2. Cruise Ambient Cars forward along highway
    for (const car of this.ambientCars) {
      car.z += car.speedMps * delta;

      // Position car in its designated lane
      const laneX = laneSystem.getLaneX(car.lane);
      car.mesh.position.set(laneX, 0, car.z);

      // Rotate wheels smoothly with ground travel
      const rotDelta = (car.speedMps / car.wheelRadius) * delta;
      for (const w of car.wheels) {
        w.rotation.x += rotDelta;
      }

      // Loop car when it passes behind camera (around Z = +26m)
      if (car.z > 26.0) {
        // Recycle to far distance behind
        car.z = -85.0 - Math.random() * 20.0;
        car.speedKmh = car.baseSpeedKmh + (Math.random() * 8.0 - 4.0);
        car.speedMps = car.speedKmh / 3.6;
      }
    }
  }

  public dispose(): void {
    this.groundDecalTexture?.dispose();
    this.signTexture?.dispose();
    this.taxiSignTexture?.dispose();
    this.group.clear();
  }
}
