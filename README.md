# TRAFFIC RUSH 🏎️💨

A complete, high-performance, mobile-first 3D endless traffic racing game built with **Three.js**, **TypeScript**, and **Vite**.

![Traffic Rush Game](public/favicon.svg)

---

## 🎮 Features

- **3 Dynamic Game Modes**:
  - 🚗 **Tek Yön (One-Way)**: Classic high-speed traffic dodging.
  - ⚡ **Çift Yön (Two-Way Traffic)**: Oncoming traffic in the left lanes! Crossing into oncoming traffic triggers **"TERS YÖN / WRONG WAY"** mode for massive extra cash (`+₺150/sec`) and score multipliers (`+500 pts/sec`).
  - ⏱️ **Zamana Karşı (Time Attack)**: Start with 80 seconds. Perform near-misses (`+3s`) and hit 1,000m checkpoints (`+10s`) to stay alive before the clock strikes zero!
- **4 Weather & Time-of-Day Presets**:
  - ☀️ **Gündüz (Day)**: Crisp natural sunlight, bright blue sky, and sharp directional shadows.
  - 🌅 **Günbatımı (Sunset Outrun)**: Dramatic purple-orange gradient sky, golden highway bounce, and warm synthwave tones.
  - 🌃 **Gece Şehri (Night City)**: Midnight blue sky, glowing streetlamps, illuminated skyscraper windows, and vibrant headlights/taillights.
  - 🌧️ **Yağmurlu (Rainy Neon)**: Dark stormy skies, animated falling rain particle streaks, and wet asphalt reflections.
- **3 Switchable Camera Perspectives**:
  - 🎥 **CHASE**: Classic third-person chase camera with steering tilt and dynamic FOV.
  - 🚘 **HOOD / DASH**: Positioned right on the front hood for intense speed immersion.
  - 🛣️ **BUMPER**: Ultra-low street level camera close to the asphalt for maximum velocity sensation.
  - *Switch views instantly with the `C` key or the in-game HUD camera button.*
- **Mobile Tilt / Gyroscope Steering**:
  - Steer your vehicle naturally by tilting your phone like a real steering wheel (`DeviceOrientation` API)!
  - Easily toggle between on-screen touch buttons and tilt controls in the menu.
- **Visual Polish & Juice**:
  - Realistic white tire smoke on hard braking or high-speed drifting.
  - Fiery exhaust backfire sparks and popping audio on nitro release or sudden deceleration.
  - Screen shake and 3D car debris explosions on crashes.
- **Arcade Driving Physics**: Responsive steering, acceleration, braking, lateral drift, and body roll/lean tilt.
- **Intelligent Traffic AI**: Object-pooled traffic vehicles (Sedans, SUVs, Compacts, and Trucks) with lane-following, opposite-direction travel, and safety spacing AI.
- **Near-Miss Combo System**: Pass close to traffic vehicles at high speed to trigger combo multipliers (`x1`, `x2`, `x3`, `x4`...), bonus cash, and sparkling popups.
- **Nitro Boost**: Hit nitro for high-speed acceleration, dynamic camera FOV widening, speed streak particles, and roaring thruster flames.
- **Vehicle Garage & Shop**:
  - 5 Original Vehicles: *Viper GT-X* (Starter Coupe), *Apex Horizon* (Sport), *Titan Vanguard* (Heavy SUV), *Monarch Royale* (Luxury Grand Tourer), and *Phantom Hyperion* (Hypercar).
  - 6 Upgrade Categories: Engine, Top Speed, Acceleration, Handling, Brakes, and Nitro (Up to Level 5 each).
  - Custom Paint Shop: Real-time car color customization on a 3D rotating turntable.
- **Progression & Missions**: Earn XP, level up, unlock vehicles, and complete challenges for cash bounties.
- **Web Audio API Sound Engine**: Zero-asset procedural audio synthesis — pitch-shifting combustion engine, tire screeches, near-miss dings, nitro roar, exhaust backfires, checkpoint fanfares, crash explosions, and an arcade synthwave soundtrack.
- **Persistent Save System**: Versioned `localStorage` saving your cash, cars, upgrades, paint colors, high scores, control type, and game settings.

---

## 🕹️ Controls

### Desktop Keyboard:
- **Accelerate**: `W` or `Up Arrow`
- **Brake / Reverse**: `S` or `Down Arrow`
- **Steer Left**: `A` or `Left Arrow`
- **Steer Right**: `D` or `Right Arrow`
- **Nitro Boost**: `Spacebar`
- **Change Camera View**: `C`
- **Pause**: `ESC` or `P`

### Mobile Touch & Gyro:
- **Steering**:
  - **Button Mode**: Large thumb buttons on the bottom-left (`◀` and `▶`).
  - **Jiroskop Mode**: Tilt your smartphone left and right like a steering wheel!
- **Gas / Brake**: Large pedal thumb buttons on the bottom-right (`▲` and `▼`).
- **Nitro Boost**: Dedicated glowing cyan boost button (`⚡ NITRO`).
- **Camera Switch**: Dedicated `🎥` camera button in the top HUD bar.

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Run Development Server (Accessible via Localhost & Wi-Fi)
```bash
npm run dev
```
- Open on desktop: **`http://localhost:5173`**
- Open on mobile (same Wi-Fi): **`http://192.168.1.5:5173`**

### Production Build
```bash
npm run build
```
Generates an optimized, lightweight production bundle in `dist/`.
