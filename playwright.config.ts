import { defineConfig, devices } from '@playwright/test';

/** Dedicated port so tests never attach to a random app already bound to 4173 (reuseExistingServer + wrong process). */
const E2E_PREVIEW_PORT = 4287;
const e2eBase = `http://127.0.0.1:${E2E_PREVIEW_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 2 workers: GitHub-hosted runners have 4 vCPUs; a single worker made the
  // full suite outgrow the e2e job's 45-minute budget.
  workers: process.env.CI ? 2 : undefined,
  // Self-terminate before the job's 45-minute timeout-minutes: a Playwright
  // "globalTimeout" exit is a job FAILURE (absorbed by continue-on-error),
  // whereas a runner-cancelled job poisons the whole workflow run as
  // "cancelled". See issue #65.
  globalTimeout: process.env.CI ? 35 * 60 * 1000 : undefined,
  timeout: process.env.CI ? 90_000 : 60_000,
  // CI reporters:
  //  - line:   per-test progress, so a timeout is not a silent 45-minute log.
  //  - github: emits ::error:: annotations carrying the actual assertion
  //            message + file/line. Without it the log ends at "1 failed"
  //            with no reason, and the only copy of the error lives in the
  //            HTML report — which the workflow did not upload, making E2E
  //            failures undiagnosable from CI alone.
  //  - html:   full report (uploaded as an artifact on failure).
  reporter: process.env.CI ? [['line'], ['github'], ['html', { open: 'never' }]] : 'html',
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
        timeout: 180000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
