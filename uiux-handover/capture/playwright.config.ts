import { defineConfig, devices } from '@playwright/test';

/**
 * Screenshot capture for the UI/UX handover (not part of the app or its tests).
 * Runs against the real production build (same server as the e2e tests), in a fresh browser profile
 * seeded with sample data through the UI.
 */
export default defineConfig({
  testDir: '.',
  timeout: 40 * 60_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', timezoneId: 'Asia/Kolkata', channel: 'chrome', actionTimeout: 15_000 },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    cwd: '../..',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
