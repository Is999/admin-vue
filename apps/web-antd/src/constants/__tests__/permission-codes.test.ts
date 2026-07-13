import { describe, expect, it } from 'vitest';

import {
  hasEveryPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '../permission-codes';

describe('system action permission codes', () => {
  it('matches backend permissions for sensitive admin actions', () => {
    expect(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_ROLE_UPDATE).toBe('100035');
    expect(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_RESET_INITIAL_STATE).toBe(
      '100075',
    );
    expect(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_EXPORT_STATUS).toBe('100076');
    expect(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_EXPORT_DOWNLOAD).toBe('100077');
    expect(SYSTEM_ACTION_PERMISSION_CODES.PERMISSION_STATUS_UPDATE).toBe(
      '100058',
    );
    expect(SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_EXPORT).toBe('100078');
    expect(SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_IMPORT).toBe('100079');
  });

  it('requires every permission for composite actions', () => {
    expect(hasEveryPermission(['read', 'write'], ['read', 'write'])).toBe(true);
    expect(hasEveryPermission(['read'], ['read', 'write'])).toBe(false);
  });
});
