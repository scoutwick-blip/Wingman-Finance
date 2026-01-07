
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'icon.svg'],
      manifest: {
        short_name: "Wingman",
        name: "Wingman Finance",
        icons: [
          {
            src: "/icon.svg",
            type: "image/svg+xml",
            sizes: "192x192"
          },
          {
            src: "/icon.svg",
            type: "image/svg+xml",
            sizes: "512x512"
          }
        ],
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#003087",
        background_color: "#f1f5f9",
        orientation: "portrait"
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ],
  define: {
    // This allows the app to access the API key safely during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
