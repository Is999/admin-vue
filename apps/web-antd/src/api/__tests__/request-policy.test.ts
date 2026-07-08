import { describe, expect, it } from 'vitest';

import {
  shouldReAuthenticateAfterError,
  shouldSyncAccessAfterError,
} from '../request-policy';

describe('request error policy', () => {
  it('reauthenticates only for explicit session unauthorized responses', () => {
    expect(shouldReAuthenticateAfterError(401, 401)).toBe(true);
    expect(shouldReAuthenticateAfterError(200, 401)).toBe(true);
    expect(shouldReAuthenticateAfterError(401, 0)).toBe(true);
    expect(shouldReAuthenticateAfterError(401, 1002)).toBe(false);
  });

  it('syncs access only for forbidden responses', () => {
    expect(shouldSyncAccessAfterError(403, 0)).toBe(true);
    expect(shouldSyncAccessAfterError(200, 403)).toBe(true);
    expect(shouldSyncAccessAfterError(200, 5)).toBe(false);
    expect(shouldSyncAccessAfterError(401, 401)).toBe(false);
  });
});
