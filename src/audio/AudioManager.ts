// Web Audio API Procedural Sound Engine & Synth Music

import { gameState } from '../core/GameState';
import { radioManager } from './RadioManager';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Master volumes
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Advanced Multi-Layer Combustion Engine & Exhaust Audio Nodes
  private engineSubOsc: OscillatorNode | null = null;
  private engineSubGain: GainNode | null = null;
  private engineMidOsc: OscillatorNode | null = null;
  private engineMidGain: GainNode | null = null;
  private exhaustRaspOsc: OscillatorNode | null = null;
  private exhaustRaspGain: GainNode | null = null;
  private exhaustDistortion: WaveShaperNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private exhaustPipeFilter: BiquadFilterNode | null = null;
  private exhaustPipeGain: GainNode | null = null;
  private bassBooster: BiquadFilterNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private intakeNoiseNode: AudioBufferSourceNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;
  private engineMasterFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning = false;

  // Exhaust preset
  public onExhaustPop: (() => void) | null = null;
  private currentExhaustPreset: 'Standard' | 'Deep' | 'Light' | 'Abarti' = 'Abarti';

  // Gearbox and RPM tracking
  private currentGear = 1;
  private currentRpm = 1000;
  private lastGearShiftTime = 0;
  private wasAccelerating = false;
  private nextBurbleTime = 0;
  private nextKesiciTime = 0;
  private lastBovTime = 0;
  private previewTimeout: ReturnType<typeof setTimeout> | null = null;
  private previewNodes: Array<{ stop?: () => void; disconnect?: () => void }> = [];

  // Nitro sound node
  private nitroNoiseNode: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroStopTimeout: ReturnType<typeof setTimeout> | null = null;

  // Dynamic Automotive Braking Audio System (Asphalt Rubber Scrub & Deep Mechanical Deceleration)
  private brakeNoiseNode: AudioBufferSourceNode | null = null;
  private brakeFilter: BiquadFilterNode | null = null;
  private brakeNoiseGain: GainNode | null = null;
  private brakeRumbleOsc: OscillatorNode | null = null;
  private brakeRumbleGain: GainNode | null = null;
  private brakeSkidOsc: OscillatorNode | null = null;
  private brakeSkidFilter: BiquadFilterNode | null = null;
  private brakeSkidGain: GainNode | null = null;
  private brakeAbsOsc: OscillatorNode | null = null;
  private brakeAbsGain: GainNode | null = null;
  private brakeMasterGain: GainNode | null = null;
  private isBrakingAudioActive: boolean = false;
  private hasPlayedStopClunk: boolean = false;
  private brakeStopTimeout: ReturnType<typeof setTimeout> | null = null;

  // Spatial Traffic Audio Engine & Siren
  private trafficAudioRunning = false;
  private trafficOsc1: OscillatorNode | null = null;
  private trafficGain1: GainNode | null = null;
  private trafficPan1: StereoPannerNode | null = null;
  private trafficOsc2: OscillatorNode | null = null;
  private trafficGain2: GainNode | null = null;
  private trafficPan2: StereoPannerNode | null = null;
  private trafficTruckOsc: OscillatorNode | null = null;
  private trafficTruckGain: GainNode | null = null;
  private trafficTruckPan: StereoPannerNode | null = null;
  private ambulanceOsc: OscillatorNode | null = null;
  private ambulanceGain: GainNode | null = null;
  private ambulancePan: StereoPannerNode | null = null;
  private ambulanceSirenTimer = 0;

  // Tunnel Reverb & Concrete Echo Bus
  private tunnelDelayNode: DelayNode | null = null;
  private tunnelFeedbackGain: GainNode | null = null;
  private tunnelFilterNode: BiquadFilterNode | null = null;
  private tunnelWetGain: GainNode | null = null;
  public isTunnelReverbActive: boolean = false;

  // Audio Performance Optimization Caches (Prevents GC spikes & audio stutter)
  private sharedNoiseBuffer: AudioBuffer | null = null;
  private sharedCrackleBuffer: AudioBuffer | null = null;
  private static distortionMap = new Map<number, Float32Array>();
  private trafficAudioUpdateCooldown = 0;
  private lastOncomingHornTime = 0;
  private lastNpcHornTime = 0;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = gameState.settings.soundEnabled ? 0.75 : 0;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = gameState.settings.musicEnabled ? 0.38 : 0;
      this.musicGain.connect(this.masterGain);

      // Initialize In-Game Radio & Cassette Deck
      radioManager.init(this.ctx, this.musicGain);

      // Tunnel Echo / Concrete Vault Reverb Bus
      this.tunnelDelayNode = this.ctx.createDelay();
      this.tunnelDelayNode.delayTime.value = 0.088; // 88ms concrete wall reflection

      this.tunnelFilterNode = this.ctx.createBiquadFilter();
      this.tunnelFilterNode.type = 'lowpass';
      this.tunnelFilterNode.frequency.value = 2400; // damping high frequencies on concrete

      this.tunnelFeedbackGain = this.ctx.createGain();
      this.tunnelFeedbackGain.gain.value = 0.36; // moderate metallic reverberation

      this.tunnelWetGain = this.ctx.createGain();
      this.tunnelWetGain.gain.value = 0.0; // dry outside tunnel

      // Delay loop: sfxGain -> tunnelDelay -> tunnelFilter -> tunnelFeedback -> tunnelDelay
      this.sfxGain.connect(this.tunnelDelayNode);
      this.tunnelDelayNode.connect(this.tunnelFilterNode);
      this.tunnelFilterNode.connect(this.tunnelFeedbackGain);
      this.tunnelFeedbackGain.connect(this.tunnelDelayNode);
      this.tunnelFilterNode.connect(this.tunnelWetGain);
      this.tunnelWetGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  public setTunnelReverb(active: boolean): void {
    if (!this.ctx || !this.tunnelWetGain || !this.tunnelFeedbackGain) return;
    const t = this.ctx.currentTime;
    const target = active ? 0.38 : 0.0;
    const feedback = active ? 0.32 : 0.0;
    this.tunnelWetGain.gain.setTargetAtTime(target, t, 0.08);
    this.tunnelFeedbackGain.gain.setTargetAtTime(feedback, t, 0.08);
    this.isTunnelReverbActive = active;
  }

  public resumeContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Pre-cached, reusable noise buffer (Brown/Pink noise for engine intake, brakes, nitro, whoosh)
  private getSharedNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.sharedNoiseBuffer) {
      const bufferSize = this.ctx.sampleRate * 2;
      this.sharedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.sharedNoiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.18;
      }
    }
    return this.sharedNoiseBuffer;
  }

  // Pre-cached crackle buffer for exhaust pops, burble, and limiter cuts
  private getSharedCrackleBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.sharedCrackleBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.06);
      this.sharedCrackleBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.sharedCrackleBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.exp(-i / (len * 0.25));
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return this.sharedCrackleBuffer;
  }

  // Tube resonance waveshaper — with memoized curve cache & optimized 512-sample footprint
  private createDistortionCurve(amount = 16): Float32Array {
    const key = Math.round(amount * 10) / 10;
    if (AudioManager.distortionMap.has(key)) {
      return AudioManager.distortionMap.get(key)!;
    }
    const n_samples = 512;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (x >= 0) {
        curve[i] = 1 - Math.exp(-key * x * 0.12);
      } else {
        curve[i] = -(1 - Math.exp(key * x * 0.07));
      }
    }
    AudioManager.distortionMap.set(key, curve);
    return curve;
  }

  // Returns audio parameters for a given exhaust preset
  private getExhaustPresetParams(preset: 'Standard' | 'Deep' | 'Light' | 'Abarti'): {
    oscType: OscillatorType;
    distortionAmount: number;
    filterFreq: number;
    filterQ: number;
    pipeFreq: number;
    pipeQ: number;
    bassHz: number;
    bassGain: number;
    hasTurbo: boolean;
    bovVolume: number;
    popcornChance: number;
  } {
    switch (preset) {
      case 'Abarti': // 💥 WAREX (VANALI AÇIK DÜZ BORU & KESİCİ)
        return {
          oscType: 'sawtooth',
          distortionAmount: 11.5,
          filterFreq: 340,
          filterQ: 5.5,
          pipeFreq: 146,
          pipeQ: 7.2,
          bassHz: 50,
          bassGain: 13.5,
          hasTurbo: true,
          bovVolume: 0.95,
          popcornChance: 0.95,
        };
      case 'Deep': // 🏎️ AKRAPOVIC (TİTANYUM ÇİFT ÇIKIŞ)
        return {
          oscType: 'square',
          distortionAmount: 7.5,
          filterFreq: 280,
          filterQ: 4.0,
          pipeFreq: 122,
          pipeQ: 5.2,
          bassHz: 46,
          bassGain: 11.0,
          hasTurbo: true,
          bovVolume: 0.65,
          popcornChance: 0.70,
        };
      case 'Light': // 🍿 POPCORN (YAZILIMLI ÇATARA PATARA)
        return {
          oscType: 'sawtooth',
          distortionAmount: 9.0,
          filterFreq: 440,
          filterQ: 3.8,
          pipeFreq: 175,
          pipeQ: 5.8,
          bassHz: 62,
          bassGain: 9.5,
          hasTurbo: false,
          bovVolume: 0.35,
          popcornChance: 1.0,
        };
      case 'Standard': // 🔉 STANDART (FABRİKA ÇIKIŞI)
      default:
        return {
          oscType: 'triangle',
          distortionAmount: 3.5,
          filterFreq: 320,
          filterQ: 2.2,
          pipeFreq: 155,
          pipeQ: 3.2,
          bassHz: 64,
          bassGain: 5.0,
          hasTurbo: false,
          bovVolume: 0.0,
          popcornChance: 0.25,
        };
    }
  }

  // Apply exhaust preset at runtime (hot-swap while engine is running)
  public setExhaustPreset(preset: 'Standard' | 'Deep' | 'Light' | 'Abarti'): void {
    this.currentExhaustPreset = preset;
    if (!this.isEngineRunning || !this.ctx || !this.exhaustRaspOsc || !this.exhaustDistortion || !this.exhaustFilter) return;
    const ep = this.getExhaustPresetParams(preset);
    const t = this.ctx.currentTime;
    this.exhaustRaspOsc.type = ep.oscType;
    this.exhaustDistortion.curve = this.createDistortionCurve(ep.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
    this.exhaustFilter.frequency.setTargetAtTime(ep.filterFreq, t, 0.05);
    this.exhaustFilter.Q.setTargetAtTime(ep.filterQ, t, 0.05);
    if (this.exhaustPipeFilter) {
      this.exhaustPipeFilter.frequency.setTargetAtTime(ep.pipeFreq, t, 0.08);
      this.exhaustPipeFilter.Q.setTargetAtTime(ep.pipeQ, t, 0.08);
    }
    if (this.bassBooster) {
      this.bassBooster.frequency.setTargetAtTime(ep.bassHz, t, 0.1);
      this.bassBooster.gain.setTargetAtTime(ep.bassGain, t, 0.1);
    }
  }

  private stopPreviewNodes(): void {
    for (const node of this.previewNodes) {
      try { (node as OscillatorNode).stop?.(); } catch {}
      try { (node as AudioNode).disconnect?.(); } catch {}
    }
    this.previewNodes = [];
  }

  // Garage Rev / Ara Gaz Performance Routine (Two-Step Rev, Kesici Limiter Banging, Turbo Flutter & Overrun Burble)
  public playExhaustPreview(preset?: 'Standard' | 'Deep' | 'Light' | 'Abarti'): void {
    if (!this.ctx) this.init();
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.stopPreviewNodes();

    const p = preset || this.currentExhaustPreset;
    const ep = this.getExhaustPresetParams(p);
    const t = this.ctx.currentTime;
    const isAbarti = p === 'Abarti';

    // Temporary preview audio chain
    const pSubOsc = this.ctx.createOscillator();
    pSubOsc.type = 'sawtooth';
    pSubOsc.frequency.setValueAtTime(30, t);
    pSubOsc.frequency.exponentialRampToValueAtTime(58, t + 0.32); // Stage 1: Quick Blip
    pSubOsc.frequency.exponentialRampToValueAtTime(42, t + 0.55); // Dip
    pSubOsc.frequency.exponentialRampToValueAtTime(92, t + 1.02); // Stage 2: Stomp to 7400 RPM
    pSubOsc.frequency.setValueAtTime(92, t + 1.40);               // Stage 3: Banging on limiter
    pSubOsc.frequency.exponentialRampToValueAtTime(28, t + 2.20); // Settle to idle

    const pSubGain = this.ctx.createGain();
    pSubGain.gain.setValueAtTime(0.05, t);
    pSubGain.gain.linearRampToValueAtTime(0.35, t + 0.30);
    pSubGain.gain.linearRampToValueAtTime(0.22, t + 0.55);
    pSubGain.gain.linearRampToValueAtTime(0.55, t + 1.00);
    pSubGain.gain.setValueAtTime(0.55, t + 1.40);
    pSubGain.gain.exponentialRampToValueAtTime(0.001, t + 2.35);

    const pRaspOsc = this.ctx.createOscillator();
    pRaspOsc.type = ep.oscType;
    pRaspOsc.frequency.setValueAtTime(60, t);
    pRaspOsc.frequency.exponentialRampToValueAtTime(118, t + 0.32);
    pRaspOsc.frequency.exponentialRampToValueAtTime(84, t + 0.55);
    pRaspOsc.frequency.exponentialRampToValueAtTime(186, t + 1.02);
    pRaspOsc.frequency.setValueAtTime(186, t + 1.40);
    pRaspOsc.frequency.exponentialRampToValueAtTime(56, t + 2.20);

    const pDistort = this.ctx.createWaveShaper();
    pDistort.curve = this.createDistortionCurve(ep.distortionAmount) as unknown as Float32Array<ArrayBuffer>;

    const pFilter = this.ctx.createBiquadFilter();
    pFilter.type = 'bandpass';
    pFilter.Q.setValueAtTime(ep.filterQ, t);
    pFilter.frequency.setValueAtTime(ep.filterFreq, t);
    pFilter.frequency.linearRampToValueAtTime(ep.filterFreq * 1.35, t + 0.32);
    pFilter.frequency.linearRampToValueAtTime(ep.filterFreq * 1.10, t + 0.55);
    pFilter.frequency.linearRampToValueAtTime(ep.filterFreq * 2.10, t + 1.02);
    pFilter.frequency.setValueAtTime(ep.filterFreq * 2.10, t + 1.40);
    pFilter.frequency.linearRampToValueAtTime(ep.filterFreq, t + 2.20);

    const pRaspGain = this.ctx.createGain();
    pRaspGain.gain.setValueAtTime(0.05, t);
    pRaspGain.gain.linearRampToValueAtTime(0.32, t + 0.30);
    pRaspGain.gain.linearRampToValueAtTime(0.20, t + 0.55);
    pRaspGain.gain.linearRampToValueAtTime(0.48, t + 1.00);
    pRaspGain.gain.setValueAtTime(0.48, t + 1.40);
    pRaspGain.gain.exponentialRampToValueAtTime(0.001, t + 2.35);

    const pBass = this.ctx.createBiquadFilter();
    pBass.type = 'peaking';
    pBass.frequency.setValueAtTime(ep.bassHz, t);
    pBass.gain.setValueAtTime(ep.bassGain, t);

    const pMaster = this.ctx.createBiquadFilter();
    pMaster.type = 'lowpass';
    pMaster.frequency.setValueAtTime(2200, t);

    const pMasterGain = this.ctx.createGain();
    pMasterGain.gain.setValueAtTime(0.80, t);

    pSubOsc.connect(pSubGain);
    pSubGain.connect(pBass);

    pRaspOsc.connect(pDistort);
    pDistort.connect(pFilter);
    pFilter.connect(pRaspGain);
    pRaspGain.connect(pBass);

    pBass.connect(pMaster);
    pMaster.connect(pMasterGain);
    pMasterGain.connect(this.sfxGain!);

    pSubOsc.start(t);
    pRaspOsc.start(t);

    this.previewNodes.push(pSubOsc, pRaspOsc, pSubGain, pRaspGain, pDistort, pFilter, pBass, pMaster, pMasterGain);

    // If preset has turbo, add spool whistle
    if (ep.hasTurbo) {
      const pTurboOsc = this.ctx.createOscillator();
      pTurboOsc.type = 'sine';
      pTurboOsc.frequency.setValueAtTime(900, t);
      pTurboOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.32);
      pTurboOsc.frequency.exponentialRampToValueAtTime(1100, t + 0.55);
      pTurboOsc.frequency.exponentialRampToValueAtTime(3200, t + 1.05);

      const pTurboGain = this.ctx.createGain();
      pTurboGain.gain.setValueAtTime(0.001, t);
      pTurboGain.gain.linearRampToValueAtTime(0.045, t + 1.00);
      pTurboGain.gain.exponentialRampToValueAtTime(0.001, t + 1.45);

      pTurboOsc.connect(pTurboGain);
      pTurboGain.connect(pMasterGain);
      pTurboOsc.start(t);
      this.previewNodes.push(pTurboOsc, pTurboGain);
    }

    // Stage 3: Banging on the Kesici / Limiter (4 machine-gun fire limiter pops)
    const kesiciTimes = [1060, 1170, 1280, 1390];
    kesiciTimes.forEach((ms) => {
      setTimeout(() => {
        if (this.ctx) this.playKesiciPop(this.ctx.currentTime);
      }, ms);
    });

    // Stage 4: Sudden Throttle Release — Turbo Blow-Off Valve Surge ("STU-TU-TU-TU!")
    if (ep.hasTurbo) {
      setTimeout(() => {
        if (this.ctx) this.playBovFlutter(this.ctx.currentTime, 0.95);
      }, 1480);
    }

    // Overrun Decel Pops & Bangs ("Çatara Patara")
    const burbleDelays = p === 'Light'
      ? [1540, 1620, 1700, 1780, 1860, 1950, 2050, 2150]
      : (isAbarti ? [1580, 1670, 1770, 1870, 1980] : [1600, 1720, 1860]);

    burbleDelays.forEach((ms) => {
      setTimeout(() => {
        if (this.ctx) this.playDecelBurble(this.ctx.currentTime, isAbarti);
      }, ms);
    });

    this.previewTimeout = setTimeout(() => {
      this.stopPreviewNodes();
      this.previewTimeout = null;
    }, 2450);
  }

  public startEngine(): void {
    if (!this.ctx || this.isEngineRunning || !gameState.settings.soundEnabled) return;

    try {
      this.resumeContext();
      const t = this.ctx.currentTime;

      // Load preset from saved settings (allow 'Abarti' to be read correctly)
      this.currentExhaustPreset = (gameState.exhaustPreset as 'Standard' | 'Deep' | 'Light' | 'Abarti') || 'Abarti';
      const ep = this.getExhaustPresetParams(this.currentExhaustPreset);

      // ─── Signal Chain ───────────────────────────────────────────────────────
      // [Sub Osc] ──────────────────────────────────────────┐
      // [Mid Osc] ──────────────────────────────────────────┤
      // [Rasp Osc] → [PreGain] → [WaveShaper] → [BandPass] ┤
      //                                → [PipeFilter] ──────┤ → [BassBoost] → [MasterLP] → [EngineGain] → [SFX]
      // [IntakeNoise] → [IntakeFilter] → [IntakeGain] ──────┤
      // [TurboOsc] → [TurboGain] ──────────────────────────┘
      // ────────────────────────────────────────────────────────────────────────

      // Master chain
      this.bassBooster = this.ctx.createBiquadFilter();
      this.bassBooster.type = 'peaking';
      this.bassBooster.frequency.setValueAtTime(ep.bassHz, t);
      this.bassBooster.Q.setValueAtTime(1.4, t);
      this.bassBooster.gain.setValueAtTime(ep.bassGain, t);

      this.engineMasterFilter = this.ctx.createBiquadFilter();
      this.engineMasterFilter.type = 'lowpass';
      this.engineMasterFilter.frequency.setValueAtTime(2200, t);
      this.engineMasterFilter.Q.setValueAtTime(0.8, t);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.22, t);

      this.bassBooster.connect(this.engineMasterFilter);
      this.engineMasterFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain!);

      // 1. Primary Cylinder Combustion Sub-Pulse (28–88 Hz piston thump)
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'sawtooth';
      this.engineSubOsc.frequency.setValueAtTime(28, t);

      // Soft saturation on sub layer for warmth
      const subDistortion = this.ctx.createWaveShaper();
      subDistortion.curve = this.createDistortionCurve(3.5) as unknown as Float32Array<ArrayBuffer>;
      subDistortion.oversample = '2x';

      this.engineSubGain = this.ctx.createGain();
      this.engineSubGain.gain.setValueAtTime(0.38, t);
      this.engineSubOsc.connect(subDistortion);
      subDistortion.connect(this.engineSubGain);
      this.engineSubGain.connect(this.bassBooster);

      // 2. Crossplane Secondary Pulse (1.503x harmonic — rich mechanical body)
      this.engineMidOsc = this.ctx.createOscillator();
      this.engineMidOsc.type = 'sawtooth';
      this.engineMidOsc.frequency.setValueAtTime(42.1, t);

      this.engineMidGain = this.ctx.createGain();
      this.engineMidGain.gain.setValueAtTime(0.28, t);
      this.engineMidOsc.connect(this.engineMidGain);
      this.engineMidGain.connect(this.bassBooster);

      // 3a. Exhaust Manifold Chamber Rasp → Distortion → Bandpass (Warex straight-pipe character)
      this.exhaustRaspOsc = this.ctx.createOscillator();
      this.exhaustRaspOsc.type = ep.oscType;
      this.exhaustRaspOsc.frequency.setValueAtTime(56.2, t);

      this.exhaustDistortion = this.ctx.createWaveShaper();
      this.exhaustDistortion.curve = this.createDistortionCurve(ep.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
      this.exhaustDistortion.oversample = '4x';

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'bandpass';
      this.exhaustFilter.Q.setValueAtTime(ep.filterQ, t);
      this.exhaustFilter.frequency.setValueAtTime(ep.filterFreq, t);

      this.exhaustRaspGain = this.ctx.createGain();
      this.exhaustRaspGain.gain.setValueAtTime(0.28, t);

      this.exhaustRaspOsc.connect(this.exhaustRaspGain);
      this.exhaustRaspGain.connect(this.exhaustDistortion);
      this.exhaustDistortion.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.bassBooster);

      // 3b. Exhaust Pipe Resonant Cavity (tuned standing-wave peak — "ov ov ov" nasal resonance)
      this.exhaustPipeFilter = this.ctx.createBiquadFilter();
      this.exhaustPipeFilter.type = 'bandpass';
      this.exhaustPipeFilter.frequency.setValueAtTime(ep.pipeFreq, t);
      this.exhaustPipeFilter.Q.setValueAtTime(ep.pipeQ, t);

      this.exhaustPipeGain = this.ctx.createGain();
      this.exhaustPipeGain.gain.setValueAtTime(0.16, t);

      this.exhaustFilter.connect(this.exhaustPipeFilter);
      this.exhaustPipeFilter.connect(this.exhaustPipeGain);
      this.exhaustPipeGain.connect(this.bassBooster);

      // 4. Engine Air Intake Induction Roar (deep brown noise — mechanical throat texture)
      const noiseBuffer = this.getSharedNoiseBuffer();
      if (noiseBuffer) {
        this.intakeNoiseNode = this.ctx.createBufferSource();
        this.intakeNoiseNode.buffer = noiseBuffer;
        this.intakeNoiseNode.loop = true;
      }

      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.frequency.setValueAtTime(280, t);
      this.intakeFilter.Q.setValueAtTime(2.2, t);

      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.setValueAtTime(0.001, t);

      this.intakeNoiseNode?.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeGain);
      this.intakeGain.connect(this.bassBooster);

      // 5. Turbo Spool Oscillator (high-pitch sine whistle: 800–3200 Hz driven by RPM)
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(820, t);

      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0.0, t); // starts silent — driven by RPM in updateEnginePitch

      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.engineGain); // bypass bass booster — turbo is high pitch

      // Start all oscillators and noise
      this.engineSubOsc.start(t);
      this.engineMidOsc.start(t);
      this.exhaustRaspOsc.start(t);
      this.intakeNoiseNode?.start(t);
      this.turboOsc.start(t);

      this.isEngineRunning = true;
      this.currentGear = 1;
      this.currentRpm = 1000;
      this.lastBovTime = 0;
    } catch (err) {
      console.warn('Failed to start engine audio', err);
    }
  }



  // Update Realistic RPM, 6-Speed Gear Ratios, Throaty Exhaust Resonance, and Intake Roar
  public updateEnginePitch(speedKmh: number, isAccelerating: boolean, isNitro: boolean): void {
    if (
      !this.ctx ||
      !this.isEngineRunning ||
      !this.engineSubOsc ||
      !this.engineMidOsc ||
      !this.exhaustRaspOsc ||
      !this.exhaustFilter ||
      !this.engineGain ||
      !this.intakeFilter ||
      !this.intakeGain
    ) {
      return;
    }

    const t = this.ctx.currentTime;

    // 1. Determine 6-Speed Gear Ratio
    let gear = 1;
    let minSpeed = 0;
    let maxSpeed = 48;

    if (speedKmh > 235) {
      gear = 6; minSpeed = 235; maxSpeed = 310;
    } else if (speedKmh > 182) {
      gear = 5; minSpeed = 182; maxSpeed = 235;
    } else if (speedKmh > 132) {
      gear = 4; minSpeed = 132; maxSpeed = 182;
    } else if (speedKmh > 86) {
      gear = 3; minSpeed = 86; maxSpeed = 132;
    } else if (speedKmh > 46) {
      gear = 2; minSpeed = 46; maxSpeed = 86;
    }

    // Gear shift detection & clutch-dip blip
    if (gear > this.currentGear && t - this.lastGearShiftTime > 0.42) {
      this.currentGear = gear;
      this.lastGearShiftTime = t;
      this.playGearShiftBlip();
    } else if (gear < this.currentGear) {
      this.currentGear = gear;
    }

    // 2. Compute Realistic RPM Curve
    const gearProgress = Math.min(1.0, Math.max(0, (speedKmh - minSpeed) / (maxSpeed - minSpeed)));
    const idleRpm = 950;
    const redlineRpm = 7000;
    const baseRpm = gear === 1
      ? idleRpm + Math.pow(gearProgress, 1.15) * (redlineRpm - idleRpm)
      : 3300 + Math.pow(gearProgress, 1.05) * (redlineRpm - 3300);

    const targetRpm = baseRpm + (isNitro ? 500 : (isAccelerating ? 240 : -320));
    this.currentRpm += (targetRpm - this.currentRpm) * 0.24;
    const rpmRatio = Math.min(1.0, Math.max(0, (this.currentRpm - idleRpm) / (redlineRpm - idleRpm)));

    // 3. Modulate Engine Combustion Frequencies with mechanical cam-lope flutter
    const ep = this.getExhaustPresetParams(this.currentExhaustPreset);
    const lope = (1.0 - rpmRatio) * Math.sin(t * 13.5) * (ep.distortionAmount > 8 ? 2.6 : 1.0);
    const subFreq = Math.max(22, 28 + rpmRatio * 62 + lope + (isNitro ? 10 : 0));
    this.engineSubOsc.frequency.setTargetAtTime(subFreq, t, 0.038);
    this.engineMidOsc.frequency.setTargetAtTime(subFreq * 1.503, t, 0.038);
    this.exhaustRaspOsc.frequency.setTargetAtTime(subFreq * 2.01, t, 0.038);

    // 4. Exhaust chamber bandpass sweep (deep throaty growl: 260Hz → 600Hz)
    const exhaustResFreq = 260 + rpmRatio * 340 + (isAccelerating ? 85 : 0);
    this.exhaustFilter.frequency.setTargetAtTime(exhaustResFreq, t, 0.045);

    // Exhaust pipe resonant cavity tracks RPM (harmonic of base note)
    if (this.exhaustPipeFilter) {
      const pipeFreq = ep.pipeFreq * (0.8 + rpmRatio * 0.5);
      this.exhaustPipeFilter.frequency.setTargetAtTime(pipeFreq, t, 0.06);
    }

    // 5. Air Intake Induction Roar
    const intakeResFreq = 220 + rpmRatio * 260 + (isNitro ? 80 : 0);
    this.intakeFilter.frequency.setTargetAtTime(intakeResFreq, t, 0.06);

    const targetIntakeGain = isAccelerating && speedKmh > 15
      ? 0.06 + rpmRatio * 0.18 + (isNitro ? 0.10 : 0)
      : 0.004;
    this.intakeGain.gain.setTargetAtTime(targetIntakeGain, t, 0.075);

    // 6. Turbo Spool (rises 820Hz → 3200Hz with load and RPM)
    if (this.turboGain && this.turboOsc) {
      if (ep.hasTurbo) {
        const turboHz = 820 + rpmRatio * 2280 + (isAccelerating ? 220 : 0);
        this.turboOsc.frequency.setTargetAtTime(turboHz, t, 0.12);
        const turboVol = isAccelerating && rpmRatio > 0.35
          ? (rpmRatio - 0.35) * 0.052 + (isNitro ? 0.015 : 0)
          : 0.0;
        this.turboGain.gain.setTargetAtTime(turboVol, t, 0.10);
      } else {
        this.turboGain.gain.setTargetAtTime(0.0, t, 0.08);
      }
    }

    // 7. Master Volume Dynamic Response
    const masterEngineVol = (ep.distortionAmount > 8 ? 0.28 : 0.22) + rpmRatio * 0.18 + (isAccelerating ? 0.09 : -0.04) + (isNitro ? 0.08 : 0);
    this.engineGain.gain.setTargetAtTime(Math.min(masterEngineVol, 0.65), t, 0.038);

    // 8a. Kesici / Redline Ignition Cut ("TA-TA-TA-TA!")
    if (isAccelerating && rpmRatio > 0.94 && t > this.nextKesiciTime) {
      this.playKesiciPop(t);
      this.nextKesiciTime = t + (ep.distortionAmount > 8 ? 0.105 : 0.125);
    }

    // 8b. BOV flutter when lifting throttle with turbo (stututu!)
    if (ep.hasTurbo && this.wasAccelerating && !isAccelerating && rpmRatio > 0.42 && t - this.lastBovTime > 0.26) {
      this.playBovFlutter(t, rpmRatio * ep.bovVolume);
      this.lastBovTime = t;
    }

    // 8c. Decel Overrun Pops & Bangs ("Çatara Patara") — throttle lift at speed
    if (this.wasAccelerating && !isAccelerating && speedKmh > 22 && t > this.nextBurbleTime) {
      if (Math.random() < ep.popcornChance) {
        const popCount = ep.popcornChance >= 0.95
          ? Math.floor(Math.random() * 2) + 2
          : (Math.random() < 0.6 ? 2 : 1);
        for (let i = 0; i < popCount; i++) {
          const popDelay = i * (0.052 + Math.random() * 0.032);
          this.playDecelBurble(t + popDelay, this.currentExhaustPreset === 'Abarti');
        }
      }
      this.nextBurbleTime = t + (ep.popcornChance >= 0.95 ? 0.26 : 0.36) + Math.random() * 0.16;
    }
    this.wasAccelerating = isAccelerating;
  }

  // Blow-Off Valve / Turbo Compressor Surge Flutter ("stu-tu-tu-tu!")
  private playBovFlutter(t: number, rpmRatio: number): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;

    const flutterCount = Math.floor(rpmRatio * 4) + 4; // 4–8 distinct fluttering chirps
    for (let i = 0; i < flutterCount; i++) {
      const delay = i * (0.046 + Math.random() * 0.014);

      // High-freq metallic flutter pulse
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const startHz = 1950 - i * 110 + Math.random() * 180;
      osc.frequency.setValueAtTime(startHz, t + delay);
      osc.frequency.exponentialRampToValueAtTime(startHz * 0.38, t + delay + 0.024);

      const flutterFilter = this.ctx.createBiquadFilter();
      flutterFilter.type = 'bandpass';
      flutterFilter.frequency.setValueAtTime(2500 - i * 90, t + delay);
      flutterFilter.Q.setValueAtTime(4.5, t + delay);

      const flutterGain = this.ctx.createGain();
      const vol = (0.14 + rpmRatio * 0.16) * Math.pow(1 - i / (flutterCount + 1), 1.2);
      flutterGain.gain.setValueAtTime(vol, t + delay);
      flutterGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.030);

      osc.connect(flutterFilter);
      flutterFilter.connect(flutterGain);
      flutterGain.connect(this.sfxGain!);
      osc.start(t + delay);
      osc.stop(t + delay + 0.034);

      osc.onended = () => {
        try { osc.disconnect(); flutterFilter.disconnect(); flutterGain.disconnect(); } catch {}
      };
    }
  }

  // Kesici / Rev Limiter Rapid Cut-off Pop ("TOK! TAK! TOK!") — Tok, Derin ve Yırtıcı Kesici Sesi
  private playKesiciPop(t: number): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;

    // 1. Tok ve Güçlü Sub-Bas Patlaması (Heavy Concussive Tok Thump 42–95 Hz)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(96, t);
    subOsc.frequency.exponentialRampToValueAtTime(42, t + 0.082);

    const subDistort = this.ctx.createWaveShaper();
    subDistort.curve = this.createDistortionCurve(4.2) as unknown as Float32Array<ArrayBuffer>;

    const subBoost = this.ctx.createBiquadFilter();
    subBoost.type = 'peaking';
    subBoost.frequency.setValueAtTime(52, t);
    subBoost.Q.setValueAtTime(1.8, t);
    subBoost.gain.setValueAtTime(8.5, t);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.01, t);
    subGain.gain.linearRampToValueAtTime(0.95, t + 0.003);
    subGain.gain.setValueAtTime(0.95, t + 0.024);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.088);

    subOsc.connect(subDistort);
    subDistort.connect(subBoost);
    subBoost.connect(subGain);
    subGain.connect(this.sfxGain!);
    subOsc.start(t);
    subOsc.stop(t + 0.092);

    subOsc.onended = () => {
      try { subOsc.disconnect(); subDistort.disconnect(); subBoost.disconnect(); subGain.disconnect(); } catch {}
    };

    // 2. Tok Egzoz Borusu ve Susturucu Kazan Rezonansı (Exhaust Chamber Body Thump 140–220 Hz)
    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'sawtooth';
    bodyOsc.frequency.setValueAtTime(210, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(98, t + 0.065);

    const bodyDistort = this.ctx.createWaveShaper();
    bodyDistort.curve = this.createDistortionCurve(6.5) as unknown as Float32Array<ArrayBuffer>;

    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.setValueAtTime(185, t);
    bodyFilter.Q.setValueAtTime(3.6, t);

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.01, t);
    bodyGain.gain.linearRampToValueAtTime(0.82, t + 0.002);
    bodyGain.gain.setValueAtTime(0.82, t + 0.020);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.070);

    bodyOsc.connect(bodyDistort);
    bodyDistort.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(this.sfxGain!);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.075);

    bodyOsc.onended = () => {
      try { bodyOsc.disconnect(); bodyDistort.disconnect(); bodyFilter.disconnect(); bodyGain.disconnect(); } catch {}
    };

    // 3. Ateşleme Kesme Kıvılcım & Metalik Çatırtı (Reuses cached crackle buffer!)
    const crackleBuffer = this.getSharedCrackleBuffer();
    if (crackleBuffer) {
      const crackleSrc = this.ctx.createBufferSource();
      crackleSrc.buffer = crackleBuffer;

      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(2400, t);
      crackFilter.Q.setValueAtTime(2.2, t);

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.58, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);

      crackleSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.sfxGain!);
      crackleSrc.start(t);

      crackleSrc.onended = () => {
        try { crackleSrc.disconnect(); crackFilter.disconnect(); crackGain.disconnect(); } catch {}
      };
    }

    // Fuel/Ignition cut dip on running engine
    if (this.engineSubGain && this.isEngineRunning) {
      const origSubGain = this.engineSubGain.gain.value;
      this.engineSubGain.gain.setValueAtTime(origSubGain * 0.30, t);
      this.engineSubGain.gain.linearRampToValueAtTime(origSubGain, t + 0.045);
    }

    if (this.onExhaustPop) {
      this.onExhaustPop();
    }
  }

  // Gear Shift Exhaust Blip & Transmission Clunk
  private playGearShiftBlip(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    const t = this.ctx.currentTime;
    const isAbarti = this.currentExhaustPreset === 'Abarti';

    // Clutch-dip fuel cut blip
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isAbarti ? 140 : 110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.065);

    const distort = this.ctx.createWaveShaper();
    distort.curve = this.createDistortionCurve(isAbarti ? 7 : 4) as unknown as Float32Array<ArrayBuffer>;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isAbarti ? 0.55 : 0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.065);

    osc.connect(distort);
    distort.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.07);

    if (isAbarti && Math.random() < 0.7 && this.onExhaustPop) {
      this.onExhaustPop();
    }
  }

  // Decel Pop / Burble Sound ("Çatara Patara" — Warex straight-pipe overrun)
  private playDecelBurble(t: number, isAbarti: boolean = false): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;

    // 1. Deep sub-bass concussive BOOM with punchy body
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    const subPitch = (isAbarti ? 64 : 48) + Math.random() * 22;
    subOsc.frequency.setValueAtTime(subPitch, t);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + 0.085);

    const subBoost = this.ctx.createBiquadFilter();
    subBoost.type = 'peaking';
    subBoost.frequency.setValueAtTime(54, t);
    subBoost.Q.setValueAtTime(1.6, t);
    subBoost.gain.setValueAtTime(isAbarti ? 7.5 : 4.5, t);

    const subGain = this.ctx.createGain();
    const subVol = isAbarti ? (0.78 + Math.random() * 0.20) : (0.48 + Math.random() * 0.16);
    subGain.gain.setValueAtTime(subVol, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.088);

    subOsc.connect(subBoost);
    subBoost.connect(subGain);
    subGain.connect(this.sfxGain!);
    subOsc.start(t);
    subOsc.stop(t + 0.092);

    subOsc.onended = () => {
      try { subOsc.disconnect(); subBoost.disconnect(); subGain.disconnect(); } catch {}
    };

    // 2. Mid-range tube "tok" — distorted sawtooth through tight 190–260Hz bandpass
    const midOsc = this.ctx.createOscillator();
    midOsc.type = 'sawtooth';
    const midPitch = (isAbarti ? 110 : 85) + Math.random() * 35;
    midOsc.frequency.setValueAtTime(midPitch, t);
    midOsc.frequency.exponentialRampToValueAtTime(midPitch * 0.38, t + 0.065);

    const midDistort = this.ctx.createWaveShaper();
    midDistort.curve = this.createDistortionCurve(isAbarti ? 8.5 : 5.0) as unknown as Float32Array<ArrayBuffer>;

    const midBP = this.ctx.createBiquadFilter();
    midBP.type = 'bandpass';
    midBP.frequency.setValueAtTime(isAbarti ? (240 + Math.random() * 80) : (180 + Math.random() * 50), t);
    midBP.Q.setValueAtTime(isAbarti ? 4.8 : 3.2, t);

    const midGain = this.ctx.createGain();
    const midVol = isAbarti ? (0.58 + Math.random() * 0.18) : (0.35 + Math.random() * 0.12);
    midGain.gain.setValueAtTime(midVol, t);
    midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.072);

    midOsc.connect(midDistort);
    midDistort.connect(midBP);
    midBP.connect(midGain);
    midGain.connect(this.sfxGain!);
    midOsc.start(t);
    midOsc.stop(t + 0.078);

    midOsc.onended = () => {
      try { midOsc.disconnect(); midDistort.disconnect(); midBP.disconnect(); midGain.disconnect(); } catch {}
    };

    // 3. Metallic crackle (Reuses cached crackle buffer!)
    const crackBuffer = this.getSharedCrackleBuffer();
    if (crackBuffer) {
      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = crackBuffer;

      const crackBP = this.ctx.createBiquadFilter();
      crackBP.type = 'bandpass';
      crackBP.frequency.setValueAtTime(isAbarti ? (1400 + Math.random() * 800) : (800 + Math.random() * 300), t);
      crackBP.Q.setValueAtTime(isAbarti ? 3.0 : 1.8, t);

      const crackGain = this.ctx.createGain();
      const crackVol = isAbarti ? (0.46 + Math.random() * 0.18) : (0.25 + Math.random() * 0.10);
      crackGain.gain.setValueAtTime(crackVol, t);

      crackSrc.connect(crackBP);
      crackBP.connect(crackGain);
      crackGain.connect(this.sfxGain!);
      crackSrc.start(t);

      crackSrc.onended = () => {
        try { crackSrc.disconnect(); crackBP.disconnect(); crackGain.disconnect(); } catch {}
      };
    }

    if (this.onExhaustPop) {
      this.onExhaustPop();
    }
  }

  public stopEngine(): void {
    if (!this.isEngineRunning) return;
    const stopNode = (node: { stop?: () => void; disconnect?: () => void } | null) => {
      if (!node) return;
      try { (node as OscillatorNode).stop?.(); } catch { /* already stopped */ }
      try { (node as AudioNode).disconnect?.(); } catch { /* already disconnected */ }
    };
    stopNode(this.engineSubOsc);   this.engineSubOsc = null;
    stopNode(this.engineMidOsc);   this.engineMidOsc = null;
    stopNode(this.exhaustRaspOsc); this.exhaustRaspOsc = null;
    stopNode(this.turboOsc);       this.turboOsc = null;
    stopNode(this.intakeNoiseNode); this.intakeNoiseNode = null;
    this.engineSubGain = null;
    this.engineMidGain = null;
    this.exhaustRaspGain = null;
    this.exhaustPipeFilter = null;
    this.exhaustPipeGain = null;
    this.bassBooster = null;
    this.turboGain = null;
    this.engineMasterFilter = null;
    this.intakeFilter = null;
    this.intakeGain = null;
    this.engineGain = null;
    this.exhaustDistortion = null;
    this.exhaustFilter = null;
    this.isEngineRunning = false;
  }



  // Crash Explosion Sound
  public playCrash(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;

    // 1. Heavy noise punch (reusing pre-cached noise buffer)
    const noiseBuffer = this.getSharedNoiseBuffer();
    const noise = this.ctx.createBufferSource();
    if (noiseBuffer) {
      noise.buffer = noiseBuffer;
      noise.loop = true;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);

    noise.start(t);
    noise.stop(t + 0.92);
    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };

    // 2. Sub impact drop
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, t);
    subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.45);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain!);
    subOsc.start(t);
    subOsc.stop(t + 0.45);
    subOsc.onended = () => {
      try {
        subOsc.disconnect();
        subGain.disconnect();
      } catch {}
    };
  }

  // Near Miss Chime
  public playNearMiss(streak: number): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const baseFreq = 520 + Math.min(streak * 80, 600);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.28);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
  }

  // Nitro Sound
  public startNitroSound(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    if (this.nitroStopTimeout) {
      clearTimeout(this.nitroStopTimeout);
      this.nitroStopTimeout = null;
    }

    if (this.nitroNoiseNode && this.nitroGain) {
      const t = this.ctx.currentTime;
      this.nitroGain.gain.cancelScheduledValues(t);
      this.nitroGain.gain.setValueAtTime(this.nitroGain.gain.value, t);
      this.nitroGain.gain.linearRampToValueAtTime(0.28, t + 0.1);
      return;
    }

    const t = this.ctx.currentTime;
    const buffer = this.getSharedNoiseBuffer();
    if (!buffer) return;

    this.nitroNoiseNode = this.ctx.createBufferSource();
    this.nitroNoiseNode.buffer = buffer;
    this.nitroNoiseNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(2.0, t);

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.setValueAtTime(0.01, t);
    this.nitroGain.gain.linearRampToValueAtTime(0.28, t + 0.2);

    this.nitroNoiseNode.connect(filter);
    filter.connect(this.nitroGain);
    this.nitroGain.connect(this.sfxGain!);

    this.nitroNoiseNode.start(t);
  }

  public stopNitroSound(): void {
    if (!this.nitroNoiseNode || !this.ctx || !this.nitroGain) return;

    if (this.nitroStopTimeout) {
      clearTimeout(this.nitroStopTimeout);
      this.nitroStopTimeout = null;
    }

    const t = this.ctx.currentTime;
    this.nitroGain.gain.cancelScheduledValues(t);
    this.nitroGain.gain.setValueAtTime(this.nitroGain.gain.value, t);
    this.nitroGain.gain.linearRampToValueAtTime(0.001, t + 0.15);

    this.nitroStopTimeout = setTimeout(() => {
      if (this.nitroNoiseNode) {
        try {
          this.nitroNoiseNode.stop();
          this.nitroNoiseNode.disconnect();
        } catch {}
        this.nitroNoiseNode = null;
        this.nitroGain = null;
      }
      this.nitroStopTimeout = null;
    }, 160);
  }

  // --- Dynamic Automotive Braking Audio System (Asphalt Rubber Scrub & Deep Mechanical Deceleration) ---
  private startBrakeAudio(): void {
    if (!this.ctx || this.isBrakingAudioActive || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    try {
      const t = this.ctx.currentTime;
      this.isBrakingAudioActive = true;

      // 1. Master Brake Gain
      this.brakeMasterGain = this.ctx.createGain();
      this.brakeMasterGain.gain.setValueAtTime(0.001, t);
      this.brakeMasterGain.gain.linearRampToValueAtTime(0.30, t + 0.05);
      this.brakeMasterGain.connect(this.sfxGain!);

      // 2. Gritty Asphalt & Tire Rubber Friction (Pink/Brown noise through warm dynamic bandpass - NO WHISTLE)
      const noiseBuffer = this.getSharedNoiseBuffer();
      if (!noiseBuffer) return;

      this.brakeNoiseNode = this.ctx.createBufferSource();
      this.brakeNoiseNode.buffer = noiseBuffer;
      this.brakeNoiseNode.loop = true;

      this.brakeFilter = this.ctx.createBiquadFilter();
      this.brakeFilter.type = 'bandpass';
      this.brakeFilter.frequency.setValueAtTime(720, t);
      this.brakeFilter.Q.setValueAtTime(1.8, t);

      this.brakeNoiseGain = this.ctx.createGain();
      this.brakeNoiseGain.gain.setValueAtTime(0.32, t);

      this.brakeNoiseNode.connect(this.brakeFilter);
      this.brakeFilter.connect(this.brakeNoiseGain);
      this.brakeNoiseGain.connect(this.brakeMasterGain);
      this.brakeNoiseNode.start(t);

      // 3. Tok Mechanical Deceleration & Chassis Weight Shift Rumble (Deep triangle wave 110 - 220 Hz)
      this.brakeRumbleOsc = this.ctx.createOscillator();
      this.brakeRumbleOsc.type = 'triangle';
      this.brakeRumbleOsc.frequency.setValueAtTime(130, t);

      this.brakeRumbleGain = this.ctx.createGain();
      this.brakeRumbleGain.gain.setValueAtTime(0.26, t);

      this.brakeRumbleOsc.connect(this.brakeRumbleGain);
      this.brakeRumbleGain.connect(this.brakeMasterGain);
      this.brakeRumbleOsc.start(t);

      // 4. Tok Asfalt Lastik Kazıma (Gritty sawtooth bandpassed at 780 - 900 Hz, strictly NO whistle/sine)
      this.brakeSkidOsc = this.ctx.createOscillator();
      this.brakeSkidOsc.type = 'sawtooth';
      this.brakeSkidOsc.frequency.setValueAtTime(760, t);

      this.brakeSkidFilter = this.ctx.createBiquadFilter();
      this.brakeSkidFilter.type = 'bandpass';
      this.brakeSkidFilter.frequency.setValueAtTime(800, t);
      this.brakeSkidFilter.Q.setValueAtTime(2.0, t);

      this.brakeSkidGain = this.ctx.createGain();
      this.brakeSkidGain.gain.setValueAtTime(0.001, t); // only audible under hard / high-speed braking

      this.brakeSkidOsc.connect(this.brakeSkidFilter);
      this.brakeSkidFilter.connect(this.brakeSkidGain);
      this.brakeSkidGain.connect(this.brakeMasterGain);
      this.brakeSkidOsc.start(t);

      // 5. ABS Hydraulic Shudder (14 Hz chassis vibration under hard braking)
      this.brakeAbsOsc = this.ctx.createOscillator();
      this.brakeAbsOsc.type = 'sawtooth';
      this.brakeAbsOsc.frequency.setValueAtTime(14, t);

      this.brakeAbsGain = this.ctx.createGain();
      this.brakeAbsGain.gain.setValueAtTime(0.0, t);

      this.brakeAbsOsc.connect(this.brakeAbsGain);
      this.brakeAbsGain.connect(this.brakeMasterGain.gain);
      this.brakeAbsOsc.start(t);
    } catch (err) {
      console.warn('Failed starting brake audio', err);
    }
  }

  public updateBrakeAudio(isBraking: boolean, speedKmh: number, _delta?: number): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;

    // Below 4 km/h, braking stops
    if (!isBraking || speedKmh < 4) {
      if (this.isBrakingAudioActive) {
        // If brought to a clean stop by brakes, play tactile mechanical caliper stop clunk
        if (speedKmh <= 6 && !this.hasPlayedStopClunk) {
          this.playBrakeStopClunk();
          this.hasPlayedStopClunk = true;
        }
        this.stopBrakeAudio();
      }
      return;
    }

    // Start audio if not active
    if (!this.isBrakingAudioActive) {
      this.hasPlayedStopClunk = false;
      this.startBrakeAudio();
    }

    if (
      !this.isBrakingAudioActive ||
      !this.brakeMasterGain ||
      !this.brakeFilter ||
      !this.brakeNoiseGain ||
      !this.brakeRumbleOsc ||
      !this.brakeRumbleGain
    ) {
      return;
    }

    const t = this.ctx.currentTime;
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh / 150));

    // 1. Gritty Asphalt & Rotor Friction Sweep (560 Hz - 1080 Hz, warm raspy asphalt bite)
    const scrubFreq = 560 + speedRatio * 520;
    this.brakeFilter.frequency.setTargetAtTime(scrubFreq, t, 0.05);

    const scrubVol = 0.24 + speedRatio * 0.26;
    this.brakeNoiseGain.gain.setTargetAtTime(scrubVol, t, 0.05);

    // 2. Tok Mechanical Deceleration Rumble (110 Hz - 220 Hz low-mid kinetic body)
    const rumbleFreq = 110 + speedRatio * 110;
    this.brakeRumbleOsc.frequency.setTargetAtTime(rumbleFreq, t, 0.05);

    const rumbleVol = 0.22 + speedRatio * 0.24;
    this.brakeRumbleGain.gain.setTargetAtTime(rumbleVol, t, 0.05);

    // 3. Tok Asfalt Lastik Kazıma (Raspy rubber scrub, strictly 740 - 920 Hz, only at high speeds > 60 km/h)
    if (this.brakeSkidOsc && this.brakeSkidGain && this.brakeSkidFilter) {
      if (speedKmh > 60) {
        const skidRatio = Math.min(1.0, (speedKmh - 60) / 80);
        const skidFreq = 740 + skidRatio * 180;
        this.brakeSkidOsc.frequency.setTargetAtTime(skidFreq, t, 0.06);
        this.brakeSkidFilter.frequency.setTargetAtTime(skidFreq + 30, t, 0.06);
        this.brakeSkidGain.gain.setTargetAtTime(0.04 + skidRatio * 0.12, t, 0.06);
      } else {
        this.brakeSkidGain.gain.setTargetAtTime(0.001, t, 0.05);
      }
    }

    // 4. ABS Shudder above 70 km/h
    if (this.brakeAbsGain) {
      const absVol = speedKmh > 70 ? 0.15 : 0.0;
      this.brakeAbsGain.gain.setTargetAtTime(absVol, t, 0.08);
    }

    // 5. Master Brake Volume
    const masterVol = 0.22 + speedRatio * 0.26;
    this.brakeMasterGain.gain.setTargetAtTime(masterVol, t, 0.04);
  }

  public stopBrakeAudio(): void {
    if (!this.isBrakingAudioActive || !this.ctx || !this.brakeMasterGain) return;

    if (this.brakeStopTimeout) {
      clearTimeout(this.brakeStopTimeout);
      this.brakeStopTimeout = null;
    }

    const t = this.ctx.currentTime;
    this.brakeMasterGain.gain.cancelScheduledValues(t);
    this.brakeMasterGain.gain.setValueAtTime(this.brakeMasterGain.gain.value, t);
    this.brakeMasterGain.gain.linearRampToValueAtTime(0.001, t + 0.06);

    this.isBrakingAudioActive = false;

    this.brakeStopTimeout = setTimeout(() => {
      const stopNode = (node: { stop?: () => void; disconnect?: () => void } | null) => {
        if (!node) return;
        try { (node as any).stop?.(); } catch {}
        try { (node as any).disconnect?.(); } catch {}
      };

      stopNode(this.brakeNoiseNode);   this.brakeNoiseNode = null;
      stopNode(this.brakeRumbleOsc);   this.brakeRumbleOsc = null;
      stopNode(this.brakeSkidOsc);     this.brakeSkidOsc = null;
      stopNode(this.brakeAbsOsc);      this.brakeAbsOsc = null;
      stopNode(this.brakeFilter);      this.brakeFilter = null;
      stopNode(this.brakeNoiseGain);   this.brakeNoiseGain = null;
      stopNode(this.brakeRumbleGain);  this.brakeRumbleGain = null;
      stopNode(this.brakeSkidFilter);  this.brakeSkidFilter = null;
      stopNode(this.brakeSkidGain);    this.brakeSkidGain = null;
      stopNode(this.brakeAbsGain);     this.brakeAbsGain = null;
      stopNode(this.brakeMasterGain);  this.brakeMasterGain = null;
      this.brakeStopTimeout = null;
    }, 75);
  }

  // Mechanical Brake Stop Caliper Clunk (Tactile brake bite & suspension settle on 0 km/h)
  public playBrakeStopClunk(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;

    // Low suspension thud
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(95, t);
    thud.frequency.exponentialRampToValueAtTime(36, t + 0.045);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(0.42, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.050);

    thud.connect(thudGain);
    thudGain.connect(this.sfxGain!);
    thud.start(t);
    thud.stop(t + 0.055);
    thud.onended = () => {
      try {
        thud.disconnect();
        thudGain.disconnect();
      } catch {}
    };

    // Metallic pad clamp click
    const click = this.ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(460, t);
    click.frequency.exponentialRampToValueAtTime(140, t + 0.035);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.35, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);

    click.connect(clickGain);
    clickGain.connect(this.sfxGain!);
    click.start(t);
    click.stop(t + 0.040);
    click.onended = () => {
      try {
        click.disconnect();
        clickGain.disconnect();
      } catch {}
    };
  }

  // Emergency Tire Skid / Heavy Asphalt Screech (Used on collisions, heavy scrapes & drifts - NO WHISTLE)
  public playBrakeScreech(intensity = 1.0): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const dur = 0.38;

    // 1. Dual detuned raspy rubber skid (deep throat asphalt scrub 880 -> 540 Hz, NO WHISTLE!)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.exponentialRampToValueAtTime(540, t + dur);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(940, t);
    osc2.frequency.exponentialRampToValueAtTime(580, t + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(840, t);
    filter.frequency.linearRampToValueAtTime(520, t + dur);
    filter.Q.setValueAtTime(2.2, t);

    const skidGain = this.ctx.createGain();
    skidGain.gain.setValueAtTime(0.01, t);
    skidGain.gain.linearRampToValueAtTime(0.25 * intensity, t + 0.02);
    skidGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(skidGain);
    skidGain.connect(this.sfxGain!);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur);
    osc2.stop(t + dur);
    osc1.onended = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        skidGain.disconnect();
      } catch {}
    };

    // 2. Gritty asphalt scrub texture (reusing pre-cached noise buffer)
    const scrubBuffer = this.getSharedNoiseBuffer();
    if (scrubBuffer) {
      const scrubSrc = this.ctx.createBufferSource();
      scrubSrc.buffer = scrubBuffer;
      scrubSrc.loop = true;

      const scrubFilter = this.ctx.createBiquadFilter();
      scrubFilter.type = 'bandpass';
      scrubFilter.frequency.setValueAtTime(780, t);
      scrubFilter.Q.setValueAtTime(1.6, t);

      const scrubGain = this.ctx.createGain();
      scrubGain.gain.setValueAtTime(0.24 * intensity, t);
      scrubGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      scrubSrc.connect(scrubFilter);
      scrubFilter.connect(scrubGain);
      scrubGain.connect(this.sfxGain!);
      scrubSrc.start(t);
      scrubSrc.stop(t + dur);
      scrubSrc.onended = () => {
        try {
          scrubSrc.disconnect();
          scrubFilter.disconnect();
          scrubGain.disconnect();
        } catch {}
      };
    }
  }

  // UI Sound
  public playClick(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.06);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
  }

  // Coin / Reward Sound
  public playReward(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    [0, 0.08].forEach((delay, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 880 : 1320, t + delay);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.25, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.12);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    });
  }

  // Exhaust Backfire / Pop Sound
  public playBackfire(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.09);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.09);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
  }

  // Checkpoint Chime (Time Attack)
  public playCheckpoint(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.2, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.15);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    });
  }

  // --- ISTANBUL AUTHENTIC PROCEDURAL AUDIO ---

  // 1. Vapur Düdüğü (Iconic Bosphorus Ferry Foghorn)
  public playFerryHorn(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const duration = 1.35;

    // Dual resonant pitches (145 Hz + 182 Hz) creating the authentic Bosphorus chord
    [145, 182].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.15);
      gain.gain.setValueAtTime(0.24, t + duration - 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + duration);
    });
  }

  private seagullBuffers: AudioBuffer[] = [];

  private getSeagullBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.seagullBuffers.length === 0) {
      const sampleRate = this.ctx.sampleRate;
      for (let variation = 1; variation <= 2; variation++) {
        const duration = variation === 1 ? 1.65 : 1.35;
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(2, numSamples, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        const addCry = (
          startTime: number,
          cryDur: number,
          startFreq: number,
          peakFreq: number,
          endFreq: number,
          peakRel: number,
          vol: number,
          pan = 0,
          flutterHz = 28
        ) => {
          const startIdx = Math.floor(startTime * sampleRate);
          const crySamples = Math.floor(cryDur * sampleRate);
          let phase = Math.random() * Math.PI * 2;
          let lfoPhase = Math.random() * Math.PI * 2;

          for (let i = 0; i < crySamples; i++) {
            const idx = startIdx + i;
            if (idx >= numSamples) break;

            const tRel = i / crySamples;
            // Avian syrinx natural pitch trajectory
            let freq: number;
            if (tRel < peakRel) {
              const p = tRel / peakRel;
              freq = startFreq + (peakFreq - startFreq) * Math.sin(p * Math.PI * 0.5);
            } else {
              const p = (tRel - peakRel) / (1 - peakRel);
              freq = peakFreq - (peakFreq - endFreq) * (1 - Math.cos(p * Math.PI * 0.5));
            }

            // Syringeal flutter / throat tremolo
            const flutter = Math.sin(lfoPhase) * 48;
            lfoPhase += (2 * Math.PI * flutterHz) / sampleRate;
            phase += (2 * Math.PI * (freq + flutter)) / sampleRate;

            // Avian harmonic spectrum: triangle + sawtooth + breath air
            const saw = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
            const tri = 2 * Math.abs(saw) - 1;
            const wave = saw * 0.35 + tri * 0.65;
            const breath = (Math.random() * 2 - 1) * 0.06;

            // Attack, sustain, release envelope
            let env = 0;
            if (tRel < 0.10) {
              env = Math.sin((tRel / 0.10) * Math.PI * 0.5);
            } else if (tRel < 0.55) {
              env = 1.0 - (tRel - 0.10) * 0.20;
            } else {
              env = 0.91 * Math.cos(((tRel - 0.55) / 0.45) * Math.PI * 0.5);
            }

            const sample = (wave + breath) * env * vol;
            left[idx] += sample * (0.5 - pan * 0.35);
            right[idx] += sample * (0.5 + pan * 0.35);
          }
        };

        if (variation === 1) {
          // Iconic long soaring cry + 2 trailing barks
          addCry(0.04, 0.65, 1150, 2180, 1320, 0.24, 0.38, 0.25, 27);
          addCry(0.82, 0.34, 1380, 1920, 1260, 0.20, 0.28, 0.35, 30);
          addCry(1.22, 0.28, 1300, 1780, 1200, 0.18, 0.20, 0.40, 32);
        } else {
          // Shorter rhythmic calls
          addCry(0.04, 0.38, 1280, 2050, 1340, 0.22, 0.36, -0.3, 29);
          addCry(0.48, 0.32, 1350, 1900, 1280, 0.20, 0.30, -0.2, 31);
          addCry(0.88, 0.36, 1240, 1850, 1200, 0.20, 0.24, -0.15, 28);
        }

        // Soft acoustic smoothing filter
        const rc = 1.0 / (2 * Math.PI * 3400);
        const dt = 1.0 / sampleRate;
        const alpha = dt / (rc + dt);
        let lPrev = 0;
        let rPrev = 0;
        for (let i = 0; i < numSamples; i++) {
          lPrev = lPrev + alpha * (left[i] - lPrev);
          rPrev = rPrev + alpha * (right[i] - rPrev);
          left[i] = lPrev;
          right[i] = rPrev;
        }

        this.seagullBuffers.push(buffer);
      }
    }

    const idx = Math.floor(Math.random() * this.seagullBuffers.length);
    return this.seagullBuffers[idx];
  }

  // 2. Martı Sesleri (Authentic Bosphorus Seagulls)
  public playSeagulls(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const buffer = this.getSeagullBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.sfxGain!);

    source.start();
  }

  private static hornDistortionCurve: Float32Array | null = null;
  private activeHornBus: GainNode | null = null;
  private activeHornCleanupTimer: any = null;
  private lastHornTime = 0;

  private getHornDistortionCurve(): Float32Array {
    if (!AudioManager.hornDistortionCurve) {
      const n_samples = 256;
      const curve = new Float32Array(n_samples);
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        // Soft metallic saturation curve (hyperbolic tangent)
        curve[i] = Math.tanh(x * 1.85);
      }
      AudioManager.hornDistortionCurve = curve;
    }
    return AudioManager.hornDistortionCurve;
  }

  // 3. Efsanevi Seger / Çift Tonlu Türk Otomobil Kornası (Dual-Tone High-Power Automotive Horn)
  public playCarHorn(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;

    // Minimum debounce threshold so rapid key-mashing doesn't stutter (80ms)
    if (t - this.lastHornTime < 0.08) {
      return;
    }

    // Voice-stealing: If a previous horn is still sounding, cleanly fade it out in 12ms so they NEVER overlap or clash!
    if (this.activeHornBus) {
      try {
        const oldBus = this.activeHornBus;
        oldBus.gain.cancelScheduledValues(t);
        oldBus.gain.setValueAtTime(oldBus.gain.value, t);
        oldBus.gain.linearRampToValueAtTime(0.0001, t + 0.012);
        setTimeout(() => {
          try { oldBus.disconnect(); } catch {}
        }, 20);
      } catch {
        // ignore
      }
      this.activeHornBus = null;
    }
    if (this.activeHornCleanupTimer) {
      clearTimeout(this.activeHornCleanupTimer);
      this.activeHornCleanupTimer = null;
    }

    // Dynamic rhythm:
    // If user presses repeatedly within 400ms, trigger a snappy single blast "Düt!"
    // If pressed after a pause, trigger the classic full double-tap "Daa - DAAAT!"
    const isRapidRepeat = (t - this.lastHornTime) < 0.40;
    this.lastHornTime = t;

    const pulses = isRapidRepeat
      ? [{ start: 0, dur: 0.13, vol: 0.48 }]
      : [
          { start: 0, dur: 0.09, vol: 0.44 },
          { start: 0.13, dur: 0.20, vol: 0.50 },
        ];

    const totalDur = pulses[pulses.length - 1].start + pulses[pulses.length - 1].dur;

    // Master horn bus with acoustic filtering & metallic resonance
    const hornBus = this.ctx.createGain();
    this.activeHornBus = hornBus;
    this.activeHornCleanupTimer = setTimeout(() => {
      if (this.activeHornBus === hornBus) {
        this.activeHornBus = null;
      }
      try {
        hornBus.disconnect();
        shaper.disconnect();
        hpFilter.disconnect();
        peakFilter.disconnect();
        lpFilter.disconnect();
        delay.disconnect();
        delayGain.disconnect();
      } catch {}
    }, Math.ceil((totalDur + 0.12) * 1000));

    // Highpass to eliminate low mud
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(320, t);

    // Peaking filter for the brassy, piercing horn flare projection (2200 Hz)
    const peakFilter = this.ctx.createBiquadFilter();
    peakFilter.type = 'peaking';
    peakFilter.frequency.setValueAtTime(2200, t);
    peakFilter.Q.setValueAtTime(2.2, t);
    peakFilter.gain.setValueAtTime(5.5, t);

    // Lowpass to tame harsh digital frequencies
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(5500, t);

    // Metallic diaphragm overdrive (waveshaper)
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.getHornDistortionCurve() as any;
    shaper.oversample = '2x';

    // Connect processing chain
    hornBus.connect(shaper);
    shaper.connect(hpFilter);
    hpFilter.connect(peakFilter);
    peakFilter.connect(lpFilter);
    lpFilter.connect(this.sfxGain!);

    // Subtle highway / street slapback echo (45ms reflection)
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.045, t);
    const delayGain = this.ctx.createGain();
    delayGain.gain.setValueAtTime(0.16, t);
    lpFilter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.sfxGain!);

    pulses.forEach(({ start, dur, vol }) => {
      const pStart = t + start;
      const pEnd = pStart + dur;

      // Pulse Gain Envelope
      const pulseGain = this.ctx!.createGain();
      pulseGain.gain.setValueAtTime(0, pStart);
      // Instant mechanical attack (5ms)
      pulseGain.gain.linearRampToValueAtTime(vol, pStart + 0.006);
      pulseGain.gain.setValueAtTime(vol * 0.95, pEnd - 0.02);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, pEnd);
      pulseGain.connect(hornBus);

      // Contact-breaker electromagnetic ripple LFO (105 Hz)
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.setValueAtTime(105, pStart);
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.setValueAtTime(7.0, pStart);
      lfo.connect(lfoGain);

      // Dual-tone European / Turkish automotive frequencies (Low: 410 Hz, High: 510 Hz)
      [
        { freq: 410, type: 'sawtooth' as OscillatorType, mix: 0.48 },
        { freq: 510, type: 'sawtooth' as OscillatorType, mix: 0.48 },
        // Harmonic overtones for rich metallic body
        { freq: 820, type: 'square' as OscillatorType, mix: 0.18 },
        { freq: 1020, type: 'square' as OscillatorType, mix: 0.18 },
      ].forEach(({ freq, type, mix }) => {
        const osc = this.ctx!.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, pStart);
        lfoGain.connect(osc.frequency);

        const oscGain = this.ctx!.createGain();
        oscGain.gain.setValueAtTime(mix, pStart);
        osc.connect(oscGain);
        oscGain.connect(pulseGain);

        osc.start(pStart);
        osc.stop(pEnd + 0.01);
        osc.onended = () => {
          try {
            osc.disconnect();
            oscGain.disconnect();
          } catch {}
        };
      });

      // Initial mechanical diaphragm snap transient (first 4ms click)
      const snapOsc = this.ctx!.createOscillator();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(1800, pStart);
      snapOsc.frequency.exponentialRampToValueAtTime(200, pStart + 0.008);
      const snapGain = this.ctx!.createGain();
      snapGain.gain.setValueAtTime(0.35, pStart);
      snapGain.gain.exponentialRampToValueAtTime(0.001, pStart + 0.009);
      snapOsc.connect(snapGain);
      snapGain.connect(pulseGain);
      snapOsc.start(pStart);
      snapOsc.stop(pStart + 0.01);
      snapOsc.onended = () => {
        try {
          snapOsc.disconnect();
          snapGain.disconnect();
        } catch {}
      };

      lfo.start(pStart);
      lfo.stop(pEnd + 0.01);
      lfo.onended = () => {
        try {
          lfo.disconnect();
          lfoGain.disconnect();
          pulseGain.disconnect();
        } catch {}
      };
    });
  }

  // 3b. Selektör / Uzun Far Röle & Kol Sesi (Tactile High-Beam Stalk Click on Press & Release)
  public playHighBeamClick(isPress: boolean = true): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isPress ? 1800 : 1250, t);
    osc.frequency.exponentialRampToValueAtTime(isPress ? 380 : 260, t + 0.024);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isPress ? 0.22 : 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.032);
  }

  // 4. EDS Hız Radarı Flaş Sesi (Electronic Camera / Radar Beep)
  public playRadarBeep(): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1760, t); // A6
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // 4b. Otomobil Sinyal Rölesi Sesi ("Tik-Tok" Flasher Relay Click)
  public playTurnSignalClick(isTick: boolean, volume = 0.35, pan = 0): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    // Sharp automotive relay mechanical pulse
    const baseFreq = isTick ? 1480 : 960;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.016);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.1, t);
    filter.Q.setValueAtTime(3.2, t);

    const gain = this.ctx.createGain();
    const effectiveVol = Math.max(0.01, Math.min(0.6, volume));
    gain.gain.setValueAtTime(effectiveVol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    osc.connect(filter);
    filter.connect(gain);

    if (Math.abs(pan) > 0.01) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      gain.connect(panner);
      panner.connect(this.sfxGain!);
    } else {
      gain.connect(this.sfxGain!);
    }

    osc.start(t);
    osc.stop(t + 0.024);
  }

  // 4c. Araç-Araç Tampon Temas / Dokunma Sesi (Vehicle Bumper Bump)
  public playBumperThump(volume = 0.4, pan = 0): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);

    const gain = this.ctx.createGain();
    const effectiveVol = Math.max(0.05, Math.min(0.8, volume));
    gain.gain.setValueAtTime(effectiveVol, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);

    let panner: StereoPannerNode | null = null;
    if (Math.abs(pan) > 0.01) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      gain.connect(panner);
      panner.connect(this.sfxGain!);
    } else {
      gain.connect(this.sfxGain!);
    }

    osc.start(t);
    osc.stop(t + 0.15);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner?.disconnect();
      } catch {}
    };
  }

  // 4d. Trafikteki Diğer Araçların Kornası (Traffic NPC Horn)
  public playNpcHorn(
    pan = 0,
    volume = 0.28,
    duration = 0.18,
    startTimeOffset = 0,
    pitchMult = 1.0
  ): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime + startTimeOffset;

    // Rate-limit immediate NPC horns to prevent burst audio thread choking
    if (startTimeOffset === 0) {
      if (t - this.lastNpcHornTime < 0.05) return;
      this.lastNpcHornTime = t;
    }

    const dur = duration;
    const hornBus = this.ctx.createGain();

    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(320, t);

    const peakFilter = this.ctx.createBiquadFilter();
    peakFilter.type = 'peaking';
    peakFilter.frequency.setValueAtTime(2100, t);
    peakFilter.Q.setValueAtTime(2.0, t);
    peakFilter.gain.setValueAtTime(4.0, t);

    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(4500, t);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.getHornDistortionCurve() as any;

    hornBus.connect(shaper);
    shaper.connect(hpFilter);
    hpFilter.connect(peakFilter);
    peakFilter.connect(lpFilter);

    let panner: StereoPannerNode | null = null;
    if (Math.abs(pan) > 0.01) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      lpFilter.connect(panner);
      panner.connect(this.sfxGain!);
    } else {
      lpFilter.connect(this.sfxGain!);
    }

    const pulseGain = this.ctx.createGain();
    pulseGain.gain.setValueAtTime(0, t);
    pulseGain.gain.linearRampToValueAtTime(volume, t + 0.008);
    pulseGain.gain.setValueAtTime(volume * 0.9, t + dur - 0.02);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    pulseGain.connect(hornBus);

    // Randomize pitch slightly per NPC car for natural variety
    const baseLow = (390 + Math.random() * 45) * pitchMult;
    const baseHigh = baseLow * 1.24;

    const oscPairs: { osc: OscillatorNode; gain: GainNode }[] = [];
    [
      { freq: baseLow, type: 'sawtooth' as OscillatorType, mix: 0.48 },
      { freq: baseHigh, type: 'sawtooth' as OscillatorType, mix: 0.48 },
      { freq: baseLow * 2, type: 'square' as OscillatorType, mix: 0.16 },
    ].forEach(({ freq, type, mix }, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      const oscGain = this.ctx!.createGain();
      oscGain.gain.setValueAtTime(mix, t);
      osc.connect(oscGain);
      oscGain.connect(pulseGain);

      osc.start(t);
      osc.stop(t + dur + 0.01);
      oscPairs.push({ osc, gain: oscGain });

      if (idx === 0) {
        osc.onended = () => {
          try {
            oscPairs.forEach(pair => {
              pair.osc.disconnect();
              pair.gain.disconnect();
            });
            pulseGain.disconnect();
            hornBus.disconnect();
            shaper.disconnect();
            hpFilter.disconnect();
            peakFilter.disconnect();
            lpFilter.disconnect();
            panner?.disconnect();
          } catch {}
        };
      }
    });
  }

  // 4d-2. Karşı Yönden Gelen Araçların Acil / Panik Uyarısı (Oncoming Panic Horn: "DÜT-DÜÜÜT!")
  public playOncomingWarningHorn(pan = 0, isHeavy = false): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    const t = this.ctx.currentTime;
    // Debounce oncoming horn blasts across approaching cars so multiple cars don't spike audio thread
    if (t - this.lastOncomingHornTime < 0.35) return;
    this.lastOncomingHornTime = t;

    if (isHeavy) {
      // Derin ve gürültülü kamyon/otobüs havalı korna uyarısı
      this.playNpcHorn(pan, 0.52, 0.48, 0, 0.62);
      this.playNpcHorn(pan, 0.44, 0.28, 0.52, 0.60);
    } else {
      // Panik çift korna uyarısı ("DÜT! DÜÜÜT!")
      this.playNpcHorn(pan, 0.44, 0.11, 0, 1.08);
      this.playNpcHorn(pan, 0.48, 0.32, 0.15, 1.05);
    }
  }

  // 4e. Diğer Araçların Yanından Hızlı Geçiş Rüzgar Sesi (Pass-By Whoosh)
  public playTrafficPassBy(pan: number, relSpeedKmh: number): void {
    if (!this.ctx || !gameState.settings.soundEnabled) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const dur = 0.35;
    const noiseBuffer = this.getSharedNoiseBuffer();
    if (!noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerFreq = Math.min(1100, 350 + relSpeedKmh * 6);
    filter.frequency.setValueAtTime(centerFreq * 0.8, t);
    filter.frequency.exponentialRampToValueAtTime(centerFreq * 1.3, t + dur * 0.4);
    filter.frequency.exponentialRampToValueAtTime(centerFreq * 0.6, t + dur);
    filter.Q.setValueAtTime(1.8, t);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.38, 0.15 + (relSpeedKmh / 160) * 0.22);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);

    let panner: StereoPannerNode | null = null;
    if (Math.abs(pan) > 0.01) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      gain.connect(panner);
      panner.connect(this.sfxGain!);
    } else {
      gain.connect(this.sfxGain!);
    }

    noise.start(t);
    noise.stop(t + dur);
    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner?.disconnect();
      } catch {}
    };
  }

  // 4f. Dinamik Trafik Motor & Siren Simülatörü (Continuous Spatial Traffic Engine & Siren)
  public initTrafficAudio(): void {
    if (!this.ctx || this.trafficAudioRunning) return;
    this.resumeContext();
    const t = this.ctx.currentTime;

    try {
      // Voice 1: Near Car 1
      this.trafficOsc1 = this.ctx.createOscillator();
      this.trafficOsc1.type = 'sawtooth';
      this.trafficOsc1.frequency.setValueAtTime(65, t);
      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(320, t);
      this.trafficGain1 = this.ctx.createGain();
      this.trafficGain1.gain.setValueAtTime(0, t);
      this.trafficPan1 = this.ctx.createStereoPanner();

      this.trafficOsc1.connect(filter1);
      filter1.connect(this.trafficGain1);
      if (this.trafficPan1) {
        this.trafficGain1.connect(this.trafficPan1);
        this.trafficPan1.connect(this.sfxGain!);
      } else {
        this.trafficGain1.connect(this.sfxGain!);
      }
      this.trafficOsc1.start(t);

      // Voice 2: Near Car 2
      this.trafficOsc2 = this.ctx.createOscillator();
      this.trafficOsc2.type = 'sawtooth';
      this.trafficOsc2.frequency.setValueAtTime(80, t);
      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.setValueAtTime(360, t);
      this.trafficGain2 = this.ctx.createGain();
      this.trafficGain2.gain.setValueAtTime(0, t);
      this.trafficPan2 = this.ctx.createStereoPanner();

      this.trafficOsc2.connect(filter2);
      filter2.connect(this.trafficGain2);
      if (this.trafficPan2) {
        this.trafficGain2.connect(this.trafficPan2);
        this.trafficPan2.connect(this.sfxGain!);
      } else {
        this.trafficGain2.connect(this.sfxGain!);
      }
      this.trafficOsc2.start(t);

      // Voice 3: Heavy Truck / Bus Deep Diesel Rumble
      this.trafficTruckOsc = this.ctx.createOscillator();
      this.trafficTruckOsc.type = 'sawtooth';
      this.trafficTruckOsc.frequency.setValueAtTime(42, t);
      const truckFilter = this.ctx.createBiquadFilter();
      truckFilter.type = 'lowpass';
      truckFilter.frequency.setValueAtTime(140, t);
      this.trafficTruckGain = this.ctx.createGain();
      this.trafficTruckGain.gain.setValueAtTime(0, t);
      this.trafficTruckPan = this.ctx.createStereoPanner();

      this.trafficTruckOsc.connect(truckFilter);
      truckFilter.connect(this.trafficTruckGain);
      if (this.trafficTruckPan) {
        this.trafficTruckGain.connect(this.trafficTruckPan);
        this.trafficTruckPan.connect(this.sfxGain!);
      } else {
        this.trafficTruckGain.connect(this.sfxGain!);
      }
      this.trafficTruckOsc.start(t);

      // Voice 4: Ambulance Siren
      this.ambulanceOsc = this.ctx.createOscillator();
      this.ambulanceOsc.type = 'sawtooth';
      this.ambulanceOsc.frequency.setValueAtTime(680, t);
      const ambFilter = this.ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.setValueAtTime(880, t);
      this.ambulanceGain = this.ctx.createGain();
      this.ambulanceGain.gain.setValueAtTime(0, t);
      this.ambulancePan = this.ctx.createStereoPanner();

      this.ambulanceOsc.connect(ambFilter);
      ambFilter.connect(this.ambulanceGain);
      if (this.ambulancePan) {
        this.ambulanceGain.connect(this.ambulancePan);
        this.ambulancePan.connect(this.sfxGain!);
      } else {
        this.ambulanceGain.connect(this.sfxGain!);
      }
      this.ambulanceOsc.start(t);

      this.trafficAudioRunning = true;
    } catch {
      this.trafficAudioRunning = false;
    }
  }

  public stopTrafficAudio(): void {
    if (!this.trafficAudioRunning) return;
    try {
      this.trafficOsc1?.stop();
      this.trafficOsc1?.disconnect();
      this.trafficOsc2?.stop();
      this.trafficOsc2?.disconnect();
      this.trafficTruckOsc?.stop();
      this.trafficTruckOsc?.disconnect();
      this.ambulanceOsc?.stop();
      this.ambulanceOsc?.disconnect();
    } catch {}
    this.trafficOsc1 = null;
    this.trafficOsc2 = null;
    this.trafficTruckOsc = null;
    this.ambulanceOsc = null;
    this.trafficAudioRunning = false;
  }

  public updateTrafficAudio(
    activeVehicles: any[],
    playerPos: { x: number; y: number; z: number },
    _playerSpeedKmh: number,
    delta: number
  ): void {
    if (!this.ctx || !gameState.settings.soundEnabled) {
      if (this.trafficAudioRunning) this.stopTrafficAudio();
      return;
    }
    if (!this.trafficAudioRunning) {
      this.initTrafficAudio();
    }

    this.trafficAudioUpdateCooldown -= delta;
    if (this.trafficAudioUpdateCooldown > 0) return;
    this.trafficAudioUpdateCooldown = 0.045; // ~22 Hz refresh rate, smooth audio param interpolation

    const t = this.ctx.currentTime;

    // Find closest cars and closest truck/ambulance
    let nearest1: any = null;
    let dist1 = Infinity;
    let nearest2: any = null;
    let dist2 = Infinity;
    let nearestTruck: any = null;
    let truckDist = Infinity;
    let nearestAmbulance: any = null;
    let ambDist = Infinity;

    for (let i = 0; i < activeVehicles.length; i++) {
      const v = activeVehicles[i];
      if (!v.isActive) continue;

      const d = Math.hypot(v.mesh.position.x - playerPos.x, v.mesh.position.z - playerPos.z);

      if (v.npcTemplate?.category === 'ambulance') {
        if (d < ambDist) {
          ambDist = d;
          nearestAmbulance = v;
        }
      }

      if (v.personality === 'heavy' || v.trafficType === 'truck' || v.trafficType === 'bus') {
        if (d < truckDist) {
          truckDist = d;
          nearestTruck = v;
        }
      } else {
        if (d < dist1) {
          nearest2 = nearest1;
          dist2 = dist1;
          nearest1 = v;
          dist1 = d;
        } else if (d < dist2) {
          nearest2 = v;
          dist2 = d;
        }
      }
    }

    // Voice 1 (Closest Car)
    if (this.trafficGain1 && this.trafficOsc1) {
      if (nearest1 && dist1 < 48) {
        const pan = Math.max(-0.9, Math.min(0.9, (nearest1.mesh.position.x - playerPos.x) / 10));
        const vol = (1 - dist1 / 48) * 0.18 * Math.min(1.0, nearest1.speedKmh / 50);
        const freq = 55 + (nearest1.speedKmh / 140) * 45;

        this.trafficGain1.gain.setTargetAtTime(vol, t, 0.05);
        this.trafficOsc1.frequency.setTargetAtTime(freq, t, 0.05);
        if (this.trafficPan1) this.trafficPan1.pan.setTargetAtTime(pan, t, 0.05);
      } else {
        this.trafficGain1.gain.setTargetAtTime(0, t, 0.08);
      }
    }

    // Voice 2 (Second Closest Car)
    if (this.trafficGain2 && this.trafficOsc2) {
      if (nearest2 && dist2 < 42) {
        const pan = Math.max(-0.9, Math.min(0.9, (nearest2.mesh.position.x - playerPos.x) / 10));
        const vol = (1 - dist2 / 42) * 0.15 * Math.min(1.0, nearest2.speedKmh / 50);
        const freq = 70 + (nearest2.speedKmh / 140) * 55;

        this.trafficGain2.gain.setTargetAtTime(vol, t, 0.05);
        this.trafficOsc2.frequency.setTargetAtTime(freq, t, 0.05);
        if (this.trafficPan2) this.trafficPan2.pan.setTargetAtTime(pan, t, 0.05);
      } else {
        this.trafficGain2.gain.setTargetAtTime(0, t, 0.08);
      }
    }

    // Voice 3 (Truck Deep Diesel Rumble)
    if (this.trafficTruckGain && this.trafficTruckOsc) {
      if (nearestTruck && truckDist < 52) {
        const pan = Math.max(-0.9, Math.min(0.9, (nearestTruck.mesh.position.x - playerPos.x) / 10));
        const vol = (1 - truckDist / 52) * 0.24 * Math.min(1.0, nearestTruck.speedKmh / 40);
        const freq = 36 + (nearestTruck.speedKmh / 100) * 26;

        this.trafficTruckGain.gain.setTargetAtTime(vol, t, 0.05);
        this.trafficTruckOsc.frequency.setTargetAtTime(freq, t, 0.05);
        if (this.trafficTruckPan) this.trafficTruckPan.pan.setTargetAtTime(pan, t, 0.05);
      } else {
        this.trafficTruckGain.gain.setTargetAtTime(0, t, 0.08);
      }
    }

    // Voice 4 (Ambulance Siren)
    if (this.ambulanceGain && this.ambulanceOsc) {
      if (nearestAmbulance && ambDist < 140) {
        this.ambulanceSirenTimer += delta;
        const isHighTone = (this.ambulanceSirenTimer % 0.88) < 0.44;
        const sirenFreq = isHighTone ? 680 : 510;
        const pan = Math.max(-0.95, Math.min(0.95, (nearestAmbulance.mesh.position.x - playerPos.x) / 14));
        const vol = (1 - ambDist / 140) * 0.35;

        this.ambulanceGain.gain.setTargetAtTime(vol, t, 0.04);
        this.ambulanceOsc.frequency.setTargetAtTime(sirenFreq, t, 0.02);
        if (this.ambulancePan) this.ambulancePan.pan.setTargetAtTime(pan, t, 0.04);
      } else {
        this.ambulanceGain.gain.setTargetAtTime(0, t, 0.08);
      }
    }
  }

  // Background In-Game Radio & Cassette Music
  public startMusic(): void {
    if (!this.ctx || !gameState.settings.musicEnabled) return;
    this.resumeContext();
    radioManager.setEnabled(true);
  }

  public stopMusic(): void {
    radioManager.setEnabled(false);
  }

  // Cinematic Camera Fly-In Whoosh Sound Effect
  public playCinematicWhoosh(): void {
    if (!this.ctx || !this.sfxGain || !gameState.settings.soundEnabled) return;
    try {
      const t = this.ctx.currentTime;
      const noiseBuffer = this.getSharedNoiseBuffer();
      if (!noiseBuffer) return;

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Sweeping bandpass filter (wind/swoop)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(130, t);
      filter.frequency.exponentialRampToValueAtTime(720, t + 3.2);
      filter.frequency.exponentialRampToValueAtTime(180, t + 5.7);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 2.8);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 5.7);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      whiteNoise.start(t);
      whiteNoise.stop(t + 5.8);
      whiteNoise.onended = () => {
        try {
          whiteNoise.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  // Arcade Countdown Beep (3, 2, 1 and High Pitch GAZLA! Chime)
  public playCountdownBeep(isFinal = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !gameState.settings.soundEnabled) return;
    try {
      const t = ctx.currentTime;
      if (!isFinal) {
        // Crisp 520Hz mid-tone arcade beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t);

        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.18);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      } else {
        // Triumphant multi-harmonic "GO!" chime (784Hz + 1046Hz)
        [784, 1046].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

          osc.connect(gain);
          gain.connect(this.sfxGain!);

          osc.start(t);
          osc.stop(t + 0.45);
          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {}
          };
        });
      }
    } catch {}
  }

  public setSoundEnabled(enabled: boolean): void {
    if (this.sfxGain) {
      this.sfxGain.gain.value = enabled ? 0.75 : 0;
    }
    if (!enabled) {
      this.stopEngine();
      this.stopNitroSound();
      this.stopTrafficAudio();
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    if (this.musicGain) {
      this.musicGain.gain.value = enabled ? 0.38 : 0;
    }
    radioManager.setEnabled(enabled);
  }
}

export const audioManager = AudioManager.getInstance();
