import { defineConfig } from 'vitest/config';

export default defineConfig({
  pool: 'forks',
  poolOptions: {
    forks: {
      isolate: true,
    },
  },
  testTimeout: 10000,
});
