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
      selectedVehicleId: 'opel_corsa_b',
      ownedVehicleIds: ['opel_corsa_b', 'starter_coupe', 'tofas_gltf', 'golf_gti', 'mini_cooper', 'bmw_e46', 'luxury_sedan', 'phantom_super', 'sport_racer'],
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

    const freeGarageCars = ['opel_corsa_b', 'starter_coupe', 'tofas_gltf', 'golf_gti', 'mini_cooper', 'bmw_e46', 'luxury_sedan', 'phantom_super', 'sport_racer'];
    freeGarageCars.forEach((cid) => {
      if (!current.ownedVehicleIds.includes(cid)) {
        current.ownedVehicleIds.push(cid);
      }
    });

    // Set Opel Corsa B as the active car if user was on default starter_coupe
    if (!current.selectedVehicleId || current.selectedVehicleId === 'starter_coupe') {
      current.selectedVehicleId = 'opel_corsa_b';
    }

    // Migrate old default red starter car color to authentic Tofaş teal
    if (current.vehicleColors['starter_coupe'] === '#d90429' || current.vehicleColors['starter_coupe'] === '#2d6a2d') {
      current.vehicleColors['starter_coupe'] = '#1e7272';
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
