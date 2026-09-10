// RaceStarterCharacter.ts - 3D Race Starter Character with procedural animations & flags
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type StarterAnimationState = 'HIDDEN' | 'IDLE' | 'RAISE_ARMS' | 'COUNTDOWN_HOLD' | 'START_DROP' | 'WATCH_CARS';

interface CachedBone {
  bone: THREE.Bone;
  restQuat: THREE.Quaternion;
  currentQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
}

export class RaceStarterCharacter {
  public readonly group: THREE.Group;
  public isLoaded = false;
  public state: StarterAnimationState = 'IDLE';

  private modelRoot: THREE.Group | null = null;
  private animTime = 0;
  private stateProgress = 0;

  // Cached key humanoid bones
  private leftUpperArm: CachedBone | null = null;
  private rightUpperArm: CachedBone | null = null;
  private leftLowerArm: CachedBone | null = null;
  private rightLowerArm: CachedBone | null = null;
  private leftHand: CachedBone | null = null;
  private rightHand: CachedBone | null = null;
  private head: CachedBone | null = null;
  private spine: CachedBone | null = null;
  private pelvis: CachedBone | null = null;

  // Visual Flag Props attached to hands
  private leftFlagCloth: THREE.Mesh | null = null;
  private rightFlagCloth: THREE.Mesh | null = null;
  private leftGlowTip: THREE.PointLight | null = null;
  private rightGlowTip: THREE.PointLight | null = null;

