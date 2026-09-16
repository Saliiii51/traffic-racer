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
    id: 'honda_s2000',
    name: 'Honda S2000 (AP1 2004)',
    category: 'SPORT',
    price: 0,
    unlockedByDefault: true,
    modelType: 'sport',
    modelPath: '/models/hondas2000.glb',
    baseStats: {
      topSpeedKmh: 245,
      acceleration: 8.6,
      handling: 9.8,
      braking: 15.2,
      nitro: 120,
      durability: 110,
    },
    maxStats: {
      topSpeedKmh: 288,
      acceleration: 11.2,
      handling: 12.0,
      braking: 18.5,
      nitro: 165,
      durability: 140,
    },
    defaultColor: '#d90429',
    availableColors: ['#d90429', '#ffb703', '#ffffff', '#111111', '#0077b6', '#8d99ae'],
  },
  {
    id: 'golf_gti',
    name: 'Volkswagen Golf GTI (2021)',
    category: 'SPORT',
    price: 15000,
    unlockedByDefault: false,
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
    id: 'lambo_aventador',
    name: 'Lamborghini Aventador LP700-4',
    category: 'SUPER',
    price: 290000,
    unlockedByDefault: false,
    modelType: 'supercar',
    modelPath: '/models/lambo.glb',
    baseStats: {
      topSpeedKmh: 350,
      acceleration: 11.2,
      handling: 10.5,
      braking: 17.0,
      nitro: 150,
      durability: 120,
    },
    maxStats: {
      topSpeedKmh: 395,
      acceleration: 14.8,
      handling: 12.8,
      braking: 20.5,
      nitro: 200,
      durability: 160,
    },
    defaultColor: '#ff5500',
    availableColors: ['#ff5500', '#ffb703', '#2dc653', '#111111', '#ffffff', '#00b4d8', '#7209b7', '#d90429'],
  },
  {
    id: 'bmw_e46',
    name: 'BMW M3 E46 (NightRyder)',
    category: 'SPORT',
    price: 48000,
    unlockedByDefault: false,
    modelType: 'sport',
    modelPath: '/models/bmw.glb',
    baseStats: {
      topSpeedKmh: 260,
      acceleration: 9.0,
      handling: 9.4,
      braking: 15.6,
      nitro: 135,
      durability: 130,
    },
    maxStats: {
      topSpeedKmh: 305,
      acceleration: 11.8,
      handling: 11.4,
      braking: 18.2,
      nitro: 175,
      durability: 160,
    },
    defaultColor: '#111111',
    availableColors: ['#111111', '#1d3557', '#d90429', '#8d99ae', '#ffffff', '#2b2d42'],
  },
  {
    id: 'sport_racer',
    name: 'Volkswagen Scirocco R (2015)',
    category: 'SPORT',
    price: 35000,
    unlockedByDefault: false,
    modelType: 'sport',
    modelPath: '/models/scirocco.glb',
    baseStats: {
      topSpeedKmh: 250,
      acceleration: 8.8,
      handling: 9.2,
      braking: 15.2,
      nitro: 135,
      durability: 120,
    },
    maxStats: {
      topSpeedKmh: 295,
      acceleration: 11.5,
      handling: 11.0,
      braking: 18.2,
      nitro: 175,
      durability: 150,
    },
    defaultColor: '#1351b4', // Rising Blue Metallic
    availableColors: ['#1351b4', '#5fa626', '#f4f4f4', '#18191a', '#c91818', '#474b51', '#ffb703', '#9e1c40'],
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
    name: 'Dodge Charger R/T (2012)',
    category: 'LUXURY',
    price: 120000,
    unlockedByDefault: false,
    modelType: 'sedan',
    modelPath: '/models/dodge_charger.glb',
    baseStats: {
      topSpeedKmh: 288,
      acceleration: 9.4,
      handling: 8.9,
      braking: 15.2,
      nitro: 130,
      durability: 140,
    },
    maxStats: {
      topSpeedKmh: 332,
      acceleration: 12.6,
      handling: 11.2,
      braking: 18.4,
      nitro: 175,
      durability: 180,
    },
    defaultColor: '#111111',
    availableColors: ['#111111', '#c91818', '#1a5276', '#4a235a', '#f4f6f7', '#4d5656', '#d97706', '#2c3e50'],
  },
  {
    id: 'phantom_super',
    name: 'Ferrari 458 Italia (2015)',
    category: 'SUPER',
    price: 250000,
    unlockedByDefault: false,
    modelType: 'supercar',
    modelPath: '/models/ferrari.glb',
    baseStats: {
      topSpeedKmh: 325,
      acceleration: 10.5,
      handling: 10.2,
      braking: 16.5,
      nitro: 140,
      durability: 110,
    },
    maxStats: {
      topSpeedKmh: 365,
      acceleration: 14.0,
      handling: 12.5,
      braking: 20.0,
      nitro: 195,
      durability: 150,
    },
    defaultColor: '#d90429',
    availableColors: ['#d90429', '#ffbe0b', '#111111', '#ffffff', '#003566', '#4cc9f0', '#2b2d42', '#3a86ff'],
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
