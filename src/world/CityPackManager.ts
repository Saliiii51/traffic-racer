// CityPackManager.ts - High-performance manager for 3D city buildings, skyscrapers, and background skyline
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BuildingCategory = 'commercial' | 'skyscraper' | 'background' | 'residential' | 'house';

export interface BuildingDefinition {
  id: string;
  file: string;
  name: string;
  category: BuildingCategory;
  defaultScale: number;
  baseFacing: number;
}

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
  baseFacing: number;
}

const BUILDING_CATALOG: BuildingDefinition[] = [
  // 1. Commercial Mid-Rises (14 detailed roadside models)
  { id: 'building-a', file: '/models/buildings/building-a.glb', name: 'Plaza A', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-b', file: '/models/buildings/building-b.glb', name: 'Plaza B', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-c', file: '/models/buildings/building-c.glb', name: 'Plaza C', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-d', file: '/models/buildings/building-d.glb', name: 'Plaza D', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-e', file: '/models/buildings/building-e.glb', name: 'Plaza E', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-f', file: '/models/buildings/building-f.glb', name: 'Plaza F', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-g', file: '/models/buildings/building-g.glb', name: 'Plaza G', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-h', file: '/models/buildings/building-h.glb', name: 'Plaza H', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-i', file: '/models/buildings/building-i.glb', name: 'Plaza I', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-j', file: '/models/buildings/building-j.glb', name: 'Plaza J', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-k', file: '/models/buildings/building-k.glb', name: 'Plaza K', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-l', file: '/models/buildings/building-l.glb', name: 'Plaza L', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-m', file: '/models/buildings/building-m.glb', name: 'Plaza M', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },
  { id: 'building-n', file: '/models/buildings/building-n.glb', name: 'Plaza N', category: 'commercial', defaultScale: 9.2, baseFacing: -Math.PI / 2 },

  // 2. Skyscraper High-Rise Towers (5 iconic tall towers for skyline depth)
  { id: 'building-skyscraper-a', file: '/models/buildings/building-skyscraper-a.glb', name: 'Skyscraper A', category: 'skyscraper', defaultScale: 15.0, baseFacing: -Math.PI / 2 },
  { id: 'building-skyscraper-b', file: '/models/buildings/building-skyscraper-b.glb', name: 'Skyscraper B', category: 'skyscraper', defaultScale: 15.5, baseFacing: -Math.PI / 2 },
  { id: 'building-skyscraper-c', file: '/models/buildings/building-skyscraper-c.glb', name: 'Skyscraper C', category: 'skyscraper', defaultScale: 15.5, baseFacing: -Math.PI / 2 },
  { id: 'building-skyscraper-d', file: '/models/buildings/building-skyscraper-d.glb', name: 'Skyscraper D', category: 'skyscraper', defaultScale: 16.0, baseFacing: -Math.PI / 2 },
  { id: 'building-skyscraper-e', file: '/models/buildings/building-skyscraper-e.glb', name: 'Skyscraper E', category: 'skyscraper', defaultScale: 15.0, baseFacing: -Math.PI / 2 },

  // 3. Low-Detail Background City Blocks (10 models for deep urban atmosphere)
  { id: 'low-detail-building-a', file: '/models/buildings/low-detail-building-a.glb', name: 'City Block A', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-b', file: '/models/buildings/low-detail-building-b.glb', name: 'City Block B', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-c', file: '/models/buildings/low-detail-building-c.glb', name: 'City Block C', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-d', file: '/models/buildings/low-detail-building-d.glb', name: 'City Block D', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-e', file: '/models/buildings/low-detail-building-e.glb', name: 'City Block E', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-f', file: '/models/buildings/low-detail-building-f.glb', name: 'City Block F', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-g', file: '/models/buildings/low-detail-building-g.glb', name: 'City Block G', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-h', file: '/models/buildings/low-detail-building-h.glb', name: 'City Block H', category: 'background', defaultScale: 11.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-wide-a', file: '/models/buildings/low-detail-building-wide-a.glb', name: 'Wide Complex A', category: 'background', defaultScale: 12.0, baseFacing: -Math.PI / 2 },
  { id: 'low-detail-building-wide-b', file: '/models/buildings/low-detail-building-wide-b.glb', name: 'Wide Complex B', category: 'background', defaultScale: 12.0, baseFacing: -Math.PI / 2 },
];

