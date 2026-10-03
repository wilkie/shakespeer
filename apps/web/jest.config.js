import react from '@shakespeer/jest-config/react';

/** @type {import('jest').Config} */
export default {
  ...react,
  displayName: '@shakespeer/web',
  setupFiles: ['fake-indexeddb/auto'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    ...react.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
