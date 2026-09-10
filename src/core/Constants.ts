// Game Constants and Configurations

export const GAME_CONSTANTS = {
  TITLE: 'TRAFFIC RUSH: İSTANBUL',
  VERSION: '1.2.0',

  // Road & Lanes
  ROAD: {
    LANES_COUNT: 4,
    LANE_WIDTH: 3.8, // meters
    SEGMENT_LENGTH: 80, // meters
    SEGMENTS_AHEAD: 5,
    SEGMENTS_BEHIND: 2,
    TOTAL_SEGMENTS: 7,
    SHOULDER_WIDTH: 2.5,
    BARRIER_HEIGHT: 0.8,
  },

  // Physics & Arcade Driving
  DRIVING: {
    BASE_TOP_SPEED_KMH: 180,
    MAX_TOP_SPEED_KMH: 265,
    BASE_ACCELERATION: 6.8, // realistic m/s^2 (0-100 in ~4.8s)
    BASE_BRAKING: 14.0, // realistic m/s^2 (~1.4G braking)
    NATURAL_DECELERATION: 1.2, // rolling resistance m/s^2
    STEER_SPEED: 5.2, // units/sec across lanes
    MAX_STEER_TILT: 0.07, // radians roll
    MAX_STEER_YAW: 0.08, // radians yaw
    DRIFT_RECOVERY: 10.0,
    MIN_MOVING_SPEED_KMH: 6,
  },

  // Camera settings
  CAMERA: {
    FOV_NORMAL: 62,
    FOV_NITRO: 76,
    FOV_LERP_SPEED: 4.0,
    OFFSET_X: 0,
    OFFSET_Y: 4.2,
    OFFSET_Z: -7.5, // Behind the vehicle
    LOOK_AT_OFFSET_Y: 1.2,
    LOOK_AT_OFFSET_Z: 8.0,
    SMOOTH_FACTOR: 8.0,
    STEER_TILT_AMOUNT: 0.04,
  },

  // Nitro Boost
  NITRO: {
    DURATION_SEC: 5,
    RECHARGE_RATE: 0.12, // per second
    BOOST_ACCEL_MULT: 1.6,
    BOOST_TOP_SPEED_KMH: 45,
    DRAIN_RATE: 0.28, // per second
  },

  // Traffic settings
  TRAFFIC: {
    POOL_SIZE: 24,
    MIN_SPAWN_DIST_AHEAD: 75,
    MAX_SPAWN_DIST_AHEAD: 220,
    DESPAWN_DIST_BEHIND: 35,
    MIN_VEHICLE_GAP: 22,
    MIN_SPEED_KMH: 55,
    MAX_SPEED_KMH: 110,
  },

  // Scoring and Economy
  ECONOMY: {
    SCORE_PER_METER: 1,
    CASH_PER_100_METERS: 100,
    NEAR_MISS_SCORE: 250,
    NEAR_MISS_CASH: 250,
    OVERTAKE_SCORE: 100,
    OVERTAKE_CASH: 100,
    HIGH_SPEED_THRESHOLD_KMH: 130,
    HIGH_SPEED_BONUS_MULT: 1.5,
    WRONG_WAY_SCORE_PER_SEC: 500,
    WRONG_WAY_CASH_PER_SEC: 150,
  },

  // Time Attack Mode
  TIME_ATTACK: {
    INITIAL_TIME_SEC: 80,
    NEAR_MISS_BONUS_SEC: 3,
    CHECKPOINT_INTERVAL_METERS: 1000,
    CHECKPOINT_BONUS_SEC: 10,
  },

  // Near Miss Detection
  NEAR_MISS: {
    LATERAL_MAX_DIST: 2.1, // meters
    RELATIVE_SPEED_MIN_KMH: 25,
    COMBO_TIMEOUT_SEC: 3.5,
  },
} as const;

export type GameStateEnum = 'BOOT' | 'MAIN_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'GARAGE' | 'SHOP' | 'MISSIONS';

export type GameMode = 'ONE_WAY' | 'TWO_WAY' | 'TIME_ATTACK' | 'CUSTOM_TRAFFIC' | 'PARKING';

export type TrafficDensityPreset = 'empty' | 'low' | 'normal' | 'dense' | 'chaos';
export type TrafficSpeedPreset = 'slow' | 'normal' | 'fast' | 'chaotic';
export type TrafficLaneChangePreset = 'none' | 'balanced' | 'crazy';
export type TrafficFleetPreset = 'all' | 'heavy' | 'commercial' | 'tofas' | 'passenger';
export type TrafficDirectionPreset = 'ONE_WAY' | 'TWO_WAY';
export type TrafficYieldPreset = 'stubborn' | 'normal' | 'polite';

export interface TrafficSettings {
  density: number; // 0 to 250% (0 = empty, 100 = default)
  densityPreset: TrafficDensityPreset;
  speedPreset: TrafficSpeedPreset;
  laneChangePreset: TrafficLaneChangePreset;
  fleetPreset: TrafficFleetPreset;
  direction: TrafficDirectionPreset;
  yieldPreset: TrafficYieldPreset;
  godMode: boolean; // if true in CUSTOM_TRAFFIC, collisions don't cause fatal Game Over
}

export const DEFAULT_TRAFFIC_SETTINGS: TrafficSettings = {
  density: 100,
  densityPreset: 'normal',
  speedPreset: 'normal',
  laneChangePreset: 'balanced',
  fleetPreset: 'all',
  direction: 'ONE_WAY',
  yieldPreset: 'normal',
  godMode: false,
};

export type EnvironmentPreset = 'DAY' | 'SUNSET' | 'NIGHT' | 'RAIN';

export type CameraViewMode = 'CHASE' | 'INTERIOR' | 'HOOD' | 'BUMPER';

export type VehicleCategory = 'STARTER' | 'SPORT' | 'SUV' | 'LUXURY' | 'SUPER';

export interface VehicleDefinition {
  id: string;
  name: string;
  category: VehicleCategory;
  price: number;
  unlockedByDefault: boolean;
  modelType: 'coupe' | 'sport' | 'suv' | 'sedan' | 'supercar';
  modelPath?: string;
  baseStats: {
    topSpeedKmh: number;
    acceleration: number;
    handling: number;
    braking: number;
    nitro: number;
    durability: number;
  };
  maxStats: {
    topSpeedKmh: number;
    acceleration: number;
    handling: number;
    braking: number;
    nitro: number;
    durability: number;
  };
  defaultColor: string;
  availableColors: string[];
}

export interface VehicleUpgradeLevels {
  engine: number;
  topSpeed: number;
  acceleration: number;
  handling: number;
  brakes: number;
  nitro: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardCash: number;
  targetValue: number;
  currentValue: number;
  type: 'distance' | 'near_misses' | 'speed' | 'score' | 'nitro' | 'wrong_way';
  isCompleted: boolean;
  isClaimed: boolean;
}
