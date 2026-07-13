import { describe, expect, it } from 'vitest';

import { buildCreateAdminParams, buildUpdateAdminParams } from './form-payload';

describe('admin form payload', () => {
  const values = {
    avatar: '/avatar.png',
    description: 'operator',
    email: 'admin@example.com',
    mfaStatus: 1 as const,
    password: 'Password1',
    phone: '13800138000',
    realName: 'Admin',
    status: 0 as const,
    username: ' admin ',
  };

  it('builds create payload without fixed account or MFA status', () => {
    const payload = buildCreateAdminParams(values, [2, 3]);

    expect(payload).toEqual({
      avatar: '/avatar.png',
      description: 'operator',
      email: 'admin@example.com',
      password: 'Password1',
      phone: '13800138000',
      realName: 'Admin',
      roleIDs: [2, 3],
      username: 'admin',
    });
    expect(payload).not.toHaveProperty('mfaSecureKey');
    expect(payload).not.toHaveProperty('mfaStatus');
    expect(payload).not.toHaveProperty('status');
  });

  it('builds update payload without username or dedicated status fields', () => {
    const payload = buildUpdateAdminParams(values, [3]);

    expect(payload).toEqual({
      avatar: '/avatar.png',
      description: 'operator',
      email: 'admin@example.com',
      isUpdateRoles: true,
      password: 'Password1',
      phone: '13800138000',
      realName: 'Admin',
      roleIDs: [3],
    });
    expect(payload).not.toHaveProperty('mfaSecureKey');
    expect(payload).not.toHaveProperty('mfaStatus');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('username');
  });

  it('omits an empty update password', () => {
    expect(
      buildUpdateAdminParams({ ...values, password: '   ' }, []),
    ).not.toHaveProperty('password');
  });
});
