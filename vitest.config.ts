import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup/noNetwork.ts'],
    exclude: ['node_modules/**', 'dist/**', 'supabase/functions/**']
  }
});