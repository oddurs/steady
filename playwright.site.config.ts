import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/site',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4180/steady/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm --prefix site run preview -- --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/steady/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
