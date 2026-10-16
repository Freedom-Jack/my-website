import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests: the content files and their schemas, the rules (GitHub, compliance, typography, places) and the
// landscape engine's pure parts. Browser behaviour is Playwright's (tests/e2e).
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
