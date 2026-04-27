import { defineConfig, devices } from '@playwright/test';

/** Dedicated port so tests never attach to a random app already bound to 4173 (reuseExistingServer + wrong process). */
const E2E_PREVIEW_PORT = 4287;
const e2eBase = `http://127.0.0.1:${E2E_PREVIEW_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || e2eBase,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${E2E_PREVIEW_PORT} --strictPort --host 127.0.0.1`,
        url: e2eBase,
        // Only reuse if you intentionally point another preview at the same port (e.g. parallel manual runs)
        reuseExistingServer: process.env.PW_REUSE_E2E_SERVER === '1',
        timeout: 120000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
