import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  extractMfaManualInfo,
  getMfaDefaultIssuer,
  mfaBindingLabel,
  mfaIssuerLabel,
} from '../mfa-core';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mfa issuer label', () => {
  it('uses frontend app id when otpauth issuer is missing', () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '102');

    expect(getMfaDefaultIssuer()).toBe('admin-102');
    expect(mfaIssuerLabel({ issuer: '' })).toBe('admin-102');
    expect(
      mfaBindingLabel(
        extractMfaManualInfo('otpauth://totp/billy999?secret=ABCDEF'),
        'billy999',
      ),
    ).toBe('admin-102 / billy999');
  });

  it('falls back to admin when frontend app id is not configured', () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '');

    expect(getMfaDefaultIssuer()).toBe('admin');
    expect(mfaIssuerLabel()).toBe('admin');
  });

  it('keeps issuer from otpauth url when backend provides it', () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '102');

    const info = extractMfaManualInfo(
      'otpauth://totp/admin-1%3Abilly999?secret=ABCDEF&issuer=admin-1',
    );

    expect(mfaIssuerLabel(info)).toBe('admin-1');
    expect(mfaBindingLabel(info, 'billy999')).toBe('admin-1 / billy999');
    expect(info.secret).toBe('ABCDEF');
    expect(info.formattedSecret).toBe('ABCD EF');
  });

  it('uses query issuer with account-only otpauth label', () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '102');

    const info = extractMfaManualInfo(
      'otpauth://totp/billy999?secret=ABCDEF&issuer=admin-1',
    );

    expect(info.account).toBe('billy999');
    expect(mfaBindingLabel(info, 'billy999')).toBe('admin-1 / billy999');
  });
});
