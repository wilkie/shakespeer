import base from '@shakespeer/jest-config/base';

/** @type {import('jest').Config} */
export default {
  ...base,
  displayName: '@shakespeer/corpus',
  testMatch: ['<rootDir>/{src,ingest}/**/*.test.ts'],
};
