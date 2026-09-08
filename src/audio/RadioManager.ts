// RadioManager.ts - In-Game Istanbul Radio & Nostalgic Cassette Deck Audio Engine
import { eventBus } from '../core/EventBus';

export interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  tagline: string;
  genre: string;
  color: string;
  tracks?: string[];
  streamUrl?: string;
  isLive?: boolean;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'kral_turk',
    name: 'KRAL TÜRK FM',
    frequency: '92.0 MHz',
    tagline: 'Canlı Damar & Arabesk',
    genre: 'Arabesk',
    color: '#ff3366',
    streamUrl: 'https://live.radyositesihazir.com/8032/stream',
    isLive: true,
    tracks: ['Canlı Yayın (Kral Türk FM)'],
  },
  {
    id: 'joy_turk',
    name: 'JOY TÜRK',
    frequency: '89.0 MHz',
    tagline: 'Canlı Türkçe Pop & Slow',
    genre: 'Pop / Slow',
    color: '#ff6b6b',
    streamUrl: 'https://28503.live.streamtheworld.com/JOY_TURK_SC',
    isLive: true,
    tracks: ['Canlı Yayın (Joy Türk)'],
  },
  {
    id: 'super_fm',
    name: 'SÜPER FM',
    frequency: '90.8 MHz',
    tagline: 'En Çok Dinlenen Türkçe Pop',
    genre: 'Türkçe Pop',
    color: '#ffbe0b',
    streamUrl: 'https://22673.live.streamtheworld.com/SUPER_FMAAC_SC',
    isLive: true,
    tracks: ['Canlı Yayın (Süper FM)'],
  },
  {
    id: 'fenomen',
    name: 'RADYO FENOMEN',
    frequency: '100.4 MHz',
    tagline: 'Maksimum Hit & Dans/EDM',
    genre: 'Hit / EDM',
    color: '#00f0ff',
    streamUrl: 'https://live.radyofenomen.com/fenomen/128/icecast.audio',
    isLive: true,
    tracks: ['Canlı Yayın (Radyo Fenomen)'],
  },
  {
    id: 'arabesk_fm',
    name: 'ARABESK FM',
    frequency: '105.4 MHz',
    tagline: 'Kesintisiz Damar & Şoför Şarkıları',
    genre: 'Arabesk / Damar',
    color: '#e11d48',
    streamUrl: 'https://yayin.radyoarabesk.com.tr:8000/stream',
    isLive: true,
    tracks: ['Canlı Yayın (Arabesk FM)'],
  },
  {
    id: 'slow_turk',
    name: 'SLOWTÜRK',
    frequency: '95.3 MHz',
    tagline: 'Aşkın ve Duyguların Frekansı',
    genre: 'Slow / Duygusal',
    color: '#f43f5e',
    streamUrl: 'https://radyo.duhnet.tv/slowturk',
    isLive: true,
    tracks: ['Canlı Yayın (SlowTürk)'],
  },
  {
    id: 'metro_fm',
    name: 'METRO FM',
    frequency: '107.2 MHz',
    tagline: 'Canlı Yabancı Hit Müzik',
    genre: 'Yabancı Hit',
    color: '#38bdf8',
    streamUrl: 'https://27753.live.streamtheworld.com/METRO_FMAAC_SC',
    isLive: true,
    tracks: ['Canlı Yayın (Metro FM)'],
  },
  {
    id: 'drift_fm',
    name: 'İSTANBUL PHONK',
    frequency: '103.8 MHz',
    tagline: 'Makas & Drift Wave (808 Trap)',
    genre: 'Phonk/Trap',
    color: '#a855f7',
    isLive: false,
    tracks: [
      'Kadıköy Drift (Tokyo-Istanbul Phonk)',
      'Warex Kesici (808 Sub-Bass)',
      'E5 Canavarı (Cowbell Trap)',
      'Gece Kuşatması (Drift Edit)',
    ],
  },
  {
    id: 'trt_nostalji',
    name: 'TRT NOSTALJİ',
    frequency: '88.6 MHz',
    tagline: '70s/80s Anadolu Rock & Funk',
    genre: 'Anadolu Rock',
    color: '#10b981',
    isLive: false,
    tracks: [
      'Dönence Rüzgarı (Anadolu Psyche)',
      'Boğaziçi Ekspresi (70s Funk)',
      'Asfaltın Tozu (Moğollar Vibe)',
      'Karaköy Rıhtımı (Retro Organ)',
    ],
  },
  {
    id: 'off',
    name: 'RADYO KAPALI',
    frequency: '--- MHz',
    tagline: 'Saf Motor & Egzoz Sesi',
    genre: 'Sessiz',
    color: '#64748b',
    isLive: false,
    tracks: ['Motor Kükremesi'],
  },
];