  // Staging positioning: Center of road at Z = 3.5m (facing oncoming cars at -Z)
  // Staging positioning: Center of road at Z = 3.5m (facing oncoming cars at -Z)
  private readonly defaultPos = new THREE.Vector3(0, 0.02, 3.5);
  private readonly scaleFactor = 0.95; // glTF FBX node has 0.01 scale; 199 * 0.01 * 0.95 = 1.89m height

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'RaceStarterCharacterRoot';
    this.group.position.copy(this.defaultPos);
    this.group.rotation.y = Math.PI; // Face oncoming cars coming from -Z
    scene.add(this.group);

    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/models/karakter.glb',
      (gltf) => {
        this.modelRoot = gltf.scene;
        this.modelRoot.name = 'KarakterMeshRoot';
        this.modelRoot.scale.setScalar(this.scaleFactor);

        // Enhance materials and enable realistic casting/receiving shadows
        this.modelRoot.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false; // Prevent procedural bone animations from being culled
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = Math.max(0.35, Math.min(0.85, mat.roughness ?? 0.6));
              mat.metalness = Math.min(0.3, mat.metalness ?? 0.1);
              mat.needsUpdate = true;
            }
          }

          if ((child as THREE.Bone).isBone) {
            const bone = child as THREE.Bone;
            this.cacheBone(bone);
          }
        });

        // Attach stylized checkered race starter flags to both hands
        this.attachFlags();

        this.group.add(this.modelRoot);
        this.isLoaded = true;
        this.setState('IDLE');
      },
      undefined,
      (err) => {
        console.error('[RaceStarterCharacter] Error loading /models/karakter.glb:', err);
      }
    );
  }

  private cacheBone(bone: THREE.Bone): void {
    const name = bone.name.toLowerCase();
    // Ignore auxiliary twist and scale compensation bones
    if (name.includes('twist') || name.includes('scale') || name.includes('compensation')) {
      return;
    }

    const entry: CachedBone = {
      bone,
      restQuat: bone.quaternion.clone(),
      currentQuat: bone.quaternion.clone(),
      targetQuat: bone.quaternion.clone(),
    };

    if (name.startsWith('upperarm_l')) {
      this.leftUpperArm = entry;
    } else if (name.startsWith('upperarm_r')) {
      this.rightUpperArm = entry;
    } else if (name.startsWith('lowerarm_l')) {
      this.leftLowerArm = entry;
    } else if (name.startsWith('lowerarm_r')) {
      this.rightLowerArm = entry;
    } else if (name.startsWith('hand_l')) {
      this.leftHand = entry;
    } else if (name.startsWith('hand_r')) {
      this.rightHand = entry;
    } else if (name.startsWith('head')) {
      this.head = entry;
    } else if (name.startsWith('spine_01')) {
      this.spine = entry;
    } else if (name.startsWith('pelvis')) {
      this.pelvis = entry;
    }
  }

  private attachFlags(): void {
    if (!this.leftHand || !this.rightHand) return;

    // Create high-contrast checkered pattern flag texture via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const size = 32;
      for (let y = 0; y < 128; y += size) {
        for (let x = 0; x < 128; x += size) {
          const isWhite = ((x / size) + (y / size)) % 2 === 0;
          ctx.fillStyle = isWhite ? '#f8fafc' : '#09090b';
          ctx.fillRect(x, y, size, size);
        }
      }
      // Add glowing neon yellow/green border stripe
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, 8, 128);
    }

    const flagTex = new THREE.CanvasTexture(canvas);
    flagTex.wrapS = THREE.RepeatWrapping;
    flagTex.wrapT = THREE.RepeatWrapping;

    const flagMaterial = new THREE.MeshStandardMaterial({
      map: flagTex,
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.1,
    });

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Left Flag
    const leftFlagGroup = new THREE.Group();
    leftFlagGroup.name = 'LeftStartFlag';
    const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 65, 8), poleMat);
    leftPole.position.set(0, 25, 0);
    leftPole.castShadow = true;
    leftFlagGroup.add(leftPole);

    const flagGeo = new THREE.PlaneGeometry(38, 26, 6, 4);
    this.leftFlagCloth = new THREE.Mesh(flagGeo, flagMaterial);
    this.leftFlagCloth.position.set(19, 45, 0);
    this.leftFlagCloth.castShadow = true;
    leftFlagGroup.add(this.leftFlagCloth);

    // Green beacon LED tip on pole top
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const leftLed = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), ledMat);
    leftLed.position.set(0, 58, 0);
    leftFlagGroup.add(leftLed);

    this.leftGlowTip = new THREE.PointLight(0x10b981, 0.6, 250);
    this.leftGlowTip.position.set(0, 58, 0);
    leftFlagGroup.add(this.leftGlowTip);

    this.leftHand.bone.add(leftFlagGroup);

    // Right Flag
    const rightFlagGroup = new THREE.Group();
    rightFlagGroup.name = 'RightStartFlag';
    const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 65, 8), poleMat);
    rightPole.position.set(0, 25, 0);
    rightPole.castShadow = true;
    rightFlagGroup.add(rightPole);

    this.rightFlagCloth = new THREE.Mesh(flagGeo.clone(), flagMaterial);
    this.rightFlagCloth.position.set(-19, 45, 0);
    this.rightFlagCloth.castShadow = true;
    rightFlagGroup.add(this.rightFlagCloth);

    const rightLed = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), ledMat);
    rightLed.position.set(0, 58, 0);
    rightFlagGroup.add(rightLed);

    this.rightGlowTip = new THREE.PointLight(0x10b981, 0.6, 250);
    this.rightGlowTip.position.set(0, 58, 0);
    rightFlagGroup.add(this.rightGlowTip);

    this.rightHand.bone.add(rightFlagGroup);
  }

  public setState(nextState: StarterAnimationState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    this.stateProgress = 0;

    if (this.state === 'HIDDEN') {
      this.group.visible = false;
    } else {
      this.group.visible = true;
    }
  }

  public triggerPulse(_count: number): void {
    this.state = 'COUNTDOWN_HOLD';
    this.stateProgress = 0;
  }

  public triggerStartDrop(): void {
    this.state = 'START_DROP';
    this.stateProgress = 0;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  public setRotationY(angleRad: number): void {
    this.group.rotation.y = angleRad;
  }

  public update(delta: number, leadCarZ = -10): void {
    if (!this.isLoaded || !this.group.visible) return;

    this.animTime += delta;
    this.stateProgress += delta;

    // Animate flag cloth fluttering in wind
    this.updateFlagCloth(this.animTime);

    // Procedural bone posing based on state
    switch (this.state) {
      case 'IDLE':
        this.animateIdle(delta);
        break;

      case 'RAISE_ARMS':
        this.animateRaiseArms(delta);
        break;

      case 'COUNTDOWN_HOLD':
        this.animateCountdownHold(delta);
        break;

      case 'START_DROP':
        this.animateStartDrop(delta);
        break;

      case 'WATCH_CARS':
        this.animateWatchCars(delta, leadCarZ);
        break;
    }

    // Apply smooth quaternion slerp to all registered bones
    this.applyBoneTransforms(delta);
  }

  private updateFlagCloth(time: number): void {
    const flutter1 = Math.sin(time * 12.0) * 0.15 + Math.cos(time * 24.0) * 0.08;
    const flutter2 = Math.sin(time * 14.0 + 1.2) * 0.15 + Math.cos(time * 28.0) * 0.08;

    if (this.leftFlagCloth) {
      this.leftFlagCloth.rotation.y = flutter1;
      this.leftFlagCloth.rotation.z = Math.sin(time * 6.0) * 0.05;
    }
    if (this.rightFlagCloth) {
      this.rightFlagCloth.rotation.y = -flutter2;
      this.rightFlagCloth.rotation.z = -Math.sin(time * 6.0 + 0.8) * 0.05;
    }
  }

  private animateIdle(_delta: number): void {
    const breath = Math.sin(this.animTime * 2.2) * 0.03;
    const sway = Math.sin(this.animTime * 1.1) * 0.04;

    // Spine breathing
    if (this.spine) {
      const q = this.spine.restQuat.clone();
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), breath);
      this.spine.targetQuat.multiplyQuaternions(q, rot);
    }

    // Head looking slightly left and right checking the staging lanes
    if (this.head) {
      const q = this.head.restQuat.clone();
      const lookRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sway * 2.0);
      this.head.targetQuat.multiplyQuaternions(q, lookRot);
    }

    // Arms resting naturally low at sides holding flags
    if (this.leftUpperArm) {
      const q = this.leftUpperArm.restQuat.clone();
      const armPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, -0.15));
      this.leftUpperArm.targetQuat.multiplyQuaternions(q, armPose);
    }
    if (this.rightUpperArm) {
      const q = this.rightUpperArm.restQuat.clone();
      const armPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0.15));
      this.rightUpperArm.targetQuat.multiplyQuaternions(q, armPose);
    }

    if (this.leftLowerArm) {
      const q = this.leftLowerArm.restQuat.clone();
      const bend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3);
      this.leftLowerArm.targetQuat.multiplyQuaternions(q, bend);
    }
    if (this.rightLowerArm) {
      const q = this.rightLowerArm.restQuat.clone();
      const bend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.3);
      this.rightLowerArm.targetQuat.multiplyQuaternions(q, bend);
    }
  }

  private animateRaiseArms(_delta: number): void {
    const t = Math.min(1.0, this.stateProgress / 0.8);
    const smoothT = t * t * (3 - 2 * t);

    // Spine stands tall
    if (this.spine) {
      const q = this.spine.restQuat.clone();
      const chestUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.06 * smoothT);
      this.spine.targetQuat.multiplyQuaternions(q, chestUp);
    }

    // Head looks high and commanding
    if (this.head) {
      const q = this.head.restQuat.clone();
      const chinUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12 * smoothT);
      this.head.targetQuat.multiplyQuaternions(q, chinUp);
    }

    // Upper arms raise into high dramatic V shape (~135 degrees up)
    if (this.leftUpperArm) {
      const q = this.leftUpperArm.restQuat.clone();
      const raiseLeft = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.1 * smoothT, 0.2 * smoothT, -1.95 * smoothT)
      );
      this.leftUpperArm.targetQuat.multiplyQuaternions(q, raiseLeft);
    }
    if (this.rightUpperArm) {
      const q = this.rightUpperArm.restQuat.clone();
      const raiseRight = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.1 * smoothT, -0.2 * smoothT, 1.95 * smoothT)
      );
      this.rightUpperArm.targetQuat.multiplyQuaternions(q, raiseRight);
    }

    // Lower arms extend upward holding flags rigid
    if (this.leftLowerArm) {
      const q = this.leftLowerArm.restQuat.clone();
      const lower = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.2 * smoothT);
      this.leftLowerArm.targetQuat.multiplyQuaternions(q, lower);
    }
    if (this.rightLowerArm) {
      const q = this.rightLowerArm.restQuat.clone();
      const lower = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2 * smoothT);
      this.rightLowerArm.targetQuat.multiplyQuaternions(q, lower);
    }

    if (t >= 1.0) {
      this.state = 'COUNTDOWN_HOLD';
    }
  }

  private animateCountdownHold(_delta: number): void {
    const pulseDecay = Math.max(0, 1.0 - this.stateProgress * 2.5);
    const pulseAmount = Math.sin(this.stateProgress * 20.0) * 0.08 * pulseDecay;
    const idleTremble = (Math.random() - 0.5) * 0.015;

    if (this.spine) {
      const q = this.spine.restQuat.clone();
      const chest = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.06 + pulseAmount);
      this.spine.targetQuat.multiplyQuaternions(q, chest);
    }

    if (this.head) {
      const q = this.head.restQuat.clone();
      const nod = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1 + pulseAmount * 1.5);
      this.head.targetQuat.multiplyQuaternions(q, nod);
    }

    if (this.leftUpperArm) {
      const q = this.leftUpperArm.restQuat.clone();
      const raiseLeft = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.1, 0.2, -1.95 + pulseAmount + idleTremble)
      );
      this.leftUpperArm.targetQuat.multiplyQuaternions(q, raiseLeft);
    }
    if (this.rightUpperArm) {
      const q = this.rightUpperArm.restQuat.clone();
      const raiseRight = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.1, -0.2, 1.95 - pulseAmount - idleTremble)
      );
      this.rightUpperArm.targetQuat.multiplyQuaternions(q, raiseRight);
    }
  }

  private animateStartDrop(_delta: number): void {
    const t = Math.min(1.0, this.stateProgress / 0.24);
    const whipT = Math.sin((t * Math.PI) / 2);

    if (this.spine) {
      const q = this.spine.restQuat.clone();
      const forwardFlex = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        0.28 * whipT
      );
      this.spine.targetQuat.multiplyQuaternions(q, forwardFlex);
    }

    if (this.head) {
      const q = this.head.restQuat.clone();
      const dip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.22 * whipT);
      this.head.targetQuat.multiplyQuaternions(q, dip);
    }

    if (this.leftUpperArm) {
      const q = this.leftUpperArm.restQuat.clone();
      const currentZ = THREE.MathUtils.lerp(-1.95, 0.45, whipT);
      const armPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35 * whipT, 0, currentZ));
      this.leftUpperArm.targetQuat.multiplyQuaternions(q, armPose);
    }
    if (this.rightUpperArm) {
      const q = this.rightUpperArm.restQuat.clone();
      const currentZ = THREE.MathUtils.lerp(1.95, -0.45, whipT);
      const armPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35 * whipT, 0, currentZ));
      this.rightUpperArm.targetQuat.multiplyQuaternions(q, armPose);
    }

    if (t >= 1.0) {
      this.state = 'WATCH_CARS';
      this.stateProgress = 0;
    }
  }

  private animateWatchCars(_delta: number, leadCarZ: number): void {
    const carOffset = leadCarZ - this.group.position.z;

    if (this.head) {
      const q = this.head.restQuat.clone();
      let lookAngle = 0;
      if (carOffset > 0) {
        lookAngle = Math.min(1.2, carOffset * 0.08);
      }
      const turnHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lookAngle, 0));
      this.head.targetQuat.multiplyQuaternions(q, turnHead);
    }

    if (this.leftUpperArm) {
      const q = this.leftUpperArm.restQuat.clone();
      const pose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, -0.2));
      this.leftUpperArm.targetQuat.multiplyQuaternions(q, pose);
    }
    if (this.rightUpperArm) {
      const q = this.rightUpperArm.restQuat.clone();
      const pump = Math.sin(this.animTime * 6.0) * 0.2;
      const pose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 1.4 + pump));
      this.rightUpperArm.targetQuat.multiplyQuaternions(q, pose);
    }

    if (carOffset > 45) {
      this.group.visible = false;
    }
  }

  private applyBoneTransforms(delta: number): void {
    const speed = 16.0;
    const slerpT = Math.min(1.0, delta * speed);

    const bones = [
      this.leftUpperArm,
      this.rightUpperArm,
      this.leftLowerArm,
      this.rightLowerArm,
      this.leftHand,
      this.rightHand,
      this.head,
      this.spine,
      this.pelvis,
    ];

    for (const b of bones) {
      if (!b) continue;
      b.currentQuat.slerp(b.targetQuat, slerpT);
      b.bone.quaternion.copy(b.currentQuat);
    }
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}