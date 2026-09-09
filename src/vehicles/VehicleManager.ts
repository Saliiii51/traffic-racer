// Vehicle Manager supporting GLTF / GLB 3D model loading and procedural fallback

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getSharedDracoLoader } from '../utils/DracoLoaderHelper';

export class VehicleManager {
  private static instance: VehicleManager;
  private gltfLoader: GLTFLoader;
  private loadedModels: Map<string, THREE.Group> = new Map();

  private constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(getSharedDracoLoader());
  }

  public static getInstance(): VehicleManager {
    if (!VehicleManager.instance) {
      VehicleManager.instance = new VehicleManager();
    }
    return VehicleManager.instance;
  }

  public async loadModel(url: string, modelId: string): Promise<THREE.Group> {
    if (this.loadedModels.has(modelId)) {
      return this.loadedModels.get(modelId)!.clone();
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.loadedModels.set(modelId, model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.warn(`Could not load GLTF model from ${url}:`, error);
          reject(error);
        }
      );
    });
  }
}

export const vehicleManager = VehicleManager.getInstance();
