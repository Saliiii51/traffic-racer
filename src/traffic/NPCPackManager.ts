// NPCPackManager.ts - Loads, extracts, and manages 3D vehicle models from traffic_racer_npc_vehicles_pack.glb

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VehicleDimensions } from '../vehicles/Vehicle';

export interface NPCTemplate {
  id: string;
  name: string;
  category: 'sedan' | 'suv' | 'truck' | 'compact' | 'taxi' | 'minibus' | 'courier' | 'bus' | 'ambulance';
  dimensions: VehicleDimensions;
  model: THREE.Group;
  speedRange: [number, number];
}

export class NPCPackManager {
  private static instance: NPCPackManager;
  private templates: Map<string, NPCTemplate> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<boolean> | null = null;

  public static getInstance(): NPCPackManager {
    if (!NPCPackManager.instance) {
      NPCPackManager.instance = new NPCPackManager();
    }
    return NPCPackManager.instance;
  }

  public async load(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise(async (resolve) => {
      const loader = new GLTFLoader();
      const url = '/models/traffic_racer_npc_vehicles_pack.glb';

      loader.load(
        url,
        (gltf) => {
          try {
            this.processPack(gltf);
            this.isLoaded = true;
            console.log(`[NPCPackManager] Successfully loaded ${this.templates.size} 3D NPC vehicles!`);
            resolve(true);
          } catch (err) {
            console.error('[NPCPackManager] Failed to process NPC pack:', err);
            resolve(false);
          }
        },
        undefined,
        (err) => {
          console.warn('[NPCPackManager] NPC vehicle pack not found or failed to load:', err);
          resolve(false);
        }
      );
    });

    return this.loadPromise;
  }

