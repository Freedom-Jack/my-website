import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests (tests/unit, in Node): the content and its schemas, the hard rules, and the pure logic of the site and
// the painting. Browser behaviour is Playwright's (tests/e2e).
export default defineConfig({
  resolve: {
    alias: {
      '@content': path.resolve(import.meta.dirname, 'content'),
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/unit/server-only-stub.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
