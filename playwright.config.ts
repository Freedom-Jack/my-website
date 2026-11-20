import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests (tests/e2e): a smoke test per route with the hard rules on the rendered pages, the band (the painting
 * and its still), the travel between pages, "Ask the painting", the three live pieces on their case pages, axe, the
 * tap targets, the contrast of the words set on the painting, and the résumé's print. They run against the QA build
 * (`next build` with NEXT_PUBLIC_INK_QA=1, which exposes the painting's debug handle), served by `next start`.
 * Locally the system Chrome is used (no browser download); in CI, Playwright's own Chromium.
 * An already running server is reused, locally and in CI, where the workflow serves the build before the PDF, hard
 * rules and links steps; the tests start one themselves only when nothing answers on the port.
 *
 *   PORT           the server's port (3100)
 *   NEXT_DIST_DIR  the build's folder, when it is not .next (next.config.ts reads it): a run beside a served build
 *                  builds into its own, e.g.
 *                  NEXT_DIST_DIR=.next-tests NEXT_PUBLIC_INK_QA=1 npx next build && PORT=3120 NEXT_DIST_DIR=.next-tests npm run test:e2e
 *   ASK_MODEL=1    also run the test that fetches the 38 MB sentence-embedding model (ask.spec.ts)
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
      },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    // (the server it starts serves the same build the run was pointed at, with the QA handle on)
    env: {
      NEXT_PUBLIC_INK_QA: '1',
      ...(process.env.NEXT_DIST_DIR ? { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR } : {}),
    },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
