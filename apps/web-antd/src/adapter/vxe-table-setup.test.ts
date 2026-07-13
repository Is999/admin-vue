import { setupVbenVxeTable } from '@vben/plugins/vxe-table';

import { describe, expect, it, vi } from 'vitest';

import './vxe-table';

describe('vxe table setup', () => {
  it('does not run global configuration more than once', () => {
    const configVxeTable = vi.fn();

    setupVbenVxeTable({ configVxeTable });

    expect(configVxeTable).not.toHaveBeenCalled();
  });
});
