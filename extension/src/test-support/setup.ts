import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test-support/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});