import { defineConfig, devices } from '@playwright/test';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch {
  // В CI переменные авторизации передаются окружением без локального .env.
}

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '3000';
const isolatedServer = process.env.PLAYWRIGHT_PORT !== undefined;
const baseURL = `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${playwrightPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !isolatedServer,
  },
});
