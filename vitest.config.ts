import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,tsx}', 'scripts/**/*.{test,spec}.{js,ts,tsx}', 'docker/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist'],
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
      },
    },
    {
      name: 'node',
      test: {
        environment: 'node',
        include: ['scripts/**/*.{test,spec}.{js,ts}', 'docker/**/*.{test,spec}.{js,ts}'],
      },
    },
  ],
});