  private processPack(gltf: any): void {
    gltf.scene.updateMatrixWorld(true);
    const root = gltf.scene.getObjectByName('GLTF_SceneRootNode') || gltf.scene;
    const MASTER_SCALE = 0.47;

    const definitions: Record<string, { category: NPCTemplate['category']; speedRange: [number, number]; name: string }> = {
      lada_coupe_3: { category: 'sedan', speedRange: [75, 105], name: 'Lada Coupe' },
      lancer_evo_5: { category: 'sedan', speedRange: [90, 130], name: 'Mitsubishi Lancer Evo' },
      lada_kalina_4: { category: 'compact', speedRange: [70, 95], name: 'Lada Kalina' },
      lada_combi_2: { category: 'sedan', speedRange: [65, 90], name: 'Lada Combi' },
      volvo_xc90_10: { category: 'suv', speedRange: [80, 115], name: 'Volvo XC90' },
      jeep_commander_1: { category: 'suv', speedRange: [75, 105], name: 'Jeep Commander' },
      hummer_0: { category: 'suv', speedRange: [70, 95], name: 'Hummer H2' },
      gazel_bus_6: { category: 'minibus', speedRange: [65, 95], name: 'Gazelle Mavi Dolmuş' },
      toyota_hiace_9: { category: 'minibus', speedRange: [70, 100], name: 'Toyota HiAce Servis' },
      ambulans_yeni_7: { category: 'ambulance', speedRange: [90, 125], name: '112 Acil Ambulans' },
      scania_bus_8: { category: 'bus', speedRange: [60, 85], name: 'Scania Şehirlerarası Otobüs' },
      pickup_new_24: { category: 'truck', speedRange: [65, 90], name: 'Pikap Kamyonet' },
      isuzu001_25: { category: 'truck', speedRange: [60, 80], name: 'Isuzu Nakliye' },
      truck3_14: { category: 'truck', speedRange: [50, 75], name: 'Hafriyat Kamyonu' },
      truck2_18: { category: 'truck', speedRange: [50, 75], name: 'Damperli Kamyon' },
      truck1_21: { category: 'truck', speedRange: [50, 70], name: 'Ağır Yük Kamyonu' },
      tir_31: { category: 'truck', speedRange: [55, 75], name: 'Uzun Dorse Tır' },
    };

    const children = [...root.children];

    children.forEach((child: THREE.Object3D) => {
      const def = definitions[child.name];
      if (!def) return;

      const worldBox = new THREE.Box3().setFromObject(child);
      const worldCenter = new THREE.Vector3();
      worldBox.getCenter(worldCenter);

      const wrapper = new THREE.Group();
      wrapper.name = `NPC_${child.name}`;
      wrapper.attach(child);

      // Center child and ground
      child.position.x -= worldCenter.x;
      child.position.z -= worldCenter.z;
      child.position.y -= worldBox.min.y;

      // In showcase, models have length along X. Rotate -90 deg around Y to align with +Z forward
      wrapper.rotation.y = -Math.PI / 2;
      wrapper.scale.set(MASTER_SCALE, MASTER_SCALE, MASTER_SCALE);

      wrapper.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      // Flashing strobe lights for ambulance
      if (def.category === 'ambulance') {
        const sirenGroup = new THREE.Group();
        sirenGroup.name = 'AmbulanceSiren';
        const sirenGeo = new THREE.BoxGeometry(0.2, 0.12, 0.3);
        const blueMat = new THREE.MeshBasicMaterial({ color: 0x0066ff });
        const redMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

        const blueLight = new THREE.Mesh(sirenGeo, blueMat);
        blueLight.position.set(-0.35, 2.52, 0.3);
        sirenGroup.add(blueLight);

        const redLight = new THREE.Mesh(sirenGeo, redMat);
        redLight.position.set(0.35, 2.52, 0.3);
        sirenGroup.add(redLight);

        wrapper.add(sirenGroup);
      }

      const finalBox = new THREE.Box3().setFromObject(wrapper);
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);

      const template: NPCTemplate = {
        id: child.name,
        name: def.name,
        category: def.category,
        model: wrapper,
        dimensions: {
          width: Math.max(1.6, finalSize.x),
          height: Math.max(1.2, finalSize.y),
          length: Math.max(3.8, finalSize.z),
          wheelBase: finalSize.z * 0.6,
          wheelTrack: finalSize.x * 0.82,
          wheelRadius: finalSize.y * 0.22,
        },
        speedRange: def.speedRange,
      };

      this.templates.set(child.name, template);
    });
  }

  public getRandomTemplate(preferredCategory?: string): NPCTemplate | null {
    if (this.templates.size === 0) return null;

    const all = Array.from(this.templates.values());
    if (preferredCategory) {
      const filtered = all.filter((t) => t.category === preferredCategory);
      if (filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
      }
    }

    return all[Math.floor(Math.random() * all.length)];
  }

  public getTemplateForLane(laneIndex: number): NPCTemplate | null {
    if (this.templates.size === 0) return null;

    // Highway Lane distribution:
    // Lane 0 (left fast lane): Sports cars, SUVs, and 112 Ambulance
    // Lane 1: Sedans, Taxis, Minibuses
    // Lane 2: Compacts, Vans, Dolmuş
    // Lane 3 (right slow lane): Trucks, Buses, and Semi-Trucks (Tır)
    let candidates: NPCTemplate[] = [];
    const all = Array.from(this.templates.values());

    if (laneIndex === 0) {
      candidates = all.filter((t) => t.category === 'sedan' || t.category === 'suv' || t.category === 'ambulance');
    } else if (laneIndex === 1) {
      candidates = all.filter((t) => t.category === 'sedan' || t.category === 'compact' || t.category === 'minibus' || t.category === 'suv');
    } else if (laneIndex === 2) {
      candidates = all.filter((t) => t.category === 'minibus' || t.category === 'compact' || t.category === 'truck' || t.category === 'sedan');
    } else {
      // Lane 3
      candidates = all.filter((t) => t.category === 'truck' || t.category === 'bus');
    }

    if (candidates.length === 0) candidates = all;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  public getTemplateForFleetAndLane(fleetPreset: string, laneIndex: number): NPCTemplate | null {
    if (this.templates.size === 0) return null;
    const all = Array.from(this.templates.values());

    let candidates: NPCTemplate[] = [];
    if (fleetPreset === 'heavy') {
      candidates = all.filter((t) => t.category === 'truck' || t.category === 'bus');
    } else if (fleetPreset === 'commercial') {
      candidates = all.filter((t) => t.category === 'minibus' || t.category === 'taxi' || t.name.toLowerCase().includes('dolmus') || t.name.toLowerCase().includes('taksi'));
    } else if (fleetPreset === 'tofas') {
      // Turkish classic sedans and compacts in pack
      candidates = all.filter((t) => t.category === 'sedan' || t.category === 'compact');
    } else if (fleetPreset === 'passenger') {
      candidates = all.filter((t) => t.category === 'sedan' || t.category === 'compact' || t.category === 'suv');
    }

    if (candidates.length === 0) {
      return this.getTemplateForLane(laneIndex);
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  public getAllTemplates(): NPCTemplate[] {
    return Array.from(this.templates.values());
  }

  public get hasTemplates(): boolean {
    return this.templates.size > 0;
  }
}

export const npcPackManager = NPCPackManager.getInstance();
