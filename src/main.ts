// TRAFFIC RUSH - Main Entry Point

import './style.css';
import { Game } from './core/Game';
import { gameState } from './core/GameState';
import { inputManager } from './player/InputManager';
import { setupOrientationAutoLock } from './utils/orientation';
import { multiplayerManager } from './network/MultiplayerManager';

function initGame() {
  try {
    setupOrientationAutoLock();
    const game = new Game();
    (window as any).__TRAFFIC_RUSH_GAME__ = game;
    (window as any).game = game;
    (window as any).gameState = gameState;
    (window as any).playerVehicle = (game as any).playerVehicle;
    (window as any).inputManager = inputManager;
    (window as any).multiplayerManager = multiplayerManager;
    console.log('🏎️ TRAFFIC RUSH initialized successfully!');
  } catch (err) {
    console.error('Failed to initialize TRAFFIC RUSH game:', err);
  }
}

// Prevent mobile browser text selection, magnifying loupe, and long-press callouts
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
