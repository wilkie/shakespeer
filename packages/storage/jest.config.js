import base from '@shakespeer/jest-config/base';

/** @type {import('jest').Config} */
export default {
  ...base,
  displayName: '@shakespeer/storage',
  setupFiles: ['fake-indexeddb/auto'],
};
