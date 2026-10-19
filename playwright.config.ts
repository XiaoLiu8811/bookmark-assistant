import { defineConfig } from '@playwright/test';

// Lets the network test see requests made by the extension's service worker, not just by pages.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.ts',
  workers: 1,
  reporter: 'list',
});
