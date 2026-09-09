import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let sharedDracoLoader: DRACOLoader | null = null;

/**
 * Returns a shared singleton DRACOLoader instance configured with offline local WASM decoders.
 * Reusing a single DRACOLoader across all GLTF loaders allows worker pool sharing and prevents
 * multiple redundant WASM compilation passes in memory.
 */
export function getSharedDracoLoader(): DRACOLoader {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('/draco/gltf/');
    sharedDracoLoader.setDecoderConfig({ type: 'wasm' });
    try {
      sharedDracoLoader.preload();
    } catch (e) {
      console.warn('[DracoLoaderHelper] Failed to preload Draco workers:', e);
    }
  }
  return sharedDracoLoader;
}
