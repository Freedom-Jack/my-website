import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests (tests/e2e): a smoke test per route, the hard rules on the rendered pages, the navigation, and the
 * DESIGN §6 budgets. They run against the production build (`npm run build` with NEXT_PUBLIC_INK_QA=1, which adds
 * only the painting's read-only debug handle), served by `next start`.
 * Locally the system Chrome is used (no browser download); in CI, Playwright's own Chromium.
 */
const PORT = Number(process.env.PORT || 3100);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: ci ? 2 : 4,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...(ci ? {} : { channel: 'chrome' }),
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        ...(ci ? {} : { channel: 'chrome' }),
      },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
