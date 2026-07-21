import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service Worker vorerst abgeschaltet: dieser SW entfernt sich bei allen bestehenden
      // Besuchern selbst und leert die Caches → Schluss mit halb-gecachten Seiten (weiß/nur Text).
      // Die Seite lädt dann wie eine normale Website. PWA kann später sauber reaktiviert werden.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bachata Steps',
        short_name: 'Steps',
        description: 'Bachata Moves & Combos verwalten, üben und teilen',
        lang: 'de',
        display: 'standalone',
        theme_color: '#0f0f12',
        background_color: '#0f0f12',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // HTML is NOT precached: navigations go network-first so a new deploy is
        // always picked up (no stale index referencing deleted asset hashes = no white screen).
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'yt-thumbs', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /\.b-cdn\.net\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'cdn-media', expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'supabase-thumbs' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
