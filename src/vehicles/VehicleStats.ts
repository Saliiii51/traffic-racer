// Vehicle definitions, stats, and upgrade calculations

import type { VehicleDefinition, VehicleUpgradeLevels } from '../core/Constants';

export const VEHICLE_CATALOG: VehicleDefinition[] = [
  {
    id: 'opel_corsa_b',
    name: 'Opel Corsa B (1998)',
    category: 'STARTER',
    price: 0,
    unlockedByDefault: true,
    modelType: 'coupe',
    modelPath: '/models/opel_corsa_b_3door_1998.glb',
    baseStats: {
      topSpeedKmh: 172,
      acceleration: 6.9,
      handling: 7.8,
      braking: 13.0,
      nitro: 100,
      durability: 100,
    },
    maxStats: {
      topSpeedKmh: 218,
      acceleration: 9.1,
      handling: 9.6,
      braking: 16.2,
      nitro: 145,
      durability: 130,
    },
    defaultColor: '#d90429',
    availableColors: ['#d90429', '#1e7272', '#ffffff', '#111111', '#ffb703', '#2b2d42', '#3a86ff', '#588157'],
  },
  {
    id: 'starter_coupe',
    name: 'Tofaş Doğan SLX',
    category: 'STARTER',
    price: 0,
    unlockedByDefault: true,
    modelType: 'coupe',
    modelPath: '/models/tofas3/illegal_media_doganslx.fbx',
    baseStats: {
      topSpeedKmh: 178,
      acceleration: 6.8,
      handling: 7.2,
      braking: 12.0,
      nitro: 100,
      durability: 100,
    },
    maxStats: {
      topSpeedKmh: 220,
      acceleration: 8.8,
      handling: 9.0,
      braking: 15.0,
      nitro: 140,
      durability: 130,
    },
    defaultColor: '#1e7272',
    availableColors: ['#1e7272', '#2a9d8f', '#2d6a2d', '#4caf50', '#d90429', '#ffffff', '#111111', '#ffb703'],
  },
  {
    id: 'tofas_gltf',
    name: 'Tofaş Doğan SLX Turbo',
    category: 'STARTER',
    price: 0,
    unlockedByDefault: true,
    modelType: 'sedan',
    modelPath: '/models/tofas.glb',
    baseStats: {
      topSpeedKmh: 185,
      acceleration: 6.7,
      handling: 7.4,
      braking: 12.5,
      nitro: 105,
      durability: 105,
    },
    maxStats: {
      topSpeedKmh: 228,
      acceleration: 9.0,
      handling: 9.2,
      braking: 15.5,
      nitro: 145,
      durability: 135,
    },
    defaultColor: '#1e7272',
    availableColors: ['#1e7272', '#ffffff', '#d90429', '#111111', '#ffb703', '#2a9d8f', '#2b2d42'],
  },
  {
    id: 'golf_gti',
    name: 'Volkswagen Golf GTI (2021)',
    category: 'SPORT',
    price: 0,
    unlockedByDefault: true,
    modelType: 'sport',
    modelPath: '/models/golf.glb',
    baseStats: {
      topSpeedKmh: 245,
      acceleration: 8.8,
      handling: 9.2,
      braking: 15.2,
      nitro: 125,
      durability: 115,
    },
    maxStats: {
      topSpeedKmh: 285,
      acceleration: 11.4,
      handling: 11.0,
      braking: 18.0,
      nitro: 165,
      durability: 140,
    },
    defaultColor: '#ffffff',
    availableColors: ['#ffffff', '#111111', '#d90429', '#1d3557', '#8d99ae', '#ffb703'],
  },
  {
    id: 'mini_cooper',
    name: 'Mini Cooper S',
    category: 'SPORT',
    price: 0,
    unlockedByDefault: true,
    modelType: 'sport',
    modelPath: '/models/minicooper.glb',
    baseStats: {
      topSpeedKmh: 225,
      acceleration: 8.2,
      handling: 9.8,
      braking: 15.5,
      nitro: 120,
      durability: 100,
    },
    maxStats: {
      topSpeedKmh: 265,
      acceleration: 10.8,
      handling: 11.8,
      braking: 18.5,
      nitro: 160,
      durability: 125,
    },
    defaultColor: '#d90429',
    availableColors: ['#d90429', '#0077b6', '#111111', '#ffffff', '#2a9d8f', '#ffb703'],
  },
  {
    id: 'bmw_e46',
    name: 'BMW 3 Serisi (E46 1998)',
    category: 'LUXURY',
    price: 0,
    unlockedByDefault: true,
    modelType: 'sedan',
    modelPath: '/models/bmwe461998.glb',
    baseStats: {
      topSpeedKmh: 235,
      acceleration: 8.4,
      handling: 8.9,
      braking: 14.8,
      nitro: 130,
      durability: 125,
    },
    maxStats: {
      topSpeedKmh: 278,
      acceleration: 11.0,
      handling: 10.6,
      braking: 17.6,
      nitro: 170,
      durability: 150,
    },
    defaultColor: '#8d99ae',
    availableColors: ['#8d99ae', '#111111', '#1d3557', '#ffffff', '#d90429', '#2b2d42'],
  },
  {
    id: 'sport_racer',
    name: 'Boğaziçi Coupe GT',
    category: 'SPORT',
    price: 35000,
    unlockedByDefault: false,
    modelType: 'sport',
    baseStats: {
      topSpeedKmh: 200,
      acceleration: 7.8,
      handling: 8.2,
      braking: 13.5,
      nitro: 110,
      durability: 100,
    },
    maxStats: {
      topSpeedKmh: 245,
      acceleration: 10.2,
      handling: 10.0,
      braking: 17.0,
      nitro: 150,
      durability: 130,
    },
    defaultColor: '#ffb703',
    availableColors: ['#ffb703', '#fb8500', '#023047', '#219ebc', '#8ecae6', '#d90429', '#ffffff', '#14213d'],
  },
  {
    id: 'heavy_suv',
    name: 'Bursa E-SUV (T10X)',
    category: 'SUV',
    price: 75000,
    unlockedByDefault: false,
    modelType: 'suv',
    baseStats: {
      topSpeedKmh: 180,
      acceleration: 7.0,
      handling: 6.8,
      braking: 13.0,
      nitro: 115,
      durability: 180,
    },
    maxStats: {
      topSpeedKmh: 220,
      acceleration: 9.0,
      handling: 8.5,
      braking: 16.0,
      nitro: 155,
      durability: 240,
    },
    defaultColor: '#0077b6', // Gemlik Mavisi
    availableColors: ['#0077b6', '#d90429', '#2b2d42', '#8d99ae', '#403d39', '#283618', '#606c38', '#111111'],
  },
  {
    id: 'luxury_sedan',
    name: 'Maslak Black Edition',
    category: 'LUXURY',
    price: 150000,
    unlockedByDefault: false,
    modelType: 'sedan',
    baseStats: {
      topSpeedKmh: 210,
      acceleration: 8.4,
      handling: 8.5,
      braking: 14.0,
      nitro: 125,
      durability: 120,
    },
    maxStats: {
      topSpeedKmh: 255,
      acceleration: 11.0,
      handling: 10.5,
      braking: 17.5,
      nitro: 170,
      durability: 160,
    },
    defaultColor: '#0f141d',
    availableColors: ['#0f141d', '#1d3557', '#343a40', '#495057', '#dee2e6', '#212529', '#8a1c14', '#003566'],
  },
  {
    id: 'phantom_super',
    name: 'Bosphorus Hyperion',
    category: 'SUPER',
    price: 350000,
    unlockedByDefault: false,
    modelType: 'supercar',
    baseStats: {
      topSpeedKmh: 240,
      acceleration: 10.0,
      handling: 9.8,
      braking: 15.5,
      nitro: 140,
      durability: 110,
    },
    maxStats: {
      topSpeedKmh: 295,
      acceleration: 13.5,
      handling: 12.0,
      braking: 19.5,
      nitro: 190,
      durability: 150,
    },
    defaultColor: '#7209b7',
    availableColors: ['#7209b7', '#f72585', '#4361ee', '#4cc9f0', '#3a0ca3', '#00f5d4', '#fee440', '#10002b'],
  },
];

