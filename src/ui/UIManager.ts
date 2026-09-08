// Comprehensive UI Manager managing all screens, HUD, Garage, Modes, Environments, and Gyro controls

import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { inputManager } from '../player/InputManager';
import { audioManager } from '../audio/AudioManager';
import { VEHICLE_CATALOG, computeVehicleStats, getUpgradeCost, UPGRADE_MAX_LEVEL } from '../vehicles/VehicleStats';
import { missionManager } from '../progression/MissionManager';
import { CAMERA_PRESETS } from '../player/ChaseCamera';
import { multiplayerManager } from '../network/MultiplayerManager';
import { radioManager } from '../audio/RadioManager';
import type { VehicleUpgradeLevels, GameMode, EnvironmentPreset, VehicleDefinition } from '../core/Constants';

export class UIManager {
  private container: HTMLElement;

  // Screens
  private screenLoading!: HTMLElement;
  private screenMenu!: HTMLElement;
  private screenHud!: HTMLElement;
  private screenGameOver!: HTMLElement;
  private screenGarage!: HTMLElement;
  private screenMissions!: HTMLElement;
  private screenMultiplayer!: HTMLElement;
  private screenMultiplayerResult!: HTMLElement;
  private loadingBarFill!: HTMLElement;
  private loadingStatusText!: HTMLElement;

  // Multiplayer HUD
  private hudMultiplayerBar!: HTMLElement;
  private mpHudMyInfo!: HTMLElement;
  private mpHudOppInfo!: HTMLElement;
  private mpHudDiffBadge!: HTMLElement;
  public onStartMultiplayerRace?: () => void;

  // HUD elements
  private hudScoreVal!: HTMLElement;
  private hudDistanceVal!: HTMLElement;
  private hudMoneyVal!: HTMLElement;
  private hudSpeedVal!: HTMLElement;
  private hudNitroFill!: HTMLElement;
  private hudHealthFill!: HTMLElement;
  private hudHealthVal!: HTMLElement;
  private hudSignalLeft!: HTMLElement;
  private hudSignalRight!: HTMLElement;
  private nearMissBanner!: HTMLElement;
  private nearMissTitle!: HTMLElement;
  private nearMissBonus!: HTMLElement;
  private nearMissTimeout: number | null = null;

  // New Mode & Preset Elements
  private hudTimerCard!: HTMLElement;
  private hudTimerVal!: HTMLElement;
  private hudCamLabel!: HTMLElement;
  private wrongWayBanner!: HTMLElement;
  private timeBonusPopup!: HTMLElement;
  private timeBonusTimeout: number | null = null;
  private edsRadarBanner!: HTMLElement;
  private edsSpeedText!: HTMLElement;
  private edsTimeout: number | null = null;
  private scrapeJoltBanner!: HTMLElement;
  private scrapeJoltTitle!: HTMLElement;
  private scrapeJoltSub!: HTMLElement;
  private scrapeTimeout: number | null = null;
  private btnToggleGyro!: HTMLElement;

  // Cassette Deck & Istanbul Radio HUD elements
  private hudCassetteDeck!: HTMLElement;
  private deckMinimizedBar!: HTMLElement;
  private deckFullFaceplate!: HTMLElement;
  private miniStationName!: HTMLElement;
  private isRadioMinimized = false;
  private tapeSpoolLeft!: HTMLElement;
  private tapeSpoolRight!: HTMLElement;
  private tapeLedPlay!: HTMLElement;
  private tapeLedStereo!: HTMLElement;
  private lcdStationFreq!: HTMLElement;
  private lcdLiveBadge!: HTMLElement;
  private lcdStationName!: HTMLElement;
  private lcdStationSub!: HTMLElement;
  private eqBars: HTMLElement[] = [];
  private radioToastBanner!: HTMLElement;
  private toastRadioFreq!: HTMLElement;
  private toastRadioName!: HTMLElement;
  private toastRadioSub!: HTMLElement;
  private radioToastTimeout: number | null = null;

  // Cinematic Camera Intro elements
  private cinematicIntroWrap!: HTMLElement;
  private cinematicCountdownText!: HTMLElement;
  private cinematicModeTag!: HTMLElement;
  private btnSkipIntro!: HTMLElement;

  // Idle Inactive Cinematic Showcase
  private hudIdleCamBanner!: HTMLElement;
  private hudIdleCamName!: HTMLElement;

  // Pause Menu elements
  private screenPause!: HTMLElement;
  private pauseStatSpeed!: HTMLElement;
  private pauseStatDist!: HTMLElement;
  private pauseStatScore!: HTMLElement;
  private btnPauseSound!: HTMLElement;
  private btnPauseMusic!: HTMLElement;
  private btnPauseGyro!: HTMLElement;

  // Garage elements
  private garageSelectedVehicleIndex = 0;

  // Callbacks for Scene / Game triggers
  public onStartGame?: () => void;
  public onRestartGame?: () => void;
  public onResumeGame?: () => void;
  public onSkipIntro?: () => void;
  public onNavigate?: (screen: 'BOOT' | 'MAIN_MENU' | 'PLAYING' | 'GAME_OVER' | 'GARAGE' | 'MISSIONS') => void;
  public onLoadCustomModel?: (files: FileList | File[]) => Promise<void>;
  public onRotateCustomModel?: (deg: number) => void;
  public onResetCustomModel?: () => void;
  public onGarageVehiclePreview?: (def: VehicleDefinition) => void;
  public onGarageColorChange?: (colorHex: string) => void;
  public onStartAdStudio?: (config: { vehicleId?: string; environment?: any; aggressive?: boolean }) => void;
  public onExitAdStudio?: () => void;
  public onCycleAdStudioShot?: () => number;

  // Ad Studio elements & state
  private screenAdsStudio!: HTMLElement;
  private adStudioHud!: HTMLElement;
  private reelsAspectMask!: HTMLElement;
  private btnUnhideUi!: HTMLElement;
  private adHudCamName!: HTMLElement;
  private adHudSpeed!: HTMLElement;
  private adBtnSlowmo!: HTMLElement;
  private adBtnReelsMask!: HTMLElement;
  private adCameraFlash!: HTMLElement;
  private adStudioSelectedCarId: string = 'tofas_gltf';
  private adStudioSelectedEnv: any = 'DAY';
  private adStudioAggressive: boolean = true;

  public navigateTo(screen: 'BOOT' | 'MAIN_MENU' | 'PLAYING' | 'GAME_OVER' | 'GARAGE' | 'MISSIONS'): void {
    if (this.onNavigate) {
      this.onNavigate(screen);
    } else {
      this.showScreen(screen);
    }
  }

