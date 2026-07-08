import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const trackedEnvPaths = [
  '.env',
  '.env.analyze',
  '.env.development',
  '.env.production',
].map((name) => resolve(process.cwd(), 'apps/web-antd', name));

describe('tracked frontend environment files', () => {
  it('does not contain backend-compatible AES or RSA private material', () => {
    for (const envPath of trackedEnvPaths) {
      const content = readFileSync(envPath, 'utf8');
      expect(content).not.toMatch(/^VITE_ADMIN_SECURITY_AES_(?:IV|KEY)=.+$/m);
      expect(content).not.toMatch(/^VITE_ADMIN_SIGNATURE_PRIVATE_KEY=.+$/m);
      expect(content).not.toContain('BEGIN PRIVATE KEY');
      expect(content).not.toContain('BEGIN RSA PRIVATE KEY');
    }
  });
});
