import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import jest from 'eslint-plugin-jest';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Type-aware TypeScript config shared by every package.
 * Consumers must call it with their package directory so the TS project service resolves.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function base({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(['dist/', 'coverage/', '**/*.d.ts']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        // Conflicts with strict's no-non-null-assertion (one demands `!`, the other forbids it).
        '@typescript-eslint/non-nullable-type-assertion-style': 'off',
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
      extends: [jest.configs['flat/recommended'], jest.configs['flat/style']],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        'jest/unbound-method': 'error',
      },
    },
    // Must stay last: turns off stylistic rules that conflict with Prettier.
    prettier,
  );
}

export default base;
