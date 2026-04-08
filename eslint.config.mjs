import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    rules: {
      'no-useless-assignment': 'off',
      'perfectionist/sort-named-imports': 'off',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['**/cspell.json', '**/.cspell.json'],
    rules: {
      'jsonc/sort-array-values': 'off',
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      'jsonc/sort-keys': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-no-unused-catalog-item': 'off',
    },
  },
]);
