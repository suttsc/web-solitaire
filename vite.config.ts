import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    tailwindcss(),
    cloudflare(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg', 'cards/*.svg'],
      manifest: {
        name: 'Solitaire',
        short_name: 'Solitaire',
        description: 'Klondike solitaire. No ads, works offline.',
        theme_color: '#14532d',
        background_color: '#1d6b3a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Leaderboards and global stats still show their last known values offline.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/leaderboard') || url.pathname.startsWith('/api/stats'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-reads', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
});
