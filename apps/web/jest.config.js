import react from '@shakespeer/jest-config/react';

/** @type {import('jest').Config} */
export default {
  ...react,
  displayName: '@shakespeer/web',
  // Reader tests render whole plays and wait up to 10 s for them; leave room under load.
  testTimeout: 20000,
  setupFiles: ['fake-indexeddb/auto'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    ...react.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
