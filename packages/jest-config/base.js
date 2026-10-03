import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Shared Jest config for TypeScript packages running in Node.
 *
 * Tests run as native ES modules (packages must run Jest with `--experimental-vm-modules`,
 * see each package's `test` script), so ESM-only dependencies need no special handling.
 * Consequences: import test APIs from `@jest/globals`, and mock modules with
 * `jest.unstable_mockModule` + dynamic `import()` instead of hoisted `jest.mock`.
 *
 * TypeScript is transpiled by SWC (fast, no type-checking — that's `pnpm typecheck`'s job).
 *
 * @type {import('jest').Config}
 */
const base = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.tsx?$': [
      require.resolve('@swc/jest'),
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2023',
          // Keep `with { type: 'json' }` so JSON modules load natively.
          experimental: { keepImportAttributes: true },
        },
        module: { type: 'es6' },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/*.test.{ts,tsx}'],
  coverageReporters: ['text-summary', 'lcov'],
  clearMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
};

export default base;
