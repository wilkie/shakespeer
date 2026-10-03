import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { base } from './base.js';

/**
 * Base config plus React, hooks (including React Compiler rules), a11y and Vite HMR rules.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function react({ tsconfigRootDir }) {
  return defineConfig(
    base({ tsconfigRootDir }),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [
        reactHooks.configs.flat['recommended-latest'],
        reactRefresh.configs.vite,
        jsxA11y.flatConfigs.strict,
      ],
      languageOptions: {
        globals: globals.browser,
      },
    },
    {
      files: ['*.config.{js,ts}'],
      languageOptions: {
        globals: globals.node,
      },
    },
  );
}

export default react;
