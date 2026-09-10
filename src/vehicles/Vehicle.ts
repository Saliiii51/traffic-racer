import * as THREE from 'three';
import { GLTFModelLoader } from './GLTFModelLoader';

export interface VehicleDimensions {
  length: number;
  width: number;
  height: number;
  wheelBase: number;
  wheelTrack: number;
  wheelRadius: number;
}

export class Vehicle {
  public mesh: THREE.Group;
  public dimensions: VehicleDimensions;
  public boundingBox: THREE.Box3;
  
  // Visual parts references
  protected bodyMesh!: THREE.Mesh;
  protected bodyMaterial!: THREE.MeshStandardMaterial;
  public wheelsGroup: THREE.Group = new THREE.Group();
  public wheelMeshes: THREE.Group[] = [];
  public frontWheels: THREE.Group[] = [];
  public rearWheels: THREE.Group[] = [];
  protected brakeLightMaterial!: THREE.MeshBasicMaterial;
  protected headLightMaterial!: THREE.MeshBasicMaterial;
  protected customBrakeLightMaterials: THREE.MeshStandardMaterial[] = [];
  protected headlightBeams: THREE.Mesh[] = [];
  protected brakeLightGlow: THREE.Mesh | null = null;
  protected nitroFlames: THREE.Mesh[] = [];
  protected shadowPlane!: THREE.Mesh;
  private static softShadowTexture: THREE.CanvasTexture | null = null;

