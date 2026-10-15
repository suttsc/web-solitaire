import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'worker/**'],
      exclude: ['**/*.test.ts', 'src/engine/test-helpers.ts'],
    },
  },
});
