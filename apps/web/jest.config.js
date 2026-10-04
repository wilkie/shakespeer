import react from '@shakespeer/jest-config/react';

/** @type {import('jest').Config} */
export default {
  ...react,
  displayName: '@shakespeer/web',
  // Reader tests render whole plays and wait up to 30 s for the first load on slow CI runners.
  testTimeout: 60000,
  setupFiles: ['fake-indexeddb/auto'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    ...react.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
