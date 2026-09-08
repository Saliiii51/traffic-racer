/**
 * Mobile Screen Orientation & Forced Landscape Manager
 * Ensures the game ALWAYS runs in landscape mode on mobile:
 * 1. Automatically locks native screen orientation to landscape via Fullscreen + ScreenOrientation API.
 * 2. If held vertically (portrait) or on browsers without native orientation lock (like iOS Safari),
 *    automatically rotates the game viewport 90 degrees with exact pixel geometry.
 */

let onOrientationChangeCallback: (() => void) | null = null;

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
  const hasTouch = Boolean(('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  const isSmallScreen = Math.min(window.screen.width, window.screen.height) <= 900;

  return Boolean(isMobileUA || (hasTouch && isSmallScreen));
}

export function isPortraitMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const isPortrait = window.innerHeight > window.innerWidth;
  const isSmallOrTouch =
    isMobileDevice() ||
    window.innerWidth <= 1024 ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  return isPortrait && isSmallOrTouch;
}

export function updateForcedLandscape(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const shouldForce = isPortraitMobile();
  const gameContainer = document.getElementById('game-container');

  if (shouldForce) {
    document.body.classList.add('forced-landscape');
    const longSide = Math.max(window.innerWidth, window.innerHeight);
    const shortSide = Math.min(window.innerWidth, window.innerHeight);

    document.documentElement.style.setProperty('--app-long', `${longSide}px`);
    document.documentElement.style.setProperty('--app-short', `${shortSide}px`);

    if (gameContainer) {
      gameContainer.style.position = 'absolute';
      gameContainer.style.width = `${longSide}px`;
      gameContainer.style.height = `${shortSide}px`;
      gameContainer.style.top = '0px';
      gameContainer.style.left = `${shortSide}px`;
      gameContainer.style.transform = 'rotate(90deg)';
      gameContainer.style.transformOrigin = '0 0';
      gameContainer.style.overflow = 'hidden';
    }
  } else {
    document.body.classList.remove('forced-landscape');

    if (gameContainer) {
      gameContainer.style.position = '';
      gameContainer.style.width = '';
      gameContainer.style.height = '';
      gameContainer.style.top = '';
      gameContainer.style.left = '';
      gameContainer.style.transform = '';
      gameContainer.style.transformOrigin = '';
      gameContainer.style.overflow = '';
    }
  }

  return shouldForce;
}

export async function requestNativeLandscapeLock(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const docEl = document.documentElement as any;
  const requestFs =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;

  // 1. Immediately request fullscreen synchronously within the user gesture (Required on Chrome for Android)
  if (requestFs && !document.fullscreenElement && !(document as any).webkitFullscreenElement) {
    try {
      await requestFs.call(docEl);
    } catch {
      // Ignored if user gesture expired or not supported (e.g. iOS)
    }
  }

  // 2. Lock screen orientation to landscape
  try {
    const orientation = window.screen?.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
      return true;
    } else if ((window.screen as any).lockOrientation) {
      return (window.screen as any).lockOrientation('landscape');
    } else if ((window.screen as any).mozLockOrientation) {
      return (window.screen as any).mozLockOrientation('landscape');
    } else if ((window.screen as any).msLockOrientation) {
      return (window.screen as any).msLockOrientation('landscape');
    }
  } catch {
    // Handled gracefully via CSS forced landscape
  }

  return false;
}

export function setupOrientationAutoLock(onResize?: () => void): void {
  if (typeof window === 'undefined') return;

  if (onResize) {
    onOrientationChangeCallback = onResize;
  }

  const triggerUpdate = () => {
    updateForcedLandscape();
    if (onOrientationChangeCallback) {
      onOrientationChangeCallback();
    }
  };

  // Run immediately
  triggerUpdate();

  // Attempt lock on boot
  if (isMobileDevice()) {
    requestNativeLandscapeLock().catch(() => {});
  }

  // Bind to any user touch or pointer interaction
  const handleInteraction = () => {
    if (isMobileDevice()) {
      requestNativeLandscapeLock().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', handleInteraction, { passive: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true });
  window.addEventListener('click', handleInteraction, { passive: true });

  // Orientation & resize observers
  window.addEventListener('resize', triggerUpdate);
  window.addEventListener('orientationchange', () => {
    triggerUpdate();
    setTimeout(triggerUpdate, 120);
    setTimeout(triggerUpdate, 350);
  });

  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener('change', () => {
      triggerUpdate();
      setTimeout(triggerUpdate, 120);
      setTimeout(triggerUpdate, 350);
    });
  }

  document.addEventListener('fullscreenchange', triggerUpdate);
  document.addEventListener('webkitfullscreenchange', triggerUpdate);
}
