import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,tsx}', 'scripts/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/**/*.e2e.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 30000, // 30 seconds for WebSocket tests
    hookTimeout: 30000, // 30 seconds for setup/teardown hooks
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
      plugins: [react()],
      test: {
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
        exclude: ['src/**/*.e2e.test.ts'],
        setupFiles: ['src/__tests__/setup.ts'],
        testTimeout: 30000, // 30 seconds for WebSocket tests
        hookTimeout: 30000, // 30 seconds for setup/teardown hooks
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
        },
      },
    },
    {
      name: 'node',
      test: {
        environment: 'node',
        include: ['scripts/**/*.{test,spec}.{js,ts}'],
        testTimeout: 30000, // 30 seconds for WebSocket tests
        hookTimeout: 30000, // 30 seconds for setup/teardown hooks
      },
    },
  ],
});
