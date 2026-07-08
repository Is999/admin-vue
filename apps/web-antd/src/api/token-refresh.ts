// AUTH_REFRESH_PATH 是当前有效会话主动续签访问令牌的接口路径。
export const AUTH_REFRESH_PATH = '/auth/refresh';

// ACCESS_TOKEN_RENEW_RATIO 表示令牌生命周期达到 80% 后进入主动续签窗口。
const ACCESS_TOKEN_RENEW_RATIO = 0.8;

// AccessTokenClaims 是主动续签只需读取的 JWT 时间声明。
type AccessTokenClaims = {
  exp: number; // 过期时间，单位秒
  iat: number; // 签发时间，单位秒
};

// shouldRenewAccessToken 判断尚未过期的 JWT 是否已进入主动续签窗口。
export function shouldRenewAccessToken(token = '', now = Date.now()) {
  const claims = parseAccessTokenClaims(token);
  if (!claims || !isAccessTokenClaimsUsable(claims, now)) {
    return false;
  }
  const nowSeconds = now / 1000;
  const lifetime = claims.exp - claims.iat;
  return nowSeconds >= claims.iat + lifetime * ACCESS_TOKEN_RENEW_RATIO;
}

// isAccessTokenUsable 判断 JWT 是否处于已签发且尚未过期的有效时间窗口。
export function isAccessTokenUsable(token = '', now = Date.now()) {
  const claims = parseAccessTokenClaims(token);
  return Boolean(claims && isAccessTokenClaimsUsable(claims, now));
}

// isAccessTokenClaimsUsable 校验 JWT 时间声明，避免刷新失败后继续发送已过期令牌。
function isAccessTokenClaimsUsable(claims: AccessTokenClaims, now: number) {
  const nowSeconds = now / 1000;
  return (
    claims.exp > claims.iat &&
    nowSeconds >= claims.iat &&
    nowSeconds < claims.exp
  );
}

// parseAccessTokenClaims 解析 JWT payload；格式异常时直接放弃主动续签，由正常 401 流程收口。
function parseAccessTokenClaims(token: string): AccessTokenClaims | null {
  const payload = String(token || '').split('.')[1];
  if (!payload || typeof globalThis.atob !== 'function') {
    return null;
  }
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const bytes = Uint8Array.from(
      globalThis.atob(padded),
      (char) => char.codePointAt(0) ?? 0,
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    const exp = Number(claims?.exp);
    const iat = Number(claims?.iat);
    if (!Number.isFinite(exp) || !Number.isFinite(iat)) {
      return null;
    }
    return { exp, iat };
  } catch {
    return null;
  }
}
