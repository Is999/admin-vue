import type { OxlintConfig } from 'oxlint';

import { fileURLToPath } from 'node:url';

const commentsPlugin = fileURLToPath(
  import.meta.resolve('@eslint-community/eslint-plugin-eslint-comments'),
);

const comments: OxlintConfig = {
  jsPlugins: [
    {
      name: 'eslint-comments',
      specifier: commentsPlugin,
    },
  ],
  rules: {
    'eslint/no-underscore-dangle': 'off',
    'eslint-comments/no-aggregating-enable': 'error',
    'eslint-comments/no-duplicate-disable': 'error',
    'eslint-comments/no-unlimited-disable': 'error',
    'eslint-comments/no-unused-enable': 'error',
  },
};

export { comments };
