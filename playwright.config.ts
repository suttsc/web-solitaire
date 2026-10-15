import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (app + Worker + local D1) via `vite preview`.
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's download.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'pixel', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command:
      'npm run db:migrate:local && npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
