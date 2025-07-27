import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,tsx}', 'scripts/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/**/*.e2e.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // Use project configuration instead of environmentMatchGlobs
  projects: [
    {
      name: 'browser',
      test: {
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
        exclude: ['src/**/*.e2e.test.ts'],
        setupFiles: ['src/__tests__/setup.ts'],
      },
    },
    {
      name: 'node',
      test: {
        environment: 'node',
        include: ['scripts/**/*.{test,spec}.{js,ts}'],
      },
    },
  ],
});
