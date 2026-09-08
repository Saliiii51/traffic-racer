// Mobile-optimized particle system for crash debris, speed lines, tire smoke, and backfire sparks

import * as THREE from 'three';

interface ParticleItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public group: THREE.Group;
  private debrisPool: ParticleItem[] = [];
  private smokePool: ParticleItem[] = [];
  private speedLines!: THREE.LineSegments;
  private speedLinesActive = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ParticleSystem';

    this.initDebrisPool();
    this.initSmokePool();
    this.initSpeedLines();
  }

  private initDebrisPool(): void {
    const debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(
        debrisGeo,
        new THREE.MeshStandardMaterial({
          color: 0xff3333,
          roughness: 0.5,
          metalness: 0.5,
        })
      );
      mesh.visible = false;
      this.group.add(mesh);

      this.debrisPool.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2,
      });
    }
  }

  private initSmokePool(): void {
    const smokeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(
        smokeGeo,
        new THREE.MeshBasicMaterial({
          color: 0xdddddd,
          transparent: true,
          opacity: 0.45,
        })
      );
      mesh.visible = false;
      this.group.add(mesh);

      this.smokePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
      });
    }
  }

  private initSpeedLines(): void {
    const lineCount = 40;
    const positions = new Float32Array(lineCount * 6);

    for (let i = 0; i < lineCount; i++) {
      const x = (Math.random() * 2 - 1) * 12;
      const y = Math.random() * 5 + 0.5;
      const z = (Math.random() * 2 - 1) * 30;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - (4 + Math.random() * 4);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.45,
    });

    this.speedLines = new THREE.LineSegments(geo, mat);
    this.speedLines.visible = false;
    this.group.add(this.speedLines);
  }

  public triggerCrashExplosion(position: THREE.Vector3, colorHex = '#e63946'): void {
    const col = new THREE.Color(colorHex);

    for (const p of this.debrisPool) {
      (p.mesh.material as THREE.MeshStandardMaterial).color = col;
      p.mesh.position.copy(position);
      p.mesh.position.y += 0.5;
      p.mesh.visible = true;

      p.velocity.set(
        (Math.random() * 2 - 1) * 12,
        Math.random() * 10 + 4,
        (Math.random() * 2 - 1) * 12
      );

      p.rotVelocity.set(
        Math.random() * 15,
        Math.random() * 15,
        Math.random() * 15
      );

      p.life = p.maxLife;
    }
  }

  public emitTireSmoke(position: THREE.Vector3, isDrifting = false): void {
    const available = this.smokePool.find((p) => p.life <= 0);
    if (!available) return;

    available.mesh.position.copy(position);
    available.mesh.position.y = 0.15;
    available.mesh.position.x += (Math.random() * 2 - 1) * 0.4;
    available.mesh.position.z -= 1.2;
    available.mesh.visible = true;

    available.velocity.set(
      (Math.random() * 2 - 1) * (isDrifting ? 3.0 : 1.0),
      Math.random() * 1.5 + 0.5,
      -Math.random() * 2.0
    );

    available.rotVelocity.set(
      Math.random() * 4,
      Math.random() * 4,
      Math.random() * 4
    );

    available.life = available.maxLife;
  }

  public emitWetRoadSpray(position: THREE.Vector3, speedKmh: number): void {
    if (speedKmh < 45) return;
    for (let side = -1; side <= 1; side += 2) {
      const available = this.smokePool.find((p) => p.life <= 0);
      if (!available) break;

      const mat = available.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xd0e8f2); // misty light water blue
      mat.opacity = 0.35;

      available.mesh.position.set(
        position.x + side * 0.85,
        0.15,
        position.z - 2.0
      );

      const spraySpeed = (speedKmh / 120) * 8.0;
      available.velocity.set(
        side * (0.8 + Math.random() * 1.2),
        0.8 + Math.random() * 1.5,
        -spraySpeed
      );

      available.life = 0.35;
      available.maxLife = 0.35;
      available.mesh.scale.set(0.45, 0.45, 0.45);
      available.mesh.visible = true;
    }
  }

  public emitEngineSmoke(position: THREE.Vector3, isCritical = false): void {
    const available = this.smokePool.find((p) => p.life <= 0);
    if (!available) return;

    available.mesh.position.copy(position);
    available.mesh.position.y = 0.55;
    available.mesh.position.z += 1.35;
    available.mesh.position.x += (Math.random() * 2 - 1) * 0.25;
    available.mesh.visible = true;

    // Dark soot smoke for heavy damage
    (available.mesh.material as THREE.MeshBasicMaterial).color.set(isCritical ? 0x222222 : 0x555555);

    available.velocity.set(
      (Math.random() * 2 - 1) * 0.8,
      Math.random() * 2.2 + 1.2,
      -Math.random() * 4.0 - 2.0
    );

    available.rotVelocity.set(
      Math.random() * 5,
      Math.random() * 5,
      Math.random() * 5
    );

    available.life = available.maxLife;
  }

  public emitBackfireSparks(position: THREE.Vector3, isNitro = false): void {
    // 1. High-speed incandescent sparks from debrisPool
    const sparkColors = isNitro
      ? [new THREE.Color(0x00f5ff), new THREE.Color(0x88eeff), new THREE.Color(0xffffff)]
      : [new THREE.Color(0xffaa00), new THREE.Color(0xff4400), new THREE.Color(0xffff66)];

    const sparkCount = isNitro ? 6 : 9;
    for (let i = 0; i < sparkCount; i++) {
      const p = this.debrisPool.find((d) => d.life <= 0);
      if (!p) break;

      (p.mesh.material as THREE.MeshStandardMaterial).color = sparkColors[i % sparkColors.length];
      p.mesh.position.copy(position);
      p.mesh.position.x += (Math.random() * 2 - 1) * 0.06;
      p.mesh.position.y += (Math.random() * 2 - 1) * 0.04;
      p.mesh.visible = true;

      // Shoot forcefully backward (-Z) with turbulent scatter
      p.velocity.set(
        (Math.random() * 2 - 1) * 2.8,
        Math.random() * 2.4 + 0.8,
        -Math.random() * 14 - 8
      );

      p.rotVelocity.set(
        Math.random() * 25,
        Math.random() * 25,
        Math.random() * 25
      );

      p.life = 0.28;
      p.maxLife = 0.28;
    }

    // 2. Unburnt carbon soot smoke puff from smokePool
    for (let i = 0; i < 2; i++) {
      const s = this.smokePool.find((p) => p.life <= 0);
      if (!s) break;

      s.mesh.position.copy(position);
      s.mesh.position.z -= 0.15;
      s.mesh.visible = true;
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(isNitro ? 0x113355 : 0x282828);

      s.velocity.set(
        (Math.random() * 2 - 1) * 0.6,
        Math.random() * 1.5 + 0.6,
        -Math.random() * 5.0 - 2.5
      );

      s.life = 0.35;
      s.maxLife = 0.35;
    }
  }

  public emitScrapeSparks(position: THREE.Vector3, count = 12): void {
    const sparkColor = new THREE.Color(0xffbb22);
    let spawned = 0;

    for (const p of this.debrisPool) {
      if (p.life > 0) continue;

      (p.mesh.material as THREE.MeshStandardMaterial).color = sparkColor;
      p.mesh.position.copy(position);
      p.mesh.position.y = Math.max(0.2, position.y + (Math.random() * 0.3 - 0.15));
      p.mesh.visible = true;

      p.velocity.set(
        (Math.random() * 2 - 1) * 8,
        Math.random() * 6 + 2,
        (Math.random() * 2 - 1) * 6
      );

      p.rotVelocity.set(
        Math.random() * 20,
        Math.random() * 20,
        Math.random() * 20
      );

      p.life = 0.32;
      p.maxLife = 0.32;

      spawned++;
      if (spawned >= count) break;
    }
  }

  public setSpeedEffects(active: boolean, playerPos: THREE.Vector3): void {
    this.speedLinesActive = active;
    this.speedLines.visible = active;
    if (active) {
      this.speedLines.position.set(0, 0, playerPos.z);
    }
  }

  public update(delta: number, playerPos: THREE.Vector3): void {
    // 1. Update debris particles
    for (const p of this.debrisPool) {
      if (p.life > 0) {
        p.life -= delta;
        p.velocity.y -= 22 * delta; // Gravity
        p.mesh.position.addScaledVector(p.velocity, delta);

        p.mesh.rotation.x += p.rotVelocity.x * delta;
        p.mesh.rotation.y += p.rotVelocity.y * delta;
        p.mesh.rotation.z += p.rotVelocity.z * delta;

        // Ground bounce
        if (p.mesh.position.y < 0.1) {
          p.mesh.position.y = 0.1;
          p.velocity.y = -p.velocity.y * 0.4;
          p.velocity.x *= 0.7;
          p.velocity.z *= 0.7;
        }

        const scale = Math.max(0.01, p.life / p.maxLife);
        p.mesh.scale.set(scale, scale, scale);

        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    }

    // 2. Update tire smoke particles
    for (const s of this.smokePool) {
      if (s.life > 0) {
        s.life -= delta;
        s.mesh.position.addScaledVector(s.velocity, delta);

        const progress = 1.0 - s.life / s.maxLife;
        const scale = 0.6 + progress * 2.2;
        s.mesh.scale.set(scale, scale, scale);

        const mat = s.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.45 * (s.life / s.maxLife));

        if (s.life <= 0) {
          s.mesh.visible = false;
        }
      }
    }

    // 3. Update speed lines if active
    if (this.speedLinesActive) {
      this.speedLines.position.z = playerPos.z + 5;
    }
  }

  public reset(): void {
    for (const p of this.debrisPool) {
      p.life = 0;
      p.mesh.visible = false;
    }
    for (const s of this.smokePool) {
      s.life = 0;
      s.mesh.visible = false;
    }
    this.speedLinesActive = false;
    this.speedLines.visible = false;
  }
}
