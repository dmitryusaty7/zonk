import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'textures/*.png', 'icons/*.png', 'favicon.ico'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'ЗОНК — Золото Южных Морей',
        short_name: 'ЗОНК',
        description: 'Счёт для игры в кости ЗОНК. Пиратская Бухта Южных Морей.',
        lang: 'ru',
        theme_color: '#070d10',
        background_color: '#070d10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['games', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Туннели приходят с чужим Host — Vite такие запросы блокирует по умолчанию.
  // Разрешаем домены quick-туннелей Cloudflare, чтобы Telegram мог открыть приложение.
  server: { port: 5173, host: true, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4173, host: true, allowedHosts: ['.trycloudflare.com'] },
})
