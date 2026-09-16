// Versioned LocalStorage Save Manager

import type { VehicleUpgradeLevels, GameMode, TrafficSettings } from '../core/Constants';
import { DEFAULT_TRAFFIC_SETTINGS } from '../core/Constants';
import { VEHICLE_CATALOG } from '../vehicles/VehicleStats';
import { isMobileDevice } from '../utils/orientation';

export interface GameSaveData {
  version: number;
  money: number;
  level: number;
  xp: number;
  bestScore: number;
  bestDistanceMeters: number;
  totalDistanceMeters: number;
  selectedVehicleId: string;
  ownedVehicleIds: string[];
  vehicleUpgrades: Record<string, VehicleUpgradeLevels>;
  vehicleColors: Record<string, string>;
  completedMissionIds: string[];
  licensePlate?: string;
  parkingStars: Record<number, number>;
  settings: {
    soundEnabled: boolean;
    musicEnabled: boolean;
    steeringSensitivity: number;
    graphicsQuality: 'low' | 'medium' | 'high';
    batterySaver: boolean;
    controlType: 'buttons' | 'tilt';
    selectedGameMode: GameMode;
    selectedEnvironment: 'DAY' | 'SUNSET' | 'NIGHT' | 'RAIN';
    exhaustPreset: 'Standard' | 'Deep' | 'Light' | 'Abarti';
    trafficSettings: TrafficSettings;
  };
}

const SAVE_KEY = 'traffic_rush_save_v1';
const CURRENT_VERSION = 1;

export class SaveManager {
  private static instance: SaveManager;

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  public getDefaultData(): GameSaveData {
    const defaultUpgrades: Record<string, VehicleUpgradeLevels> = {};
    const defaultColors: Record<string, string> = {};

    VEHICLE_CATALOG.forEach((v) => {
      defaultUpgrades[v.id] = {
        engine: 0,
        topSpeed: 0,
        acceleration: 0,
        handling: 0,
        brakes: 0,
        nitro: 0,
      };
      defaultColors[v.id] = v.defaultColor;
    });

    return {
      version: CURRENT_VERSION,
      money: 1500, // Starter wallet
      level: 1,
      xp: 0,
      bestScore: 0,
      bestDistanceMeters: 0,
      totalDistanceMeters: 0,
      selectedVehicleId: 'honda_s2000',
      ownedVehicleIds: ['opel_corsa_b', 'honda_s2000'],
      vehicleUpgrades: defaultUpgrades,
      vehicleColors: defaultColors,
      completedMissionIds: [],
      licensePlate: '34 TR 1998',
      parkingStars: {},
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        steeringSensitivity: 1.0,
        graphicsQuality: isMobileDevice() ? 'medium' : 'high',
        batterySaver: false,
        controlType: 'buttons',
        selectedGameMode: 'ONE_WAY',
        selectedEnvironment: 'DAY',
        exhaustPreset: 'Abarti',
        trafficSettings: { ...DEFAULT_TRAFFIC_SETTINGS },
      },
    };
  }

  public load(): GameSaveData {
    try {
      const serialized = localStorage.getItem(SAVE_KEY);
      if (!serialized) {
        const initial = this.getDefaultData();
        this.save(initial);
        return initial;
      }

      const parsed = JSON.parse(serialized) as Partial<GameSaveData>;
      return this.migrate(parsed);
    } catch (e) {
      console.warn('Failed to parse save from localStorage, creating fresh save', e);
      const fallback = this.getDefaultData();
      this.save(fallback);
      return fallback;
    }
  }

  public save(data: GameSaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save data to localStorage', e);
    }
  }

  private migrate(raw: Partial<GameSaveData>): GameSaveData {
    const defaults = this.getDefaultData();
    const current = Object.assign({}, defaults, raw);

    // Ensure settings and trafficSettings exist
    if (!current.settings) {
      current.settings = { ...defaults.settings };
    } else {
      current.settings.trafficSettings = Object.assign({}, DEFAULT_TRAFFIC_SETTINGS, current.settings.trafficSettings);
      if (current.settings.batterySaver === undefined) current.settings.batterySaver = false;
    }

    // Ensure all catalog vehicles have upgrade entries
    VEHICLE_CATALOG.forEach((v) => {
      if (!current.vehicleUpgrades[v.id]) {
        current.vehicleUpgrades[v.id] = { ...defaults.vehicleUpgrades[v.id] };
      }
      if (!current.vehicleColors[v.id]) {
        current.vehicleColors[v.id] = v.defaultColor;
      }
    });

    // Migrate away from removed vehicles
    if (current.selectedVehicleId === 'starter_coupe' || current.selectedVehicleId === 'tofas_gltf') {
      current.selectedVehicleId = 'honda_s2000';
    } else if (current.selectedVehicleId === 'mini_cooper') {
      current.selectedVehicleId = 'lambo_aventador';
    }

    // Clean up obsolete IDs from owned vehicles and ensure honda_s2000 & opel_corsa_b are owned
    current.ownedVehicleIds = current.ownedVehicleIds.map((cid) => (cid === 'mini_cooper' ? 'lambo_aventador' : cid));
    current.ownedVehicleIds = current.ownedVehicleIds.filter((cid) => cid !== 'starter_coupe' && cid !== 'tofas_gltf');
    const defaultUnlockedCars = ['opel_corsa_b', 'honda_s2000'];
    defaultUnlockedCars.forEach((cid) => {
      if (!current.ownedVehicleIds.includes(cid)) {
        current.ownedVehicleIds.push(cid);
      }
    });

    if (!current.selectedVehicleId) {
      current.selectedVehicleId = 'honda_s2000';
    }

    if (!current.vehicleColors['honda_s2000']) {
      current.vehicleColors['honda_s2000'] = '#d90429';
    }
    if (!current.vehicleColors['lambo_aventador']) {
      current.vehicleColors['lambo_aventador'] = '#ff5500';
    }
    if (!current.vehicleColors['bmw_e46']) {
      current.vehicleColors['bmw_e46'] = '#111111';
    }

    if (!current.licensePlate) {
      current.licensePlate = '34 TR 1998';
    }

    // Auto-migrate mobile users from old default 'high' to 'medium' for smooth 60 FPS
    if (isMobileDevice() && !(raw as any)?._mobileGraphicsMigrated) {
      if (!raw.settings || raw.settings.graphicsQuality === 'high') {
        current.settings.graphicsQuality = 'medium';
      }
      (current as any)._mobileGraphicsMigrated = true;
    }

    return current;
  }
}

export const saveManager = SaveManager.getInstance();
