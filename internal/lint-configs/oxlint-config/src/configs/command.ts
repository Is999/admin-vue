import type { OxlintConfig } from 'oxlint';

import { fileURLToPath } from 'node:url';

const commandPlugin = fileURLToPath(
  import.meta.resolve('eslint-plugin-command'),
);

const command: OxlintConfig = {
  jsPlugins: [
    {
      name: 'command',
      specifier: commandPlugin,
    },
  ],
  rules: {
    'command/command': 'error',
  },
};

export { command };
