import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/German-Quiz/',
  test: {
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
