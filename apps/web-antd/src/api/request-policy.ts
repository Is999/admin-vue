// FORBIDDEN_BUSINESS_CODES 表示会触发权限态同步的后端无权限业务码。
const FORBIDDEN_BUSINESS_CODES = new Set([403]);

// shouldSyncAccessAfterError 判断请求失败后是否需要刷新当前账号权限态。
// MFA 绑定业务码 5 不属于权限错误，禁止在此触发额外的权限查询。
export function shouldSyncAccessAfterError(
  httpStatus?: number,
  businessCode?: number,
) {
  return (
    httpStatus === 403 ||
    FORBIDDEN_BUSINESS_CODES.has(Number(businessCode || 0))
  );
}
