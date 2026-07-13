import { describe, expect, it } from 'vitest';

import { isAccessTokenUsable, shouldRenewAccessToken } from '../token-refresh';

// buildToken 构造只包含时间声明的测试 JWT，签名不参与前端续签窗口判断。
function buildToken(iat: number, exp: number) {
  const payload = btoa(JSON.stringify({ exp, iat }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `header.${payload}.signature`;
}

describe('access token renewal policy', () => {
  it('renews only after 80 percent of a valid token lifetime', () => {
    const token = buildToken(1000, 2000);

    expect(shouldRenewAccessToken(token, 1_799_000)).toBe(false);
    expect(shouldRenewAccessToken(token, 1_800_000)).toBe(true);
    expect(shouldRenewAccessToken(token, 1_999_000)).toBe(true);
  });

  it('does not renew expired, malformed, or incomplete tokens', () => {
    expect(shouldRenewAccessToken(buildToken(1000, 2000), 2_000_000)).toBe(
      false,
    );
    expect(shouldRenewAccessToken('not-a-jwt', 1_500_000)).toBe(false);
    expect(shouldRenewAccessToken(buildToken(2000, 1000), 1_500_000)).toBe(
      false,
    );

    const payload = btoa(JSON.stringify({ exp: 2000 }));
    expect(
      shouldRenewAccessToken(`header.${payload}.signature`, 1_500_000),
    ).toBe(false);
  });

  it('accepts only issued and unexpired tokens for refresh fallback', () => {
    expect(isAccessTokenUsable(buildToken(1000, 2000), 1_500_000)).toBe(true);
    expect(isAccessTokenUsable(buildToken(1000, 2000), 2_000_000)).toBe(false);
    expect(isAccessTokenUsable(buildToken(2000, 3000), 1_500_000)).toBe(false);
    expect(isAccessTokenUsable('not-a-jwt', 1_500_000)).toBe(false);
  });
});
