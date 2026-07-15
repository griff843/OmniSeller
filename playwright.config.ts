import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: process.env.CI ? [
    { command: 'pnpm --filter api start', url: 'http://127.0.0.1:3001/health/live', reuseExistingServer: false, timeout: 120_000 },
    { command: 'pnpm --filter web dev', url: 'http://127.0.0.1:3000/login', reuseExistingServer: false, timeout: 120_000 },
  ] : undefined,
});
