import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        {
            name: 'debug-plugin',
            buildStart() {
                console.log('vite.config.js chargé');
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