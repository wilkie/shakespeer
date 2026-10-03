import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import base from './base.js';

const require = createRequire(import.meta.url);

/**
 * Shared Jest config for React packages: jsdom, static-asset stubs and CSS module proxies.
 *
 * @type {import('jest').Config}
 */
const react = {
  ...base,
  testEnvironment: fileURLToPath(new URL('./environment-jsdom.js', import.meta.url)),
  moduleNameMapper: {
    '\\.module\\.css$': require.resolve('identity-obj-proxy'),
    '\\.css$': fileURLToPath(new URL('./stubs/style.cjs', import.meta.url)),
    '\\.(svg|png|jpe?g|gif|webp|avif|woff2?)(\\?.*)?$': fileURLToPath(
      new URL('./stubs/file.cjs', import.meta.url),
    ),
  },
};

export default react;
