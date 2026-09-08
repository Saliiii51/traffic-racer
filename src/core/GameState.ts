// Centralized reactive GameState

import type { GameStateEnum, VehicleUpgradeLevels, GameMode, EnvironmentPreset, CameraViewMode, TrafficSettings } from './Constants';
import { GAME_CONSTANTS, DEFAULT_TRAFFIC_SETTINGS } from './Constants';
import { eventBus } from './EventBus';
import { saveManager, type GameSaveData } from '../save/SaveManager';
import { VEHICLE_CATALOG } from '../vehicles/VehicleStats';

export class GameState {
  private static instance: GameState;
  private data: GameSaveData;

  // Runtime / Session State
  public currentScreen: GameStateEnum = 'BOOT';
  public isPlaying: boolean = false;
  public isPaused: boolean = false;
  
  public currentDistanceMeters: number = 0;
  public currentScore: number = 0;
  public currentSessionCash: number = 0;
  public currentSpeedKmh: number = 0;
  public currentNearMisses: number = 0;
  public currentCombo: number = 0;
  public currentNitroPercent: number = 100;

  // New Modes & Presets
  public currentMode: GameMode = 'ONE_WAY';
  public currentEnvironment: EnvironmentPreset = 'DAY';
  public currentCameraView: CameraViewMode = 'CHASE';
  public timeAttackRemaining: number = 80;
  public isWrongWay: boolean = false;
  public lastCheckpointMeters: number = 0;
  public vehicleHealth: number = 100;
  public maxVehicleHealth: number = 100;

