import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertProductionSecurityEnv } from './security-env';

const SECURITY_ENV_NAMES = [
  'VITE_ADMIN_CRYPTO_ENABLED',
  'VITE_ADMIN_CRYPTO_TYPE',
  'VITE_ADMIN_SECURITY_AES_IV',
  'VITE_ADMIN_SECURITY_AES_KEY',
  'VITE_ADMIN_SECURITY_APP_ID',
  'VITE_ADMIN_SIGNATURE_ENABLED',
  'VITE_ADMIN_SIGNATURE_PRIVATE_KEY',
  'VITE_ADMIN_SIGNATURE_PUBLIC_KEY',
  'VITE_ADMIN_SIGNATURE_TYPE',
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

function validate(env: Record<string, string>) {
  for (const name of SECURITY_ENV_NAMES) {
    vi.stubEnv(name, '');
  }
  assertProductionSecurityEnv('production', env);
}

describe('production security env', () => {
  it('allows signing and encryption to both be disabled', () => {
    expect(() =>
      validate({
        VITE_ADMIN_CRYPTO_ENABLED: 'false',
        VITE_ADMIN_SIGNATURE_ENABLED: 'false',
      }),
    ).not.toThrow();
  });

  it('allows MD5 signing without AES or RSA material', () => {
    expect(() =>
      validate({
        VITE_ADMIN_CRYPTO_ENABLED: 'false',
        VITE_ADMIN_SECURITY_APP_ID: '203',
        VITE_ADMIN_SIGNATURE_ENABLED: 'true',
        VITE_ADMIN_SIGNATURE_TYPE: 'M',
      }),
    ).not.toThrow();
  });

  it('allows AES encryption without signing', () => {
    expect(() =>
      validate({
        VITE_ADMIN_CRYPTO_ENABLED: 'true',
        VITE_ADMIN_CRYPTO_TYPE: 'A',
        VITE_ADMIN_SECURITY_AES_IV: 'abcdef1234567890',
        VITE_ADMIN_SECURITY_AES_KEY: '1234567890abcdef',
        VITE_ADMIN_SECURITY_APP_ID: '203',
        VITE_ADMIN_SIGNATURE_ENABLED: 'false',
      }),
    ).not.toThrow();
  });

  it('rejects RSA signing without its key pair', () => {
    expect(() =>
      validate({
        VITE_ADMIN_CRYPTO_ENABLED: 'false',
        VITE_ADMIN_SECURITY_APP_ID: '203',
        VITE_ADMIN_SIGNATURE_ENABLED: 'true',
        VITE_ADMIN_SIGNATURE_TYPE: 'R',
      }),
    ).toThrow(/PEM/);
  });

  it('rejects AES encryption without AES material', () => {
    expect(() =>
      validate({
        VITE_ADMIN_CRYPTO_ENABLED: 'true',
        VITE_ADMIN_SECURITY_APP_ID: '203',
        VITE_ADMIN_SIGNATURE_ENABLED: 'false',
      }),
    ).toThrow(/AES/);
  });
});
