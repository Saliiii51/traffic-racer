// CityPackManager.ts - Ultra-lightweight manager for Kenney building-a (108 KB)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BuildingCategory = 'skyscraper' | 'commercial' | 'residential' | 'house';

export interface BuildingTemplate {
  id: string;
  name: string;
  category: BuildingCategory;
  model: THREE.Group;
  dimensions: {
    width: number;
    height: number;
    length: number;
  };
  baseFacing: number; // Native yaw rotation to point front facade towards +X
}

export class CityPackManager {
  private static instance: CityPackManager;
  private buildings: BuildingTemplate[] = [];
  private isLoaded = false;
  private loadPromise: Promise<boolean> | null = null;
  private readyCallbacks: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): CityPackManager {
    if (!CityPackManager.instance) {
      CityPackManager.instance = new CityPackManager();
    }
    return CityPackManager.instance;
  }

  public get hasBuildings(): boolean {
    return this.buildings.length > 0;
  }

  public get buildingCount(): number {
    return this.buildings.length;
  }

  public getBuildingById(id: string): BuildingTemplate | undefined {
    return this.buildings.find((b) => b.id === id);
  }

  public isReady(): boolean {
    return this.isLoaded && this.buildings.length > 0;
  }

  public onReady(callback: () => void): void {
    if (this.isLoaded) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  public async load(): Promise<boolean> {
    if (this.isLoaded) return this.buildings.length > 0;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        '/models/building-a.glb',
        (gltf) => {
          try {
            const rawModel = gltf.scene;
            rawModel.updateMatrixWorld(true);

            rawModel.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = true;
                if (mesh.material) {
                  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                  mat.side = THREE.FrontSide;
                }
              }
            });

            const rawBox = new THREE.Box3().setFromObject(rawModel);
            const rawCenter = new THREE.Vector3();
            rawBox.getCenter(rawCenter);

            rawModel.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);

            const container = new THREE.Group();
            container.name = 'BuildingContainer_building-a';
            container.add(rawModel);
            const scale = 9.0;
            container.scale.set(scale, scale, scale);
            container.updateMatrixWorld(true);

            const finalBox = new THREE.Box3().setFromObject(container);
            const finalSize = new THREE.Vector3();
            finalBox.getSize(finalSize);

            const template: BuildingTemplate = {
              id: 'building-a',
              name: 'Modern Plaza A',
              category: 'commercial',
              model: container,
              dimensions: {
                width: finalSize.x,
                height: finalSize.y,
                length: finalSize.z,
              },
              baseFacing: -Math.PI / 2,
            };

            this.buildings = [template];
            this.isLoaded = true;
            this.readyCallbacks.forEach((cb) => cb());
            this.readyCallbacks = [];
            resolve(true);
          } catch (err) {
            console.warn('[CityPackManager] Error setting up building-a:', err);
            this.isLoaded = true;
            resolve(false);
          }
        },
        undefined,
        (err) => {
          console.warn('[CityPackManager] Failed to load /models/building-a.glb:', err);
          this.isLoaded = true;
          resolve(false);
        }
      );
    });

    return this.loadPromise;
  }

  public createBuildingInstance(
    _indexOrId?: number | string,
    options: { facingRoad?: 'left' | 'right'; randomYaw?: boolean } = {}
  ): THREE.Group | null {
    if (this.buildings.length === 0) return null;
    const template = this.buildings[0];

    const wrapper = new THREE.Group();
    wrapper.name = `Building_${template.id}`;

    const clone = template.model.clone(true);
    wrapper.add(clone);

    let yaw = template.baseFacing;
    if (options.facingRoad === 'left') {
      yaw += 0;
    } else if (options.facingRoad === 'right') {
      yaw += Math.PI;
    }

    if (options.randomYaw !== false) {
      yaw += (Math.random() - 0.5) * 0.12;
    }

    wrapper.rotation.y = yaw;
    return wrapper;
  }
}

export const cityPackManager = CityPackManager.getInstance();
