/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#131316',
        theme_color: '#131316',
        categories: ['productivity', 'lifestyle', 'health'],
        // Android: Share → Personal OS opens /share, which saves it to the Inbox (build.md F4).
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
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
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
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