  public setLoadingProgress(percent: number, text?: string): void {
    if (this.loadingBarFill) {
      this.loadingBarFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (text && this.loadingStatusText) {
      this.loadingStatusText.innerText = text;
    }
  }

  public setLoadingStatus(text: string): void {
    if (this.loadingStatusText) {
      this.loadingStatusText.innerText = text;
    }
  }

  constructor() {
    const el = document.getElementById('ui-layer');
    if (!el) {
      throw new Error('UI layer element not found in DOM');
    }
    this.container = el;

    this.renderScreens();
    this.setupEventListeners();

    // Restore radio minimized preference
    try {
      if (localStorage.getItem('tr_radio_minimized') === '1') {
        this.setRadioMinimized(true);
      }
    } catch {
      // ignore storage access restrictions
    }
  }

  private renderScreens(): void {
    this.container.innerHTML = `
      <!-- 0. LOADING SCREEN -->
      <div id="screen-loading" class="ui-screen active">
        <div class="loading-container">
          <div class="loading-logo-box">
            <h1 class="game-logo pulse-anim">TRAFFIC RUSH: İSTANBUL</h1>
            <p class="game-sub">Boğaziçi Köprüsü & E-5 Otoyolu</p>
          </div>
          
          <div class="loading-vehicle-icon">
            <svg viewBox="0 0 64 64" width="76" height="76" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 36L18 20H46L52 36M12 36V46H18M12 36H52M52 36V46H46M18 46H46M18 46C18 48.2 16.2 50 14 50C11.8 50 10 48.2 10 46C10 43.8 11.8 42 14 42C16.2 42 18 43.8 18 46ZM46 46C46 48.2 47.8 50 50 50C52.2 50 54 48.2 54 46C54 43.8 52.2 42 50 42C47.8 42 46 43.8 46 46Z" stroke="#00f0ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="22" cy="36" r="3.5" fill="#ffbe0b"/>
              <circle cx="42" cy="36" r="3.5" fill="#ffbe0b"/>
            </svg>
          </div>

          <div class="loading-bar-wrapper">
            <div class="loading-bar-track">
              <div class="loading-bar-fill" id="loading-bar-fill"></div>
            </div>
            <div class="loading-status" id="loading-status-text">3D Araçlar ve İstanbul Modelleri Yükleniyor...</div>
          </div>
        </div>
      </div>

      <!-- 1. MAIN MENU SCREEN -->
      <div id="screen-menu" class="ui-screen">
        <div class="menu-header">
          <div class="level-badge" id="menu-level-badge">LVL 1</div>
          <div class="currency-badge" id="menu-money-badge">₺0</div>
        </div>

        <div class="menu-title-area">
          <h1 class="game-logo">TRAFFIC RUSH: İSTANBUL</h1>
          <p class="game-sub">Boğaziçi Köprüsü & E-5 Otoyol Yarışı</p>

          <div class="menu-records">
            <div class="record-box">
              <div class="record-label">EN YÜKSEK SKOR</div>
              <div class="record-val" id="menu-best-score">0</div>
            </div>
            <div class="record-box">
              <div class="record-label">EN UZUN MESAFE</div>
              <div class="record-val" id="menu-best-dist">0.0 KM</div>
            </div>
          </div>
        </div>

        <div class="menu-actions">
          <!-- Game Mode Selector -->
          <div class="selector-group">
            <div class="selector-label">OYUN MODU</div>
            <div class="pill-selector-row" id="menu-mode-selector">
              <button class="choice-pill active-mode" data-mode="ONE_WAY">TEK YÖN</button>
              <button class="choice-pill" data-mode="TWO_WAY">ÇİFT YÖN</button>
              <button class="choice-pill" data-mode="TIME_ATTACK">ZAMANA KARŞI</button>
              <button class="choice-pill" data-mode="CUSTOM_TRAFFIC" style="border-color: #38bdf8; color: #38bdf8;">🚦 TRAFİK MODU</button>
            </div>
            <div id="traffic-mode-quick-badge" style="display: none; justify-content: space-between; align-items: center; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 6px 10px; margin-top: 6px; font-size: 0.78rem;">
              <span style="color: #e0f2fe;">Yoğunluk: <b id="badge-density-val" style="color: #38bdf8;">%100</b> • <b id="badge-fleet-val" style="color: #ffbe0b;">Karışık</b></span>
              <button id="btn-edit-traffic" class="btn btn-pill" style="padding: 3px 8px; font-size: 0.72rem; border-color: #38bdf8; color: #38bdf8;">⚙️ Trafiği Ayarla</button>
            </div>
          </div>

          <!-- Environment Preset Selector -->
          <div class="selector-group">
            <div class="selector-label">İSTANBUL HAVA & VAKİT</div>
            <div class="pill-selector-row" id="menu-env-selector">
              <button class="choice-pill active" data-env="DAY">☀️ BOĞAZİÇİ</button>
              <button class="choice-pill" data-env="SUNSET">🌅 KIZ KULESİ</button>
              <button class="choice-pill" data-env="NIGHT">🌃 MASLAK</button>
              <button class="choice-pill" data-env="RAIN">🌧️ YAĞMUR</button>
            </div>
          </div>

          <div class="menu-play-row">
            <button id="btn-play-game" class="btn btn-primary btn-play-main">
              ▶ TEK OYUNCULU
            </button>
            <button id="btn-open-multiplayer" class="btn btn-primary btn-multiplayer-main">
              ⚔️ CANLI DÜELLO
            </button>
          </div>
          <div class="menu-btn-row">
            <button id="btn-open-garage" class="btn btn-secondary">🏎️ GARAJ</button>
            <button id="btn-open-missions" class="btn btn-secondary">🎯 GÖREVLER</button>
            <button id="btn-open-traffic-settings" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8;">🚦 TRAFİK</button>
            <button id="btn-open-settings" class="btn btn-secondary">⚙️ AYARLAR</button>
          </div>
          <div style="margin: 10px 0 6px 0; width: 100%;">
            <button id="btn-open-ad-studio" class="btn" style="width: 100%; padding: 13px 18px; font-size: 0.94rem; font-weight: 900; letter-spacing: 1.2px; background: linear-gradient(135deg, #e1306c 0%, #fd1d1d 50%, #f56040 100%); color: #fff; border: 2px solid rgba(255,255,255,0.45); border-radius: 14px; box-shadow: 0 4px 20px rgba(225, 48, 108, 0.45); cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 1.25rem;">🎬</span> REKLAMLAR (SİNEMATİK MAKAS) <span style="background: rgba(0,0,0,0.3); font-size: 0.70rem; padding: 2px 7px; border-radius: 6px; letter-spacing: 1px;">REEL / TIKTOK</span>
            </button>
          </div>
          <div class="menu-controls-hint">
            <span>◄ <b>Q:</b> Sol Sinyal</span>
            <span><b>E:</b> Sağ Sinyal ►</span>
            <span>🎺 <b>H:</b> Korna</span>
            <span>💡 <b>F:</b> Selektör</span>
            <span>⚡ <b>Boşluk:</b> Nitro</span>
            <span>🎥 <b>C:</b> Kamera</span>
            <span>📻 <b>R:</b> Radyo</span>
            <span>📼 <b>M:</b> Ses</span>
          </div>
        </div>

        <div class="menu-footer">
          <button id="btn-toggle-sound" class="icon-btn" title="Sesi Aç/Kapat">🔊</button>
          <button id="btn-toggle-music" class="icon-btn" title="Müziği Aç/Kapat">🎵</button>
          <button id="btn-footer-settings" class="icon-btn" title="Oyun Ayarları">⚙️</button>
          <button id="btn-toggle-gyro" class="control-type-pill">📱 KONTROL: BUTON</button>
        </div>
      </div>

      <!-- 2. IN-GAME HUD -->
      <div id="screen-hud" class="ui-screen">
        <div class="hud-top-bar">
          <div class="hud-stat-box">
            <div class="hud-stat-label">SKOR</div>
            <div class="hud-stat-value" id="hud-score">0</div>
          </div>

          <div class="hud-stat-box hud-center-distance">
            <div class="hud-stat-label">MESAFE</div>
            <div class="hud-stat-value" id="hud-distance">0.00 KM</div>
          </div>

          <!-- Time Attack Countdown -->
          <div id="hud-timer-card">
            <div class="hud-stat-label">KALAN SÜRE</div>
            <div class="hud-timer-val" id="hud-timer-val">80s</div>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="hud-stat-box">
              <div class="hud-stat-label">KAZANÇ</div>
              <div class="hud-stat-value" style="color: var(--accent-gold);" id="hud-cash">₺0</div>
            </div>
            <button id="hud-btn-camera" class="hud-camera-btn" title="Kamera Değiştir (C)">
              🎥 <span id="hud-cam-label">TAKİP</span>
            </button>
            <button id="hud-btn-pause" class="hud-pause-btn">⏸</button>
          </div>
        </div>
        
        <!-- MULTIPLAYER LIVE HIGHWAY LEADERBOARD BAR -->
        <div id="hud-multiplayer-bar" style="display: none; position: absolute; top: 78px; left: 50%; transform: translateX(-50%); background: rgba(10, 15, 26, 0.92); border: 2px solid #ff007f; border-radius: 16px; padding: 6px 14px; color: #fff; font-family: 'Orbitron', sans-serif; font-size: 0.80rem; font-weight: 800; align-items: center; gap: 10px; box-shadow: 0 0 20px rgba(255,0,127,0.45); z-index: 60; pointer-events: none; max-width: 96vw; overflow-x: auto;">
          <div id="mp-live-leaderboard-items" style="display: flex; align-items: center; gap: 8px;"></div>
          <!-- Fallback legacy tags -->
          <span id="mp-hud-my-info" style="display: none;"></span>
          <span id="mp-hud-opp-info" style="display: none;"></span>
          <span id="mp-hud-diff-badge" style="display: none;"></span>
        </div>

        <!-- Telemetry: Turn signals, Speedometer & Nitro bar -->
        <div class="hud-telemetry">
          <div class="hud-turn-signals">
            <button id="hud-signal-left" class="hud-signal-btn" title="Sol Sinyal (Q)">◀</button>
            <span class="hud-signal-divider"></span>
            <button id="hud-signal-right" class="hud-signal-btn" title="Sağ Sinyal (E)">▶</button>
          </div>

          <div class="speedometer-card">
            <span class="speed-number" id="hud-speed">0</span>
            <span class="speed-unit">KM/H</span>
          </div>

          <div class="nitro-gauge-wrap">
            <div class="nitro-gauge-fill" id="hud-nitro-fill"></div>
          </div>

          <div class="health-gauge-wrap" title="Araç Sağlığı (Hasar Limiti)">
            <div class="health-gauge-header">
              <span class="health-icon">🛡️ SAĞLIK</span>
              <span class="health-val" id="hud-health-val">%100</span>
            </div>
            <div class="health-bar-track">
              <div class="health-gauge-fill" id="hud-health-fill"></div>
            </div>
          </div>
        </div>

        <!-- RETRO CASSETTE PLAYER & ISTANBUL RADIO DECK -->
        <div id="hud-cassette-deck" class="hud-cassette-deck">
          <!-- Minimized Compact Pill Bar -->
          <div id="deck-minimized-bar" class="deck-minimized-bar" style="display: none;">
            <div class="mini-radio-left" id="btn-mini-expand-deck" title="Kasetçaları Büyüt">
              <span class="mini-radio-icon">📻</span>
              <span class="mini-station-name" id="mini-station-name">KRAL TÜRK FM</span>
            </div>
            <div class="mini-actions">
              <button id="btn-mini-radio-toggle" class="mini-btn" title="Radyo Aç / Kapat">⏯</button>
              <button id="btn-mini-radio-next" class="mini-btn" title="Sonraki İstasyon">⏭</button>
              <button id="btn-radio-maximize" class="mini-btn mini-btn-expand" title="Kasetçaları Büyüt">➕</button>
            </div>
          </div>

          <!-- Full Faceplate -->
          <div class="deck-faceplate" id="deck-full-faceplate">
            <!-- Top Vintage Header & Status LEDs -->
            <div class="deck-top-row">
              <div class="deck-brand">
                <span class="deck-brand-name">AUTO-REVERSE</span>
                <span class="deck-tape-type">CrO2 / DOLBY B NR</span>
              </div>
              <div class="deck-status-leds">
                <span class="tape-led tape-led-stereo active" id="tape-led-stereo">ST</span>
                <span class="tape-led tape-led-fm active">FM</span>
                <span class="tape-led tape-led-play active" id="tape-led-play">PLAY</span>
                <button id="btn-radio-minimize" class="deck-minimize-btn" title="Kasetçaları Küçült">➖</button>
              </div>
            </div>

            <!-- Cassette Window with Rotating Spools & 5-Band VU-Meter -->
            <div class="cassette-window">
              <div class="spool-housing">
                <div class="tape-spool tape-spool-left" id="tape-spool-left">
                  <div class="spool-cog"></div>
                  <div class="spool-cog"></div>
                  <div class="spool-cog"></div>
                </div>
                <div class="tape-bridge">
                  <div class="tape-ribbon"></div>
                  <div class="tape-head-slot"></div>
                </div>
                <div class="tape-spool tape-spool-right" id="tape-spool-right">
                  <div class="spool-cog"></div>
                  <div class="spool-cog"></div>
                  <div class="spool-cog"></div>
                </div>
              </div>

              <!-- 5-Band Live Equalizer / Dancing LED VU-Meter -->
              <div class="deck-equalizer" id="deck-equalizer">
                <div class="eq-col" data-band="60Hz"><div class="eq-bar" id="eq-bar-0"></div></div>
                <div class="eq-col" data-band="250Hz"><div class="eq-bar" id="eq-bar-1"></div></div>
                <div class="eq-col" data-band="1kHz"><div class="eq-bar" id="eq-bar-2"></div></div>
                <div class="eq-col" data-band="4kHz"><div class="eq-bar" id="eq-bar-3"></div></div>
                <div class="eq-col" data-band="12kHz"><div class="eq-bar" id="eq-bar-4"></div></div>
              </div>
            </div>

            <!-- VFD Retro LCD Digital Tuner Display -->
            <div class="deck-lcd" id="deck-lcd">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="lcd-freq-badge" id="lcd-station-freq">92.0 MHz</div>
                <div class="lcd-live-badge" id="lcd-live-badge">🔴 CANLI</div>
              </div>
              <div class="lcd-station-title" id="lcd-station-name">KRAL TÜRK FM</div>
              <div class="lcd-station-sub" id="lcd-station-sub">Canlı Damar & Arabesk</div>
            </div>

            <!-- Mechanical Cassette Controls -->
            <div class="deck-controls">
              <button id="btn-radio-prev" class="deck-btn" title="Önceki İstasyon">⏮</button>
              <button id="btn-radio-toggle" class="deck-btn deck-btn-play" title="Radyo Aç / Kapat (M)">⏯</button>
              <button id="btn-radio-next" class="deck-btn" title="Sonraki İstasyon (R)">⏭</button>
              <span class="deck-hotkey-badge" title="Klavye Kısayolları">R: Kanal • M: Ses</span>
            </div>
          </div>
        </div>

        <!-- Station Switch Toast Notification Banner -->
        <div id="radio-toast-banner" class="radio-toast-banner">
          <span class="radio-toast-icon" id="toast-radio-icon">📻</span>
          <div class="radio-toast-content">
            <div class="radio-toast-freq" id="toast-radio-freq">92.0 MHz FM • CANLI</div>
            <div class="radio-toast-name" id="toast-radio-name">KRAL TÜRK FM</div>
            <div class="radio-toast-sub" id="toast-radio-sub">Canlı Damar & Arabesk</div>
          </div>
        </div>

        <!-- Wrong Way Warning Banner (Two-Way Mode) -->
        <div id="wrong-way-banner">
          <div class="wrong-way-text">⚠️ TERS YÖN!</div>
          <div class="wrong-way-sub">+₺150/sn & +500 Puan</div>
        </div>

        <!-- Time Bonus Floating Popup -->
        <div id="time-bonus-popup">+10s CHECKPOINT!</div>

        <!-- EDS Speed Radar Flash Banner -->
        <div id="eds-radar-banner">
          <div class="eds-flash-title">📸 EDS RADAR TESPİTİ!</div>
          <div class="eds-flash-speed" id="eds-flash-speed">148 KM/S</div>
        </div>

        <!-- Near Miss Floating Banner -->
        <div id="near-miss-banner">
          <div class="near-miss-title" id="near-miss-title">SIFIR MAKAS!</div>
          <div class="near-miss-bonus" id="near-miss-bonus">+₺250</div>
        </div>

        <!-- Scrape & Bump Jolt Warning Banner -->
        <div id="scrape-jolt-banner">
          <div class="scrape-jolt-title" id="scrape-jolt-title">⚡ SIYIRMA!</div>
          <div class="scrape-jolt-sub" id="scrape-jolt-sub">Makas Sarsıntısı</div>
        </div>

        <!-- Cinematic Camera Intro Overlay -->
        <div id="cinematic-intro-wrap" class="cinematic-intro-container" style="display: none;">
          <div class="cinematic-letterbox cinematic-letterbox-top"></div>
          <div class="cinematic-letterbox cinematic-letterbox-bottom"></div>

          <div class="cinematic-info-box">
            <div class="cinematic-location-badge">📍 İSTANBUL OTOYOLU</div>
            <div class="cinematic-mode-tag" id="cinematic-mode-tag">KÖPRÜ BAĞLANTISI • AKICI TRAFİK</div>
          </div>

          <div class="cinematic-countdown-wrap">
            <div id="cinematic-countdown-text" class="cinematic-countdown-val">HAZIR</div>
          </div>

          <button id="btn-skip-intro" class="cinematic-skip-btn">
            GEÇ ⏭️ <span class="skip-key-hint">(BOŞLUK)</span>
          </button>
        </div>

        <!-- Idle Inactive Cinematic Showcase Banner - Minimalist floating prompt -->
        <div id="hud-idle-cam-banner" class="hud-idle-cam-banner">
          <span class="idle-cam-touch-icon">👆</span>
          <span class="idle-cam-touch-text">Sürüşe dönmek için dokunun</span>
          <span id="hud-idle-cam-name" style="display: none;"></span>
        </div>

        <!-- Mobile Touch Controls -->
        <div class="mobile-controls-container" id="mobile-controls-wrap">
          <!-- Left: Steering & Auxiliary (Aux on top, Steer on bottom) -->
          <div class="touch-cluster-left" id="touch-steering-cluster">
            <div class="touch-aux-row">
              <button id="touch-signal-left" class="touch-btn touch-btn-signal" title="Sol Sinyal (Q)" aria-label="Sol Sinyal">
                ◀
              </button>
              <button id="touch-horn" class="touch-btn touch-btn-horn" title="Korna (H)" aria-label="Korna">
                📯
              </button>
              <button id="touch-flash" class="touch-btn touch-btn-flash" title="Selektör At (F)" aria-label="Selektör At">
                💡
              </button>
              <button id="touch-signal-right" class="touch-btn touch-btn-signal" title="Sağ Sinyal (E)" aria-label="Sağ Sinyal">
                ▶
              </button>
            </div>
            <div class="touch-steer-row">
              <button id="touch-steer-left" class="touch-btn touch-btn-steer" aria-label="Steer Left">
                ◀
                <span class="touch-sublabel">SOL</span>
              </button>
              <button id="touch-steer-right" class="touch-btn touch-btn-steer" aria-label="Steer Right">
                ▶
                <span class="touch-sublabel">SAĞ</span>
              </button>
            </div>
          </div>

          <!-- Right: Drive & Boost Cluster (Nitro, Brake, Gas) -->
          <div class="touch-cluster-right">
            <div class="touch-pedal-aux">
              <button id="touch-nitro" class="touch-btn touch-btn-nitro" title="Nitro (Boşluk / Shift)">
                ⚡
                <span class="touch-sublabel">NITRO</span>
              </button>
              <button id="touch-brake" class="touch-btn touch-btn-brake">
                ▼
                <span class="touch-sublabel">FREN</span>
              </button>
            </div>
            <button id="touch-gas" class="touch-btn touch-btn-gas">
              ▲
              <span class="touch-sublabel">GAZ</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2.5 PAUSE MENU OVERLAY -->
      <div id="screen-pause" class="pause-overlay">
        <div class="glass-panel pause-card">
          <div class="pause-header">
            <span class="pause-icon">⏸</span>
            <h2 class="pause-title">OYUN DURAKLATILDI</h2>
          </div>

          <div class="pause-stats-grid">
            <div class="pause-stat">
              <span class="p-stat-label">HIZ</span>
              <span class="p-stat-val" id="pause-stat-speed">0 KM/S</span>
            </div>
            <div class="pause-stat">
              <span class="p-stat-label">MESAFE</span>
              <span class="p-stat-val" id="pause-stat-dist">0.0 KM</span>
            </div>
            <div class="pause-stat">
              <span class="p-stat-label">SKOR</span>
              <span class="p-stat-val" id="pause-stat-score">0</span>
            </div>
          </div>

          <div class="pause-actions">
            <button id="btn-pause-resume" class="btn btn-primary">
              <span>▶</span> DEVAM ET
            </button>
            <button id="btn-pause-restart" class="btn btn-secondary">
              <span>🔄</span> YENİDEN BAŞLAT
            </button>
            <div class="pause-toggles-row">
              <button id="btn-pause-sound" class="btn btn-pill">
                🔊 SES: AÇIK
              </button>
              <button id="btn-pause-music" class="btn btn-pill">
                🎵 MÜZİK: AÇIK
              </button>
            </div>
            <button id="btn-pause-gyro" class="btn btn-pill" style="width: 100%; margin-top: 4px;">
              📱 KONTROL: BUTON
            </button>
            <button id="btn-pause-traffic" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8;">
              <span>🚦</span> TRAFİK AYARLARI
            </button>
            <button id="btn-pause-settings" class="btn btn-secondary">
              <span>⚙️</span> AYARLAR
            </button>
            <button id="btn-pause-garage" class="btn btn-secondary">
              <span>🚗</span> GARAJ
            </button>
            <button id="btn-pause-home" class="btn btn-secondary">
              <span>🏠</span> ANA MENÜ
            </button>
          </div>

          <div class="pause-hint">
            <span>İpucu: <b>ESC</b> veya <b>P</b> ile devam edebilirsiniz</span>
          </div>
        </div>
      </div>

      <!-- 3. GAME OVER SCREEN -->
      <div id="screen-gameover" class="ui-screen">
        <div class="glass-panel gameover-card">
          <div class="gameover-header-row">
            <h2 class="crash-header" id="gameover-title">KAZA YAPTIN!</h2>
            <div id="gameover-new-record" style="display: none;">
              <span class="new-record-badge">★ YENİ REKOR! ★</span>
            </div>
          </div>

          <div class="gameover-body-split">
            <!-- Left Side: 2x2 Stats Grid -->
            <div class="gameover-stats-grid">
              <div class="go-stat-item">
                <div class="go-stat-label">MESAFE</div>
                <div class="go-stat-val" id="go-stat-dist">0.00 KM</div>
              </div>

              <div class="go-stat-item">
                <div class="go-stat-label">SKOR</div>
                <div class="go-stat-val" id="go-stat-score">0</div>
              </div>

              <div class="go-stat-item">
                <div class="go-stat-label">MAKAS SAYISI</div>
                <div class="go-stat-val" id="go-stat-near">0</div>
              </div>

              <div class="go-stat-item">
                <div class="go-stat-label">EN YÜKSEK SKOR</div>
                <div class="go-stat-val" id="go-stat-best">0</div>
              </div>
            </div>

            <!-- Right Side: Earnings & Action Buttons -->
            <div class="gameover-actions-side">
              <div class="go-stat-item highlight-earnings">
                <div class="go-stat-label">YARIŞ KAZANCI</div>
                <div class="go-stat-val" id="go-stat-earnings">+₺0</div>
              </div>

              <div class="gameover-actions">
                <button id="btn-restart" class="btn btn-primary">TEKRAR DENE</button>
                <div class="gameover-actions-row">
                  <button id="btn-go-garage" class="btn btn-secondary">GARAJ</button>
                  <button id="btn-go-home" class="btn btn-secondary">ANA MENÜ</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. GARAGE & SHOP SCREEN (Luxury Showroom Split Layout) -->
      <div id="screen-garage" class="ui-screen" style="display: flex !important; flex-direction: row !important; justify-content: space-between !important; overflow: hidden !important; pointer-events: none !important;">
        <!-- Floating Header across the top -->
        <div class="garage-top-bar">
          <button id="btn-garage-back" class="btn btn-secondary">◀ GERİ</button>
          <div class="garage-title-wrap">
            <h2 class="panel-title">ARAÇ GALERİSİ</h2>
            <div class="garage-rotate-hint">🔄 360° İncelemek İçin Sürükleyin</div>
          </div>
          <div class="currency-badge" id="garage-money-badge">₺0</div>
        </div>

        <!-- Left 3D Showcase Area: Clear open view of the car & podium -->
        <div class="garage-showcase-zone" style="flex: 1 !important; height: 100% !important; width: auto !important; pointer-events: auto !important; cursor: grab !important; touch-action: none !important;"></div>

        <!-- Right Side Customization Sidebar -->
        <div class="garage-sidebar" style="position: relative !important; width: min(380px, 42vw) !important; min-width: 260px !important; height: 100% !important; border-top: none !important; border-radius: 0 !important; right: 0 !important; box-sizing: border-box !important; overflow-y: auto !important; pointer-events: auto !important; touch-action: pan-y !important; -webkit-overflow-scrolling: touch !important;">
          <!-- Vehicle Selector -->
          <div class="vehicle-carousel-selector">
            <button id="btn-prev-car" class="vehicle-nav-btn">◀</button>
            <div class="vehicle-meta">
              <div class="vehicle-name" id="garage-car-name">Viper GT-X</div>
              <div class="vehicle-category" id="garage-car-category">BAŞLANGIÇ ARACI</div>
            </div>
            <button id="btn-next-car" class="vehicle-nav-btn">▶</button>
          </div>

          <!-- Color Customizer -->
          <div class="glass-panel garage-panel-card">
            <h3 class="garage-card-title">GÖVDE RENGİ</h3>
            <div class="color-picker-row" id="garage-colors-row"></div>
          </div>

          <!-- Vehicle Stats Bars -->
          <div class="glass-panel stat-bars-container garage-panel-card">
            <div class="stat-bar-row">
              <div class="stat-bar-header">
                <span>MAKSİMUM HIZ</span>
                <span id="stat-val-speed">180 KM/H</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" id="stat-fill-speed" style="width: 50%;"></div></div>
            </div>

            <div class="stat-bar-row">
              <div class="stat-bar-header">
                <span>HIZLANMA</span>
                <span id="stat-val-accel">18 m/s²</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" id="stat-fill-accel" style="width: 50%;"></div></div>
            </div>

            <div class="stat-bar-row">
              <div class="stat-bar-header">
                <span>YOL TUTUŞ</span>
                <span id="stat-val-handling">7.5</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" id="stat-fill-handling" style="width: 50%;"></div></div>
            </div>

            <div class="stat-bar-row">
              <div class="stat-bar-header">
                <span>FREN GÜCÜ</span>
                <span id="stat-val-braking">30</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" id="stat-fill-braking" style="width: 50%;"></div></div>
            </div>

            <div class="stat-bar-row">
              <div class="stat-bar-header">
                <span>NİTRO GÜCÜ</span>
                <span id="stat-val-nitro">100%</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" id="stat-fill-nitro" style="width: 50%;"></div></div>
            </div>
          </div>

          <!-- Action: Buy or Select -->
          <div id="garage-purchase-area">
            <button id="btn-select-or-buy" class="btn btn-primary" style="width: 100%; padding: 15px;">
              ARACI SEÇ
            </button>
          </div>

          <!-- License Plate Customizer Card -->
          <div class="glass-panel garage-panel-card" style="border: 1px solid rgba(0, 240, 255, 0.35); background: rgba(6, 15, 30, 0.65); border-radius: 14px; padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <h3 class="garage-card-title" style="margin: 0; display: flex; align-items: center; gap: 6px; color: #00f0ff;">
                <span>🇹🇷</span> ÖZEL PLAKA
              </h3>
              <button id="btn-random-plate" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.74rem;" title="Rastgele Türk Plakası Üret">
                🎲 RASTGELE
              </button>
            </div>

            <!-- Realistic Turkish Plate Graphic Preview -->
            <div class="tr-plate-preview" style="display: flex; align-items: center; background: #ffffff; border: 3.5px solid #111; border-radius: 8px; overflow: hidden; height: 50px; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); user-select: none;">
              <div style="background: #003399; color: #fff; width: 44px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem; letter-spacing: 1px; border-right: 1px solid rgba(0,0,0,0.3);">
                <span style="font-size: 0.65rem; color: #ffcc00; line-height: 1; letter-spacing: 0;">★★★</span>
                <span>TR</span>
              </div>
              <div id="plate-preview-text" style="flex: 1; text-align: center; color: #000; font-family: var(--font-display), 'Impact', sans-serif; font-size: 1.62rem; font-weight: 900; letter-spacing: 3.5px;">
                34 TR 1998
              </div>
            </div>

            <!-- Plate Input & Apply Button -->
            <div style="display: flex; gap: 6px;">
              <input type="text" id="input-license-plate" maxlength="11" placeholder="34 TR 1998" style="flex: 1; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; color: #fff; padding: 10px 12px; font-family: var(--font-display); font-size: 1.05rem; font-weight: 800; text-transform: uppercase; text-align: center; letter-spacing: 2px;" />
              <button id="btn-save-plate" class="btn btn-primary" style="padding: 10px 16px; font-size: 0.86rem; font-weight: 800; letter-spacing: 0.5px;">
                KAYDET
              </button>
            </div>
          </div>

          <!-- Exhaust Sound Preset Selector -->
          <div class="glass-panel garage-panel-card">
            <h3 class="garage-card-title">🔊 EGZOZ SİSTEMİ & ALEV KİTİ</h3>
            <div id="garage-exhaust-selector" style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn exhaust-pill" data-preset="Abarti"   style="flex: 1 1 45%; padding: 10px 6px; font-size: 0.80rem; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.2s; font-weight: 800;">💥 WAREX (VANALI)</button>
              <button class="btn exhaust-pill" data-preset="Deep"     style="flex: 1 1 45%; padding: 10px 6px; font-size: 0.80rem; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.2s; font-weight: 800;">🏎️ AKRAPOVIÇ</button>
              <button class="btn exhaust-pill" data-preset="Light"    style="flex: 1 1 45%; padding: 10px 6px; font-size: 0.80rem; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.2s; font-weight: 800;">🍿 POPCORN TUNE</button>
              <button class="btn exhaust-pill" data-preset="Standard" style="flex: 1 1 45%; padding: 10px 6px; font-size: 0.80rem; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.2s; font-weight: 800;">🔉 STANDART</button>
            </div>
            <!-- Live spec badge -->
            <div id="exhaust-desc-badge" style="margin-top: 8px; padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); font-size: 0.74rem; color: #ffbe0b; line-height: 1.35; text-align: center; border: 1px solid rgba(255,190,11,0.25);">
              💥 Vanalı Açık Düz Boru • Yanan Titanyum Uç • Kesici & Seri Alev • HKS Blow-Off
            </div>
            <button id="btn-preview-exhaust" class="btn btn-secondary" style="width: 100%; margin-top: 8px; padding: 11px; font-size: 0.88rem; font-weight: 800; border-color: #ffbe0b; color: #ffbe0b; display: flex; align-items: center; justify-content: center; gap: 8px;" title="Seçili egzoz tonuyla ara gaz ver ve alevleri izle">
              <span>🔥</span> ARA GAZ VER / ALEV & SESİ DİNLE
            </button>
          </div>

          <!-- Custom 3D Model (.GLTF / .GLB / .FBX) -->
          <div class="glass-panel garage-panel-card" style="border: 1px dashed rgba(0, 240, 255, 0.45); background: rgba(0, 240, 255, 0.05); border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <h3 style="font-size: 0.95rem; color: #00f0ff; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>🚘</span> ÖZEL 3D ARABA (.GLTF / .GLB / .FBX)
              </h3>
              <span id="custom-model-badge" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.12); color: #fff;">Orijinal Model</span>
            </div>
            <p style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-bottom: 10px; line-height: 1.35;">
              Kendi indirdiğin 3D araba modelini (.gltf / .glb / .fbx) hemen oyuna aktar! Dosya seç veya ekrana sürükle-bırak.
            </p>
            <input type="file" id="input-custom-model" accept=".gltf,.glb,.fbx,.bin,.png,.jpg,.jpeg" multiple style="display: none;" />
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="btn-upload-model" class="btn btn-secondary" style="flex: 2; min-width: 120px; padding: 9px; font-size: 0.82rem; border-color: #00f0ff; color: #00f0ff;">
                📂 3D MODEL YÜKLE
              </button>
              <button id="btn-flip-model" class="btn btn-secondary" style="flex: 1; min-width: 90px; padding: 9px; font-size: 0.82rem;" title="Araba ters yöne bakıyorsa 180 derece çevir">
                🔄 180° ÇEVİR
              </button>
              <button id="btn-reset-model" class="btn btn-secondary" style="flex: 1; min-width: 75px; padding: 9px; font-size: 0.82rem; color: #ff5555;" title="Orijinal araba modeline geri dön">
                ↺ SIFIRLA
              </button>
            </div>
            <div id="custom-model-status" style="margin-top: 8px; font-size: 0.78rem; color: #00ffaa; display: none;"></div>
          </div>

          <!-- Upgrades List -->
          <div class="glass-panel garage-panel-card">
            <h3 class="garage-card-title" style="color: var(--primary-glow);">PERFORMANS YÜKSELTMELERİ</h3>
            <div class="upgrades-list" id="garage-upgrades-list"></div>
          </div>
        </div>
      </div>

      <!-- 5. MISSIONS SCREEN -->
      <div id="screen-missions" class="ui-screen">
        <div class="panel-header">
          <button id="btn-missions-back" class="btn btn-secondary">◀ GERİ</button>
          <h2 class="panel-title">GÖREVLER</h2>
          <div class="currency-badge" id="missions-money-badge">₺0</div>
        </div>

        <div class="missions-list" id="missions-items-container"></div>
      </div>

      <!-- Drag & Drop Fullscreen Overlay -->
      <div id="dropzone-overlay" style="position: fixed; inset: 0; background: rgba(0, 15, 30, 0.88); z-index: 99999; backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; flex-direction: column; border: 4px dashed #00f0ff; pointer-events: none;">
        <div style="font-size: 4.5rem; margin-bottom: 16px;">🏎️</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #00f0ff; letter-spacing: 2px;">3D ARABA MODELİNİ BURAYA BIRAKIN</div>
        <div style="font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-top: 10px; max-width: 480px; text-align: center; line-height: 1.4;">
          .gltf veya .glb dosyanız otomatik olarak arabanıza dönüştürülecektir.
        </div>
      </div>

      <!-- 6. SETTINGS MODAL OVERLAY -->
      <div id="screen-settings" class="settings-overlay">
        <div class="glass-panel settings-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
            <h2 style="margin: 0; font-size: 1.35rem; color: #00f0ff; display: flex; align-items: center; gap: 8px;">
              <span>⚙️</span> OYUN AYARLARI
            </h2>
            <button id="btn-close-settings" class="icon-btn" style="width: 34px; height: 34px; font-size: 1.1rem; border-radius: 50%;">✕</button>
          </div>

          <!-- Direksiyon Hassasiyeti -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 0.92rem; color: #fff;">Direksiyon Hassasiyeti</span>
              <span id="label-steering-val" style="color: #ffbe0b; font-weight: 800; font-size: 0.95rem;">1.00x</span>
            </div>
            <input type="range" id="slider-steering-sens" min="0.5" max="1.5" step="0.05" value="1.0" style="width: 100%; accent-color: #00f0ff; cursor: pointer;" />
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 4px;">
              <span>Daha Yumuşak (0.5x)</span>
              <span>Dengeli (1.0x)</span>
              <span>Daha Seri (1.5x)</span>
            </div>
          </div>

          <!-- Grafik Kalitesi -->
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 700; font-size: 0.92rem; margin-bottom: 8px; color: #fff;">Grafik Kalitesi</div>
            <div style="display: flex; gap: 8px;" id="settings-graphics-row">
              <button class="choice-pill btn-graphics-choice" data-quality="low" style="flex: 1; padding: 10px; font-size: 0.82rem;">DÜŞÜK</button>
              <button class="choice-pill btn-graphics-choice" data-quality="medium" style="flex: 1; padding: 10px; font-size: 0.82rem;">ORTA</button>
              <button class="choice-pill btn-graphics-choice active" data-quality="high" style="flex: 1; padding: 10px; font-size: 0.82rem;">YÜKSEK</button>
            </div>
            <div id="settings-graphics-hint" style="font-size: 0.72rem; color: rgba(0,240,255,0.75); margin-top: 6px;">
              Yüksek: PCF Yumuşak Gölgeler, tam cihaz çözünürlüğü.
            </div>
          </div>

          <!-- Ses & Efektler -->
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 700; font-size: 0.92rem; margin-bottom: 8px; color: #fff;">Ses & Efektler</div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-settings-sound" class="btn btn-pill" style="flex: 1; padding: 10px; font-size: 0.85rem;">🔊 SES: AÇIK</button>
              <button id="btn-settings-music" class="btn btn-pill" style="flex: 1; padding: 10px; font-size: 0.85rem;">🎵 MÜZİK: AÇIK</button>
            </div>
          </div>

          <!-- Kontrol Modu -->
          <div style="margin-bottom: 22px;">
            <div style="font-weight: 700; font-size: 0.92rem; margin-bottom: 8px; color: #fff;">Kontrol Modu</div>
            <button id="btn-settings-gyro" class="btn btn-pill" style="width: 100%; padding: 10px; font-size: 0.85rem;">📱 KONTROL: BUTON</button>
          </div>

          <!-- Trafik Ayarları Geçiş Butonu -->
          <div style="margin-bottom: 22px;">
            <button id="btn-settings-open-traffic" class="btn btn-secondary" style="width: 100%; padding: 11px; font-size: 0.90rem; border-color: #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>🚦</span> ÖZEL TRAFİK AYARLARI MENÜSÜ
            </button>
          </div>

          <!-- Kapat Butonu -->
          <button id="btn-save-close-settings" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 0.98rem; font-weight: 800;">
            KAYDET VE KAPAT
          </button>
        </div>
      </div>

      <!-- 7. TRAFFIC SETTINGS MODAL OVERLAY -->
      <div id="screen-traffic-settings" class="settings-overlay">
        <div class="glass-panel settings-card" style="max-width: 540px; max-height: 88vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
            <h2 style="margin: 0; font-size: 1.35rem; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
              <span>🚦</span> TRAFİK AYARLARI
            </h2>
            <button id="btn-close-traffic-settings" class="icon-btn" style="width: 34px; height: 34px; font-size: 1.1rem; border-radius: 50%;">✕</button>
          </div>

          <!-- Hızlı Şablonlar (Quick Presets) -->
          <div style="margin-bottom: 18px;">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 8px; color: #fff; display: flex; justify-content: space-between;">
              <span>⚡ HIZLI ŞABLONLAR</span>
              <span style="font-size: 0.74rem; color: #38bdf8;">Tek Dokunuşla Seç</span>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="traffic-quick-presets-row">
              <button class="choice-pill traffic-preset-pill" data-preset="empty">🚫 Boş Yol (%0)</button>
              <button class="choice-pill traffic-preset-pill" data-preset="low">🟢 Akıcı (%40)</button>
              <button class="choice-pill traffic-preset-pill" data-preset="normal">🟡 Normal (%100)</button>
              <button class="choice-pill traffic-preset-pill" data-preset="dense">🔴 Mesai Saati (%160)</button>
              <button class="choice-pill traffic-preset-pill" data-preset="chaos">⚡ Kaos (%220)</button>
            </div>
          </div>

          <!-- Trafik Yoğunluğu Slider -->
          <div style="margin-bottom: 18px; background: rgba(255,255,255,0.04); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 0.92rem; color: #fff;">Trafik Yoğunluğu</span>
              <span id="label-traffic-density" style="color: #38bdf8; font-weight: 800; font-size: 1.05rem;">%100</span>
            </div>
            <input type="range" id="slider-traffic-density" min="0" max="250" step="5" value="100" style="width: 100%; accent-color: #38bdf8; cursor: pointer;" />
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 4px;">
              <span>Sıfır Araç (%0)</span>
              <span>Standart (%100)</span>
              <span>İğne Atılsa Düşmez (%250)</span>
            </div>
          </div>

          <!-- Trafik Akış Hızı -->
          <div style="margin-bottom: 18px;">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 8px; color: #fff;">🏎️ TRAFİK AKIŞ HIZI</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="traffic-speed-row">
              <button class="choice-pill traffic-speed-pill" data-speed="slow">🐢 Yavaş (45-65)</button>
              <button class="choice-pill traffic-speed-pill active" data-speed="normal">🚗 Normal (75-105)</button>
              <button class="choice-pill traffic-speed-pill" data-speed="fast">⚡ Hızlı (110-145)</button>
              <button class="choice-pill traffic-speed-pill" data-speed="chaotic">🎲 Kaotik (40-150)</button>
            </div>
          </div>

          <!-- Şerit Değiştirme / Makas Agresifliği -->
          <div style="margin-bottom: 18px;">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 8px; color: #fff;">🚕 ŞERİT DEĞİŞTİRME & MAKAS AGRESİFLİĞİ</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="traffic-lanechange-row">
              <button class="choice-pill traffic-lane-pill" data-lane="none">🛑 Sabit (0 Makas)</button>
              <button class="choice-pill traffic-lane-pill active" data-lane="balanced">🔹 Dengeli (Normal)</button>
              <button class="choice-pill traffic-lane-pill" data-lane="crazy">💥 İstanbul Taksicisi (Çılgın)</button>
            </div>
          </div>

          <!-- Araç Filosu / Çeşitliliği -->
          <div style="margin-bottom: 18px;">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 8px; color: #fff;">🚚 TRAFİK ARAÇ FİLOSU</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="traffic-fleet-row">
              <button class="choice-pill traffic-fleet-pill active" data-fleet="all">🎲 Karışık (Tümü)</button>
              <button class="choice-pill traffic-fleet-pill" data-fleet="heavy">🚛 Tır & Otobüs Konvoyu</button>
              <button class="choice-pill traffic-fleet-pill" data-fleet="commercial">🚕 Sarı Taksi & Dolmuş</button>
              <button class="choice-pill traffic-fleet-pill" data-fleet="tofas">🕊️ Tofaş & Şahin Çetesi</button>
              <button class="choice-pill traffic-fleet-pill" data-fleet="passenger">🚗 Yalnızca Binekler</button>
            </div>
          </div>

          <!-- Yol Yönü & Korna Yol Verme -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
            <div>
              <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: #fff;">↔️ YOL YÖNÜ</div>
              <div style="display: flex; gap: 6px;" id="traffic-direction-row">
                <button class="choice-pill traffic-dir-pill active" data-dir="ONE_WAY" style="flex: 1; padding: 8px 4px; font-size: 0.80rem;">TEK YÖN</button>
                <button class="choice-pill traffic-dir-pill" data-dir="TWO_WAY" style="flex: 1; padding: 8px 4px; font-size: 0.80rem;">ÇİFT YÖN</button>
              </div>
            </div>

            <div>
              <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: #fff;">📢 KORNA / SELEKTÖR</div>
              <div style="display: flex; gap: 6px;" id="traffic-yield-row">
                <button class="choice-pill traffic-yield-pill" data-yield="stubborn" style="flex: 1; padding: 8px 4px; font-size: 0.78rem;">İnatçı</button>
                <button class="choice-pill traffic-yield-pill active" data-yield="normal" style="flex: 1; padding: 8px 4px; font-size: 0.78rem;">Normal</button>
                <button class="choice-pill traffic-yield-pill" data-yield="polite" style="flex: 1; padding: 8px 4px; font-size: 0.78rem;">Saygılı</button>
              </div>
            </div>
          </div>

          <!-- Hasarsızlık / Ölümsüzlük (God Mode) -->
          <div style="margin-bottom: 22px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 800; font-size: 0.92rem; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                <span>🛡️</span> HASARSIZLIK / ÖLÜMSÜZLÜK (GOD MODE)
              </div>
              <div style="font-size: 0.74rem; color: rgba(255,255,255,0.7); margin-top: 2px;">
                Çarpışmalarda oyun bitmez; araçları savurarak gazlamaya devam edersin.
              </div>
            </div>
            <button id="btn-toggle-godmode" class="choice-pill" style="min-width: 90px; padding: 8px 14px; font-weight: 800;">KAPALI</button>
          </div>

          <!-- Action Buttons: Kaydet & Sıfırla -->
          <div style="display: flex; gap: 10px;">
            <button id="btn-reset-traffic-settings" class="btn btn-secondary" style="flex: 1; padding: 12px; font-size: 0.88rem; color: #ff5555; border-color: rgba(255,85,85,0.4);">
              ↺ SIFIRLA
            </button>
            <button id="btn-save-close-traffic-settings" class="btn btn-primary" style="flex: 2; padding: 12px; font-size: 0.98rem; font-weight: 800;">
              KAYDET VE UYGULA
            </button>
          </div>
        </div>
      </div>

      <!-- 8. MULTIPLAYER LOBBY MODAL OVERLAY -->
      <div id="screen-multiplayer" class="settings-overlay">
        <div class="glass-panel settings-card" style="max-width: 560px; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
            <h2 style="margin: 0; font-size: 1.3rem; color: #ff007f; display: flex; align-items: center; gap: 8px;">
              <span>⚔️</span> ÇOK OYUNCULU DÜELLO
            </h2>
            <button id="btn-close-multiplayer" class="icon-btn" style="width: 34px; height: 34px; font-size: 1.1rem; border-radius: 50%;">✕</button>
          </div>

          <!-- Driver Name Input -->
          <div style="margin-bottom: 18px; background: rgba(255,255,255,0.04); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; color: #fff;">👤 SÜRÜCÜ ADINIZ</div>
            <input type="text" id="input-mp-player-name" placeholder="Örn: AsfaltCanavarı34" maxlength="16" style="width: 100%; padding: 10px 14px; font-size: 0.95rem; font-weight: 700; background: rgba(0,0,0,0.4); border: 1.5px solid #ff007f; border-radius: 8px; color: #fff; box-sizing: border-box;" />
            <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 4px;">Seçili Aracınız: <b id="mp-selected-car-name" style="color: #00f0ff;">-</b></div>
          </div>

          <!-- Lobby Navigation Tabs: ODA KUR vs ODAYA KATIL -->
          <div style="display: flex; gap: 8px; margin-bottom: 18px;">
            <button id="tab-mp-create" class="choice-pill active" style="flex: 1; padding: 10px; font-size: 0.88rem;">🏠 ODA KUR (HOST)</button>
            <button id="tab-mp-join" class="choice-pill" style="flex: 1; padding: 10px; font-size: 0.88rem;">🔑 ODAYA KATIL</button>
          </div>

          <!-- TAB 1: CREATE ROOM CONTENT -->
          <div id="panel-mp-create">
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 8px; color: #fff;">🏁 YARIŞ FORMATI</div>
              <div style="display: flex; gap: 8px;" id="mp-mode-selector">
                <button class="choice-pill active mp-mode-pill" data-mode="SPRINT" style="flex: 1; padding: 9px; font-size: 0.82rem;">🏎️ 3000M SPRINT</button>
                <button class="choice-pill mp-mode-pill" data-mode="SURVIVAL" style="flex: 1; padding: 9px; font-size: 0.82rem;">💀 HAYATTA KALMA</button>
              </div>
              <div id="mp-mode-desc" style="font-size: 0.74rem; color: #ffbe0b; margin-top: 6px;">
                Trafikte 3000 metreye ilk varan düelloyu kazanır!
              </div>
            </div>

            <!-- Create button (shown before room created) -->
            <div id="mp-create-action-box">
              <button id="btn-mp-create-room" class="btn btn-primary" style="width: 100%; padding: 13px; font-size: 1.0rem; font-weight: 800; background: linear-gradient(135deg, #ff007f, #b5179e); border-color: #ff007f;">
                ⚡ YENİ ODA OLUŞTUR
              </button>
            </div>

            <!-- Host Room Lobby Info (shown after room created) -->
            <div id="mp-host-room-info" style="display: none; background: rgba(255, 0, 127, 0.08); border: 1.5px dashed #ff007f; border-radius: 12px; padding: 16px; text-align: center; margin-top: 12px;">
              <div style="font-size: 0.82rem; color: rgba(255,255,255,0.7);">ODA PIN KODU (Arkadaşlarına Gönder):</div>
              <div id="mp-room-code-display" style="font-size: 2.2rem; font-family: 'Orbitron', monospace; font-weight: 900; color: #00f0ff; letter-spacing: 8px; margin: 8px 0;">----</div>
              <div id="mp-host-status-msg" style="font-size: 0.85rem; color: #ffbe0b; margin-bottom: 12px;">⏳ Arkadaşlarının odaya girmesi bekleniyor... (En az 2 yarışçı)</div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; text-align: left;">
                <span style="font-weight: 700; font-size: 0.82rem; color: #fff;">🏎️ OTOYOL GRID (4 ŞERİT):</span>
                <span id="mp-host-count-badge" style="background: #ff007f; color: #fff; font-size: 0.76rem; font-weight: 800; padding: 2px 8px; border-radius: 10px;">1/4 Oyuncu</span>
              </div>

              <!-- 4-Player Grid Slots for Host -->
              <div id="mp-host-players-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; text-align: left;"></div>

              <!-- Legacy compatibility badge -->
              <div id="mp-host-opponent-badge" style="display: none;">
                <span id="mp-host-opp-name"></span>
              </div>

              <button id="btn-mp-start-race" class="btn btn-primary" disabled style="width: 100%; padding: 13px; font-size: 1.05rem; font-weight: 800; opacity: 0.5; cursor: not-allowed;">
                ▶ YARIŞI BAŞLAT (2-4 OYUNCU)
              </button>
            </div>
          </div>

          <!-- TAB 2: JOIN ROOM CONTENT -->
          <div id="panel-mp-join" style="display: none;">
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 8px; color: #fff;">🔑 ODA KODUNU GİRİN</div>
              <input type="text" id="input-mp-room-code" placeholder="Örn: TR34" maxlength="4" style="width: 100%; padding: 14px; font-size: 1.6rem; font-weight: 900; text-align: center; font-family: 'Orbitron', monospace; letter-spacing: 10px; text-transform: uppercase; background: rgba(0,0,0,0.5); border: 2px solid #00f0ff; border-radius: 10px; color: #00f0ff; box-sizing: border-box;" />
            </div>

            <button id="btn-mp-join-room" class="btn btn-primary" style="width: 100%; padding: 13px; font-size: 1.0rem; font-weight: 800;">
              🚀 ODAYA GİR VE BAĞLAN
            </button>

            <div id="mp-join-status-box" style="margin-top: 14px; text-align: left; display: none;">
              <div style="text-align: center; margin-bottom: 10px; font-size: 0.88rem; color: #00f0ff; line-height: 1.4;">
                ✅ <b>Odaya Bağlandın!</b><br><span style="color: rgba(255,255,255,0.7); font-size: 0.78rem;">Oda kurucusu başlattığında yarış otomatik başlayacak...</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 0.82rem; color: #fff;">🏎️ OTOYOL GRID:</span>
                <span id="mp-join-count-badge" style="background: #00f0ff; color: #000; font-size: 0.76rem; font-weight: 800; padding: 2px 8px; border-radius: 10px;">1/4 Oyuncu</span>
              </div>
              <div id="mp-join-players-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"></div>
            </div>
          </div>

          <div id="mp-error-msg" style="margin-top: 14px; padding: 8px 12px; border-radius: 8px; background: rgba(255, 0, 60, 0.15); border: 1px solid rgba(255, 0, 60, 0.4); color: #ff5555; font-size: 0.80rem; display: none; text-align: center;"></div>
        </div>
      </div>

      <!-- 9. MULTIPLAYER RESULT MODAL OVERLAY -->
      <div id="screen-multiplayer-result" class="settings-overlay">
        <div class="glass-panel settings-card" style="max-width: 520px; text-align: center; border: 2px solid #ff007f;">
          <div id="mp-result-badge-icon" style="font-size: 3.8rem; margin-bottom: 4px;">🏆</div>
          <h2 id="mp-result-title" style="font-size: 1.8rem; margin: 0 0 4px 0; color: #00f0ff; font-family: 'Orbitron', sans-serif;">KAZANDIN!</h2>
          <p id="mp-result-subtitle" style="font-size: 0.90rem; color: rgba(255,255,255,0.8); margin-bottom: 16px;">Otoyolun şampiyonu sensin!</p>

          <!-- 4-Player Leaderboard / Podium Table -->
          <div id="mp-podium-table" style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 8px; font-family: 'Rajdhani', sans-serif; text-align: left;">
            <!-- Populated dynamically with all racers' results -->
          </div>

          <!-- Fallback stats for legacy code -->
          <div style="display: none;">
            <span id="mp-stat-my-dist"></span>
            <span id="mp-stat-opp-dist"></span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button id="btn-mp-result-lobby" class="btn btn-secondary" style="flex: 1; padding: 12px; font-size: 0.92rem;">
              👥 LOBİYE DÖN
            </button>
            <button id="btn-mp-result-home" class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 0.92rem;">
              🏠 ANA MENÜ
            </button>
          </div>
        </div>
      </div>

      <!-- 10. AD STUDIO / REELS SETUP MODAL -->
      <div id="screen-ads-studio" class="settings-overlay" style="display: none;">
        <div class="glass-panel settings-card" style="max-width: 560px; max-height: 94vh; overflow-y: auto; padding: 18px 22px 26px 22px; border: 2px solid #e1306c; box-shadow: 0 0 35px rgba(225, 48, 108, 0.35);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.6rem;">🎬</span>
              <div>
                <h2 style="margin: 0; font-size: 1.22rem; color: #ff758c; font-family: 'Orbitron', sans-serif;">SİNEMATİK REKLAM STÜDYOSU</h2>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.65);">Instagram Reels & TikTok İçin Otomatik Makas Çekimi</span>
              </div>
            </div>
            <button id="btn-close-ad-studio" class="icon-btn" style="width: 34px; height: 34px; font-size: 1.1rem;">✕</button>
          </div>

          <!-- Tanıtım Açıklaması -->
          <div style="background: rgba(225, 48, 108, 0.12); border: 1px solid rgba(225, 48, 108, 0.3); border-radius: 12px; padding: 12px; margin-bottom: 16px; font-size: 0.82rem; line-height: 1.45; color: #fff;">
            🏎️ <b>Yapay Zeka Otopilot</b> aracı yüksek hızda (160+ km/s) otomatik sürer, araçların arasından kıl payı makas atar, selektör yakar ve 5 farklı profesyonel sinematik kamera açısından kayıt almanızı sağlar. Çarpışmada durmaz, video asla kesilmez!
          </div>

          <!-- Araç Seçimi -->
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 700; font-size: 0.86rem; margin-bottom: 8px; color: #fff; display: flex; justify-content: space-between;">
              <span>🏎️ ÇEKİM ARACI</span>
              <span id="ad-studio-selected-car-name" style="color: #ff758c; font-weight: 800;">Tofaş Doğan SLX</span>
            </div>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;" id="ad-studio-cars-row"></div>
          </div>

          <!-- Vakit / Ortam Seçimi -->
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 700; font-size: 0.86rem; margin-bottom: 8px; color: #fff;">🌆 İSTANBUL ATMOSFERİ</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="ad-studio-env-row">
              <button class="choice-pill active" data-env="DAY">☀️ BOĞAZİÇİ</button>
              <button class="choice-pill" data-env="SUNSET">🌅 KIZ KULESİ</button>
              <button class="choice-pill" data-env="NIGHT">🌃 MASLAK</button>
              <button class="choice-pill" data-env="RAIN">🌧️ YAĞMURLU</button>
            </div>
          </div>

          <!-- Makas Agresifliği -->
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 700; font-size: 0.86rem; margin-bottom: 8px; color: #fff;">⚡ MAKAS VE SÜRÜŞ STİLİ</div>
            <div style="display: flex; gap: 8px;" id="ad-studio-aggr-row">
              <button class="choice-pill active" data-aggr="aggressive" style="flex: 1; padding: 10px; font-size: 0.82rem;">
                🔥 Çılgın Makas (165 km/s)
              </button>
              <button class="choice-pill" data-aggr="smooth" style="flex: 1; padding: 10px; font-size: 0.82rem;">
                🚗 Akıcı Slalom (135 km/s)
              </button>
            </div>
          </div>

          <!-- 9:16 Instagram Reels Çerçevesi -->
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 800; font-size: 0.88rem; color: #fff; display: flex; align-items: center; gap: 6px;">
                <span>📱</span> 9:16 INSTAGRAM REELS REHBERİ
              </div>
              <div style="font-size: 0.74rem; color: rgba(255,255,255,0.65); margin-top: 2px;">
                Dikey video çekimi için kenar maskesini ve kırpma kılavuzunu açar.
              </div>
            </div>
            <button id="btn-toggle-reels-mask" class="choice-pill" style="min-width: 80px; padding: 8px 12px;">KAPALI</button>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 10px;">
            <button id="btn-cancel-ad-studio" class="btn btn-secondary" style="flex: 1; padding: 13px;">
              İPTAL
            </button>
            <button id="btn-start-ad-studio-action" class="btn btn-primary" style="flex: 2; padding: 13px; font-size: 1.02rem; font-weight: 900; background: linear-gradient(135deg, #e1306c 0%, #fd1d1d 100%); border: none; box-shadow: 0 4px 18px rgba(225, 48, 108, 0.45);">
              🚀 ÇEKİMİ BAŞLAT
            </button>
          </div>
        </div>
      </div>

      <!-- IN-GAME AD STUDIO CONTROL HUD -->
      <div id="ad-studio-hud" style="display: none; position: absolute; inset: 0; pointer-events: none; z-index: 85;">
        <div style="position: absolute; top: 18px; left: 20px; display: flex; align-items: center; gap: 10px; pointer-events: auto;">
          <div style="background: rgba(0,0,0,0.78); border: 2px solid #e1306c; border-radius: 20px; padding: 6px 14px; display: flex; align-items: center; gap: 8px; font-family: 'Orbitron', sans-serif; font-size: 0.80rem; font-weight: 800; color: #fff; box-shadow: 0 0 16px rgba(225,48,108,0.4);">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff0055; animation: blink-rec 1s infinite;"></span>
            <span>REEL ÇEKİMİ</span>
          </div>
          <div id="ad-hud-cam-name" style="background: rgba(0,0,0,0.70); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700; color: #38bdf8;">
            🎥 ALÇAK EGZOZ
          </div>
          <div id="ad-hud-speed" style="background: rgba(0,0,0,0.70); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 800; color: #ffbe0b;">
            165 KM/H
          </div>
        </div>

        <div style="position: absolute; top: 18px; right: 20px; display: flex; gap: 8px; pointer-events: auto;">
          <button id="ad-btn-clean-ui" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.80rem; font-weight: 800; background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.35); color: #fff; border-radius: 20px; cursor: pointer;">
            👁️ UI GİZLE (H)
          </button>
          <button id="ad-btn-slowmo" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.80rem; font-weight: 800; background: rgba(0,0,0,0.75); border: 1px solid #ffbe0b; color: #ffbe0b; border-radius: 20px; cursor: pointer;">
            ⏱️ SLOW-MO: KAPALI
          </button>
          <button id="ad-btn-reels-mask" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.80rem; font-weight: 800; background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.35); color: #fff; border-radius: 20px; cursor: pointer;">
            📱 9:16 REEL
          </button>
          <button id="ad-btn-next-cam" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.80rem; font-weight: 800; background: rgba(0,0,0,0.75); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 20px; cursor: pointer;">
            🎥 KAMERA
          </button>
          <button id="ad-btn-exit" class="btn btn-secondary" style="padding: 8px 14px; font-size: 0.80rem; font-weight: 800; background: rgba(225,48,108,0.85); border: 1px solid #fff; color: #fff; border-radius: 20px; cursor: pointer;">
            ✕ ÇIKIŞ
          </button>
        </div>
      </div>

      <!-- Fullscreen Instagram 9:16 Vertical Framing Mask -->
      <div id="reels-aspect-mask" style="display: none; position: absolute; inset: 0; pointer-events: none; z-index: 80;">
        <div style="position: absolute; top: 0; bottom: 0; left: 0; width: calc(50% - (100vh * 9 / 32)); background: rgba(0,0,0,0.78); backdrop-filter: blur(2px); border-right: 2px dashed rgba(225,48,108,0.6);"></div>
        <div style="position: absolute; top: 0; bottom: 0; right: 0; width: calc(50% - (100vh * 9 / 32)); background: rgba(0,0,0,0.78); backdrop-filter: blur(2px); border-left: 2px dashed rgba(225,48,108,0.6);"></div>
        <div style="position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.65); padding: 4px 14px; border-radius: 12px; font-size: 0.72rem; color: rgba(255,255,255,0.75); letter-spacing: 1px; font-weight: 700;">
          📱 9:16 INSTAGRAM REELS ÇEKİM ALANI
        </div>
      </div>

      <!-- Cinematic Camera Transition Flash & Vignette -->
      <div id="ad-camera-transition-flash" style="display: block; position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at center, rgba(255,255,255,0.75) 0%, rgba(225,48,108,0.35) 45%, rgba(0,0,0,0.85) 100%); mix-blend-mode: screen; z-index: 95; backdrop-filter: blur(2px);"></div>

      <!-- Floating Unhide UI Trigger (Only visible when UI is hidden) -->
      <button id="btn-unhide-ui" style="display: none; position: absolute; top: 16px; right: 16px; z-index: 100; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 50%; width: 44px; height: 44px; font-size: 1.2rem; cursor: pointer; backdrop-filter: blur(4px);">
        👁️
      </button>
    `;

    // Cache elements
    this.screenLoading = document.getElementById('screen-loading')!;
    this.loadingBarFill = document.getElementById('loading-bar-fill')!;
    this.loadingStatusText = document.getElementById('loading-status-text')!;

    this.screenMenu = document.getElementById('screen-menu')!;
    this.screenHud = document.getElementById('screen-hud')!;
    this.screenGameOver = document.getElementById('screen-gameover')!;
    this.screenGarage = document.getElementById('screen-garage')!;
    this.screenMissions = document.getElementById('screen-missions')!;
    this.screenMultiplayer = document.getElementById('screen-multiplayer')!;
    this.screenMultiplayerResult = document.getElementById('screen-multiplayer-result')!;

    this.hudMultiplayerBar = document.getElementById('hud-multiplayer-bar')!;
    this.mpHudMyInfo = document.getElementById('mp-hud-my-info')!;
    this.mpHudOppInfo = document.getElementById('mp-hud-opp-info')!;
    this.mpHudDiffBadge = document.getElementById('mp-hud-diff-badge')!;

    this.hudScoreVal = document.getElementById('hud-score')!;
    this.hudDistanceVal = document.getElementById('hud-distance')!;
    this.hudMoneyVal = document.getElementById('hud-cash')!;
    this.hudSpeedVal = document.getElementById('hud-speed')!;
    this.hudNitroFill = document.getElementById('hud-nitro-fill')!;
    this.hudHealthFill = document.getElementById('hud-health-fill')!;
    this.hudHealthVal = document.getElementById('hud-health-val')!;
    this.hudSignalLeft = document.getElementById('hud-signal-left')!;
    this.hudSignalRight = document.getElementById('hud-signal-right')!;
    this.nearMissBanner = document.getElementById('near-miss-banner')!;
    this.nearMissTitle = document.getElementById('near-miss-title')!;
    this.nearMissBonus = document.getElementById('near-miss-bonus')!;

    this.hudTimerCard = document.getElementById('hud-timer-card')!;
    this.hudTimerVal = document.getElementById('hud-timer-val')!;
    this.hudCamLabel = document.getElementById('hud-cam-label')!;
    this.wrongWayBanner = document.getElementById('wrong-way-banner')!;
    this.timeBonusPopup = document.getElementById('time-bonus-popup')!;
    this.edsRadarBanner = document.getElementById('eds-radar-banner')!;
    this.edsSpeedText = document.getElementById('eds-flash-speed')!;
    this.scrapeJoltBanner = document.getElementById('scrape-jolt-banner')!;
    this.scrapeJoltTitle = document.getElementById('scrape-jolt-title')!;
    this.scrapeJoltSub = document.getElementById('scrape-jolt-sub')!;
    this.btnToggleGyro = document.getElementById('btn-toggle-gyro')!;

    // Cache Cassette Radio Deck elements
    this.hudCassetteDeck = document.getElementById('hud-cassette-deck')!;
    this.deckMinimizedBar = document.getElementById('deck-minimized-bar')!;
    this.deckFullFaceplate = document.getElementById('deck-full-faceplate')!;
    this.miniStationName = document.getElementById('mini-station-name')!;
    this.tapeSpoolLeft = document.getElementById('tape-spool-left')!;
    this.tapeSpoolRight = document.getElementById('tape-spool-right')!;
    this.tapeLedPlay = document.getElementById('tape-led-play')!;
    this.tapeLedStereo = document.getElementById('tape-led-stereo')!;
    this.lcdStationFreq = document.getElementById('lcd-station-freq')!;
    this.lcdLiveBadge = document.getElementById('lcd-live-badge')!;
    this.lcdStationName = document.getElementById('lcd-station-name')!;
    this.lcdStationSub = document.getElementById('lcd-station-sub')!;
    this.eqBars = [
      document.getElementById('eq-bar-0')!,
      document.getElementById('eq-bar-1')!,
      document.getElementById('eq-bar-2')!,
      document.getElementById('eq-bar-3')!,
      document.getElementById('eq-bar-4')!,
    ];
    this.radioToastBanner = document.getElementById('radio-toast-banner')!;
    this.toastRadioFreq = document.getElementById('toast-radio-freq')!;
    this.toastRadioName = document.getElementById('toast-radio-name')!;
    this.toastRadioSub = document.getElementById('toast-radio-sub')!;

    // Cache cinematic intro elements
    this.cinematicIntroWrap = document.getElementById('cinematic-intro-wrap')!;
    this.cinematicCountdownText = document.getElementById('cinematic-countdown-text')!;
    this.cinematicModeTag = document.getElementById('cinematic-mode-tag')!;
    this.btnSkipIntro = document.getElementById('btn-skip-intro')!;

    // Cache idle camera banner elements
    this.hudIdleCamBanner = document.getElementById('hud-idle-cam-banner')!;
    this.hudIdleCamName = document.getElementById('hud-idle-cam-name')!;

    // Cache Ad Studio elements
    this.screenAdsStudio = document.getElementById('screen-ads-studio')!;
    this.adStudioHud = document.getElementById('ad-studio-hud')!;
    this.reelsAspectMask = document.getElementById('reels-aspect-mask')!;
    this.btnUnhideUi = document.getElementById('btn-unhide-ui')!;
    this.adHudCamName = document.getElementById('ad-hud-cam-name')!;
    this.adHudSpeed = document.getElementById('ad-hud-speed')!;
    this.adBtnSlowmo = document.getElementById('ad-btn-slowmo')!;
    this.adBtnReelsMask = document.getElementById('ad-btn-reels-mask')!;
    this.adCameraFlash = document.getElementById('ad-camera-transition-flash')!;

    this.btnSkipIntro?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playClick();
      this.onSkipIntro?.();
    });

