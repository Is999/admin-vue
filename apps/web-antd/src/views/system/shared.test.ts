import { describe, expect, it, vi } from 'vitest';

import { resolveBackendMessage } from './shared';

vi.mock('#/locales', () => ({
  $t: (key: string) => `t:${key}`,
  $te: (key: string) => key.startsWith('business.'),
}));

describe('system shared helpers', () => {
  it('uses fallback translation when backend message is empty', () => {
    expect(resolveBackendMessage(' ', 'business.message.failed')).toBe(
      't:business.message.failed',
    );
  });

  it('translates backend i18n keys and keeps plain backend messages', () => {
    expect(
      resolveBackendMessage(
        ' business.message.cacheRenewFailed ',
        'business.message.failed',
      ),
    ).toBe('t:business.message.cacheRenewFailed');
    expect(
      resolveBackendMessage('backend failed', 'business.message.failed'),
    ).toBe('backend failed');
  });
});