export class RadioManager {
  private static instance: RadioManager;
  private ctx: AudioContext | null = null;
  private outputNode: GainNode | null = null;

  // Analyser node for live spectrum / equalizer HUD
  private analyser: AnalyserNode | null = null;
  private freqDataArray: Uint8Array | null = null;

  // Current state
  public currentStationIndex = 0; // Starts at Kral Türk FM
  public currentTrackIndex = 0;
  public isPlaying = true;
  private isEnabled = true;

  // HTML5 Live Stream Audio Element
  private liveAudio: HTMLAudioElement | null = null;
  private liveMediaSource: MediaElementAudioSourceNode | null = null;
  private isConnectingLive = false;

  // Music loop state
  private stepTimer: number | null = null;
  private currentStep = 0;

  // Tuner static buffer
  private staticBuffer: AudioBuffer | null = null;

  private constructor() {}

  public static getInstance(): RadioManager {
    if (!RadioManager.instance) {
      RadioManager.instance = new RadioManager();
    }
    return RadioManager.instance;
  }

  public init(ctx: AudioContext, destination: AudioNode): void {
    this.ctx = ctx;

    // Analyser node for frequency spectrum dancing HUD
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    this.freqDataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // Dedicated radio volume gain
    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 0.42;

    this.outputNode.connect(this.analyser);
    this.analyser.connect(destination);

    // Pre-create analog tuner static noise buffer
    this.createStaticNoiseBuffer();

    // Initialize live streaming audio element
    this.setupLiveAudio();

    // Start playing default station
    if (this.isEnabled && this.currentStationIndex < RADIO_STATIONS.length - 1) {
      this.playCurrentStation();
    }
  }

  private setupLiveAudio(): void {
    if (typeof window === 'undefined') return;
    this.liveAudio = new Audio();
    this.liveAudio.crossOrigin = 'anonymous';
    this.liveAudio.preload = 'none';

    if (this.ctx && this.outputNode) {
      try {
        this.liveMediaSource = this.ctx.createMediaElementSource(this.liveAudio);
        this.liveMediaSource.connect(this.outputNode);
      } catch (e) {
        console.warn('MediaElementSource fallback to direct audio element volume:', e);
        this.liveAudio.volume = 0.42;
      }
    }

    this.liveAudio.addEventListener('playing', () => {
      this.isConnectingLive = false;
      this.emitChange();
    });

    this.liveAudio.addEventListener('waiting', () => {
      this.isConnectingLive = true;
      this.emitChange();
    });

    this.liveAudio.addEventListener('error', () => {
      const st = this.getCurrentStation();
      console.warn('Live stream error or offline on station:', st.name);
      this.isConnectingLive = false;
      // Graceful fallback: start procedural synth if live stream fails
      if (this.isPlaying && st.id !== 'off') {
        this.startSynthesizer();
      }
      this.emitChange();
    });
  }

  private playCurrentStation(): void {
    const station = this.getCurrentStation();

    if (station.id === 'off' || !this.isPlaying || !this.isEnabled) {
      this.stopSynthesizer();
      this.stopLiveAudio();
      this.isConnectingLive = false;
      this.emitChange();
      return;
    }

    if (station.isLive && station.streamUrl) {
      this.stopSynthesizer();
      this.isConnectingLive = true;
      this.emitChange();
      this.startLiveStream(station.streamUrl);
    } else {
      this.stopLiveAudio();
      this.isConnectingLive = false;
      this.startSynthesizer();
      this.emitChange();
    }
  }

