import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.fbx', '**/*.dds'],
  server: {
    host: true,
    watch: {
      ignored: ['**/public/models/**', '**/*.glb', '**/*.gltf'],
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
        },
      },
    },
  },
});
