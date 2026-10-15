import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'worker/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'src/app/**', 'src/data/**', 'shared/**', 'worker/**'],
      exclude: ['**/*.test.ts', 'src/engine/test-helpers.ts', 'worker/test/**'],
    },
  },
});