  private startLiveStream(url: string): void {
    if (!this.liveAudio) return;
    try {
      this.liveAudio.pause();
      this.liveAudio.src = url;
      this.liveAudio.load();
      const p = this.liveAudio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Live stream autoplay notice:', err);
        });
      }
    } catch (err) {
      console.warn('Live stream load error:', err);
    }
  }

  private stopLiveAudio(): void {
    if (this.liveAudio) {
      try {
        this.liveAudio.pause();
        this.liveAudio.removeAttribute('src');
        this.liveAudio.load();
      } catch {}
    }
    this.isConnectingLive = false;
  }

  private createStaticNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.22); // 220ms of tuner static
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate FM radio tuning static: white noise + crackles
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.4;
      const crackle = Math.random() < 0.05 ? (Math.random() * 2 - 1) * 0.8 : 0;
      data[i] = white + crackle;
    }
    this.staticBuffer = buffer;
  }

  public getCurrentStation(): RadioStation {
    return RADIO_STATIONS[this.currentStationIndex];
  }

  public getCurrentTrack(): string {
    const station = this.getCurrentStation();
    if (!station.tracks || station.tracks.length === 0) {
      return station.isLive ? 'Canlı FM Yayını' : 'Müzik Parçası';
    }
    return station.tracks[this.currentTrackIndex % station.tracks.length];
  }

  // Play realistic analog FM frequency search static
  public playTunerStatic(): void {
    if (!this.ctx || !this.outputNode || !this.staticBuffer) return;
    try {
      const t = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = this.staticBuffer;

      // Sweeping bandpass filter to sound like finding a frequency dial
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 4.0;
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
      filter.frequency.exponentialRampToValueAtTime(1400, t + 0.22);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      source.start(t);
      source.stop(t + 0.22);
      source.onended = () => {
        try {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  // Play authentic retro cassette mechanical click ("ka-çık!")
  public playCassetteClick(): void {
    if (!this.ctx || !this.outputNode) return;
    try {
      const t = this.ctx.currentTime;
      [0, 0.04].forEach((delay, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 320 : 180, t + delay);
        osc.frequency.exponentialRampToValueAtTime(40, t + delay + 0.05);

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.35, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);

        osc.connect(gain);
        gain.connect(this.outputNode!);

        osc.start(t + delay);
        osc.stop(t + delay + 0.05);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      });
    } catch {}
  }

  public nextStation(): void {
    this.playTunerStatic();
    this.currentStationIndex = (this.currentStationIndex + 1) % RADIO_STATIONS.length;
    this.currentTrackIndex = 0;
    this.onStationChanged();
  }

  public prevStation(): void {
    this.playTunerStatic();
    this.currentStationIndex = (this.currentStationIndex - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    this.currentTrackIndex = 0;
    this.onStationChanged();
  }

  public setStation(index: number): void {
    if (index === this.currentStationIndex) return;
    this.playTunerStatic();
    this.currentStationIndex = Math.max(0, Math.min(RADIO_STATIONS.length - 1, index));
    this.currentTrackIndex = 0;
    this.onStationChanged();
  }

  public togglePlay(): void {
    this.playCassetteClick();
    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      if (this.getCurrentStation().id === 'off') {
        this.currentStationIndex = 0;
      }
      this.playCurrentStation();
    } else {
      this.stopSynthesizer();
      this.stopLiveAudio();
    }

    this.emitChange();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopSynthesizer();
      this.stopLiveAudio();
    } else if (this.isPlaying && this.getCurrentStation().id !== 'off') {
      this.playCurrentStation();
    }
  }

  private onStationChanged(): void {
    const station = this.getCurrentStation();
    if (station.id === 'off') {
      this.isPlaying = false;
      this.stopSynthesizer();
      this.stopLiveAudio();
    } else {
      this.isPlaying = true;
      this.playCurrentStation();
    }
  }

  private emitChange(): void {
    const station = this.getCurrentStation();
    const track = this.getCurrentTrack();
    let sub = '';
    if (station.id === 'off') {
      sub = 'Sadece Saf Motor Sesi';
    } else if (this.isConnectingLive) {
      sub = '⚡ FREKANS ARANIYOR (BAĞLANIYOR)...';
    } else if (station.isLive) {
      sub = `🔴 CANLI YAYIN • ${station.tagline}`;
    } else {
      sub = `${station.tagline} • ${track}`;
    }

    eventBus.emit('radio:stationChanged', {
      stationIndex: this.currentStationIndex,
      frequency: station.frequency,
      name: station.name,
      trackTitle: track,
      subtitle: sub,
      isPlaying: this.isPlaying,
      isLive: station.isLive,
      isConnecting: this.isConnectingLive,
    });
  }

  // Real-time 5-Band Equalizer spectrum data for HUD widget
  public getSpectrumLevels(): number[] {
    if (!this.analyser || !this.freqDataArray || !this.isPlaying || this.getCurrentStation().id === 'off') {
      return [0, 0, 0, 0, 0];
    }
    this.analyser.getByteFrequencyData(this.freqDataArray as any);

    // Sample 5 representative frequency ranges (Sub-Bass, Bass, Mid, High-Mid, Treble)
    const b0 = this.freqDataArray[1] / 255;
    const b1 = this.freqDataArray[3] / 255;
    const b2 = this.freqDataArray[6] / 255;
    const b3 = this.freqDataArray[11] / 255;
    const b4 = this.freqDataArray[18] / 255;

    // Organic dancing waveform fallback if CORS prevents Web Audio bin inspection on certain stream hosts
    const sum = b0 + b1 + b2 + b3 + b4;
    if (sum === 0 && this.isPlaying && !this.isConnectingLive) {
      const now = performance.now() * 0.007;
      const wave0 = 0.38 + Math.sin(now * 1.8) * 0.28;
      const wave1 = 0.48 + Math.cos(now * 2.4) * 0.32;
      const wave2 = 0.54 + Math.sin(now * 3.2) * 0.34;
      const wave3 = 0.42 + Math.cos(now * 2.8) * 0.26;
      const wave4 = 0.32 + Math.sin(now * 4.2) * 0.22;
      return [wave0, wave1, wave2, wave3, wave4];
    }

    return [
      Math.min(1.0, b0 * 1.3),
      Math.min(1.0, b1 * 1.2),
      Math.min(1.0, b2 * 1.15),
      Math.min(1.0, b3 * 1.2),
      Math.min(1.0, b4 * 1.3),
    ];
  }

  // --- Real-Time Multi-Station Synthesizer Engine ---

  private startSynthesizer(): void {
    this.stopSynthesizer();
    if (!this.ctx || !this.isEnabled || !this.isPlaying) return;

    this.currentStep = 0;
    const station = this.getCurrentStation();

    // Different BPM intervals based on station
    let stepMs = 125; // 120 BPM 16th note default
    if (station.id === 'kral_fm') {
      stepMs = 175; // 86 BPM (Deep, emotional Arabesk groove)
    } else if (station.id === 'power_turk') {
      stepMs = 117; // 128 BPM (Punchy Eurodance Pop)
    } else if (station.id === 'drift_fm') {
      stepMs = 107; // 140 BPM (Rapid makas drift phonk)
    } else if (station.id === 'trt_nostalji') {
      stepMs = 136; // 110 BPM (Groovy 70s Anadolu funk)
    }

    this.stepTimer = window.setInterval(() => {
      if (!this.ctx || !this.isPlaying || !this.isEnabled) return;
      this.tickSynthesizer(station.id);
      this.currentStep++;
    }, stepMs);
  }

  private stopSynthesizer(): void {
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private tickSynthesizer(stationId: string): void {
    if (!this.ctx || !this.outputNode) return;
    const t = this.ctx.currentTime;
    const step16 = this.currentStep % 16;
    const bar = Math.floor(this.currentStep / 16);

    switch (stationId) {
      case 'kral_fm':
        this.playKralFmStep(t, step16, bar);
        break;
      case 'power_turk':
        this.playPowerTurkStep(t, step16, bar);
        break;
      case 'drift_fm':
        this.playDriftFmStep(t, step16, bar);
        break;
      case 'trt_nostalji':
        this.playTrtNostaljiStep(t, step16, bar);
        break;
    }
  }

  // 1. KRAL FM (Damar Arabesk / Hicaz & Saz Scale)
  private playKralFmStep(t: number, step: number, bar: number): void {
    // Turkish Hicaz/Nihavend Scale Frequencies: D2, Eb2, F#2, G2, A2, Bb2, C3, D3
    const hicazBass = [73.42, 77.78, 92.50, 98.00]; // D2, Eb2, F#2, G2
    const sazMelody = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33]; // D4 to D5

    // Slow, deep acoustic-like kick & bass on steps 0, 6, 8, 12
    if (step === 0 || step === 8) {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      const bassFreq = hicazBass[bar % hicazBass.length];
      osc.frequency.setValueAtTime(bassFreq, t);
      osc.frequency.exponentialRampToValueAtTime(bassFreq * 0.9, t + 0.35);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      osc.connect(gain);
      gain.connect(this.outputNode!);
      osc.start(t);
      osc.stop(t + 0.35);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
    }

    // Acoustic Darbuka / Snare rimshot on step 4 and 12
    if (step === 4 || step === 12) {
      this.createSnareHit(t, 0.16, 680);
    }

    // Hicaz Bağlama / Keman lead note with micro-vibrato on odd steps
    if (step % 2 === 1 && Math.random() < 0.75) {
      const noteIdx = (step * 3 + bar) % sazMelody.length;
      const freq = sazMelody[noteIdx];

      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      // Gentle oriental pitch bend
      osc.frequency.linearRampToValueAtTime(freq * 1.015, t + 0.08);
      osc.frequency.linearRampToValueAtTime(freq, t + 0.20);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.value = 3.5;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode!);

      osc.start(t);
      osc.stop(t + 0.24);
      osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
    }
  }

  // 2. POWER TÜRK (128 BPM Eurodance Pop & Punchy Bass)
  private playPowerTurkStep(t: number, step: number, bar: number): void {
    const popChords = [65.41, 77.78, 87.31, 98.00]; // C2, Eb2, F2, G2
    const leadArp = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];

    // Four-on-the-floor Kick (steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      const kickOsc = this.ctx!.createOscillator();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(140, t);
      kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

      const kickGain = this.ctx!.createGain();
      kickGain.gain.setValueAtTime(0.40, t);
      kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      kickOsc.connect(kickGain);
      kickGain.connect(this.outputNode!);
      kickOsc.start(t);
      kickOsc.stop(t + 0.12);
      kickOsc.onended = () => { try { kickOsc.disconnect(); kickGain.disconnect(); } catch {} };
    }

    // Upbeat Hi-Hat (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      this.createHiHat(t, 0.06);
    }

    // Offbeat Eurodance Bassline (steps 2, 6, 10, 14)
    if (step % 2 === 1) {
      const chordIdx = Math.floor(bar % popChords.length);
      const bassOsc = this.ctx!.createOscillator();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(popChords[chordIdx], t);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(480, t);

      const bassGain = this.ctx!.createGain();
      bassGain.gain.setValueAtTime(0.24, t);
      bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(this.outputNode!);

      bassOsc.start(t);
      bassOsc.stop(t + 0.14);
      bassOsc.onended = () => { try { bassOsc.disconnect(); filter.disconnect(); bassGain.disconnect(); } catch {} };
    }

    // High Eurodance Arpeggiator Lead
    if (step % 2 === 0) {
      const note = leadArp[(step + bar * 2) % leadArp.length];
      const leadOsc = this.ctx!.createOscillator();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(note, t);

      const leadGain = this.ctx!.createGain();
      leadGain.gain.setValueAtTime(0.08, t);
      leadGain.gain.exponentialRampToValueAtTime(0.005, t + 0.16);

      leadOsc.connect(leadGain);
      leadGain.connect(this.outputNode!);

      leadOsc.start(t);
      leadOsc.stop(t + 0.16);
      leadOsc.onended = () => { try { leadOsc.disconnect(); leadGain.disconnect(); } catch {} };
    }
  }

  // 3. İSTANBUL PHONK / DRIFT FM (140 BPM Cowbells & Distorted 808 Sub)
  private playDriftFmStep(t: number, step: number, bar: number): void {
    // 808 Sub-bass with pitch glide on step 0 and 8
    if (step === 0 || step === 8) {
      const subOsc = this.ctx!.createOscillator();
      subOsc.type = 'sawtooth';
      const root = step === 0 ? 55 : 49; // A1 or G1
      subOsc.frequency.setValueAtTime(root * 1.5, t);
      subOsc.frequency.exponentialRampToValueAtTime(root, t + 0.08); // 808 pitch dive

      const subFilter = this.ctx!.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(180, t);

      const subGain = this.ctx!.createGain();
      subGain.gain.setValueAtTime(0.38, t);
      subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(this.outputNode!);

      subOsc.start(t);
      subOsc.stop(t + 0.32);
      subOsc.onended = () => { try { subOsc.disconnect(); subFilter.disconnect(); subGain.disconnect(); } catch {} };
    }

    // Memphis / Drift Phonk Cowbell rhythm (Syncope on 0, 3, 6, 9, 12, 14)
    const cowbellSteps = [0, 3, 6, 9, 12, 14];
    if (cowbellSteps.includes(step)) {
      const cowbellNotes = [587.33, 659.25, 783.99, 880.0]; // D5, E5, G5, A5
      const note = cowbellNotes[(step + bar) % cowbellNotes.length];

      // Dual square oscillators for authentic metal cowbell
      [note, note * 1.48].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);

        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.2, t);
        filter.Q.value = 6.0;

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.outputNode!);

        osc.start(t);
        osc.stop(t + 0.12);
        osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
      });
    }

    // Trap snare on step 4 and 12
    if (step === 4 || step === 12) {
      this.createSnareHit(t, 0.14, 1100);
    }
  }

  // 4. TRT NOSTALJİ (70s/80s Anadolu Rock & Groovy Psychedelic Funk)
  private playTrtNostaljiStep(t: number, step: number, bar: number): void {
    const anadoluBass = [65.41, 73.42, 82.41, 98.00]; // C2, D2, E2, G2

    // Funky bassline walk on 0, 3, 6, 8, 11, 14
    if (step % 3 === 0 || step === 8 || step === 14) {
      const bassOsc = this.ctx!.createOscillator();
      bassOsc.type = 'triangle';
      const root = anadoluBass[(bar + Math.floor(step / 4)) % anadoluBass.length];
      bassOsc.frequency.setValueAtTime(root, t);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(360, t);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.30, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

      bassOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode!);

      bassOsc.start(t);
      bassOsc.stop(t + 0.22);
      bassOsc.onended = () => { try { bassOsc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
    }

    // Wah-wah psychedelic synth guitar sweep on step 2, 6, 10
    if (step === 2 || step === 6 || step === 10) {
      const leadOsc = this.ctx!.createOscillator();
      leadOsc.type = 'sawtooth';
      leadOsc.frequency.setValueAtTime(220 * (1 + (bar % 3) * 0.25), t);

      const wahFilter = this.ctx!.createBiquadFilter();
      wahFilter.type = 'bandpass';
      wahFilter.Q.value = 5.0;
      wahFilter.frequency.setValueAtTime(450, t);
      wahFilter.frequency.exponentialRampToValueAtTime(2200, t + 0.14); // Wah opening
      wahFilter.frequency.exponentialRampToValueAtTime(600, t + 0.25);

      const wahGain = this.ctx!.createGain();
      wahGain.gain.setValueAtTime(0.12, t);
      wahGain.gain.exponentialRampToValueAtTime(0.005, t + 0.26);

      leadOsc.connect(wahFilter);
      wahFilter.connect(wahGain);
      wahGain.connect(this.outputNode!);

      leadOsc.start(t);
      leadOsc.stop(t + 0.26);
      leadOsc.onended = () => { try { leadOsc.disconnect(); wahFilter.disconnect(); wahGain.disconnect(); } catch {} };
    }
  }

  // Helper: Snare hit with noise + tone
  private createSnareHit(t: number, dur = 0.14, filterFreq = 800): void {
    if (!this.ctx || !this.outputNode) return;
    try {
      const count = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < count; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (count * 0.3));
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(filterFreq, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      source.start(t);
      source.stop(t + dur);
      source.onended = () => { try { source.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
    } catch {}
  }

  // Helper: Crisp closed hi-hat
  private createHiHat(t: number, dur = 0.05): void {
    if (!this.ctx || !this.outputNode) return;
    try {
      const count = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < count; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (count * 0.2));
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + dur);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      source.start(t);
      source.stop(t + dur);
      source.onended = () => { try { source.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
    } catch {}
  }
}

export const radioManager = RadioManager.getInstance();
