// ESLint (flat config): Next.js's rules (React, hooks, accessibility, Core Web Vitals) and TypeScript's.
// The landscape engine (src/features/landscape/engine, plain JavaScript ported as-is from demo 4b) is linted for
// real errors only; its style is the demo's, reviewed there.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import globals from 'globals';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'legacy-v1/**',
      'design-demo/**',
      'public/**',
      'next-env.d.ts',
      'test-results/**',
      'playwright-report/**',
      // the demo's own probe, copied verbatim and evaluated in the page as a string (one bare function expression)
      'tests/e2e/support/measure.js',
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/features/landscape/engine/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['tools/**/*.ts', 'tests/**/*.ts', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // the browser tests read the demo probe's free-form JSON measurements
    files: ['tests/e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
