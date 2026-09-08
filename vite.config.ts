import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.fbx', '**/*.dds'],
  server: {
    host: true,
    watch: {
      ignored: ['**/public/models/**', '**/*.glb', '**/*.gltf'],
    },
  },
});
