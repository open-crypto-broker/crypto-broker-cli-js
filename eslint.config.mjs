import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/', '**/generated/', '**/node_modules/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
    
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        __VERSION__: 'readonly',
        __GIT_HASH__: 'readonly',
      },

      parserOptions: {
        project: './tsconfig.json',
      },
    },

    rules: {
      ...typescriptEslint.configs.recommended.rules,
      'prettier/prettier': 'error',
    },
  },
];