export const UPGRADE_MAX_LEVEL = 5;

// Base upgrade cost multiplier per level
export function getUpgradeCost(category: keyof VehicleUpgradeLevels, currentLevel: number): number {
  if (currentLevel >= UPGRADE_MAX_LEVEL) return 0;
  const baseCosts: Record<keyof VehicleUpgradeLevels, number> = {
    engine: 3500,
    topSpeed: 4500,
    acceleration: 4000,
    handling: 3000,
    brakes: 2500,
    nitro: 3500,
  };

  const base = baseCosts[category] || 3000;
  return Math.round(base * Math.pow(1.65, currentLevel));
}

export function computeVehicleStats(vehicleDef: VehicleDefinition, upgrades: VehicleUpgradeLevels) {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const topSpeedT = (upgrades.topSpeed || 0) / UPGRADE_MAX_LEVEL;
  const accelT = (upgrades.acceleration || 0) / UPGRADE_MAX_LEVEL;
  const handlingT = (upgrades.handling || 0) / UPGRADE_MAX_LEVEL;
  const brakesT = (upgrades.brakes || 0) / UPGRADE_MAX_LEVEL;
  const nitroT = (upgrades.nitro || 0) / UPGRADE_MAX_LEVEL;

  // Engine upgrades boost both top speed and acceleration slightly
  const extraTopSpeed = (upgrades.engine || 0) * 4;
  const extraAccel = (upgrades.engine || 0) * 0.35;

  return {
    topSpeedKmh: Math.round(lerp(vehicleDef.baseStats.topSpeedKmh, vehicleDef.maxStats.topSpeedKmh, topSpeedT) + extraTopSpeed),
    acceleration: Number((lerp(vehicleDef.baseStats.acceleration, vehicleDef.maxStats.acceleration, accelT) + extraAccel).toFixed(1)),
    handling: Number(lerp(vehicleDef.baseStats.handling, vehicleDef.maxStats.handling, handlingT).toFixed(1)),
    braking: Number(lerp(vehicleDef.baseStats.braking, vehicleDef.maxStats.braking, brakesT).toFixed(1)),
    nitroCapacity: Math.round(lerp(vehicleDef.baseStats.nitro, vehicleDef.maxStats.nitro, nitroT)),
    durability: vehicleDef.baseStats.durability,
  };
}