export class CityPackManager {
  private static instance: CityPackManager;
  private buildings: BuildingTemplate[] = [];
  private templateMap: Map<string, BuildingTemplate> = new Map();
  private categoryMap: Map<BuildingCategory, BuildingTemplate[]> = new Map();

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
    return this.templateMap.get(id);
  }

  public getBuildingsByCategory(category: BuildingCategory): BuildingTemplate[] {
    return this.categoryMap.get(category) || [];
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

    this.loadPromise = new Promise(async (resolve) => {
      const loader = new GLTFLoader();
      const loadPromises = BUILDING_CATALOG.map((def) => this.loadSingleBuilding(loader, def));

      const results = await Promise.all(loadPromises);
      const successfulTemplates = results.filter((t): t is BuildingTemplate => t !== null);

      this.buildings = successfulTemplates;
      this.templateMap.clear();
      this.categoryMap.clear();

      for (const tmpl of this.buildings) {
        this.templateMap.set(tmpl.id, tmpl);
        if (!this.categoryMap.has(tmpl.category)) {
          this.categoryMap.set(tmpl.category, []);
        }
        this.categoryMap.get(tmpl.category)!.push(tmpl);
      }

      this.isLoaded = true;
      console.log(`[CityPackManager] Loaded ${this.buildings.length}/${BUILDING_CATALOG.length} 3D city buildings.`);

      this.readyCallbacks.forEach((cb) => cb());
      this.readyCallbacks = [];
      resolve(this.buildings.length > 0);
    });

    return this.loadPromise;
  }

  private async loadSingleBuilding(loader: GLTFLoader, def: BuildingDefinition): Promise<BuildingTemplate | null> {
    return new Promise((res) => {
      loader.load(
        def.file,
        (gltf) => {
          try {
            const rawModel = gltf.scene;
            rawModel.updateMatrixWorld(true);

            rawModel.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                if (mesh.material) {
                  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                  mat.side = THREE.FrontSide;
                }
              }
            });

            // Center geometry and ground at Y=0
            const rawBox = new THREE.Box3().setFromObject(rawModel);
            const rawCenter = new THREE.Vector3();
            rawBox.getCenter(rawCenter);
            rawModel.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);

            const container = new THREE.Group();
            container.name = `BuildingContainer_${def.id}`;
            container.add(rawModel);
            container.scale.set(def.defaultScale, def.defaultScale, def.defaultScale);
            container.updateMatrixWorld(true);

            const finalBox = new THREE.Box3().setFromObject(container);
            const finalSize = new THREE.Vector3();
            finalBox.getSize(finalSize);

            const template: BuildingTemplate = {
              id: def.id,
              name: def.name,
              category: def.category,
              model: container,
              dimensions: {
                width: finalSize.x,
                height: finalSize.y,
                length: finalSize.z,
              },
              baseFacing: def.baseFacing,
            };

            res(template);
          } catch (err) {
            console.warn(`[CityPackManager] Error configuring ${def.id}:`, err);
            res(null);
          }
        },
        undefined,
        (err) => {
          console.warn(`[CityPackManager] Failed to load ${def.file}:`, err);
          res(null);
        }
      );
    });
  }

  public createBuildingInstance(
    indexOrId?: number | string,
    options: {
      facingRoad?: 'left' | 'right';
      randomYaw?: boolean;
      category?: BuildingCategory;
      scaleMult?: number;
      seed?: number;
    } = {}
  ): THREE.Group | null {
    if (this.buildings.length === 0) return null;

    let template: BuildingTemplate | undefined;

    if (typeof indexOrId === 'string' && this.templateMap.has(indexOrId)) {
      template = this.templateMap.get(indexOrId);
    } else if (options.category) {
      const list = this.categoryMap.get(options.category);
      if (list && list.length > 0) {
        const seedVal = options.seed !== undefined ? Math.abs(Math.floor(options.seed)) : Math.floor(Math.random() * 1000);
        template = list[seedVal % list.length];
      }
    }

    if (!template) {
      if (typeof indexOrId === 'number') {
        template = this.buildings[Math.abs(indexOrId) % this.buildings.length];
      } else {
        const seedVal = options.seed !== undefined ? Math.abs(Math.floor(options.seed)) : Math.floor(Math.random() * 1000);
        template = this.buildings[seedVal % this.buildings.length];
      }
    }

    if (!template) return null;

    const wrapper = new THREE.Group();
    wrapper.name = `Building_${template.id}`;

    const clone = template.model.clone(true);
    if (options.scaleMult && options.scaleMult !== 1.0) {
      clone.scale.multiplyScalar(options.scaleMult);
    }
    wrapper.add(clone);

    let yaw = template.baseFacing;
    if (options.facingRoad === 'left') {
      yaw += 0;
    } else if (options.facingRoad === 'right') {
      yaw += Math.PI;
    }

    if (options.randomYaw !== false) {
      const randOffset = options.seed !== undefined
        ? Math.sin(options.seed * 37.1) * 0.08
        : (Math.random() - 0.5) * 0.12;
      yaw += randOffset;
    }

    wrapper.rotation.y = yaw;
    return wrapper;
  }
}

export const cityPackManager = CityPackManager.getInstance();
