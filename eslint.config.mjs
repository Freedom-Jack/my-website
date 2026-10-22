// ESLint (flat config): Next.js's rules (React, hooks, accessibility, Core Web Vitals) and TypeScript's, everywhere.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import globals from 'globals';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
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
    // the landscape engine (strict TypeScript, ported from demo 4b): a parameter its caller passes but it does not
    // read is named _x, as tsc's noUnusedParameters accepts
    files: ['src/features/landscape/engine/**/*.ts'],
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
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
