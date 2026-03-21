import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/YAML-Trivia-Engine/',
  test: {
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