  private constructor() {
    this.data = saveManager.load();
    this.currentMode = this.data.settings.selectedGameMode || 'ONE_WAY';
    this.currentEnvironment = this.data.settings.selectedEnvironment || 'DAY';
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  // Persistent Getters
  public get money(): number {
    return this.data.money;
  }

  public get level(): number {
    return this.data.level;
  }

  public get xp(): number {
    return this.data.xp;
  }

  public get bestScore(): number {
    return this.data.bestScore;
  }

  public get bestDistanceMeters(): number {
    return this.data.bestDistanceMeters;
  }

  public get selectedVehicleId(): string {
    return this.data.selectedVehicleId;
  }

  public get ownedVehicleIds(): string[] {
    return this.data.ownedVehicleIds;
  }

  public get settings() {
    return this.data.settings;
  }

  // Traffic Settings getter/setter
  public get trafficSettings(): TrafficSettings {
    if (!this.data.settings.trafficSettings) {
      this.data.settings.trafficSettings = { ...DEFAULT_TRAFFIC_SETTINGS };
    }
    return this.data.settings.trafficSettings;
  }

  public updateTrafficSettings(partial: Partial<TrafficSettings>): void {
    const current = this.trafficSettings;
    this.data.settings.trafficSettings = {
      ...current,
      ...partial,
    };
    this.save();
    eventBus.emit('trafficSettingsChanged', { settings: this.data.settings.trafficSettings });
  }

  public resetTrafficSettings(): void {
    this.data.settings.trafficSettings = { ...DEFAULT_TRAFFIC_SETTINGS };
    this.save();
    eventBus.emit('trafficSettingsChanged', { settings: this.data.settings.trafficSettings });
  }

  // Exhaust preset getter/setter
  public get exhaustPreset(): string {
    return this.data.settings.exhaustPreset;
  }
  public setExhaustPreset(preset: 'Standard' | 'Deep' | 'Light' | 'Abarti'): void {
    this.data.settings.exhaustPreset = preset;
    this.save();
    eventBus.emit('exhaustPresetChanged', { preset });
  }

  // Custom license plate getter/setter
  public get licensePlate(): string {
    return this.data.licensePlate || '34 TR 1998';
  }
  public setLicensePlate(plate: string): void {
    const clean = plate.trim().toUpperCase().slice(0, 11);
    this.data.licensePlate = clean || '34 TR 1998';
    this.save();
    eventBus.emit('licensePlateChanged', { plate: this.data.licensePlate });
  }

  public getVehicleUpgrades(vehicleId: string): VehicleUpgradeLevels {
    return this.data.vehicleUpgrades[vehicleId] || {
      engine: 0,
      topSpeed: 0,
      acceleration: 0,
      handling: 0,
      brakes: 0,
      nitro: 0,
    };
  }

  public getVehicleColor(vehicleId: string): string {
    if (this.data.vehicleColors[vehicleId]) {
      return this.data.vehicleColors[vehicleId];
    }
    // Fall back to the catalog's defaultColor for this vehicle
    const def = VEHICLE_CATALOG.find((v) => v.id === vehicleId);
    return def?.defaultColor ?? '#1e7272';
  }

  public setVehicleColor(vehicleId: string, color: string): void {
    this.data.vehicleColors[vehicleId] = color;
    this.save();
  }

  public isVehicleOwned(vehicleId: string): boolean {
    return this.data.ownedVehicleIds.includes(vehicleId);
  }

  public selectVehicle(vehicleId: string): void {
    if (this.isVehicleOwned(vehicleId)) {
      this.data.selectedVehicleId = vehicleId;
      this.save();
      eventBus.emit('vehicleSelected', { vehicleId });
    }
  }

  public buyVehicle(vehicleId: string): boolean {
    const def = VEHICLE_CATALOG.find((v) => v.id === vehicleId);
    if (!def) return false;
    if (this.isVehicleOwned(vehicleId)) return true;

    if (this.data.money >= def.price) {
      this.data.money -= def.price;
      this.data.ownedVehicleIds.push(vehicleId);
      this.data.selectedVehicleId = vehicleId;
      this.save();
      eventBus.emit('moneyChanged', { totalMoney: this.data.money, delta: -def.price });
      eventBus.emit('vehiclePurchased', { vehicleId });
      return true;
    }
    return false;
  }

  public upgradeVehicle(vehicleId: string, category: keyof VehicleUpgradeLevels, cost: number): boolean {
    if (this.data.money < cost) return false;

    const upgrades = this.getVehicleUpgrades(vehicleId);
    if (upgrades[category] >= 5) return false;

    this.data.money -= cost;
    upgrades[category] += 1;
    this.data.vehicleUpgrades[vehicleId] = upgrades;
    this.save();

    eventBus.emit('moneyChanged', { totalMoney: this.data.money, delta: -cost });
    eventBus.emit('upgradePurchased', { vehicleId, category, newLevel: upgrades[category] });
    return true;
  }

  public addMoney(amount: number): void {
    if (amount <= 0) return;
    this.data.money += amount;
    this.save();
    eventBus.emit('moneyChanged', { totalMoney: this.data.money, delta: amount });
  }

  public addXp(amount: number): void {
    if (amount <= 0) return;
    this.data.xp += amount;
    const requiredXp = this.data.level * 1000;
    if (this.data.xp >= requiredXp) {
      this.data.xp -= requiredXp;
      this.data.level += 1;
      const levelUpReward = this.data.level * 2500;
      this.data.money += levelUpReward;
      this.save();
      eventBus.emit('levelUp', { newLevel: this.data.level, rewardMoney: levelUpReward });
      eventBus.emit('moneyChanged', { totalMoney: this.data.money, delta: levelUpReward });
    } else {
      this.save();
    }
  }

  // Session reset
  public startSession(): void {
    this.isPlaying = true;
    this.isPaused = false;
    this.currentDistanceMeters = 0;
    this.currentScore = 0;
    this.currentSessionCash = 0;
    this.currentSpeedKmh = 0;
    this.currentNearMisses = 0;
    this.currentCombo = 0;
    this.currentNitroPercent = 100;
    this.timeAttackRemaining = GAME_CONSTANTS.TIME_ATTACK.INITIAL_TIME_SEC;
    this.isWrongWay = false;
    this.lastCheckpointMeters = 0;
    this.vehicleHealth = this.maxVehicleHealth;
    eventBus.emit('gameStarted', undefined);
  }

  public applyDamage(amount: number): { currentHealth: number; isTotaled: boolean } {
    this.vehicleHealth = Math.max(0, this.vehicleHealth - amount);
    eventBus.emit('damageTaken', { damage: amount, health: this.vehicleHealth });
    return {
      currentHealth: this.vehicleHealth,
      isTotaled: this.vehicleHealth <= 0,
    };
  }

  public setGameMode(mode: GameMode): void {
    this.currentMode = mode;
    this.data.settings.selectedGameMode = mode;
    this.save();
    eventBus.emit('gameModeChanged', { mode });
  }

  public setEnvironment(env: EnvironmentPreset): void {
    this.currentEnvironment = env;
    this.data.settings.selectedEnvironment = env;
    this.save();
    eventBus.emit('environmentChanged', { env });
  }

  public setCameraView(view: CameraViewMode): void {
    this.currentCameraView = view;
    eventBus.emit('cameraModeChanged', { mode: view });
  }

  public addTimeAttackSeconds(sec: number, reason: string): void {
    this.timeAttackRemaining += sec;
    eventBus.emit('timeBonusAdded', { secondsAdded: sec, reason });
  }

  public setWrongWay(wrongWay: boolean): void {
    if (this.isWrongWay !== wrongWay) {
      this.isWrongWay = wrongWay;
      eventBus.emit('wrongWayChanged', { isWrongWay: wrongWay });
    }
  }

  public endSession(): { isNewHighScore: boolean; isNewBestDistance: boolean; earnings: number } {
    this.isPlaying = false;
    this.isPaused = false;

    let isNewHighScore = false;
    let isNewBestDistance = false;

    if (this.currentScore > this.data.bestScore) {
      this.data.bestScore = Math.floor(this.currentScore);
      isNewHighScore = true;
    }

    if (this.currentDistanceMeters > this.data.bestDistanceMeters) {
      this.data.bestDistanceMeters = Math.floor(this.currentDistanceMeters);
      isNewBestDistance = true;
    }

    this.data.totalDistanceMeters += Math.floor(this.currentDistanceMeters);
    const earnings = Math.floor(this.currentSessionCash);
    this.data.money += earnings;

    // Award XP
    const xpGained = Math.floor(this.currentDistanceMeters * 0.1) + this.currentNearMisses * 50;
    this.addXp(xpGained);

    this.save();

    eventBus.emit('moneyChanged', { totalMoney: this.data.money, delta: earnings });
    eventBus.emit('gameOver', {
      distanceMeters: this.currentDistanceMeters,
      score: this.currentScore,
      earnings,
      nearMisses: this.currentNearMisses,
      isNewHighScore,
      isNewBestDistance,
    });

    return { isNewHighScore, isNewBestDistance, earnings };
  }

  public setScreen(screen: GameStateEnum): void {
    this.currentScreen = screen;
    eventBus.emit('screenChanged', { screen });
  }

  public save(): void {
    saveManager.save(this.data);
  }
}

export const gameState = GameState.getInstance();
