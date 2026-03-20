import { defineConfig, devices } from '@playwright/test';

/**
 * Local E2E: records a full-site walkthrough video.
 * Run: npm run test:e2e
 * Video output: test-results/ (see playwright-report/ after run)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 15 * 60 * 1000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'off',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    // Reuse if something is already on 5173 (common when dev server runs in another terminal).
    // Set PLAYWRIGHT_FORCE_NEW_SERVER=1 in CI if you need a fresh server every time.
    reuseExistingServer: !process.env.PLAYWRIGHT_FORCE_NEW_SERVER,
    timeout: 120_000,
  },
});
