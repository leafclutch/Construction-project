import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { APP_NAME } from './src/lib/appName.ts'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own service worker (src/sw.ts) because it also shows push notifications.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The app shows "New version ready · Reload" instead of swapping code under the person.
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Site records for thekedars: labour, materials, VAT bills, BOQ, steel and drawings.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#ffffff',
        background_color: '#eceeea',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add labour', url: '/?add=labour', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Add material', url: '/?add=materials', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
  test: {
    // Integration tests in tests/ need the non-VITE_ secret too.
    env: loadEnv(mode, process.cwd(), ''),
    // They talk to the hosted project; an Edge Function cold start alone can take a few seconds.
    testTimeout: 20_000,
  },
}))
