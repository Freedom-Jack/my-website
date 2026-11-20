// ESLint (flat config): Next.js's rules (React, hooks, accessibility, Core Web Vitals) and TypeScript's, everywhere.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      '.claude/**', // (Claude Code's own worktrees and settings: not the site's code)
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    // the landscape engine names a parameter its caller passes but it does not read _x, as tsc's noUnusedParameters
    // accepts
    files: ['src/features/landscape/engine/**/*.ts'],
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
  {
    // the browser tests read the engine's free-form stats()
    files: ['tests/e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