  private static getSoftShadowTexture(): THREE.CanvasTexture {
    if (!Vehicle.softShadowTexture && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(64, 64, 15, 64, 64, 64);
        rad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
        rad.addColorStop(0.45, 'rgba(0, 0, 0, 0.25)');
        rad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
        rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, 128, 128);
      }
      Vehicle.softShadowTexture = new THREE.CanvasTexture(canvas);
    }
    return Vehicle.softShadowTexture!;
  }

  // Wheel rotation accumulator
  protected wheelAngle: number = 0;
  protected customWheels: Array<{ obj: THREE.Object3D; isLeft: boolean; isFront: boolean; initialRotY: number; initialRotX: number }> = [];
  protected customSteeringWheel: { obj: THREE.Object3D; initialRotZ: number } | null = null;

  // Model groups
  public proceduralGroup: THREE.Group = new THREE.Group();
  public customModelGroup: THREE.Group = new THREE.Group();
  public isUsingCustomModel: boolean = false;

  public id: string;
  public type: string;

  constructor(
    id: string,
    type: string,
    dimensions?: Partial<VehicleDimensions>,
    color = '#e63946'
  ) {
    this.id = id;
    this.type = type;
    this.mesh = new THREE.Group();
    this.mesh.name = `Vehicle_${id}`;
    this.mesh.add(this.proceduralGroup);
    this.mesh.add(this.customModelGroup);
    this.mesh.add(this.wheelsGroup);

    this.dimensions = {
      length: dimensions?.length ?? 4.2,
      width: dimensions?.width ?? 1.9,
      height: dimensions?.height ?? 1.3,
      wheelBase: dimensions?.wheelBase ?? 2.6,
      wheelTrack: dimensions?.wheelTrack ?? 1.75,
      wheelRadius: dimensions?.wheelRadius ?? 0.38,
    };

    this.boundingBox = new THREE.Box3();
    this.buildProceduralModel(color);
    this.updateBoundingBox();
  }

  protected buildProceduralModel(bodyColor: string): void {
    const { length, width, height, wheelBase, wheelTrack, wheelRadius } = this.dimensions;

    // 1. Soft Realistic Radial Blurred Contact Shadow under car (Zero sharp rectangular edges)
    const shadowGeo = new THREE.PlaneGeometry(width * 1.15, length * 1.05);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: Vehicle.getSoftShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0.02;
    this.mesh.add(this.shadowPlane);

    // 2. Main Chassis / Lower Body with High-Gloss PBR Lacquer
    const lowerHeight = height * 0.45;
    const bodyGeo = new THREE.BoxGeometry(width, lowerHeight, length);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColor),
      metalness: 0.82,
      roughness: 0.18,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.position.y = wheelRadius + lowerHeight / 2;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.proceduralGroup.add(this.bodyMesh);

    // 3. Cabin / Greenhouse / Roof
    const cabinLength = length * 0.52;
    const cabinWidth = width * 0.84;
    const cabinHeight = height * 0.55;
    const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x1a2530,
      metalness: 0.9,
      roughness: 0.1,
    });
    const cabin = new THREE.Mesh(cabinGeo, windowMat);
    // Cabin shifted slightly toward rear
    cabin.position.set(0, wheelRadius + lowerHeight + cabinHeight / 2 - 0.02, -length * 0.08);
    cabin.castShadow = true;
    this.proceduralGroup.add(cabin);

    // 4. Aerodynamic Front Hood Slope
    const hoodLength = length * 0.28;
    const hoodWidth = width * 0.86;
    const hoodHeight = lowerHeight * 0.35;
    const hoodGeo = new THREE.BoxGeometry(hoodWidth, hoodHeight, hoodLength);
    const hood = new THREE.Mesh(hoodGeo, this.bodyMaterial);
    hood.position.set(0, wheelRadius + lowerHeight + hoodHeight / 2 - 0.04, length * 0.3);
    hood.rotation.x = 0.08;
    this.proceduralGroup.add(hood);

    // 5. Rear Spoiler (for sporty aesthetic)
    if (this.type !== 'truck' && this.type !== 'van') {
      const spoilerWing = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.95, 0.06, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
      );
      spoilerWing.position.set(0, wheelRadius + lowerHeight + cabinHeight * 0.75, -length * 0.46);
      this.proceduralGroup.add(spoilerWing);

      const standGeo = new THREE.BoxGeometry(0.06, cabinHeight * 0.4, 0.1);
      const standLeft = new THREE.Mesh(standGeo, spoilerWing.material);
      standLeft.position.set(-width * 0.35, wheelRadius + lowerHeight + cabinHeight * 0.55, -length * 0.46);
      this.proceduralGroup.add(standLeft);

      const standRight = new THREE.Mesh(standGeo, spoilerWing.material);
      standRight.position.set(width * 0.35, wheelRadius + lowerHeight + cabinHeight * 0.55, -length * 0.46);
      this.proceduralGroup.add(standRight);
    }

    // 6. Headlights (Front facing +Z)
    this.headLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlGeo = new THREE.BoxGeometry(width * 0.22, 0.14, 0.08);

    const leftHL = new THREE.Mesh(hlGeo, this.headLightMaterial);
    leftHL.position.set(-width * 0.34, wheelRadius + lowerHeight * 0.7, length * 0.5 + 0.02);
    this.proceduralGroup.add(leftHL);

    const rightHL = new THREE.Mesh(hlGeo, this.headLightMaterial);
    rightHL.position.set(width * 0.34, wheelRadius + lowerHeight * 0.7, length * 0.5 + 0.02);
    this.proceduralGroup.add(rightHL);

    // Headlights have realistic 3D glowing glass lenses on the car body (no flat additive boxes on asphalt)
    this.headlightBeams = [];

    // 7. Taillights (Rear facing -Z)
    this.brakeLightMaterial = new THREE.MeshBasicMaterial({ color: 0xcc1111 });
    const tlGeo = new THREE.BoxGeometry(width * 0.25, 0.14, 0.08);

    const leftTL = new THREE.Mesh(tlGeo, this.brakeLightMaterial);
    leftTL.position.set(-width * 0.34, wheelRadius + lowerHeight * 0.7, -length * 0.5 - 0.02);
    this.proceduralGroup.add(leftTL);

    const rightTL = new THREE.Mesh(tlGeo, this.brakeLightMaterial);
    rightTL.position.set(width * 0.34, wheelRadius + lowerHeight * 0.7, -length * 0.5 - 0.02);
    this.proceduralGroup.add(rightTL);

    // Taillight / Brake Road Glow with soft circular radial gradient (Zero sharp box edges)
    let brakeGlowTex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 64;
      bCanvas.height = 64;
      const bctx = bCanvas.getContext('2d');
      if (bctx) {
        const grad = bctx.createRadialGradient(32, 32, 4, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 0, 30, 0.75)');
        grad.addColorStop(0.4, 'rgba(255, 0, 30, 0.25)');
        grad.addColorStop(1, 'rgba(255, 0, 30, 0)');
        bctx.fillStyle = grad;
        bctx.fillRect(0, 0, 64, 64);
      }
      brakeGlowTex = new THREE.CanvasTexture(bCanvas);
    }
    const brakeGlowGeo = new THREE.PlaneGeometry(width * 1.3, 3.2);
    brakeGlowGeo.translate(0, -1.6, 0);
    const brakeGlowMat = new THREE.MeshBasicMaterial({
      map: brakeGlowTex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.brakeLightGlow = new THREE.Mesh(brakeGlowGeo, brakeGlowMat);
    this.brakeLightGlow.rotation.x = -Math.PI / 2;
    this.brakeLightGlow.position.set(0, 0.02, -length * 0.5);
    this.mesh.add(this.brakeLightGlow);

    // 8. Wheels (Front Left, Front Right, Rear Left, Rear Right)
    const halfBase = wheelBase / 2;
    const halfTrack = wheelTrack / 2;

    const frontLeft = this.createWheel(wheelRadius, width * 0.12, true);
    frontLeft.position.set(-halfTrack, wheelRadius, halfBase);
    this.wheelsGroup.add(frontLeft);
    this.frontWheels.push(frontLeft);

    const frontRight = this.createWheel(wheelRadius, width * 0.12, false);
    frontRight.position.set(halfTrack, wheelRadius, halfBase);
    this.wheelsGroup.add(frontRight);
    this.frontWheels.push(frontRight);

    const rearLeft = this.createWheel(wheelRadius, width * 0.12, true);
    rearLeft.position.set(-halfTrack, wheelRadius, -halfBase);
    this.wheelsGroup.add(rearLeft);
    this.rearWheels.push(rearLeft);

    const rearRight = this.createWheel(wheelRadius, width * 0.12, false);
    rearRight.position.set(halfTrack, wheelRadius, -halfBase);
    this.wheelsGroup.add(rearRight);
    this.rearWheels.push(rearRight);

    this.wheelMeshes = [...this.frontWheels, ...this.rearWheels];

    // 9. Nitro Exhaust Flames (hidden by default)
    const flameGeo = new THREE.ConeGeometry(0.12, 0.8, 6);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const leftFlame = new THREE.Mesh(flameGeo, flameMat);
    leftFlame.position.set(-width * 0.22, wheelRadius * 0.8, -length * 0.52 - 0.4);
    leftFlame.visible = false;
    this.mesh.add(leftFlame);
    this.nitroFlames.push(leftFlame);

    const rightFlame = new THREE.Mesh(flameGeo, flameMat);
    rightFlame.position.set(width * 0.22, wheelRadius * 0.8, -length * 0.52 - 0.4);
    rightFlame.visible = false;
    this.mesh.add(rightFlame);
    this.nitroFlames.push(rightFlame);

    // 10. Istanbul Authentic Thematic Attachments
    this.addIstanbulDecorations();
  }

  private addIstanbulDecorations(): void {
    const { length, width, height, wheelRadius } = this.dimensions;
    const lowerHeight = height * 0.45;
    const cabinHeight = height * 0.55;
    const roofY = wheelRadius + lowerHeight + cabinHeight;
    const cabinCenterZ = -length * 0.08;

    // A. SARI TAKSİ (Istanbul Yellow Taxi)
    if (this.type === 'taxi') {
      const taxiSignGroup = new THREE.Group();
      taxiSignGroup.position.set(0, roofY + 0.1, cabinCenterZ);

      // Black magnetic roof base
      const baseGeo = new THREE.BoxGeometry(width * 0.45, 0.04, 0.28);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      taxiSignGroup.add(baseMesh);

      // Glowing yellow TAXI sign body
      const signGeo = new THREE.BoxGeometry(width * 0.4, 0.18, 0.22);
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xffc72c,
        emissive: 0xffaa00,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.y = 0.1;
      taxiSignGroup.add(signMesh);

      // Black "TAKSİ" text block bar
      const textBarGeo = new THREE.BoxGeometry(width * 0.3, 0.08, 0.24);
      const textBarMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const textBar = new THREE.Mesh(textBarGeo, textBarMat);
      textBar.position.y = 0.1;
      taxiSignGroup.add(textBar);

      this.proceduralGroup.add(taxiSignGroup);

      // Checkered stripe along side doors
      const stripeGeo = new THREE.BoxGeometry(width + 0.02, 0.08, length * 0.48);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const sideStripe = new THREE.Mesh(stripeGeo, stripeMat);
      sideStripe.position.set(0, wheelRadius + lowerHeight * 0.8, -length * 0.05);
      this.proceduralGroup.add(sideStripe);
    }

    // B. MAVİ MİNİBÜS (Istanbul Dolmuş / Minibüs)
    if (this.type === 'minibus') {
      // Roof luggage rack (portbagaj)
      const rackGroup = new THREE.Group();
      rackGroup.position.set(0, roofY + 0.08, cabinCenterZ);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.8, roughness: 0.3 });

      const sideRailGeo = new THREE.BoxGeometry(0.04, 0.08, length * 0.45);
      const leftRail = new THREE.Mesh(sideRailGeo, railMat);
      leftRail.position.x = -width * 0.36;
      rackGroup.add(leftRail);

      const rightRail = new THREE.Mesh(sideRailGeo, railMat);
      rightRail.position.x = width * 0.36;
      rackGroup.add(rightRail);

      // Crossbars
      for (let i = -1; i <= 1; i++) {
        const crossGeo = new THREE.BoxGeometry(width * 0.72, 0.03, 0.04);
        const crossBar = new THREE.Mesh(crossGeo, railMat);
        crossBar.position.set(0, 0.03, i * (length * 0.18));
        rackGroup.add(crossBar);
      }
      this.proceduralGroup.add(rackGroup);

      // Front windshield route placard (Hat levhası: KADIKÖY - HAREM)
      const placardGeo = new THREE.BoxGeometry(width * 0.48, 0.14, 0.04);
      const placardMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const placard = new THREE.Mesh(placardGeo, placardMat);
      placard.position.set(0, roofY - 0.12, cabinCenterZ + (length * 0.26) + 0.02);
      this.proceduralGroup.add(placard);
    }

    // C. MOTOKURYE (Delivery Scooter / Courier)
    if (this.type === 'courier') {
      // Rear delivery box (insulated food box)
      const boxWidth = width * 0.72;
      const boxHeight = height * 0.65;
      const boxDepth = length * 0.32;
      const boxGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xff5400, // Vibrant delivery orange
        roughness: 0.4,
      });
      const deliveryBox = new THREE.Mesh(boxGeo, boxMat);
      deliveryBox.position.set(0, wheelRadius + lowerHeight + boxHeight / 2, -length * 0.36);
      deliveryBox.castShadow = true;
      this.proceduralGroup.add(deliveryBox);

      // Reflective white safety stripe around box
      const stripeGeo = new THREE.BoxGeometry(boxWidth + 0.02, 0.08, boxDepth + 0.02);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, wheelRadius + lowerHeight + boxHeight * 0.5, -length * 0.36);
      this.proceduralGroup.add(stripe);
    }

    // D. İETT / METROBÜS (City Bus)
    if (this.type === 'bus') {
      // Front LED route display ("METROBÜS / SÖĞÜTLÜÇEŞME")
      const ledGeo = new THREE.BoxGeometry(width * 0.7, 0.16, 0.06);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0xff9900,
        emissiveIntensity: 0.8,
      });
      const ledSign = new THREE.Mesh(ledGeo, ledMat);
      ledSign.position.set(0, roofY - 0.08, cabinCenterZ + (length * 0.28) + 0.02);
      this.proceduralGroup.add(ledSign);
    }
  }

  protected createWheel(radius: number, thickness: number, isLeft: boolean = false): THREE.Group {
    const wheelGroup = new THREE.Group();
    const outerSign = isLeft ? -1 : 1; // Left wheels face -X, right wheels face +X

    // 1. Stationary Brake Assembly (Rotates with steering Y, but does NOT roll with X)
    const brakeGroup = new THREE.Group();

    // Brake rotor disc (ventilated steel)
    const rotorRadius = radius * 0.64;
    const rotorThickness = 0.022;
    const rotorGeo = new THREE.CylinderGeometry(rotorRadius, rotorRadius, rotorThickness, 20);
    rotorGeo.rotateZ(Math.PI / 2);
    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0xadb5bd,
      metalness: 0.88,
      roughness: 0.26,
    });
    const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
    rotorMesh.position.x = -outerSign * (thickness * 0.18);
    brakeGroup.add(rotorMesh);

    // Brake caliper (Sport racing red, clamped at top/rear of disc)
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      roughness: 0.32,
      metalness: 0.35,
    });
    const caliperGeo = new THREE.BoxGeometry(0.042, radius * 0.32, radius * 0.24);
    const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
    caliperMesh.position.set(-outerSign * (thickness * 0.18), radius * 0.38, -radius * 0.16);
    brakeGroup.add(caliperMesh);

    wheelGroup.add(brakeGroup);

    // 2. Rolling Assembly (Rolls around X as car drives)
    const rollGroup = new THREE.Group();
    (wheelGroup as any).rollGroup = rollGroup;

    // Tire (Automotive Carbon Rubber)
    const tireGeo = new THREE.CylinderGeometry(radius, radius, thickness, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141517, // Realistic automotive carbon tire black
      roughness: 0.88,
      metalness: 0.05,
    });
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = false;
    tireMesh.receiveShadow = true;
    rollGroup.add(tireMesh);

    // Rim Outer Barrel / Rim Lip
    const rimRadius = radius * 0.67;
    const rimBarrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, thickness + 0.006, 22);
    rimBarrelGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e5ea, // Bright sport alloy silver
      metalness: 0.85,
      roughness: 0.18,
    });
    const rimBarrel = new THREE.Mesh(rimBarrelGeo, rimMat);
    rollGroup.add(rimBarrel);

    // Central Hubcap (Dark graphite hub)
    const hubRadius = radius * 0.23;
    const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, thickness + 0.012, 16);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x212529,
      metalness: 0.82,
      roughness: 0.22,
    });
    const hubMesh = new THREE.Mesh(hubGeo, hubMat);
    rollGroup.add(hubMesh);

    // 5 High-Gloss Sport Alloy Spokes with open gaps between them
    const spokeCount = 5;
    const spokeLength = radius * 0.48;
    const spokeWidth = radius * 0.13;
    const spokeThickness = thickness + 0.008;
    const spokeGeo = new THREE.BoxGeometry(spokeThickness, spokeLength, spokeWidth);
    spokeGeo.translate(0, spokeLength / 2, 0);

    for (let i = 0; i < spokeCount; i++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.x = (i * Math.PI * 2) / spokeCount;
      rollGroup.add(spoke);
    }

    // Chrome Lug Nuts on outer rim face (highly visible micro-details)
    const lugGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.018, 6);
    lugGeo.rotateZ(Math.PI / 2);
    const lugMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.1,
    });
    for (let j = 0; j < 5; j++) {
      const angle = ((j + 0.5) * Math.PI * 2) / 5;
      const lug = new THREE.Mesh(lugGeo, lugMat);
      lug.position.set(
        outerSign * (thickness * 0.49),
        Math.sin(angle) * (radius * 0.15),
        Math.cos(angle) * (radius * 0.15)
      );
      rollGroup.add(lug);
    }

    wheelGroup.add(rollGroup);
    return wheelGroup;
  }

  public setColor(hexColor: string): void {
    if (this.bodyMaterial) {
      this.bodyMaterial.color.set(hexColor);
    }
    if (this.isUsingCustomModel && this.customModelGroup) {
      this.customModelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat: any) => {
            if (mat && mat.isBodyPaint) {
              if (mat.isMiniCooperHull) {
                this.applyMiniCooperPaint(mat, hexColor);
              } else {
                mat.color.set(hexColor);
                mat.needsUpdate = true;
              }
            }
          });
        }
      });
    }
  }

  private applyMiniCooperPaint(mat: THREE.MeshStandardMaterial, hexColor: string): void {
    try {
      // 1. Ensure dielectric automotive clearcoat (bright lacquer, not light-absorbing metal)
      mat.metalness = 0.08;
      mat.roughness = 0.20;
      mat.aoMap = null;

      const origMap = (mat as any)._originalMap || mat.map;
      if (!origMap) {
        mat.color.set(hexColor);
        mat.needsUpdate = true;
        return;
      }
      (mat as any)._originalMap = origMap;

      const img = origMap.image || (origMap.source ? origMap.source.data : null);
      if (!img) {
        setTimeout(() => this.applyMiniCooperPaint(mat, hexColor), 120);
        return;
      }

      if (img instanceof HTMLImageElement && !img.complete) {
        img.onload = () => this.applyMiniCooperPaint(mat, hexColor);
        return;
      }

      let canvas = (mat as any)._tintCanvas as HTMLCanvasElement;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 1024;
        canvas.height = img.naturalHeight || img.height || 1024;
        (mat as any)._tintCanvas = canvas;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const target = new THREE.Color(hexColor);
      const tr = target.r;
      const tg = target.g;
      const tb = target.b;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Red body paint in Mini Cooper texture:
        if (r > 30 && r > g * 1.15 && r > b * 1.15) {
          const lum = Math.min(1.40, Math.max(0.60, r / 50.0));
          data[i] = Math.min(255, Math.round(lum * tr * 255));
          data[i + 1] = Math.min(255, Math.round(lum * tg * 255));
          data[i + 2] = Math.min(255, Math.round(lum * tb * 255));
        }
      }

      ctx.putImageData(imgData, 0, 0);

      if (!mat.map || !(mat.map as any).isCanvasTexture) {
        const canvasTex = new THREE.CanvasTexture(canvas);
        canvasTex.flipY = origMap.flipY;
        canvasTex.colorSpace = origMap.colorSpace || THREE.SRGBColorSpace;
        canvasTex.wrapS = origMap.wrapS;
        canvasTex.wrapT = origMap.wrapT;
        mat.map = canvasTex;
      }
      mat.map.needsUpdate = true;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    } catch (e) {
      console.warn('[Vehicle] Mini Cooper paint tint warning:', e);
      mat.color.set(hexColor);
      mat.needsUpdate = true;
    }
  }

  public setBraking(isBraking: boolean): void {
    if (this.brakeLightMaterial) {
      this.brakeLightMaterial.color.set(isBraking ? 0xff0000 : 0xcc1111);
    }
    if (this.brakeLightGlow) {
      (this.brakeLightGlow.material as THREE.MeshBasicMaterial).opacity = isBraking ? 0.38 : 0.0;
    }
    if (this.customBrakeLightMaterials.length > 0) {
      this.customBrakeLightMaterials.forEach((mat) => {
        if (isBraking) {
          mat.emissive.setHex(0xff0000);
          mat.emissiveIntensity = 1.35;
          mat.color.setHex(0xff2222);
        } else {
          mat.emissive.setHex(0x380505);
          mat.emissiveIntensity = 0.28;
          mat.color.setHex(0x7a1212);
        }
        mat.needsUpdate = true;
      });
    }
  }

  public setNitroFlames(active: boolean): void {
    this.nitroFlames.forEach((flame) => {
      flame.visible = active;
      if (active) {
        const flicker = 0.8 + Math.random() * 0.4;
        flame.scale.set(flicker, flicker, flicker * (1.0 + Math.random() * 0.5));
      }
    });
  }

  public updateWheels(speedMps: number, steerAngle: number, delta: number): void {
    const radius = this.dimensions.wheelRadius || 0.33;
    const angularSpeed = speedMps / radius;
    this.wheelAngle += angularSpeed * delta;

    // 1. Procedural / universal wheels
    this.wheelMeshes.forEach((w) => {
      const roll = (w as any).rollGroup || w;
      roll.rotation.x = this.wheelAngle;
    });

    // Steer front wheels around Y axis
    this.frontWheels.forEach((w) => {
      w.rotation.y = steerAngle;
    });

    // 2. Custom 3D Model wheels (Tofaş / GLTF / FBX / Dodge Charger)
    if (this.isUsingCustomModel && this.customWheels.length > 0) {
      this.customWheels.forEach((w) => {
        // Roll forward around local X axis matching forward car motion (+Z)
        const spinSign = this.id === 'luxury_sedan' ? -1 : (Math.abs(Math.abs(w.initialRotY) - Math.PI) < 0.5 ? -1 : 1);
        w.obj.rotation.x = w.initialRotX + this.wheelAngle * spinSign;

        // Steer front wheels around Y
        if (w.isFront) {
          w.obj.rotation.y = w.initialRotY + steerAngle;
        }
      });
    }

    // 3. Custom Steering Wheel (rotates realistically with steering input, strictly NEVER rolls like a tire!)
    if (this.isUsingCustomModel && this.customSteeringWheel) {
      this.customSteeringWheel.obj.rotation.z = this.customSteeringWheel.initialRotZ - steerAngle * 2.4;
    }
  }

  public applyCustomGLTF(model: THREE.Group): void {
    // Hide procedural body and wheels
    this.proceduralGroup.visible = false;
    this.customBrakeLightMaterials = [];

    // Clear previous custom model
    while (this.customModelGroup.children.length > 0) {
      this.customModelGroup.remove(this.customModelGroup.children[0]);
    }

    // 0. Remove unwanted ground planes / studio backdrop meshes (e.g. Mini Cooper's Plane_ground_0)
    const unwantedChildren: THREE.Object3D[] = [];
    model.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      const matName = (((child as any).material?.name) || '').toLowerCase();
      if ((name.includes('plane') || matName === 'ground' || name.includes('ground')) && !name.includes('plate') && !name.includes('plaka')) {
        unwantedChildren.push(child);
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            // Fix Sketchfab materials with alphaMode BLEND that shouldn't be transparent
            if (mat.transparent && (mat.opacity === undefined || mat.opacity >= 0.95) && !/glass|cam|window/i.test(mat.name || '')) {
              mat.depthWrite = true;
              mat.transparent = false;
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
    unwantedChildren.forEach((c) => c.parent && c.parent.remove(c));

    const pivot = new THREE.Group();
    pivot.name = 'CustomModelPivot';
    pivot.add(model);

    // Initial bounding box analysis
    model.updateMatrixWorld(true);
    let rawBox = new THREE.Box3().setFromObject(model);
    let rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);

    // If model length was oriented along Y instead of Z (common in Max/Blender conversions), rotate around X by -90 deg
    if (rawSize.y > rawSize.z * 1.2 && rawSize.y > rawSize.x * 1.2) {
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
      rawBox.setFromObject(model);
      rawBox.getSize(rawSize);
    }

    // If model length was oriented along X instead of Z, rotate 90 degrees around Y
    if (rawSize.x > rawSize.z * 1.15) {
      model.rotation.y = Math.PI / 2;
      model.updateMatrixWorld(true);
      rawBox.setFromObject(model);
      rawBox.getSize(rawSize);
    }

    // Auto-detect if car was exported facing -Z (headlights behind taillights)
    let frontZ: number | null = null;
    let rearZ: number | null = null;
    model.traverse((child) => {
      const name = ((child.name || '') + ' ' + (child.parent?.name || '')).toLowerCase();
      const matName = (((child as any).material?.name) || '').toLowerCase();
      const combined = `${name} ${matName}`;
      // Headlights / front bonnet
      if ((/far|headlight|bonnet|hood/i.test(name) || /clearglass/i.test(matName)) && !/kalorifer|stop|redglass/i.test(combined)) {
        const b = new THREE.Box3().setFromObject(child);
        if (!b.isEmpty()) {
          const center = b.getCenter(new THREE.Vector3());
          if (frontZ === null || center.z < frontZ) frontZ = center.z;
        }
      }
      // Taillights / rear trunk (strictly exclude boot_ok materials)
      if (/stop|taillight/i.test(name) || /redglass/i.test(matName) || /trunk|bagaj/i.test(name) || (/\bboot\b/i.test(name) && !/boot_ok/i.test(combined))) {
        const b = new THREE.Box3().setFromObject(child);
        if (!b.isEmpty()) {
          const center = b.getCenter(new THREE.Vector3());
          if (rearZ === null || center.z > rearZ) rearZ = center.z;
        }
      }
    });

    const isFacingBackward = (frontZ !== null && rearZ !== null && frontZ < rearZ) || (this.id === 'tofas_gltf');
    if (isFacingBackward) {
      model.rotation.y += Math.PI;
      model.updateMatrixWorld(true);
      rawBox.setFromObject(model);
      rawBox.getSize(rawSize);
    }

    if (this.id === 'phantom_super') {
      model.rotation.y += Math.PI;
      model.updateMatrixWorld(true);
      rawBox.setFromObject(model);
      rawBox.getSize(rawSize);
    }

    // Target length is 4.2 meters standard car
    let targetLength = this.dimensions.length || 4.2;
    if (this.id === 'luxury_sedan') {
      targetLength = 4.65;
    }
    const scale = targetLength / Math.max(rawSize.z, 0.01);
    model.scale.set(scale, scale, scale);
    model.updateMatrixWorld(true);

    // Center horizontally and ground on road (Y = 0)
    rawBox.setFromObject(model);
    const center = new THREE.Vector3();
    rawBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= rawBox.min.y;
    model.updateMatrixWorld(true);

    // 0. Merge separated wheel, tyre, and rotor nodes (common in FBX models like Dodge Charger)
    const wheelRoots: THREE.Object3D[] = [];
    const tyreRoots: THREE.Object3D[] = [];
    const rotorRoots: THREE.Object3D[] = [];

    model.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      if (/steering|direksiyon|\bsw\b|interior/i.test(name + ' ' + parentName)) return;

      if (
        (/^wheel_(lf|rf|lr|rr|fl|fr|rl|rr)$/i.test(name) || /lod_a_wheel/i.test(name) || (/wheel[\._\d]/i.test(name) && !/dummy|caliper|blur/i.test(name))) &&
        !/wheel/i.test(parentName)
      ) {
        wheelRoots.push(child);
      }
      if ((/lod_a_tyre/i.test(name) || /tyre[\._\d]|tire[\._\d]/i.test(name)) && !/tyre|tire/i.test(parentName)) {
        tyreRoots.push(child);
      }
      if ((/lod_a_rotor/i.test(name) || /rotor[\._\d]/i.test(name)) && !/rotor/i.test(parentName)) {
        rotorRoots.push(child);
      }
    });

    if (wheelRoots.length >= 4 && tyreRoots.length >= 4) {
      wheelRoots.forEach((wheel) => {
        const wPos = wheel.position;
        const matchingTyre = tyreRoots.find(
          (t) => Math.abs(t.position.x - wPos.x) < 0.15 && Math.abs(t.position.z - wPos.z) < 0.15
        );
        if (matchingTyre && matchingTyre.parent && matchingTyre.parent !== wheel) {
          matchingTyre.position.set(0, 0, 0);
          matchingTyre.rotation.set(0, 0, 0);
          wheel.add(matchingTyre);
        }

        const matchingRotor = rotorRoots.find(
          (r) => Math.abs(r.position.x - wPos.x) < 0.15 && Math.abs(r.position.z - wPos.z) < 0.15
        );
        if (matchingRotor && matchingRotor.parent && matchingRotor.parent !== wheel) {
          matchingRotor.position.set(0, 0, 0);
          matchingRotor.rotation.set(0, 0, 0);
          wheel.add(matchingRotor);
        }
      });
    }

    // Detect and bind 3D wheels for physics rolling and steering animation
    this.customWheels = [];
    this.customSteeringWheel = null;
    const wheelNodes: THREE.Object3D[] = [];
    model.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      const isSteeringWheel = /steering|direksiyon|\bsw\b/i.test(name + ' ' + parentName);

      // Separate detection for interior steering wheel
      if (isSteeringWheel && !this.customSteeringWheel && /steering_wheel|direksiyon/i.test(name)) {
        this.customSteeringWheel = {
          obj: child,
          initialRotZ: child.rotation.z,
        };
      }

      // Hide low-detail duplicate LOD meshes and blur disc rims (never hide WHEEL_LR!)
      if (/(lod_lr|_lod_|rim_blur|jant_blur)/i.test(name) && !/wheel/i.test(name)) {
        child.visible = false;
      }

      // Top-level road wheel root nodes in FBX or GLTF (exclude child meshes inside wheel)
      if (
        !isSteeringWheel &&
        !/wheel|tyre|tire|rotor/i.test(parentName) &&
        (/^wheel_(lf|rf|lr|rr|fl|fr|rl|rr)$/i.test(name) || /lod_a_wheel/i.test(name) || (/wheel[\._\d]/i.test(name) && !/dummy|caliper|blur/i.test(name)))
      ) {
        wheelNodes.push(child);
      }
    });

    this.customWheels = wheelNodes.map((child) => {
      const name = child.name.toLowerCase();
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      const isLeft = /_lf|_lr|_fl|_rl|sol/i.test(name) || child.position.x < 0;
      const isFront = /_lf|_rf|_fl|_fr|front|on/i.test(name) || worldPos.z > 0;
      return {
        obj: child,
        isLeft,
        isFront,
        initialRotY: child.rotation.y,
        initialRotX: child.rotation.x,
      };
    });
    if (this.customWheels.length > 0) {
      console.log(`[Vehicle] Detected ${this.customWheels.length} custom wheels for physics animation.`);
    }

    // Stop/brake light material names (including Golf GTI Index_0_2 and FBX CH_LD_7)
    const stopPattern = /redglass|stop|taillight|stopcam|stopfar|ae_stop|ayarli\.4|ch_ld_7|index_0_2/i;
    // Turn signal light material names
    const signalPattern = /orangeglass|sinyal|turn_signal/i;
    // Headlights
    const headPattern = /clearglass|far|headlight|farcamlar|ae_far|lights_lod|projector/i;
    // Window glass material names or mesh names (including Ferrari glass_gray, Golf Index_0_3, Mini Cooper MCar_Glass, Charger d_glass)
    const glassPattern = /windowglass|window|cam|windscreen|windshield|öncam|mcar_glass|index_0_3|\bglass\b|glass_gray|frontglass|rearglass|d_glass|glass_surr/i;
    const knownGlassNodes = new Set(['_gltfNode_60','_gltfNode_61','_gltfNode_62','_gltfNode_236','farcam002','Object_11','MCarGlass_MCar_Glass_0','glass','Glass_Gray','d_glass','glass_surr','untitledVehicle_Exterior_mm_windows1']);
    // Body paint material names (covers Corsa carpaint, Golf Paint_Color, Mini MCar_Hull, BMW Standard_00FD5B, Tofas primary/kasa/main, Charger color_CH)
    const bodyPattern = /carpaint|paint|body|xr_c|kasa|primary|boot_ok\.[3-9]|boot_ok_[3-9]|boya|govde|^main|mcar_hull|standard_00fd5b|paint_color|color_ch/i;

    // === Configure materials ===
    model.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      mesh.receiveShadow = true;

      const matArr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      matArr.forEach((m: THREE.Material) => {
        const mat = m as THREE.MeshStandardMaterial;
        const matName = (mat.name || '').toLowerCase();
        const meshName = (mesh.name || '').toLowerCase();
        const combined = `${meshName}_${matName}`;

        // Sanitize broken / incomplete compressed textures (only prune corrupted DDS)
        const isBrokenCompressedTexture = (tex: any): boolean => {
          if (!tex || !tex.isCompressedTexture) return false;
          return !Array.isArray(tex.mipmaps) || tex.mipmaps.length === 0 || typeof tex.format !== 'number' || tex.format === 1023;
        };
        if (mat.map && isBrokenCompressedTexture(mat.map)) mat.map = null;
        if (mat.bumpMap && isBrokenCompressedTexture(mat.bumpMap)) mat.bumpMap = null;
        if (mat.normalMap && isBrokenCompressedTexture(mat.normalMap)) mat.normalMap = null;
        if (mat.roughnessMap && isBrokenCompressedTexture(mat.roughnessMap)) mat.roughnessMap = null;
        if (mat.metalnessMap && isBrokenCompressedTexture(mat.metalnessMap)) mat.metalnessMap = null;
        if (mat.aoMap && isBrokenCompressedTexture(mat.aoMap)) mat.aoMap = null;

        // Fix BMW E46 & Single-mesh Ghost Car Transparency bug (alphaMode: BLEND on entire car body)
        if (/standard_00fd5b/i.test(matName) || meshName.includes('cleaner.materialmerger')) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.alphaTest = 0.5;
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.28;
          mat.metalness = 0.65;
          (mat as any).isBodyPaint = true;
        }

        // 1. Stop / Tail Lights (Ruby red glass + dynamic brake illumination)
        if (stopPattern.test(combined)) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.color = new THREE.Color(0x7a1212);
          mat.emissive = new THREE.Color(0x380505);
          mat.emissiveIntensity = 0.28;
          mat.roughness = 0.18;
          mat.metalness = 0.35;
          this.customBrakeLightMaterials.push(mat);
        }
        // 2. Turn Signals (Amber / Orange)
        else if (signalPattern.test(combined)) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.color = new THREE.Color(0xd46005);
          mat.emissive = new THREE.Color(0x5a2000);
          mat.emissiveIntensity = 0.3;
        }
        // 3. Headlights (Bright illumination)
        else if (headPattern.test(combined)) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.emissive = new THREE.Color(0xfcfcfa);
          mat.emissiveIntensity = 0.45;
          mat.roughness = 0.12;
          mat.metalness = 0.85;
        }
        // 4. Windows / Glass: Clear, realistic tinted glass for cockpit view
        else if (glassPattern.test(combined) || knownGlassNodes.has(mesh.name) || knownGlassNodes.has(mat.name)) {
          mat.transparent = true;
          mat.opacity = mat.map ? 0.22 : 0.12;
          mat.depthWrite = false;
          mat.roughness = 0.05;
          mat.metalness = 0.08;
          mat.color = new THREE.Color(0xdceaff);
          mat.side = THREE.DoubleSide;
          mesh.renderOrder = 10;
        }
        // 5. Body Paint (High-gloss PBR Lacquer)
        else if (bodyPattern.test(combined) || (mat as any).isBodyPaint) {
          mat.transparent = false;
          mat.depthWrite = true;
          (mat as any).isBodyPaint = true;
          if (matName.includes('mcar_hull') || meshName.includes('mcar_mcar_hull')) {
            (mat as any).isMiniCooperHull = true;
            mat.metalness = 0.08;
            mat.roughness = 0.20;
            mat.aoMap = null;
            mat.color.setHex(0xffffff);
          } else {
            mat.metalness = 0.65;
            mat.roughness = 0.22;
          }
        }
        // 6. Chrome / Mirror
        else if (/chrome|mirror/i.test(combined)) {
          mat.metalness = 0.95;
          mat.roughness = 0.12;
          mat.depthWrite = true;
        }
        // 7. Tires
        else if (/tire|lastik|tyre|teker/i.test(combined)) {
          mat.metalness = 0.05;
          mat.roughness = 0.90;
          mat.depthWrite = true;
          mat.color = new THREE.Color(0x1a1c1e);
        }
        // 8. Rims & Alloy
        else if (/rim|jant|wheel_rim|metal_white|rim_second/i.test(combined)) {
          mat.metalness = 0.88;
          mat.roughness = 0.18;
          mat.depthWrite = true;
          if (!mat.map) {
            mat.color = new THREE.Color(0xcccccc);
          }
        }
        // 9. Black Trims, Rubbers, Grilles & Mouldings
        else if (/^black$/i.test(matName) || /_black|plastik|trim|grille|rubber|tampon_siyah/i.test(combined)) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.color = new THREE.Color(0x131518);
          mat.roughness = 0.85;
          mat.metalness = 0.08;
        }
        // 10. Automotive Interior (Dashboard, Steering Wheel, Seats, Headliner, Door Panels)
        else if (
          /interior|konsol|direksiyon|seat|koltuk|torpido|gosterge/i.test(combined) ||
          meshName.startsWith('object_44') ||
          meshName.startsWith('object_45') ||
          meshName.startsWith('object_46') ||
          meshName.startsWith('object_47')
        ) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.metalness = 0.08;

          if (meshName.includes('45') || /dashboard|steering|direksiyon|torpido/i.test(combined)) {
            // Dashboard & Steering Wheel: Visible Graphite / Anthracite Automotive Polymer
            mat.color = new THREE.Color(0x4c5563);
            mat.roughness = 0.65;
            mat.emissive = new THREE.Color(0x242a32);
            mat.emissiveIntensity = 0.55;
          } else if (meshName.includes('44') || /seat|koltuk/i.test(combined)) {
            // Seats & Cabin Floor: Dark Textured Slate
            mat.color = new THREE.Color(0x3e4550);
            mat.roughness = 0.80;
            mat.emissive = new THREE.Color(0x1c2128);
            mat.emissiveIntensity = 0.40;
          } else if (meshName.includes('46') || /pillar|roof|tavan/i.test(combined)) {
            // A/B/C Pillars & Headliner: Light Grey Fabric Headliner (Factory Opel Spec)
            mat.color = new THREE.Color(0x656e7c);
            mat.roughness = 0.70;
            mat.emissive = new THREE.Color(0x282e38);
            mat.emissiveIntensity = 0.50;
          } else {
            // Rear parcel shelf and interior accents
            mat.color = new THREE.Color(0x343a44);
            mat.roughness = 0.80;
            mat.emissive = new THREE.Color(0x181d24);
            mat.emissiveIntensity = 0.35;
          }
        }
        // 11. Default solid objects
        else {
          mat.depthWrite = true;
        }

        mat.needsUpdate = true;
      });
    });

    GLTFModelLoader.applySmartShadows(model);

    // Recompute final dimensions
    const finalBox = new THREE.Box3().setFromObject(model);
    const finalSize = new THREE.Vector3();
    finalBox.getSize(finalSize);
    this.dimensions.length = finalSize.z;
    this.dimensions.width = finalSize.x;
    this.dimensions.height = finalSize.y;

    // Adjust road headlight beams and brake light glow to fit custom model dimensions
    if (this.headlightBeams.length >= 2) {
      this.headlightBeams[0].position.set(-finalSize.x * 0.32, 0.04, finalSize.z * 0.5);
      this.headlightBeams[1].position.set(finalSize.x * 0.32, 0.04, finalSize.z * 0.5);
    }
    if (this.brakeLightGlow) {
      this.brakeLightGlow.position.set(0, 0.04, -finalSize.z * 0.5);
    }
    if (this.nitroFlames.length >= 2) {
      this.nitroFlames[0].position.set(-finalSize.x * 0.22, finalSize.y * 0.2, -finalSize.z * 0.52 - 0.4);
      this.nitroFlames[1].position.set(finalSize.x * 0.22, finalSize.y * 0.2, -finalSize.z * 0.52 - 0.4);
    }

    // Manage wheels visibility and positioning for custom models
    if (this.customWheels.length >= 4) {
      // 3D model has its own 4 animated wheel nodes (e.g. Tofaş Doğan SLX FBX)
      this.wheelsGroup.visible = false;
    } else {
      // Single-mesh or merged-wheel models (Mini Cooper, Opel Corsa, Golf, BMW)
      // use the high-fidelity procedural wheel assembly!
      this.wheelsGroup.visible = true;

      // Hide baked static tire/rim/hubcap meshes in models like Opel Corsa
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const matName = (Array.isArray(mesh.material) ? mesh.material[0]?.name : mesh.material?.name || '').toLowerCase();
          const meshName = (mesh.name || '').toLowerCase();
          if (
            matName === 'tire' ||
            matName === 'rim_second' ||
            /^object_(5[8-9]|6\d|7[0-5])$/i.test(meshName) ||
            /hubcap|jant_kapak|wheel_static/i.test(meshName)
          ) {
            mesh.visible = false;
          }
        }
      });

      // Align wheels with custom car model dimensions
      let halfTrack = finalSize.x * 0.44;
      let frontZ = finalSize.z * 0.28;
      let rearZ = -finalSize.z * 0.29;
      let wheelRadius = this.dimensions.wheelRadius || 0.33;
      let wheelScale = 1.0;

      if (this.id === 'opel_corsa_b') {
        halfTrack = 0.78;
        frontZ = 1.292;
        rearZ = -1.470;
        wheelRadius = 0.324;
        wheelScale = 0.98;
      }

      if (this.frontWheels.length >= 2 && this.rearWheels.length >= 2) {
        this.frontWheels[0].position.set(-halfTrack, wheelRadius, frontZ);
        this.frontWheels[1].position.set(halfTrack, wheelRadius, frontZ);
        this.frontWheels[0].scale.set(wheelScale, wheelScale, wheelScale);
        this.frontWheels[1].scale.set(wheelScale, wheelScale, wheelScale);

        this.rearWheels[0].position.set(-halfTrack, wheelRadius, rearZ);
        this.rearWheels[1].position.set(halfTrack, wheelRadius, rearZ);
        this.rearWheels[0].scale.set(wheelScale, wheelScale, wheelScale);
        this.rearWheels[1].scale.set(wheelScale, wheelScale, wheelScale);
      }
    }

    this.customModelGroup.add(pivot);
    this.customModelGroup.visible = true;
    this.isUsingCustomModel = true;
    this.updateBoundingBox();
  }

  public rotateCustomModel(radians: number = Math.PI): void {
    const pivot = this.customModelGroup.getObjectByName('CustomModelPivot');
    if (pivot) {
      pivot.rotation.y += radians;
    }
  }

  public resetToProceduralModel(): void {
    while (this.customModelGroup.children.length > 0) {
      this.customModelGroup.remove(this.customModelGroup.children[0]);
    }
    this.customModelGroup.visible = false;
    this.proceduralGroup.visible = true;
    this.wheelsGroup.visible = true;
    this.isUsingCustomModel = false;
    this.customSteeringWheel = null;

    const halfBase = this.dimensions.wheelBase / 2;
    const halfTrack = this.dimensions.wheelTrack / 2;
    const wheelRadius = this.dimensions.wheelRadius;
    if (this.frontWheels.length >= 2 && this.rearWheels.length >= 2) {
      this.frontWheels[0].position.set(-halfTrack, wheelRadius, halfBase);
      this.frontWheels[1].position.set(halfTrack, wheelRadius, halfBase);
      this.rearWheels[0].position.set(-halfTrack, wheelRadius, -halfBase);
      this.rearWheels[1].position.set(halfTrack, wheelRadius, -halfBase);
      this.wheelMeshes.forEach((w) => w.scale.set(1, 1, 1));
    }

    this.updateBoundingBox();
  }

  public updateBoundingBox(): void {
    const halfWidth = this.dimensions.width * 0.45; // Slightly forgiving hitbox
    const halfLength = this.dimensions.length * 0.45;
    const height = this.dimensions.height;

    const pos = this.mesh.position;
    this.boundingBox.min.set(pos.x - halfWidth, 0, pos.z - halfLength);
    this.boundingBox.max.set(pos.x + halfWidth, height, pos.z + halfLength);
  }
}
