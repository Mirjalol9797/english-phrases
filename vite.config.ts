import { fileURLToPath, URL } from 'node:url'
// defineConfig из vitest/config — та же настройка Vite плюс раздел test.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Относительный base: собранное приложение работает из любой папки
  // (GitHub Pages, Netlify, локальный сервер). Роутер использует hash-режим.
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Иконки из манифеста плагин кладёт в кэш сам, здесь — остальное из public.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'English Phrases',
        short_name: 'Phrases',
        description: 'Изучение английских фраз по урокам с повторением',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f5f9',
        theme_color: '#f3f5f9',
        icons: [
          // Фон у иконок во всю площадь, содержимое в безопасной зоне,
          // поэтому один набор годится и как обычная иконка, и как maskable.
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Главы занимают около 470 КБ — без них офлайн бесполезен.
        // Из шрифтов кладём только woff2: woff нужен браузерам, которых уже нет.
        globPatterns: ['**/*.{js,css,html,ico,woff2}', 'data/**/*.json'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Проверяется чистая логика: экраны и браузерное окружение не нужны.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
})
