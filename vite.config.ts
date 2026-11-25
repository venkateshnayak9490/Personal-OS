/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function productionHeaders(): Record<string, string> {
  const cfg = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = cfg.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
  return Object.fromEntries(
    all.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]),
  );
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = a new version waits until the user taps "Reload" (never reloads mid-edit).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png', 'theme-init.js'],
      manifest: {
        id: '/',
        name: 'Personal OS',
        short_name: 'Personal OS',
        description: 'Your personal workspace for work, research, health and life.',
        start_url: '/', // the app icon opens Today: today's work first, on phone and desktop
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f151c',
        theme_color: '#0a0f15',
        categories: ['productivity', 'lifestyle', 'health'],
        // Android: Share → Personal OS opens /share, which saves it to the Inbox (build.md F4).
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        // Long press the app icon: the four most frequent actions (handled by LaunchActions).
        shortcuts: [
          { name: 'New task', url: '/?do=task', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'I’m up', url: '/?do=wake', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          {
            name: 'Start workout',
            url: '/?do=workout',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          { name: 'Search', url: '/?do=search', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
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
        // Only precache the Latin font subsets; others still load on demand via unicode-range.
        globIgnores: [
          '**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
          '**/bricolage-grotesque-vietnamese-*.woff2',
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Push notifications: show them, and open the right page on click (public/push-sw.js).
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The built app is previewed (and end-to-end tested) with the same security headers as on Vercel,
  // so a blocked request or script shows up in tests, not only in production.
  preview: { headers: productionHeaders() },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    alias: {
      // The PWA plugin's virtual module only exists in real builds.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
});
