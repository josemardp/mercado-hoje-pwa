import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'

const manifest: Partial<ManifestOptions> = {
  id: '/mercado-hoje-pwa/',
  name: 'Meu Diário',
  short_name: 'Meu Diário',
  lang: 'pt-BR',
  description: 'Compras, rotina e agenda do seu dia a dia',
  orientation: 'portrait',
  categories: ['shopping', 'utilities'],
  start_url: '/mercado-hoje-pwa/',
  display: 'standalone',
  background_color: '#FBF3E6',
  theme_color: '#FBF3E6',
  shortcuts: [
    {
      name: 'Adicionar item',
      short_name: 'Adicionar',
      description: 'Abre o app com o campo de novo item pronto para digitar',
      url: '/mercado-hoje-pwa/?action=add-item',
      icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
    {
      name: 'Rotina',
      short_name: 'Rotina',
      description: 'Abre direto na aba Rotina',
      url: '/mercado-hoje-pwa/?tab=rotina',
      icons: [{ src: 'icons/rotina-icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
  icons: [
    {
      src: 'icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    // ITEM 11: Maskable icons for Android adaptive icons
    {
      src: 'icons/icon-192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: 'icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

export default defineConfig({
  base: '/mercado-hoje-pwa/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not 'autoUpdate') so a new version waits for the user to
      // confirm via the in-app banner instead of silently swapping assets
      // underneath an open session.
      registerType: 'prompt',
      base: '/mercado-hoje-pwa/',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest,
      workbox: {
        cleanupOutdatedCaches: true,
        // Deliberately NOT skipWaiting/clientsClaim: with registerType
        // 'prompt', the new worker must stay in "waiting" until the user
        // taps "Atualizar" (updateServiceWorker(true) sends the skip-
        // waiting message itself) — setting these here would activate it
        // immediately and the update banner would never have anything to
        // offer.
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('dexie')) return 'dexie';
        },
      },
    },
  },
  server: {
    host: true,
  },
})