    this.cinematicIntroWrap?.addEventListener('pointerdown', () => {
      audioManager.playClick();
      this.onSkipIntro?.();
    });

    // Cache pause menu elements
    this.screenPause = document.getElementById('screen-pause')!;
    this.pauseStatSpeed = document.getElementById('pause-stat-speed')!;
    this.pauseStatDist = document.getElementById('pause-stat-dist')!;
    this.pauseStatScore = document.getElementById('pause-stat-score')!;
    this.btnPauseSound = document.getElementById('btn-pause-sound')!;
    this.btnPauseMusic = document.getElementById('btn-pause-music')!;
    this.btnPauseGyro = document.getElementById('btn-pause-gyro')!;

    this.updateMenuStats();
    this.updateModeSelectorUI();
    this.updateEnvSelectorUI();
    this.updateGyroButtonUI();
    this.updateTrafficSettingsUI();
  }

  private setupEventListeners(): void {
    // Menu Buttons
    document.getElementById('btn-play-game')?.addEventListener('click', async () => {
      audioManager.init();
      audioManager.playClick();
      if (inputManager.controlType === 'tilt') {
        await inputManager.requestOrientationPermission();
      }
      if (this.onStartGame) this.onStartGame();
    });

    document.getElementById('btn-open-garage')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.navigateTo('GARAGE');
    });

    // Ad Studio / Reels Modal Open & Close
    document.getElementById('btn-open-ad-studio')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showAdStudioModal();
    });

    document.getElementById('btn-close-ad-studio')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideAdStudioModal();
    });

    document.getElementById('btn-cancel-ad-studio')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideAdStudioModal();
    });

    // Environment picker in Ad Studio
    document.querySelectorAll('#ad-studio-env-row .choice-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const env = (e.currentTarget as HTMLElement).dataset.env as any;
        this.adStudioSelectedEnv = env;
        document.querySelectorAll('#ad-studio-env-row .choice-pill').forEach((p) => p.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
      });
    });

    // Aggressiveness in Ad Studio
    document.querySelectorAll('#ad-studio-aggr-row .choice-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const aggr = (e.currentTarget as HTMLElement).dataset.aggr;
        this.adStudioAggressive = aggr === 'aggressive';
        document.querySelectorAll('#ad-studio-aggr-row .choice-pill').forEach((p) => p.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
      });
    });

    // 9:16 Reel Mask Toggles
    const toggleMaskHandler = () => {
      audioManager.playClick();
      const active = gameState.toggleReelsMask();
      const maskBtn = document.getElementById('btn-toggle-reels-mask');
      if (maskBtn) {
        maskBtn.innerText = active ? 'AÇIK' : 'KAPALI';
        maskBtn.classList.toggle('active', active);
      }
      if (this.reelsAspectMask) {
        this.reelsAspectMask.style.display = active ? 'block' : 'none';
      }
      if (this.adBtnReelsMask) {
        this.adBtnReelsMask.style.borderColor = active ? '#ff0055' : 'rgba(255,255,255,0.35)';
        this.adBtnReelsMask.style.color = active ? '#ff0055' : '#fff';
      }
    };
    document.getElementById('btn-toggle-reels-mask')?.addEventListener('click', toggleMaskHandler);
    document.getElementById('ad-btn-reels-mask')?.addEventListener('click', toggleMaskHandler);

    // Start Shoot Action
    document.getElementById('btn-start-ad-studio-action')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.hideAdStudioModal();
      if (this.onStartAdStudio) {
        this.onStartAdStudio({
          vehicleId: this.adStudioSelectedCarId,
          environment: this.adStudioSelectedEnv,
          aggressive: this.adStudioAggressive,
        });
      }
    });

    // In-Game Ad Studio HUD Buttons
    document.getElementById('ad-btn-clean-ui')?.addEventListener('click', () => {
      audioManager.playClick();
      this.toggleCleanScreen();
    });

    this.btnUnhideUi?.addEventListener('click', () => {
      audioManager.playClick();
      this.toggleCleanScreen();
    });

    document.getElementById('ad-btn-slowmo')?.addEventListener('click', () => {
      audioManager.playClick();
      const newScale = gameState.timeScale < 0.9 ? 1.0 : 0.35;
      gameState.setTimeScale(newScale);
    });

    document.getElementById('ad-btn-next-cam')?.addEventListener('click', () => {
      audioManager.playClick();
      this.onCycleAdStudioShot?.();
    });

    document.getElementById('ad-btn-exit')?.addEventListener('click', () => {
      audioManager.playClick();
      this.onExitAdStudio?.();
    });

    // Ad Studio Camera Switch Transition Flash & HUD Update
    eventBus.on('adStudioCameraSwitched', ({ shotName }) => {
      if (this.adCameraFlash) {
        this.adCameraFlash.style.transition = 'none';
        this.adCameraFlash.style.opacity = '0.9';
        // Force browser reflow to reliably restart transition
        void this.adCameraFlash.offsetWidth;
        this.adCameraFlash.style.transition = 'opacity 0.32s cubic-bezier(0.1, 0.9, 0.2, 1)';
        this.adCameraFlash.style.opacity = '0';
      }
      if (this.adHudCamName) {
        this.adHudCamName.innerText = `🎥 ${shotName}`;
      }
    });

    // Keyboard 'H' or 'h' to toggle Clean Screen mode
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
        if (gameState.currentScreen === 'PLAYING') {
          this.toggleCleanScreen();
        }
      }
    });

    document.getElementById('btn-open-missions')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.navigateTo('MISSIONS');
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showSettingsModal();
    });

    document.getElementById('btn-footer-settings')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showSettingsModal();
    });

    // Mode Selector Pills
    document.querySelectorAll('#menu-mode-selector .choice-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const mode = (e.currentTarget as HTMLElement).dataset.mode as GameMode;
        gameState.setGameMode(mode);
        this.updateModeSelectorUI();
      });
    });

    // Main Menu Background Click to Cycle Cinematic Camera Angle
    this.screenMenu?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.screenMenu || target.classList.contains('menu-overlay') || target.classList.contains('hero-banner')) {
        audioManager.playClick();
        eventBus.emit('menuCinematicNext');
      }
    });

    // Environment Selector Pills
    document.querySelectorAll('#menu-env-selector .choice-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const env = (e.currentTarget as HTMLElement).dataset.env as EnvironmentPreset;
        gameState.setEnvironment(env);
        this.updateEnvSelectorUI();
      });
    });

    // Gyroscope Control Toggle
    this.btnToggleGyro.addEventListener('click', async () => {
      audioManager.playClick();
      if (inputManager.controlType === 'buttons') {
        const granted = await inputManager.requestOrientationPermission();
        if (granted) {
          inputManager.setControlType('tilt');
        } else {
          alert('Cihaz eğim (jiroskop) izni verilmedi.');
        }
      } else {
        inputManager.setControlType('buttons');
      }
      this.updateGyroButtonUI();
    });

    // Sound / Music Toggles
    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.soundEnabled = !gameState.settings.soundEnabled;
      gameState.save();
      audioManager.setSoundEnabled(gameState.settings.soundEnabled);
      if (soundBtn) soundBtn.innerText = gameState.settings.soundEnabled ? '🔊' : '🔇';
    });

    const musicBtn = document.getElementById('btn-toggle-music');
    musicBtn?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.musicEnabled = !gameState.settings.musicEnabled;
      gameState.save();
      audioManager.setMusicEnabled(gameState.settings.musicEnabled);
      if (musicBtn) musicBtn.innerText = gameState.settings.musicEnabled ? '🎵' : '🔇';
    });

    // Exhaust Preset Selector
    document.querySelectorAll('#garage-exhaust-selector .exhaust-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.init();
        audioManager.playClick();
        const preset = (e.currentTarget as HTMLElement).dataset.preset as 'Standard' | 'Deep' | 'Light' | 'Abarti';
        gameState.setExhaustPreset(preset);
        audioManager.setExhaustPreset(preset);
        this.updateExhaustSelectorUI();
        audioManager.playExhaustPreview(preset);
      });
    });
    this.updateExhaustSelectorUI();

    document.getElementById('btn-preview-exhaust')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playExhaustPreview(gameState.exhaustPreset as any);
    });

    // In-game Pause, Camera Switch & Signals
    document.getElementById('hud-btn-pause')?.addEventListener('click', () => {
      inputManager.triggerPause();
    });

    // Pause Menu Actions
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      audioManager.playClick();
      if (this.onResumeGame) {
        this.onResumeGame();
      } else {
        this.hidePauseMenu();
      }
    });

    document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hidePauseMenu();
      if (this.onRestartGame) this.onRestartGame();
    });

    this.btnPauseSound?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.soundEnabled = !gameState.settings.soundEnabled;
      gameState.save();
      audioManager.setSoundEnabled(gameState.settings.soundEnabled);
      const soundBtn = document.getElementById('btn-toggle-sound');
      if (soundBtn) soundBtn.innerText = gameState.settings.soundEnabled ? '🔊' : '🔇';
      this.updatePauseToggles();
      if (gameState.settings.soundEnabled) audioManager.playClick();
    });

    this.btnPauseMusic?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.musicEnabled = !gameState.settings.musicEnabled;
      gameState.save();
      audioManager.setMusicEnabled(gameState.settings.musicEnabled);
      const musicBtn = document.getElementById('btn-toggle-music');
      if (musicBtn) musicBtn.innerText = gameState.settings.musicEnabled ? '🎵' : '🔇';
      this.updatePauseToggles();
      if (gameState.settings.soundEnabled) audioManager.playClick();
    });

    this.btnPauseGyro?.addEventListener('click', async () => {
      audioManager.playClick();
      if (inputManager.controlType === 'buttons') {
        const granted = await inputManager.requestOrientationPermission();
        if (granted) {
          inputManager.setControlType('tilt');
        } else {
          alert('Cihaz eğim (jiroskop) izni verilmedi.');
        }
      } else {
        inputManager.setControlType('buttons');
      }
      this.updateGyroButtonUI();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.showSettingsModal();
    });

    // Settings Modal Listeners
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideSettingsModal();
    });

    document.getElementById('btn-save-close-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideSettingsModal();
    });

    const sensSlider = document.getElementById('slider-steering-sens') as HTMLInputElement | null;
    sensSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      gameState.settings.steeringSensitivity = val;
      gameState.save();
      const lbl = document.getElementById('label-steering-val');
      if (lbl) lbl.innerText = `${val.toFixed(2)}x`;
    });

    document.querySelectorAll('.btn-graphics-choice').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const q = (e.currentTarget as HTMLElement).dataset.quality as 'low' | 'medium' | 'high';
        gameState.settings.graphicsQuality = q;
        gameState.save();
        eventBus.emit('graphicsQualityChanged', q);
        this.updateSettingsUI();
      });
    });

    document.getElementById('btn-settings-sound')?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.soundEnabled = !gameState.settings.soundEnabled;
      gameState.save();
      audioManager.setSoundEnabled(gameState.settings.soundEnabled);
      const soundBtn = document.getElementById('btn-toggle-sound');
      if (soundBtn) soundBtn.innerText = gameState.settings.soundEnabled ? '🔊' : '🔇';
      this.updatePauseToggles();
      this.updateSettingsUI();
      if (gameState.settings.soundEnabled) audioManager.playClick();
    });

    document.getElementById('btn-settings-music')?.addEventListener('click', () => {
      audioManager.init();
      gameState.settings.musicEnabled = !gameState.settings.musicEnabled;
      gameState.save();
      audioManager.setMusicEnabled(gameState.settings.musicEnabled);
      const musicBtn = document.getElementById('btn-toggle-music');
      if (musicBtn) musicBtn.innerText = gameState.settings.musicEnabled ? '🎵' : '🔇';
      this.updatePauseToggles();
      this.updateSettingsUI();
      if (gameState.settings.soundEnabled) audioManager.playClick();
    });

    document.getElementById('btn-settings-gyro')?.addEventListener('click', async () => {
      audioManager.playClick();
      if (inputManager.controlType === 'buttons') {
        const granted = await inputManager.requestOrientationPermission();
        if (granted) {
          inputManager.setControlType('tilt');
        } else {
          alert('Cihaz eğim (jiroskop) izni verilmedi.');
        }
      } else {
        inputManager.setControlType('buttons');
      }
      this.updateGyroButtonUI();
      this.updateSettingsUI();
    });

    // Traffic Settings modal open/close & quick actions
    document.getElementById('btn-open-traffic-settings')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showTrafficSettingsModal();
    });

    document.getElementById('btn-edit-traffic')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showTrafficSettingsModal();
    });

    document.getElementById('btn-pause-traffic')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.showTrafficSettingsModal();
    });

    document.getElementById('btn-settings-open-traffic')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.playClick();
      this.hideSettingsModal();
      this.showTrafficSettingsModal();
    });

    document.getElementById('btn-close-traffic-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideTrafficSettingsModal();
    });

    document.getElementById('btn-save-close-traffic-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideTrafficSettingsModal();
    });

    document.getElementById('btn-reset-traffic-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      gameState.resetTrafficSettings();
      this.updateTrafficSettingsUI();
    });

    // Traffic Density Slider
    const trafficDensitySlider = document.getElementById('slider-traffic-density') as HTMLInputElement | null;
    trafficDensitySlider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      let preset: any = 'normal';
      if (val === 0) preset = 'empty';
      else if (val <= 40) preset = 'low';
      else if (val <= 100) preset = 'normal';
      else if (val <= 160) preset = 'dense';
      else preset = 'chaos';

      gameState.updateTrafficSettings({ density: val, densityPreset: preset });
      const lbl = document.getElementById('label-traffic-density');
      if (lbl) lbl.innerText = `%${val}`;

      document.querySelectorAll('#traffic-quick-presets-row .traffic-preset-pill').forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle('active', el.dataset.preset === preset);
      });
      this.updateModeSelectorUI();
    });

    // Traffic Quick Preset Pills
    document.querySelectorAll('#traffic-quick-presets-row .traffic-preset-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const p = (e.currentTarget as HTMLElement).dataset.preset as any;
        let density = 100;
        if (p === 'empty') density = 0;
        else if (p === 'low') density = 40;
        else if (p === 'normal') density = 100;
        else if (p === 'dense') density = 160;
        else if (p === 'chaos') density = 220;

        gameState.updateTrafficSettings({ density, densityPreset: p });
        this.updateTrafficSettingsUI();
        this.updateModeSelectorUI();
      });
    });

    // Traffic Speed Pills
    document.querySelectorAll('#traffic-speed-row .traffic-speed-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const speed = (e.currentTarget as HTMLElement).dataset.speed as any;
        gameState.updateTrafficSettings({ speedPreset: speed });
        this.updateTrafficSettingsUI();
      });
    });

    // Traffic Lane Change Pills
    document.querySelectorAll('#traffic-lanechange-row .traffic-lane-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const lane = (e.currentTarget as HTMLElement).dataset.lane as any;
        gameState.updateTrafficSettings({ laneChangePreset: lane });
        this.updateTrafficSettingsUI();
      });
    });

    // Traffic Fleet Pills
    document.querySelectorAll('#traffic-fleet-row .traffic-fleet-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const fleet = (e.currentTarget as HTMLElement).dataset.fleet as any;
        gameState.updateTrafficSettings({ fleetPreset: fleet });
        this.updateTrafficSettingsUI();
        this.updateModeSelectorUI();
      });
    });

    // Traffic Direction Pills
    document.querySelectorAll('#traffic-direction-row .traffic-dir-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const dir = (e.currentTarget as HTMLElement).dataset.dir as any;
        gameState.updateTrafficSettings({ direction: dir });
        this.updateTrafficSettingsUI();
      });
    });

    // Traffic Yield Pills
    document.querySelectorAll('#traffic-yield-row .traffic-yield-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const y = (e.currentTarget as HTMLElement).dataset.yield as any;
        gameState.updateTrafficSettings({ yieldPreset: y });
        this.updateTrafficSettingsUI();
      });
    });

    // God Mode Toggle
    document.getElementById('btn-toggle-godmode')?.addEventListener('click', () => {
      audioManager.playClick();
      const current = gameState.trafficSettings.godMode;
      gameState.updateTrafficSettings({ godMode: !current });
      this.updateTrafficSettingsUI();
    });

    document.getElementById('btn-pause-garage')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hidePauseMenu();
      this.navigateTo('GARAGE');
    });

    document.getElementById('btn-pause-home')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hidePauseMenu();
      this.navigateTo('MAIN_MENU');
    });

    document.getElementById('hud-btn-camera')?.addEventListener('click', () => {
      inputManager.triggerCameraCycle();
    });

    this.hudSignalLeft?.addEventListener('click', () => {
      inputManager.triggerSignalLeft();
    });

    this.hudSignalRight?.addEventListener('click', () => {
      inputManager.triggerSignalRight();
    });

    // Retro Cassette Deck Controls & Hotkeys
    document.getElementById('btn-radio-minimize')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playClick();
      this.setRadioMinimized(true);
    });

    document.getElementById('btn-radio-maximize')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playClick();
      this.setRadioMinimized(false);
    });

    document.getElementById('btn-mini-expand-deck')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playClick();
      this.setRadioMinimized(false);
    });

    document.getElementById('btn-mini-radio-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.init();
      radioManager.togglePlay();
    });

    document.getElementById('btn-mini-radio-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.init();
      radioManager.nextStation();
    });

    document.getElementById('btn-radio-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.init();
      radioManager.prevStation();
    });

    document.getElementById('btn-radio-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.init();
      radioManager.togglePlay();
    });

    document.getElementById('btn-radio-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.init();
      radioManager.nextStation();
    });

    eventBus.on('radio:stationChanged', (payload: any) => {
      if (!payload) return;
      if (this.lcdStationFreq) this.lcdStationFreq.innerText = payload.frequency;
      if (this.lcdStationName) this.lcdStationName.innerText = payload.name;
      if (this.miniStationName) this.miniStationName.innerText = payload.name;
      if (this.lcdStationSub) this.lcdStationSub.innerText = payload.subtitle;
      if (this.lcdLiveBadge) {
        this.lcdLiveBadge.style.display = payload.isLive ? 'inline-block' : 'none';
      }
      this.showRadioToast(payload.frequency, payload.name, payload.subtitle, payload.isLive);
    });

    eventBus.on('radio:toggle', (payload: any) => {
      if (!payload) return;
      if (this.tapeLedPlay) {
        this.tapeLedPlay.classList.toggle('active', payload.isPlaying);
      }
      if (payload.isPlaying) {
        const cur = radioManager.getCurrentStation();
        this.showRadioToast(cur.frequency, cur.name, cur.tagline, cur.isLive);
      } else {
        this.showRadioToast('RADYO KAPALI', 'SES KAPATILDI', 'Sadece Saf Motor Sesi', false);
      }
    });

    // Game Over Buttons
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      audioManager.playClick();
      if (this.onRestartGame) this.onRestartGame();
    });

    document.getElementById('btn-go-garage')?.addEventListener('click', () => {
      audioManager.playClick();
      this.navigateTo('GARAGE');
    });

    document.getElementById('btn-go-home')?.addEventListener('click', () => {
      audioManager.playClick();
      this.navigateTo('MAIN_MENU');
    });

    // Garage Navigation
    document.getElementById('btn-garage-back')?.addEventListener('click', () => {
      audioManager.playClick();
      this.navigateTo('MAIN_MENU');
    });

    document.getElementById('btn-prev-car')?.addEventListener('click', () => {
      audioManager.playClick();
      this.garageSelectedVehicleIndex =
        (this.garageSelectedVehicleIndex - 1 + VEHICLE_CATALOG.length) % VEHICLE_CATALOG.length;
      this.refreshGarageUI();
    });

    document.getElementById('btn-next-car')?.addEventListener('click', () => {
      audioManager.playClick();
      this.garageSelectedVehicleIndex = (this.garageSelectedVehicleIndex + 1) % VEHICLE_CATALOG.length;
      this.refreshGarageUI();
    });

    // License Plate Customizer Listeners
    const inputPlate = document.getElementById('input-license-plate') as HTMLInputElement | null;
    const btnSavePlate = document.getElementById('btn-save-plate');
    const btnRandomPlate = document.getElementById('btn-random-plate');

    const applyLicensePlate = () => {
      if (!inputPlate) return;
      let val = inputPlate.value.trim().toUpperCase();
      if (!val) val = '34 TR 1998';
      gameState.setLicensePlate(val);
      audioManager.playClick();
      this.refreshGarageUI();
    };

    btnSavePlate?.addEventListener('click', applyLicensePlate);

    inputPlate?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyLicensePlate();
        inputPlate.blur();
      }
    });

    inputPlate?.addEventListener('input', () => {
      const preview = document.getElementById('plate-preview-text');
      if (preview) {
        preview.innerText = inputPlate.value.toUpperCase() || '34 TR 1998';
      }
    });

    btnRandomPlate?.addEventListener('click', () => {
      audioManager.playClick();
      const cities = ['34', '06', '35', '16', '07', '41', '01', '55', '61', '42', '20', '54', '26'];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const letterSets = ['CORSA', 'OPL', 'TR', 'SLH', 'IST', 'ANK', 'TC', 'SLX', 'VIP', 'GT', 'TURBO', 'CAN', 'EFE', 'MSR'];
      const letters = letterSets[Math.floor(Math.random() * letterSets.length)];
      const num = Math.floor(10 + Math.random() * 990);
      const generated = `${city} ${letters} ${num}`;

      if (inputPlate) inputPlate.value = generated;
      gameState.setLicensePlate(generated);
      this.refreshGarageUI();
    });

    // Custom 3D Model (.GLTF / .GLB) Upload, Flip, and Reset
    const inputModel = document.getElementById('input-custom-model') as HTMLInputElement | null;
    const btnUpload = document.getElementById('btn-upload-model');
    const btnFlip = document.getElementById('btn-flip-model');
    const btnReset = document.getElementById('btn-reset-model');

    btnUpload?.addEventListener('click', () => {
      audioManager.playClick();
      inputModel?.click();
    });

    inputModel?.addEventListener('change', async () => {
      if (inputModel.files && inputModel.files.length > 0 && this.onLoadCustomModel) {
        const files = inputModel.files;
        this.setCustomModelStatus('Model yükleniyor...', false);
        try {
          await this.onLoadCustomModel(files);
          this.setCustomModelBadge(files[0].name);
        } catch (err: any) {
          this.setCustomModelStatus(`Yükleme hatası: ${err.message || 'Geçersiz GLTF'}`, true);
        }
      }
    });

    btnFlip?.addEventListener('click', () => {
      audioManager.playClick();
      if (this.onRotateCustomModel) {
        this.onRotateCustomModel(180);
        this.setCustomModelStatus('✓ Araba 180° çevrildi', false);
      }
    });

    btnReset?.addEventListener('click', () => {
      audioManager.playClick();
      if (this.onResetCustomModel) {
        this.onResetCustomModel();
        this.setCustomModelBadge(null);
      }
    });

    // Global Drag & Drop for 3D Models
    this.setupDragAndDrop();

    // Missions Back
    document.getElementById('btn-missions-back')?.addEventListener('click', () => {
      audioManager.playClick();
      this.navigateTo('MAIN_MENU');
    });

    // Virtual Touch Controls Setup
    this.setupTouchControls();

    // Event bus subscriptions
    eventBus.on('nearMiss', ({ combo, cashBonus }) => {
      this.showNearMissPopup(combo, cashBonus);
    });

    eventBus.on('moneyChanged', () => {
      this.updateMenuStats();
    });

    eventBus.on('wrongWayChanged', ({ isWrongWay }) => {
      if (isWrongWay) {
        this.wrongWayBanner.classList.add('show');
      } else {
        this.wrongWayBanner.classList.remove('show');
      }
    });

    eventBus.on('gameModeChanged', () => {
      this.updateModeSelectorUI();
    });

    eventBus.on('trafficSettingsChanged', () => {
      this.updateTrafficSettingsUI();
    });

    eventBus.on('timeAttackTick', ({ remainingSeconds }) => {
      this.hudTimerVal.innerText = `${remainingSeconds}s`;
      if (remainingSeconds <= 15) {
        this.hudTimerCard.classList.add('warning');
      } else {
        this.hudTimerCard.classList.remove('warning');
      }
    });

    eventBus.on('timeBonusAdded', ({ secondsAdded, reason }) => {
      this.showTimeBonus(secondsAdded, reason);
    });

    eventBus.on('cameraModeChanged', ({ mode }) => {
      this.hudCamLabel.innerText = CAMERA_PRESETS[mode]?.name || mode;
    });

    eventBus.on('gamePaused', () => {
      this.showPauseMenu();
    });

    eventBus.on('gameResumed', () => {
      this.hidePauseMenu();
    });

    this.setupMultiplayerUI();
  }

  private setupTouchControls(): void {
    interface TouchAction {
      id: string;
      btn: HTMLElement;
      onDown: () => void;
      onUp: () => void;
    }

    const touchActions = new Map<string, TouchAction>();
    const activeTouches = new Map<number | string, string>(); // pointerId -> active button ID

    const activateButton = (pointerId: number | string, btnId: string) => {
      const action = touchActions.get(btnId);
      if (!action) return;

      action.btn.classList.add('pressed');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(14);
        } catch {}
      }
      action.onDown();
      activeTouches.set(pointerId, btnId);

      // If activating Nitro, also maintain Gas acceleration!
      if (btnId === 'touch-nitro') {
        const gasAction = touchActions.get('touch-gas');
        if (gasAction) {
          gasAction.btn.classList.add('pressed');
          gasAction.onDown();
        }
      }
    };

    const hasOtherTouchOnButton = (btnId: string, currentPointerId: number | string): boolean => {
      for (const [pId, bId] of activeTouches.entries()) {
        if (pId !== currentPointerId && bId === btnId) {
          return true;
        }
      }
      return false;
    };

    const releaseButtonForTouch = (pointerId: number | string, btnId: string, nextBtnId: string = '') => {
      // If sliding from Gas to Nitro, DO NOT release Gas!
      if (btnId === 'touch-gas' && nextBtnId === 'touch-nitro') {
        return;
      }

      const action = touchActions.get(btnId);
      if (action) {
        if (!hasOtherTouchOnButton(btnId, pointerId)) {
          action.btn.classList.remove('pressed');
          action.onUp();
        }
      }

      // If releasing Nitro, also release Gas unless another touch is on Gas or moving directly to Gas
      if (btnId === 'touch-nitro' && nextBtnId !== 'touch-gas') {
        if (!hasOtherTouchOnButton('touch-gas', pointerId)) {
          const gasAction = touchActions.get('touch-gas');
          if (gasAction) {
            gasAction.btn.classList.remove('pressed');
            gasAction.onUp();
          }
        }
      }
    };

    const releaseTouch = (pointerId: number | string) => {
      const currentBtnId = activeTouches.get(pointerId);
      if (currentBtnId) {
        releaseButtonForTouch(pointerId, currentBtnId, '');
      }
      activeTouches.delete(pointerId);
    };

    const updateTouchPosition = (pointerId: number | string, clientX: number, clientY: number) => {
      if (!activeTouches.has(pointerId)) return;

      const currentBtnId = activeTouches.get(pointerId) || '';
      const targetEl = document.elementFromPoint(clientX, clientY);
      const hitBtn = targetEl ? (targetEl.closest('.touch-btn') as HTMLElement | null) : null;
      const newBtnId = hitBtn && touchActions.has(hitBtn.id) ? hitBtn.id : '';

      if (newBtnId !== currentBtnId) {
        if (currentBtnId) {
          releaseButtonForTouch(pointerId, currentBtnId, newBtnId);
        }
        if (newBtnId) {
          activateButton(pointerId, newBtnId);
        } else {
          activeTouches.set(pointerId, '');
        }
      }
    };

    // Global movement and release listeners for fluid finger sliding
    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (activeTouches.has(e.pointerId)) {
          updateTouchPosition(e.pointerId, e.clientX, e.clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        if (activeTouches.has(e.pointerId)) {
          releaseTouch(e.pointerId);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'pointercancel',
      (e: PointerEvent) => {
        if (activeTouches.has(e.pointerId)) {
          releaseTouch(e.pointerId);
        }
      },
      { passive: true }
    );

    // Fallback touch listeners for older mobile environments
    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const touchId = `t-${t.identifier}`;
          if (activeTouches.has(touchId)) {
            updateTouchPosition(touchId, t.clientX, t.clientY);
          }
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          releaseTouch(`t-${t.identifier}`);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchcancel',
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          releaseTouch(`t-${t.identifier}`);
        }
      },
      { passive: true }
    );

    const bindTouch = (id: string, onDown: () => void, onUp: () => void) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      touchActions.set(id, { id, btn, onDown, onUp });

      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        activateButton(e.pointerId, id);
      });

      // Prevent mobile selection and magnifying loupe on touchstart
      btn.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            activateButton(`t-${t.identifier}`, id);
          }
        },
        { passive: false }
      );

      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      btn.addEventListener('selectstart', (e) => e.preventDefault());
    };

    bindTouch(
      'touch-steer-left',
      () => inputManager.setVirtualSteerLeft(true),
      () => inputManager.setVirtualSteerLeft(false)
    );

    bindTouch(
      'touch-steer-right',
      () => inputManager.setVirtualSteerRight(true),
      () => inputManager.setVirtualSteerRight(false)
    );

    bindTouch(
      'touch-gas',
      () => inputManager.setVirtualAccelerate(true),
      () => inputManager.setVirtualAccelerate(false)
    );

    bindTouch(
      'touch-brake',
      () => inputManager.setVirtualBrake(true),
      () => inputManager.setVirtualBrake(false)
    );

    bindTouch(
      'touch-nitro',
      () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([20, 30, 40]);
          } catch {}
        }
        inputManager.setVirtualNitro(true);
      },
      () => inputManager.setVirtualNitro(false)
    );

    bindTouch(
      'touch-horn',
      () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(25);
          } catch {}
        }
        inputManager.triggerHorn();
      },
      () => {}
    );

    bindTouch(
      'touch-flash',
      () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(20);
          } catch {}
        }
        inputManager.setVirtualFlash(true);
      },
      () => {
        inputManager.setVirtualFlash(false);
      }
    );

    bindTouch(
      'touch-signal-left',
      () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(18);
          } catch {}
        }
        inputManager.triggerSignalLeft();
      },
      () => {}
    );

    bindTouch(
      'touch-signal-right',
      () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(18);
          } catch {}
        }
        inputManager.triggerSignalRight();
      },
      () => {}
    );
  }

  public showPauseMenu(): void {
    if (!this.screenPause) return;
    if (this.pauseStatSpeed) {
      this.pauseStatSpeed.innerText = `${Math.round(gameState.currentSpeedKmh)} KM/S`;
    }
    if (this.pauseStatDist) {
      this.pauseStatDist.innerText = `${(gameState.currentDistanceMeters / 1000).toFixed(2)} KM`;
    }
    if (this.pauseStatScore) {
      this.pauseStatScore.innerText = `${Math.floor(gameState.currentScore)}`;
    }
    this.updatePauseToggles();
    this.updateGyroButtonUI();
    this.screenPause.classList.add('active');
  }

  public hidePauseMenu(): void {
    if (this.screenPause) {
      this.screenPause.classList.remove('active');
    }
  }

  public showSettingsModal(): void {
    const modal = document.getElementById('screen-settings');
    if (modal) {
      this.updateSettingsUI();
      modal.classList.add('active');
    }
  }

  public hideSettingsModal(): void {
    const modal = document.getElementById('screen-settings');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  public updateSettingsUI(): void {
    const sensSlider = document.getElementById('slider-steering-sens') as HTMLInputElement | null;
    const sensValLabel = document.getElementById('label-steering-val');
    const sens = gameState.settings.steeringSensitivity || 1.0;
    if (sensSlider) sensSlider.value = sens.toString();
    if (sensValLabel) sensValLabel.innerText = `${sens.toFixed(2)}x`;

    const quality = gameState.settings.graphicsQuality || 'high';
    document.querySelectorAll('.btn-graphics-choice').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.quality === quality);
    });

    const hint = document.getElementById('settings-graphics-hint');
    if (hint) {
      if (quality === 'low') {
        hint.innerText = 'Düşük: Gölgeler kapalı, 1.0x çözünürlük (en yüksek FPS).';
      } else if (quality === 'medium') {
        hint.innerText = 'Orta: Temel gölgeler, 1.25x dengeli çözünürlük.';
      } else {
        hint.innerText = 'Yüksek: PCF Yumuşak Gölgeler, tam cihaz çözünürlüğü.';
      }
    }

    const soundBtn = document.getElementById('btn-settings-sound');
    if (soundBtn) {
      const on = gameState.settings.soundEnabled;
      soundBtn.innerText = on ? '🔊 SES: AÇIK' : '🔇 SES: KAPALI';
      soundBtn.classList.toggle('active', on);
    }

    const musicBtn = document.getElementById('btn-settings-music');
    if (musicBtn) {
      const on = gameState.settings.musicEnabled;
      musicBtn.innerText = on ? '🎵 MÜZİK: AÇIK' : '🔇 MÜZİK: KAPALI';
      musicBtn.classList.toggle('active', on);
    }

    const gyroBtn = document.getElementById('btn-settings-gyro');
    if (gyroBtn) {
      const isTilt = inputManager.controlType === 'tilt';
      gyroBtn.innerText = isTilt ? '📱 KONTROL: JİROSKOP (EĞİM)' : '📱 KONTROL: BUTON';
      gyroBtn.classList.toggle('active', isTilt);
    }
  }

  public showMultiplayerModal(): void {
    if (this.screenMultiplayer) {
      this.screenMultiplayer.classList.add('active');
      const nameInput = document.getElementById('input-mp-player-name') as HTMLInputElement | null;
      if (nameInput) {
        nameInput.value = localStorage.getItem('traffic_rush_player_name') || 'Sürücü_' + Math.floor(Math.random() * 900 + 100);
      }
      const carName = document.getElementById('mp-selected-car-name');
      if (carName) {
        const def = VEHICLE_CATALOG.find((v) => v.id === gameState.selectedVehicleId) || VEHICLE_CATALOG[0];
        carName.innerText = def.name;
      }
      const err = document.getElementById('mp-error-msg');
      if (err) err.style.display = 'none';
    }
  }

  public hideMultiplayerModal(): void {
    if (this.screenMultiplayer) {
      this.screenMultiplayer.classList.remove('active');
    }
  }

  public setMultiplayerHudVisible(visible: boolean): void {
    if (this.hudMultiplayerBar) {
      this.hudMultiplayerBar.style.display = visible ? 'flex' : 'none';
    }
  }

  public updateMultiplayerLeaderboard(standings: Array<{
    rank: number;
    id: string;
    name: string;
    distance: number;
    deltaMeters: number;
    isMe: boolean;
    isCrashed: boolean;
    lane: number;
  }>): void {
    if (!this.hudMultiplayerBar) return;
    this.hudMultiplayerBar.style.display = 'flex';

    const container = document.getElementById('mp-live-leaderboard-items');
    if (!container) return;

    const rankBadges = ['🥇', '🥈', '🥉', '4️⃣'];
    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#94a3b8'];

    container.innerHTML = standings.map((item, idx) => {
      const badge = rankBadges[idx] || `${idx + 1}.`;
      const color = rankColors[idx] || '#fff';
      const isMe = item.isMe;

      let statText = `${Math.round(item.distance)}m`;
      let statusStyle = 'color: #fff;';

      if (item.isCrashed) {
        statText = '💥 KAZA';
        statusStyle = 'color: #ff3366; font-weight: 900;';
      } else if (idx > 0 && item.deltaMeters !== 0) {
        statText = `${Math.round(item.deltaMeters)}m`;
        statusStyle = 'color: #ffbe0b;';
      }

      return `
        <div style="display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 8px; background: ${isMe ? 'rgba(0,240,255,0.22)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isMe ? '#00f0ff' : color};">
          <span style="font-size: 0.95rem;">${badge}</span>
          <span style="font-weight: 800; font-size: 0.74rem; color: ${isMe ? '#00f0ff' : '#fff'}; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
          <span style="font-size: 0.72rem; font-weight: 700; ${statusStyle}">${statText}</span>
        </div>
      `;
    }).join('');
  }

  public updateMultiplayerHud(myDist: number, oppDist: number): void {
    if (!this.hudMultiplayerBar) return;
    this.hudMultiplayerBar.style.display = 'flex';

    if (this.mpHudMyInfo) {
      this.mpHudMyInfo.innerText = `Sen: ${Math.round(myDist)}m`;
    }
    if (this.mpHudOppInfo) {
      const oppName = multiplayerManager.opponent?.name || 'Rakip';
      this.mpHudOppInfo.innerText = `${oppName}: ${Math.round(oppDist)}m`;
    }
    if (this.mpHudDiffBadge) {
      const diff = Math.round(myDist - oppDist);
      if (diff > 0) {
        this.mpHudDiffBadge.innerText = `+${diff}m Öndesin`;
        this.mpHudDiffBadge.style.background = 'rgba(0, 255, 170, 0.2)';
        this.mpHudDiffBadge.style.color = '#00ffaa';
      } else if (diff < 0) {
        this.mpHudDiffBadge.innerText = `${diff}m Geridesin`;
        this.mpHudDiffBadge.style.background = 'rgba(255, 0, 85, 0.2)';
        this.mpHudDiffBadge.style.color = '#ff0055';
      } else {
        this.mpHudDiffBadge.innerText = 'Kafa Kafaya';
        this.mpHudDiffBadge.style.background = 'rgba(255, 190, 11, 0.2)';
        this.mpHudDiffBadge.style.color = '#ffbe0b';
      }
    }
  }

  public renderMultiplayerLobby(containerId: string, players: any[]): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const laneNames = ['Şerit 1 (Orta-Sol)', 'Şerit 2 (Orta-Sağ)', 'Şerit 0 (En Sol)', 'Şerit 3 (En Sağ)'];
    const maxSlots = 4;
    let html = '';

    for (let i = 0; i < maxSlots; i++) {
      const p = players[i];
      const laneDesc = laneNames[i] || `Şerit ${i}`;

      if (p) {
        const isMe = p.id === multiplayerManager.myPlayerId;
        const carDef = VEHICLE_CATALOG.find((c) => c.id === p.vehicleId);
        const carName = carDef ? carDef.name : p.vehicleId;
        const hostTag = p.isHost ? '👑 HOST' : '🚗 YARIŞÇI';

        html += `
          <div style="background: rgba(0, 240, 255, 0.08); border: 1.5px solid ${isMe ? '#00f0ff' : 'rgba(255,255,255,0.25)'}; border-radius: 10px; padding: 10px; box-shadow: ${isMe ? '0 0 12px rgba(0,240,255,0.3)' : 'none'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 0.85rem; color: ${isMe ? '#00f0ff' : '#fff'};">
                ${p.name} ${isMe ? '<b style="color: #00ffaa;">(Sen)</b>' : ''}
              </span>
              <span style="font-size: 0.65rem; background: ${p.isHost ? 'rgba(255, 0, 127, 0.25)' : 'rgba(255,255,255,0.1)'}; color: ${p.isHost ? '#ff007f' : '#fff'}; padding: 2px 6px; border-radius: 6px; font-weight: 800;">
                ${hostTag}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: rgba(255,255,255,0.8); margin-bottom: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${p.colorHex || '#fff'}; display: inline-block; border: 1px solid #fff;"></span>
              <span>${carName}</span>
            </div>
            <div style="font-size: 0.70rem; color: #00ffaa; font-weight: 700; background: rgba(0, 255, 170, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-block;">
              ✅ ${laneDesc}
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1.5px dashed rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 10px; text-align: center; color: rgba(255,255,255,0.4); display: flex; flex-direction: column; justify-content: center; min-height: 72px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.5);">⏳ SÜRÜCÜ BEKLENİYOR...</div>
            <div style="font-size: 0.68rem; color: rgba(255,255,255,0.35); margin-top: 4px;">${laneDesc}</div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  public showMultiplayerResult(params: {
    isWinner: boolean;
    winnerName: string;
    reason: string;
    myDist: number;
    oppDist: number;
    standings?: any[];
  }): void {
    if (!this.screenMultiplayerResult) return;

    const icon = document.getElementById('mp-result-badge-icon');
    const title = document.getElementById('mp-result-title');
    const sub = document.getElementById('mp-result-subtitle');
    const myDistEl = document.getElementById('mp-stat-my-dist');
    const oppDistEl = document.getElementById('mp-stat-opp-dist');
    const podiumTable = document.getElementById('mp-podium-table');

    if (params.isWinner) {
      if (icon) icon.innerText = '🏆';
      if (title) {
        title.innerText = 'KAZANDIN!';
        title.style.color = '#00ffaa';
      }
      if (sub) {
        sub.innerText = params.reason === 'LAST_SURVIVOR' || params.reason === 'OPPONENT_CRASHED'
          ? '💥 Rakipler elendi! Otoyolun şampiyonu sensin.'
          : '🏁 Bitiş çizgisine ilk sen ulaştın!';
      }
    } else {
      if (icon) icon.innerText = '💀';
      if (title) {
        title.innerText = 'KAYBETTİN!';
        title.style.color = '#ff0055';
      }
      if (sub) {
        sub.innerText = params.reason === 'OPPONENT_CRASHED'
          ? '💥 Kaza yaptın! Rakipler yarışı tamamladı.'
          : `🏁 ${params.winnerName} bitişe ilk ulaştı.`;
      }
    }

    if (myDistEl) myDistEl.innerText = `${Math.round(params.myDist)}m`;
    if (oppDistEl) oppDistEl.innerText = `${Math.round(params.oppDist)}m`;

    // Render multi-player podium table
    if (podiumTable) {
      const medals = ['🥇', '🥈', '🥉', '4️⃣'];
      const borderGradients = [
        'border-left: 4px solid #ffd700; background: rgba(255, 215, 0, 0.10);',
        'border-left: 4px solid #c0c0c0; background: rgba(192, 192, 192, 0.08);',
        'border-left: 4px solid #cd7f32; background: rgba(205, 127, 50, 0.08);',
        'border-left: 4px solid #94a3b8; background: rgba(148, 163, 184, 0.06);'
      ];

      const rows = (params.standings && params.standings.length > 0)
        ? params.standings
        : [
            { rank: 1, name: params.isWinner ? 'Sen' : params.winnerName, distance: params.isWinner ? params.myDist : params.oppDist, isCrashed: false },
            { rank: 2, name: params.isWinner ? params.winnerName : 'Sen', distance: params.isWinner ? params.oppDist : params.myDist, isCrashed: params.reason === 'OPPONENT_CRASHED' && !params.isWinner }
          ];

      podiumTable.innerHTML = rows.map((r: any, idx: number) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const style = borderGradients[idx] || 'border-left: 4px solid #fff; background: rgba(255,255,255,0.05);';
        const isMe = r.isMe || r.name === 'Sen' || r.id === multiplayerManager.myPlayerId;
        const statusBadge = r.isCrashed
          ? '<span style="color: #ff3366; font-size: 0.74rem; font-weight: 800;">💥 KAZA YAPTI</span>'
          : (r.finishTime ? `<span style="color: #00ffaa; font-size: 0.74rem; font-weight: 800;">⏱️ ${r.finishTime}s</span>` : `<span style="color: #00f0ff; font-size: 0.74rem; font-weight: 800;">${Math.round(r.distance)}m</span>`);

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; ${style}">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.3rem;">${medal}</span>
              <div>
                <div style="font-weight: 800; font-size: 0.94rem; color: ${isMe ? '#00f0ff' : '#fff'};">
                  ${r.name} ${isMe ? '<span style="color: #00ffaa; font-size: 0.75rem;">(Sen)</span>' : ''}
                </div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5);">
                  Mesafe: ${Math.round(r.distance)}m
                </div>
              </div>
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>
        `;
      }).join('');
    }

    this.screenMultiplayerResult.classList.add('active');
  }

  public hideMultiplayerResult(): void {
    if (this.screenMultiplayerResult) {
      this.screenMultiplayerResult.classList.remove('active');
    }
  }

  public showAdStudioModal(): void {
    if (!this.screenAdsStudio) return;
    this.screenAdsStudio.classList.add('active');
    this.screenAdsStudio.style.display = 'flex';

    // Populate car options
    const carsRow = document.getElementById('ad-studio-cars-row');
    if (carsRow) {
      carsRow.innerHTML = '';
      this.adStudioSelectedCarId = gameState.selectedVehicleId || 'tofas_gltf';

      VEHICLE_CATALOG.forEach((v) => {
        const isSelected = v.id === this.adStudioSelectedCarId;
        const pill = document.createElement('button');
        pill.className = `ad-car-pill ${isSelected ? 'active' : ''}`;
        pill.dataset.vehicleId = v.id;
        pill.innerText = v.name;
        pill.addEventListener('click', () => {
          this.adStudioSelectedCarId = v.id;
          const nameLbl = document.getElementById('ad-studio-selected-car-name');
          if (nameLbl) nameLbl.innerText = v.name;
          carsRow.querySelectorAll('.ad-car-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          audioManager.playClick();
        });
        carsRow.appendChild(pill);
      });

      const activeDef = VEHICLE_CATALOG.find((v) => v.id === this.adStudioSelectedCarId);
      const nameLbl = document.getElementById('ad-studio-selected-car-name');
      if (nameLbl && activeDef) nameLbl.innerText = activeDef.name;
    }

    // Set active environment
    this.adStudioSelectedEnv = gameState.currentEnvironment || 'DAY';
    document.querySelectorAll('#ad-studio-env-row .choice-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.env === this.adStudioSelectedEnv);
    });

    // Update 9:16 button text
    const maskBtn = document.getElementById('btn-toggle-reels-mask');
    if (maskBtn) {
      maskBtn.innerText = gameState.isReelsMaskActive ? 'AÇIK' : 'KAPALI';
      maskBtn.classList.toggle('active', gameState.isReelsMaskActive);
    }
  }

  public hideAdStudioModal(): void {
    if (this.screenAdsStudio) {
      this.screenAdsStudio.classList.remove('active');
      this.screenAdsStudio.style.display = 'none';
    }
  }

  public showAdStudioHud(): void {
    if (this.screenHud) {
      this.screenHud.style.display = 'none';
    }
    if (this.adStudioHud) {
      this.adStudioHud.style.display = 'block';
    }
    if (this.reelsAspectMask) {
      this.reelsAspectMask.style.display = gameState.isReelsMaskActive ? 'block' : 'none';
    }
    if (this.adBtnReelsMask) {
      this.adBtnReelsMask.style.borderColor = gameState.isReelsMaskActive ? '#ff0055' : 'rgba(255,255,255,0.35)';
      this.adBtnReelsMask.style.color = gameState.isReelsMaskActive ? '#ff0055' : '#fff';
    }
  }

  public hideAdStudioHud(): void {
    if (this.adStudioHud) {
      this.adStudioHud.style.display = 'none';
    }
    if (this.reelsAspectMask) {
      this.reelsAspectMask.style.display = 'none';
    }
    if (this.btnUnhideUi) {
      this.btnUnhideUi.style.display = 'none';
    }
    gameState.isCleanScreenActive = false;
    if (this.screenHud) {
      this.screenHud.style.display = '';
    }
  }

  public updateAdStudioHud(camName: string, speedKmh: number, timeScale: number): void {
    if (!gameState.isAdStudioMode) return;

    if (this.adHudCamName) {
      this.adHudCamName.innerText = `🎥 ${camName}`;
    }
    if (this.adHudSpeed) {
      this.adHudSpeed.innerText = `${Math.round(speedKmh)} KM/H`;
    }
    if (this.adBtnSlowmo) {
      const isSlow = timeScale < 0.9;
      this.adBtnSlowmo.innerText = isSlow ? '⏱️ SLOW-MO: %35' : '⏱️ SLOW-MO: KAPALI';
      this.adBtnSlowmo.style.background = isSlow ? 'rgba(255, 190, 11, 0.35)' : 'rgba(0,0,0,0.75)';
    }
  }

  public toggleCleanScreen(): void {
    gameState.toggleCleanScreen();
    const isClean = gameState.isCleanScreenActive;

    if (this.screenHud) {
      this.screenHud.style.display = isClean ? 'none' : '';
    }
    if (this.adStudioHud) {
      this.adStudioHud.style.display = (isClean || !gameState.isAdStudioMode) ? 'none' : 'block';
    }
    if (this.btnUnhideUi) {
      this.btnUnhideUi.style.display = isClean ? 'block' : 'none';
    }
  }

  private setupMultiplayerUI(): void {
    let selectedMode: 'SPRINT' | 'SURVIVAL' = 'SPRINT';

    let lastMpTrigger = 0;
    const openMp = (e?: Event) => {
      const now = Date.now();
      if (now - lastMpTrigger < 350) return;
      lastMpTrigger = now;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      audioManager.playClick();
      this.showMultiplayerModal();
    };

    const mpBtn = document.getElementById('btn-open-multiplayer');
    if (mpBtn) {
      mpBtn.addEventListener('click', openMp);
      mpBtn.addEventListener('touchend', openMp);
    }

    const closeMp = (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      audioManager.playClick();
      this.hideMultiplayerModal();
      multiplayerManager.leaveRoom();
    };

    document.getElementById('btn-close-multiplayer')?.addEventListener('click', closeMp);

    this.screenMultiplayer?.addEventListener('click', (e) => {
      if (e.target === this.screenMultiplayer) {
        closeMp();
      }
    });

    // Tab switching: ODA KUR vs ODAYA KATIL
    const tabCreate = document.getElementById('tab-mp-create');
    const tabJoin = document.getElementById('tab-mp-join');
    const panelCreate = document.getElementById('panel-mp-create');
    const panelJoin = document.getElementById('panel-mp-join');
    const errEl = document.getElementById('mp-error-msg');

    const showTab = (isCreate: boolean) => {
      tabCreate?.classList.toggle('active', isCreate);
      tabJoin?.classList.toggle('active', !isCreate);
      if (panelCreate) panelCreate.style.display = isCreate ? 'block' : 'none';
      if (panelJoin) panelJoin.style.display = isCreate ? 'none' : 'block';
      if (errEl) errEl.style.display = 'none';
    };

    tabCreate?.addEventListener('click', () => {
      audioManager.playClick();
      showTab(true);
    });

    tabJoin?.addEventListener('click', () => {
      audioManager.playClick();
      showTab(false);
    });

    // Mode Selector (SPRINT vs SURVIVAL)
    document.querySelectorAll('#mp-mode-selector .mp-mode-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        audioManager.playClick();
        const m = (e.currentTarget as HTMLElement).dataset.mode as any;
        selectedMode = m;
        document.querySelectorAll('#mp-mode-selector .mp-mode-pill').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.mode === m);
        });
        const desc = document.getElementById('mp-mode-desc');
        if (desc) {
          desc.innerText = m === 'SPRINT'
            ? 'Trafikte 3000 metreye ilk varan düelloyu kazanır!'
            : 'Trafikte ilk kaza yapan elenir, hayatta kalan kazanır!';
        }
      });
    });

    // Create Room Button
    const createRoomBtn = document.getElementById('btn-mp-create-room') as HTMLButtonElement | null;
    createRoomBtn?.addEventListener('click', async () => {
      audioManager.playClick();
      const nameInput = document.getElementById('input-mp-player-name') as HTMLInputElement | null;
      const playerName = (nameInput?.value || 'Sürücü').trim() || 'Sürücü';
      localStorage.setItem('traffic_rush_player_name', playerName);

      if (createRoomBtn) {
        createRoomBtn.disabled = true;
        createRoomBtn.innerText = '⏳ Sunucuya bağlanıyor...';
      }

      const success = await multiplayerManager.createRoom({
        playerName,
        vehicleId: gameState.selectedVehicleId,
        colorHex: gameState.getVehicleColor(gameState.selectedVehicleId) || '#dc2626',
        mode: selectedMode,
        targetDistance: 3000,
      });

      if (!success) {
        if (errEl) {
          errEl.innerText = 'Multiplayer sunucusuna bağlanılamadı! Lütfen sunucunun açık olduğundan emin olun.';
          errEl.style.display = 'block';
        }
        if (createRoomBtn) {
          createRoomBtn.disabled = false;
          createRoomBtn.innerText = '⚡ YENİ ODA OLUŞTUR';
        }
      }
    });

    // Join Room Button
    document.getElementById('btn-mp-join-room')?.addEventListener('click', async () => {
      audioManager.playClick();
      const nameInput = document.getElementById('input-mp-player-name') as HTMLInputElement | null;
      const playerName = (nameInput?.value || 'Sürücü').trim() || 'Sürücü';
      localStorage.setItem('traffic_rush_player_name', playerName);

      const codeInput = document.getElementById('input-mp-room-code') as HTMLInputElement | null;
      const roomCode = (codeInput?.value || '').trim().toUpperCase();

      if (!roomCode || roomCode.length !== 4) {
        if (errEl) {
          errEl.innerText = 'Lütfen 4 haneli geçerli bir oda kodu girin (örn: TR34)!';
          errEl.style.display = 'block';
        }
        return;
      }

      const statusBox = document.getElementById('mp-join-status-box');
      if (statusBox) {
        statusBox.innerText = `Odaya bağlanıyor (${roomCode})...`;
        statusBox.style.display = 'block';
      }

      const success = await multiplayerManager.joinRoom({
        roomCode,
        playerName,
        vehicleId: gameState.selectedVehicleId,
        colorHex: gameState.getVehicleColor(gameState.selectedVehicleId) || '#ffffff',
      });

      if (!success) {
        if (errEl) {
          errEl.innerText = 'Multiplayer sunucusuna bağlanılamadı!';
          errEl.style.display = 'block';
        }
        if (statusBox) statusBox.style.display = 'none';
      }
    });

    // Start Race Button (Host)
    document.getElementById('btn-mp-start-race')?.addEventListener('click', () => {
      audioManager.playClick();
      multiplayerManager.startRace();
    });

    // Result screen buttons
    document.getElementById('btn-mp-result-lobby')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideMultiplayerResult();
      this.showMultiplayerModal();
    });

    document.getElementById('btn-mp-result-home')?.addEventListener('click', () => {
      audioManager.playClick();
      this.hideMultiplayerResult();
      multiplayerManager.leaveRoom();
      this.navigateTo('MAIN_MENU');
    });

    // EventBus bindings for Networking Events
    eventBus.on('mp:roomCreated', (data: any) => {
      const display = document.getElementById('mp-room-code-display');
      if (display) display.innerText = data.roomCode;
      const actionBox = document.getElementById('mp-create-action-box');
      if (actionBox) actionBox.style.display = 'none';
      const infoBox = document.getElementById('mp-host-room-info');
      if (infoBox) infoBox.style.display = 'block';
      if (errEl) errEl.style.display = 'none';

      const players = data.players || [
        {
          id: multiplayerManager.myPlayerId,
          name: multiplayerManager.myPlayerName,
          vehicleId: gameState.selectedVehicleId,
          colorHex: gameState.getVehicleColor(gameState.selectedVehicleId) || '#dc2626',
          lane: data.lane ?? 1,
          isHost: true,
        }
      ];

      this.renderMultiplayerLobby('mp-host-players-grid', players);
      const countBadge = document.getElementById('mp-host-count-badge');
      if (countBadge) countBadge.innerText = `${players.length}/4 Oyuncu`;
    });

    eventBus.on('mp:playerJoined', (data: any) => {
      const startBtn = document.getElementById('btn-mp-start-race') as HTMLButtonElement | null;
      const hostMsg = document.getElementById('mp-host-status-msg');
      const hostCountBadge = document.getElementById('mp-host-count-badge');
      const joinCountBadge = document.getElementById('mp-join-count-badge');

      const players = data.players || [];
      this.renderMultiplayerLobby('mp-host-players-grid', players);
      this.renderMultiplayerLobby('mp-join-players-grid', players);

      if (hostCountBadge) hostCountBadge.innerText = `${players.length}/4 Oyuncu`;
      if (joinCountBadge) joinCountBadge.innerText = `${players.length}/4 Oyuncu`;

      if (players.length >= 2) {
        if (hostMsg) hostMsg.innerText = `✅ ${players.length} Yarışçı bağlandı! Hazırsan yarışı başlat.`;
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
      }
    });

    eventBus.on('mp:roomJoined', (data: any) => {
      const statusBox = document.getElementById('mp-join-status-box');
      if (statusBox) {
        statusBox.style.display = 'block';
      }
      if (errEl) errEl.style.display = 'none';

      const players = data.players || [];
      this.renderMultiplayerLobby('mp-join-players-grid', players);
      const joinCountBadge = document.getElementById('mp-join-count-badge');
      if (joinCountBadge) joinCountBadge.innerText = `${players.length}/4 Oyuncu`;
    });

    eventBus.on('mp:opponentLeft', (data: any) => {
      const startBtn = document.getElementById('btn-mp-start-race') as HTMLButtonElement | null;
      const hostMsg = document.getElementById('mp-host-status-msg');
      const hostCountBadge = document.getElementById('mp-host-count-badge');
      const joinCountBadge = document.getElementById('mp-join-count-badge');

      const players = data.players || multiplayerManager.roomPlayers;
      this.renderMultiplayerLobby('mp-host-players-grid', players);
      this.renderMultiplayerLobby('mp-join-players-grid', players);

      if (hostCountBadge) hostCountBadge.innerText = `${players.length}/4 Oyuncu`;
      if (joinCountBadge) joinCountBadge.innerText = `${players.length}/4 Oyuncu`;

      if (players.length < 2) {
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.style.opacity = '0.5';
          startBtn.style.cursor = 'not-allowed';
        }
        if (hostMsg) hostMsg.innerText = '⚠️ Oyuncu ayrıldı. Yeni yarışçı bekleniyor... (En az 2 yarışçı)';
      }
    });

    eventBus.on('mp:hostChanged', () => {
      if (multiplayerManager.isHost) {
        const createTab = document.getElementById('tab-mp-create') as HTMLButtonElement | null;
        createTab?.click();
        const actionBox = document.getElementById('mp-create-action-box');
        if (actionBox) actionBox.style.display = 'none';
        const infoBox = document.getElementById('mp-host-room-info');
        if (infoBox) infoBox.style.display = 'block';
        const display = document.getElementById('mp-room-code-display');
        if (display) display.innerText = multiplayerManager.roomCode || '----';
        this.renderMultiplayerLobby('mp-host-players-grid', multiplayerManager.roomPlayers);
      }
    });

    eventBus.on('mp:error', (data: any) => {
      if (errEl) {
        errEl.innerText = data.message || 'Bir bağlantı hatası oluştu!';
        errEl.style.display = 'block';
      }
      const statusBox = document.getElementById('mp-join-status-box');
      if (statusBox) statusBox.style.display = 'none';
    });

    eventBus.on('mp:raceStarting', () => {
      this.hideMultiplayerModal();
      this.hideMultiplayerResult();
      if (this.onStartMultiplayerRace) {
        this.onStartMultiplayerRace();
      }
    });

    eventBus.on('mp:raceFinished', (data: any) => {
      this.showMultiplayerResult({
        isWinner: data.isMeWinner,
        winnerName: data.winnerName,
        reason: data.reason,
        myDist: (window as any).__TRAFFIC_RUSH_GAME__?.playerVehicle?.mesh?.position?.z || 0,
        oppDist: multiplayerManager.opponent?.distance || 0,
        standings: data.standings,
      });
    });
  }

  public showTrafficSettingsModal(): void {
    const modal = document.getElementById('screen-traffic-settings');
    if (modal) {
      this.updateTrafficSettingsUI();
      modal.classList.add('active');
    }
  }

  public hideTrafficSettingsModal(): void {
    const modal = document.getElementById('screen-traffic-settings');
    if (modal) {
      modal.classList.remove('active');
    }
    this.updateModeSelectorUI();
  }

  public updateTrafficSettingsUI(): void {
    const tSettings = gameState.trafficSettings;

    // 1. Density slider & label
    const densitySlider = document.getElementById('slider-traffic-density') as HTMLInputElement | null;
    const densityLabel = document.getElementById('label-traffic-density');
    if (densitySlider) densitySlider.value = tSettings.density.toString();
    if (densityLabel) densityLabel.innerText = `%${tSettings.density}`;

    // 2. Quick Presets
    document.querySelectorAll('#traffic-quick-presets-row .traffic-preset-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.preset === tSettings.densityPreset);
    });

    // 3. Speed Presets
    document.querySelectorAll('#traffic-speed-row .traffic-speed-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.speed === tSettings.speedPreset);
    });

    // 4. Lane Change Presets
    document.querySelectorAll('#traffic-lanechange-row .traffic-lane-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.lane === tSettings.laneChangePreset);
    });

    // 5. Fleet Presets
    document.querySelectorAll('#traffic-fleet-row .traffic-fleet-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.fleet === tSettings.fleetPreset);
    });

    // 6. Direction Presets
    document.querySelectorAll('#traffic-direction-row .traffic-dir-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.dir === tSettings.direction);
    });

    // 7. Yield Presets
    document.querySelectorAll('#traffic-yield-row .traffic-yield-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.yield === tSettings.yieldPreset);
    });

    // 8. God Mode Toggle
    const godBtn = document.getElementById('btn-toggle-godmode');
    if (godBtn) {
      if (tSettings.godMode) {
        godBtn.innerText = '✓ AÇIK';
        godBtn.classList.add('active');
        godBtn.style.background = 'rgba(56, 189, 248, 0.35)';
        godBtn.style.borderColor = '#38bdf8';
        godBtn.style.color = '#38bdf8';
      } else {
        godBtn.innerText = 'KAPALI';
        godBtn.classList.remove('active');
        godBtn.style.background = 'rgba(255, 255, 255, 0.08)';
        godBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
        godBtn.style.color = 'rgba(255, 255, 255, 0.6)';
      }
    }
  }

  public updatePauseToggles(): void {
    if (this.btnPauseSound) {
      const on = gameState.settings.soundEnabled;
      this.btnPauseSound.innerText = on ? '🔊 SES: AÇIK' : '🔇 SES: KAPALI';
      this.btnPauseSound.classList.toggle('active', on);
    }
    if (this.btnPauseMusic) {
      const on = gameState.settings.musicEnabled;
      this.btnPauseMusic.innerText = on ? '🎵 MÜZİK: AÇIK' : '🔇 MÜZİK: KAPALI';
      this.btnPauseMusic.classList.toggle('active', on);
    }
  }

  public showScreen(screen: 'BOOT' | 'MAIN_MENU' | 'PLAYING' | 'GAME_OVER' | 'GARAGE' | 'MISSIONS'): void {
    this.hidePauseMenu();
    this.hideSettingsModal();
    this.hideTrafficSettingsModal();
    this.hideMultiplayerModal();
    this.hideMultiplayerResult();
    if (screen !== 'PLAYING') {
      this.setMultiplayerHudVisible(false);
    }
    [this.screenLoading, this.screenMenu, this.screenHud, this.screenGameOver, this.screenGarage, this.screenMissions].forEach((s) => {
      if (s) s.classList.remove('active');
    });
    this.setIdleCinematicBadge(false);

    if (screen === 'BOOT') {
      this.screenLoading.classList.add('active');
    } else if (screen === 'MAIN_MENU') {
      this.updateMenuStats();
      this.updateModeSelectorUI();
      this.updateEnvSelectorUI();
      this.updateGyroButtonUI();
      this.screenMenu.classList.add('active');
    } else if (screen === 'PLAYING') {
      this.hudTimerCard.style.display = gameState.currentMode === 'TIME_ATTACK' ? 'block' : 'none';
      this.hudCamLabel.innerText = CAMERA_PRESETS[gameState.currentCameraView]?.name || gameState.currentCameraView;
      this.wrongWayBanner.classList.remove('show');



      // Adjust mobile steering buttons visibility if tilt steering is enabled
      const steerCluster = document.getElementById('touch-steering-cluster');
      if (steerCluster) {
        steerCluster.style.opacity = inputManager.controlType === 'tilt' ? '0.2' : '1.0';
      }

      this.screenHud.classList.add('active');
    } else if (screen === 'GAME_OVER') {
      this.screenGameOver.classList.add('active');
    } else if (screen === 'GARAGE') {
      const idx = VEHICLE_CATALOG.findIndex((v) => v.id === gameState.selectedVehicleId);
      this.garageSelectedVehicleIndex = idx >= 0 ? idx : 0;
      this.refreshGarageUI();
      this.screenGarage.classList.add('active');
    } else if (screen === 'MISSIONS') {
      this.refreshMissionsUI();
      this.screenMissions.classList.add('active');
    }
  }

  public updateHUD(
    speedKmh: number,
    distanceMeters: number,
    score: number,
    cash: number,
    nitroPercent: number,
    turnSignal: 'none' | 'left' | 'right' | 'hazard' = 'none',
    isBlinkOn: boolean = false,
    healthPercent: number = 100
  ): void {
    this.hudSpeedVal.innerText = Math.floor(speedKmh).toString();
    this.hudDistanceVal.innerText = `${(distanceMeters / 1000).toFixed(2)} KM`;
    this.hudScoreVal.innerText = Math.floor(score).toLocaleString();
    this.hudMoneyVal.innerText = `₺${Math.floor(cash).toLocaleString()}`;
    this.hudNitroFill.style.width = `${Math.max(0, Math.min(100, nitroPercent))}%`;

    if (this.hudHealthFill) {
      const clampedHealth = Math.max(0, Math.min(100, healthPercent));
      this.hudHealthFill.style.width = `${clampedHealth}%`;
      this.hudHealthFill.classList.toggle('warning', clampedHealth <= 60 && clampedHealth > 25);
      this.hudHealthFill.classList.toggle('danger', clampedHealth <= 25);
    }
    if (this.hudHealthVal) {
      this.hudHealthVal.innerText = `%${Math.round(Math.max(0, healthPercent))}`;
    }

    if (this.hudSignalLeft) {
      const active = (turnSignal === 'left' || turnSignal === 'hazard') && isBlinkOn;
      this.hudSignalLeft.classList.toggle('blink-on', active);
    }
    if (this.hudSignalRight) {
      const active = (turnSignal === 'right' || turnSignal === 'hazard') && isBlinkOn;
      this.hudSignalRight.classList.toggle('blink-on', active);
    }
  }

  public setRadioMinimized(minimized: boolean): void {
    this.isRadioMinimized = minimized;
    try {
      localStorage.setItem('tr_radio_minimized', minimized ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.hudCassetteDeck) {
      this.hudCassetteDeck.classList.toggle('minimized', minimized);
    }
    if (this.deckMinimizedBar) {
      this.deckMinimizedBar.style.display = minimized ? 'flex' : 'none';
    }
    if (this.deckFullFaceplate) {
      this.deckFullFaceplate.style.display = minimized ? 'none' : 'flex';
    }
  }

  public getIsRadioMinimized(): boolean {
    return this.isRadioMinimized;
  }

  public updateRadioVisuals(levels: number[], isPlaying: boolean): void {
    if (!this.hudCassetteDeck || this.isRadioMinimized) return;

    if (this.tapeSpoolLeft && this.tapeSpoolRight) {
      if (isPlaying) {
        this.tapeSpoolLeft.classList.add('spinning');
        this.tapeSpoolRight.classList.add('spinning');
      } else {
        this.tapeSpoolLeft.classList.remove('spinning');
        this.tapeSpoolRight.classList.remove('spinning');
      }
    }

    if (this.tapeLedPlay) {
      this.tapeLedPlay.classList.toggle('active', isPlaying);
    }
    if (this.tapeLedStereo) {
      this.tapeLedStereo.classList.toggle('active', isPlaying);
    }

    if (this.eqBars && this.eqBars.length > 0) {
      for (let i = 0; i < this.eqBars.length; i++) {
        const bar = this.eqBars[i];
        if (bar) {
          const lvl = isPlaying ? (levels[i] ?? 0) : 0;
          const pct = Math.round(Math.min(100, Math.max(8, lvl * 100)));
          bar.style.height = `${pct}%`;
        }
      }
    }
  }

  public showRadioToast(freq: string, name: string, subtitle: string, isLive = false): void {
    if (this.radioToastTimeout !== null) {
      clearTimeout(this.radioToastTimeout);
    }
    const icon = document.getElementById('toast-radio-icon');
    if (icon) {
      icon.innerText = isLive ? '📡' : '📻';
    }
    if (this.toastRadioFreq) {
      this.toastRadioFreq.innerText = isLive ? `${freq} FM • CANLI YAYIN` : `${freq} FM`;
    }
    if (this.toastRadioName) this.toastRadioName.innerText = name;
    if (this.toastRadioSub) this.toastRadioSub.innerText = subtitle;

    if (this.radioToastBanner) {
      this.radioToastBanner.classList.add('show');
      this.radioToastTimeout = window.setTimeout(() => {
        if (this.radioToastBanner) {
          this.radioToastBanner.classList.remove('show');
        }
        this.radioToastTimeout = null;
      }, 2800);
    }
  }

  public showNearMissPopup(combo: number, cashBonus: number): void {
    if (this.nearMissTimeout !== null) {
      clearTimeout(this.nearMissTimeout);
    }

    this.nearMissTitle.innerText = combo > 1 ? `MAKAS x${combo}!` : 'SIFIR MAKAS!';
    this.nearMissBonus.innerText = `+₺${cashBonus}`;
    this.nearMissBanner.classList.add('show');

    this.nearMissTimeout = window.setTimeout(() => {
      this.nearMissBanner.classList.remove('show');
      this.nearMissTimeout = null;
    }, 1200);
  }

  public showTimeBonus(sec: number, reason: string): void {
    if (this.timeBonusTimeout !== null) {
      clearTimeout(this.timeBonusTimeout);
    }

    this.timeBonusPopup.innerText = `+${sec}s ${reason}`;
    this.timeBonusPopup.classList.add('show');

    this.timeBonusTimeout = window.setTimeout(() => {
      this.timeBonusPopup.classList.remove('show');
      this.timeBonusTimeout = null;
    }, 1100);
  }

  public triggerRadarFlash(speedKmh: number): void {
    if (this.edsTimeout !== null) {
      clearTimeout(this.edsTimeout);
    }

    if (this.edsSpeedText) {
      this.edsSpeedText.innerText = `${speedKmh} KM/S`;
    }

    if (this.edsRadarBanner) {
      this.edsRadarBanner.classList.add('show');
    }

    this.edsTimeout = window.setTimeout(() => {
      if (this.edsRadarBanner) {
        this.edsRadarBanner.classList.remove('show');
      }
      this.edsTimeout = null;
    }, 1200);
  }

  public showScrapeNotification(title: string, subtitle = ''): void {
    if (this.scrapeTimeout !== null) {
      clearTimeout(this.scrapeTimeout);
    }

    if (this.scrapeJoltTitle) {
      this.scrapeJoltTitle.innerText = title;
    }
    if (this.scrapeJoltSub) {
      this.scrapeJoltSub.innerText = subtitle;
    }
    if (this.scrapeJoltBanner) {
      this.scrapeJoltBanner.classList.add('show');
    }

    this.scrapeTimeout = window.setTimeout(() => {
      if (this.scrapeJoltBanner) {
        this.scrapeJoltBanner.classList.remove('show');
      }
      this.scrapeTimeout = null;
    }, 950);
  }

  public startCinematicIntro(modeName: string, cinematicName = ''): void {
    if (!this.cinematicIntroWrap) return;
    if (this.cinematicModeTag) {
      this.cinematicModeTag.innerText = cinematicName
        ? `${modeName.toUpperCase()} • ${cinematicName.toUpperCase()}`
        : modeName.toUpperCase();
    }
    if (this.cinematicCountdownText) {
      this.cinematicCountdownText.innerText = 'HAZIR';
      this.cinematicCountdownText.classList.remove('go-flash', 'pulse-tick');
    }
    this.cinematicIntroWrap.style.display = 'flex';
    void this.cinematicIntroWrap.offsetWidth;
    this.cinematicIntroWrap.classList.add('active');

    // Mute HUD telemetry & touch cluster during cinematic intro for clean movie presentation
    const telemetry = document.querySelector('.hud-telemetry') as HTMLElement | null;
    const topBar = document.querySelector('.hud-top-bar') as HTMLElement | null;
    const touchCluster = document.getElementById('mobile-controls-wrap');
    if (telemetry) telemetry.style.opacity = '0.35';
    if (topBar) topBar.style.opacity = '0.35';
    if (touchCluster) touchCluster.style.opacity = '0.2';
  }

  public updateCinematicCountdown(text: string, isFinal = false): void {
    if (!this.cinematicCountdownText) return;
    this.cinematicCountdownText.innerText = text;
    this.cinematicCountdownText.classList.remove('pulse-tick');
    void this.cinematicCountdownText.offsetWidth;
    this.cinematicCountdownText.classList.add('pulse-tick');

    if (isFinal) {
      this.cinematicCountdownText.classList.add('go-flash');
    }
  }

  public finishCinematicIntro(): void {
    if (!this.cinematicIntroWrap) return;
    this.cinematicIntroWrap.classList.remove('active');

    const telemetry = document.querySelector('.hud-telemetry') as HTMLElement | null;
    const topBar = document.querySelector('.hud-top-bar') as HTMLElement | null;
    const touchCluster = document.getElementById('mobile-controls-wrap');
    if (telemetry) telemetry.style.opacity = '1';
    if (topBar) topBar.style.opacity = '1';
    if (touchCluster) touchCluster.style.opacity = '1';

    setTimeout(() => {
      if (this.cinematicIntroWrap) {
        this.cinematicIntroWrap.style.display = 'none';
      }
    }, 450);
  }

  public setIdleCinematicBadge(active: boolean, shotName?: string): void {
    if (!this.hudIdleCamBanner) return;

    const screenHud = this.screenHud || document.getElementById('screen-hud');
    const telemetry = document.querySelector('.hud-telemetry') as HTMLElement | null;
    const topBar = document.querySelector('.hud-top-bar') as HTMLElement | null;
    const touchCluster = document.getElementById('mobile-controls-wrap');

    if (active) {
      if (shotName && this.hudIdleCamName) {
        this.hudIdleCamName.textContent = shotName;
      }
      this.hudIdleCamBanner.classList.add('active');
      if (screenHud) {
        screenHud.classList.add('cinematic-idle-active');
      }

      // Hide all HUD gameplay controls completely so only the cinematic view remains
      if (telemetry) telemetry.style.opacity = '0';
      if (topBar) topBar.style.opacity = '0';
      if (touchCluster) touchCluster.style.opacity = '0';
    } else {
      this.hudIdleCamBanner.classList.remove('active');
      if (screenHud) {
        screenHud.classList.remove('cinematic-idle-active');
      }

      // Restore HUD gameplay controls
      if (telemetry) telemetry.style.opacity = '';
      if (topBar) topBar.style.opacity = '';
      if (touchCluster) touchCluster.style.opacity = '';
    }
  }

  public showGameOver(
    distanceMeters: number,
    score: number,
    earnings: number,
    nearMisses: number,
    isNewHighScore: boolean,
    title = 'KAZA YAPTIN!'
  ): void {
    document.getElementById('gameover-title')!.innerText = title;
    document.getElementById('go-stat-dist')!.innerText = `${(distanceMeters / 1000).toFixed(2)} KM`;
    document.getElementById('go-stat-score')!.innerText = Math.floor(score).toLocaleString();
    document.getElementById('go-stat-near')!.innerText = nearMisses.toString();
    document.getElementById('go-stat-best')!.innerText = gameState.bestScore.toLocaleString();
    document.getElementById('go-stat-earnings')!.innerText = `+₺${earnings.toLocaleString()}`;

    const recordBadge = document.getElementById('gameover-new-record')!;
    recordBadge.style.display = isNewHighScore ? 'block' : 'none';

    this.showScreen('GAME_OVER');
  }

  private updateModeSelectorUI(): void {
    const currentMode = gameState.currentMode;
    document.querySelectorAll('#menu-mode-selector .choice-pill').forEach((btn) => {
      const mode = (btn as HTMLElement).dataset.mode;
      if (mode === currentMode) {
        btn.classList.add('active-mode');
      } else {
        btn.classList.remove('active-mode');
      }
    });

    const trafficBadge = document.getElementById('traffic-mode-quick-badge');
    if (trafficBadge) {
      if (currentMode === 'CUSTOM_TRAFFIC') {
        trafficBadge.style.display = 'flex';
        const tSettings = gameState.trafficSettings;
        const densityVal = document.getElementById('badge-density-val');
        if (densityVal) densityVal.innerText = `%${tSettings.density}`;

        const fleetNames: Record<string, string> = {
          all: 'Karışık',
          heavy: 'Tır & Otobüs',
          commercial: 'Taksi & Dolmuş',
          tofas: 'Tofaş Çetesi',
          passenger: 'Binekler',
        };
        const fleetVal = document.getElementById('badge-fleet-val');
        if (fleetVal) fleetVal.innerText = fleetNames[tSettings.fleetPreset] || 'Karışık';
      } else {
        trafficBadge.style.display = 'none';
      }
    }
  }

  private updateEnvSelectorUI(): void {
    const currentEnv = gameState.currentEnvironment;
    document.querySelectorAll('#menu-env-selector .choice-pill').forEach((btn) => {
      const env = (btn as HTMLElement).dataset.env;
      if (env === currentEnv) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  private updateExhaustSelectorUI(): void {
    const current = gameState.exhaustPreset;
    document.querySelectorAll('#garage-exhaust-selector .exhaust-pill').forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.preset === current) {
        el.style.background = 'rgba(0, 240, 255, 0.25)';
        el.style.borderColor = '#00f0ff';
        el.style.color = '#00f0ff';
      } else {
        el.style.background = 'rgba(255,255,255,0.08)';
        el.style.borderColor = 'rgba(255,255,255,0.25)';
        el.style.color = 'rgba(255,255,255,0.7)';
      }
    });

    const badge = document.getElementById('exhaust-desc-badge');
    if (badge) {
      if (current === 'Deep') {
        badge.innerText = '🏎️ Karbon Fiber Çift Çıkış • Titanyum Çekirdek • Tok Bas & Akrapovic Tınısı';
        badge.style.color = '#00f0ff';
        badge.style.borderColor = 'rgba(0, 240, 255, 0.35)';
      } else if (current === 'Light') {
        badge.innerText = '🍿 Yazılımlı Çatara Patara • Bol Kıvılcım & Geri Tepme • Seri Popcorn Alev';
        badge.style.color = '#ff9f1c';
        badge.style.borderColor = 'rgba(255, 159, 28, 0.35)';
      } else if (current === 'Standard') {
        badge.innerText = '🔉 Çift Çıkış Fabrika Susturucusu • Orijinal Tok & Sessiz Konfor';
        badge.style.color = '#adb5bd';
        badge.style.borderColor = 'rgba(173, 181, 189, 0.35)';
      } else {
        badge.innerText = '💥 Vanalı Açık Düz Boru • Yanan Titanyum Uç • Kesici & Seri Alev • HKS Blow-Off';
        badge.style.color = '#ffbe0b';
        badge.style.borderColor = 'rgba(255, 190, 11, 0.35)';
      }
    }
  }

  private updateGyroButtonUI(): void {
    const isTilt = inputManager.controlType === 'tilt';
    const text = isTilt ? '📱 KONTROL: JİROSKOP (EĞİM)' : '📱 KONTROL: BUTON';
    if (this.btnToggleGyro) {
      this.btnToggleGyro.innerText = text;
      this.btnToggleGyro.classList.toggle('active', isTilt);
    }
    if (this.btnPauseGyro) {
      this.btnPauseGyro.innerText = text;
      this.btnPauseGyro.classList.toggle('active', isTilt);
    }
    const steerCluster = document.getElementById('touch-steering-cluster');
    if (steerCluster) {
      steerCluster.style.opacity = isTilt ? '0.25' : '1.0';
    }
  }

  private updateMenuStats(): void {
    const moneyFormatted = `₺${gameState.money.toLocaleString()}`;
    const levelFormatted = `LVL ${gameState.level}`;

    document.getElementById('menu-money-badge')!.innerText = moneyFormatted;
    document.getElementById('menu-level-badge')!.innerText = levelFormatted;
    document.getElementById('menu-best-score')!.innerText = gameState.bestScore.toLocaleString();
    document.getElementById('menu-best-dist')!.innerText = `${(gameState.bestDistanceMeters / 1000).toFixed(2)} KM`;

    const gBadge = document.getElementById('garage-money-badge');
    if (gBadge) gBadge.innerText = moneyFormatted;

    const mBadge = document.getElementById('missions-money-badge');
    if (mBadge) mBadge.innerText = moneyFormatted;
  }

  private refreshGarageUI(): void {
    const vehicle = VEHICLE_CATALOG[this.garageSelectedVehicleIndex];
    const isOwned = gameState.isVehicleOwned(vehicle.id);
    const isSelected = gameState.selectedVehicleId === vehicle.id;
    const upgrades = gameState.getVehicleUpgrades(vehicle.id);
    const stats = computeVehicleStats(vehicle, upgrades);

    document.getElementById('garage-car-name')!.innerText = vehicle.name;
    document.getElementById('garage-car-category')!.innerText = vehicle.category;
    document.getElementById('garage-money-badge')!.innerText = `₺${gameState.money.toLocaleString()}`;

    // Notify scene to preview 3D model for this vehicle on turntable
    this.onGarageVehiclePreview?.(vehicle);

    // Update Stats Bars
    document.getElementById('stat-val-speed')!.innerText = `${stats.topSpeedKmh} KM/H`;
    document.getElementById('stat-fill-speed')!.style.width = `${(stats.topSpeedKmh / 300) * 100}%`;

    document.getElementById('stat-val-accel')!.innerText = `${stats.acceleration} m/s²`;
    document.getElementById('stat-fill-accel')!.style.width = `${(stats.acceleration / 40) * 100}%`;

    document.getElementById('stat-val-handling')!.innerText = `${stats.handling}`;
    document.getElementById('stat-fill-handling')!.style.width = `${(stats.handling / 14) * 100}%`;

    document.getElementById('stat-val-braking')!.innerText = `${stats.braking}`;
    document.getElementById('stat-fill-braking')!.style.width = `${(stats.braking / 60) * 100}%`;

    document.getElementById('stat-val-nitro')!.innerText = `${stats.nitroCapacity}%`;
    document.getElementById('stat-fill-nitro')!.style.width = `${(stats.nitroCapacity / 200) * 100}%`;

    // Colors Row
    const colorsRow = document.getElementById('garage-colors-row')!;
    colorsRow.innerHTML = '';
    const currentColor = gameState.getVehicleColor(vehicle.id);

    vehicle.availableColors.forEach((hex) => {
      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${hex.toLowerCase() === currentColor.toLowerCase() ? 'active' : ''}`;
      swatch.style.backgroundColor = hex;
      swatch.addEventListener('click', () => {
        audioManager.playClick();
        gameState.setVehicleColor(vehicle.id, hex);
        this.onGarageColorChange?.(hex);
        this.refreshGarageUI();
      });
      colorsRow.appendChild(swatch);
    });

    // Update License Plate Preview & Input
    const plateTextElem = document.getElementById('plate-preview-text');
    if (plateTextElem) plateTextElem.innerText = gameState.licensePlate;
    const inputPlateElem = document.getElementById('input-license-plate') as HTMLInputElement | null;
    if (inputPlateElem && document.activeElement !== inputPlateElem) {
      inputPlateElem.value = gameState.licensePlate;
    }

    // Select or Buy Button
    const purchaseArea = document.getElementById('garage-purchase-area')!;
    if (isSelected) {
      purchaseArea.innerHTML = `<button class="btn btn-secondary" style="width: 100%; padding: 16px; opacity: 0.8;" disabled>SEÇİLİ ARAÇ</button>`;
    } else if (isOwned) {
      purchaseArea.innerHTML = `<button id="btn-car-action" class="btn btn-primary" style="width: 100%; padding: 16px;">ARACI SEÇ</button>`;
      document.getElementById('btn-car-action')?.addEventListener('click', () => {
        audioManager.playClick();
        gameState.selectVehicle(vehicle.id);
        this.refreshGarageUI();
      });
    } else {
      purchaseArea.innerHTML = `<button id="btn-car-action" class="btn btn-gold" style="width: 100%; padding: 16px;">₺${vehicle.price.toLocaleString()} İLE SATIN AL</button>`;
      document.getElementById('btn-car-action')?.addEventListener('click', () => {
        if (gameState.buyVehicle(vehicle.id)) {
          audioManager.playReward();
          this.refreshGarageUI();
        } else {
          alert('Bu aracı satın almak için yeterli paranız yok!');
        }
      });
    }

    // Upgrades List
    const upgradesList = document.getElementById('garage-upgrades-list')!;
    upgradesList.innerHTML = '';

    const categories: Array<{ key: keyof VehicleUpgradeLevels; label: string }> = [
      { key: 'engine', label: 'Motor' },
      { key: 'topSpeed', label: 'Maksimum Hız' },
      { key: 'acceleration', label: 'Hızlanma' },
      { key: 'handling', label: 'Yol Tutuş' },
      { key: 'brakes', label: 'Fren' },
      { key: 'nitro', label: 'Nitro' },
    ];

    categories.forEach(({ key, label }) => {
      const currentLvl = upgrades[key];
      const isMaxed = currentLvl >= UPGRADE_MAX_LEVEL;
      const cost = getUpgradeCost(key, currentLvl);

      const card = document.createElement('div');
      card.className = 'upgrade-card';

      let dotsHtml = '';
      for (let i = 1; i <= UPGRADE_MAX_LEVEL; i++) {
        dotsHtml += `<div class="level-dot ${i <= currentLvl ? 'active' : ''}"></div>`;
      }

      card.innerHTML = `
        <div class="upgrade-info">
          <div class="upgrade-name">${label}</div>
          <div class="upgrade-level-dots">${dotsHtml}</div>
        </div>
        <div>
          ${
            isMaxed
              ? `<span style="color: var(--primary-glow); font-weight: bold;">MAX</span>`
              : `<button class="btn btn-secondary btn-upgrade" data-cat="${key}" style="font-size: 0.85rem; padding: 6px 14px;">
                  ₺${cost.toLocaleString()}
                </button>`
          }
        </div>
      `;

      upgradesList.appendChild(card);
    });

    // Bind upgrade clicks
    document.querySelectorAll('.btn-upgrade').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const cat = target.dataset.cat as keyof VehicleUpgradeLevels;
        const cost = getUpgradeCost(cat, upgrades[cat]);
        if (gameState.upgradeVehicle(vehicle.id, cat, cost)) {
          audioManager.playReward();
          this.refreshGarageUI();
        } else {
          alert('Yükseltmeyi satın almak için yeterli paranız yok!');
        }
      });
    });
  }

  private refreshMissionsUI(): void {
    const container = document.getElementById('missions-items-container')!;
    container.innerHTML = '';
    const missions = missionManager.getMissions();
    document.getElementById('missions-money-badge')!.innerText = `₺${gameState.money.toLocaleString()}`;

    missions.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'mission-card';

      const progress = Math.min(1.0, m.currentValue / m.targetValue);
      const percent = Math.floor(progress * 100);

      card.innerHTML = `
        <div class="mission-details">
          <div class="mission-title">${m.title}</div>
          <div class="mission-desc">${m.description}</div>
          <div class="mission-progress-bar">
            <div class="mission-progress-fill" style="width: ${percent}%;"></div>
          </div>
          <div style="font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 2px;">
            ${m.currentValue.toLocaleString()} / ${m.targetValue.toLocaleString()} (${percent}%)
          </div>
        </div>
        <div>
          ${
            m.isClaimed
              ? `<span style="color: rgba(255,255,255,0.4); font-weight: 700;">ALINDI</span>`
              : m.isCompleted
              ? `<button class="btn btn-gold btn-claim-mission" data-id="${m.id}" style="font-size: 0.9rem; padding: 8px 16px;">₺${m.rewardCash.toLocaleString()} ÖDÜLÜ AL</button>`
              : `<span style="color: var(--accent-gold); font-weight: 700;">₺${m.rewardCash.toLocaleString()}</span>`
          }
        </div>
      `;

      container.appendChild(card);
    });

    document.querySelectorAll('.btn-claim-mission').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        if (missionManager.claimReward(id)) {
          this.refreshMissionsUI();
          this.updateMenuStats();
        }
      });
    });
  }

  public setCustomModelBadge(name: string | null): void {
    const badge = document.getElementById('custom-model-badge');
    const status = document.getElementById('custom-model-status');
    if (!badge || !status) return;

    if (name) {
      badge.innerText = 'Özel 3D Model Aktif';
      badge.style.background = '#00f0ff';
      badge.style.color = '#000';
      badge.style.fontWeight = 'bold';
      status.style.display = 'block';
      status.style.color = '#00ffaa';
      status.innerText = `✓ Aktif Model: ${name}`;
    } else {
      badge.innerText = 'Orijinal Model';
      badge.style.background = 'rgba(255,255,255,0.12)';
      badge.style.color = '#fff';
      badge.style.fontWeight = 'normal';
      status.style.display = 'none';
      status.innerText = '';
    }
  }

  public setCustomModelStatus(text: string, isError = false): void {
    const status = document.getElementById('custom-model-status');
    if (!status) return;
    status.style.display = 'block';
    status.style.color = isError ? '#ff4d4d' : '#00ffaa';
    status.innerText = text;
  }

  private setupDragAndDrop(): void {
    const overlay = document.getElementById('dropzone-overlay');
    if (!overlay) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        overlay.style.display = 'flex';
      }
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.style.display = 'none';
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.style.display = 'none';

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const files = e.dataTransfer.files;
        const hasModel = Array.from(files).some(
          (f) => f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb')
        );

        if (hasModel && this.onLoadCustomModel) {
          this.setCustomModelStatus('Sürüklenen 3D model yükleniyor...', false);
          try {
            await this.onLoadCustomModel(files);
            const mainFile = Array.from(files).find(
              (f) => f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb')
            );
            this.setCustomModelBadge(mainFile ? mainFile.name : 'Model');
          } catch (err: any) {
            this.setCustomModelStatus(`Yükleme hatası: ${err.message || 'Geçersiz GLTF'}`, true);
          }
        }
      }
    });
  }
}
