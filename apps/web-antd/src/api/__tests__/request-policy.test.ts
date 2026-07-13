import { describe, expect, it } from 'vitest';

import { shouldSyncAccessAfterError } from '../request-policy';

describe('request error policy', () => {
  it('syncs access only for forbidden responses', () => {
    expect(shouldSyncAccessAfterError(403, 0)).toBe(true);
    expect(shouldSyncAccessAfterError(200, 403)).toBe(true);
    expect(shouldSyncAccessAfterError(200, 5)).toBe(false);
    expect(shouldSyncAccessAfterError(401, 401)).toBe(false);
  });
});
