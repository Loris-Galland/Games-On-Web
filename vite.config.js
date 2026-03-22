import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        {
            name: 'debug-plugin',
            buildStart() {
                console.log('✅ vite.config.js bien chargé !');
            }
        }
    ],
    optimizeDeps: {
        exclude: ['recast-detour']
    },
    server: {
        fs: {
            allow: ['.']
        }
    }
});