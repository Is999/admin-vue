import { defineConfig } from '@vben/oxlint-config';

export default defineConfig({
  rules: {
    'typescript/no-non-null-assertion': 'off',
    'vitest/no-conditional-expect': 'off',
  },
});
