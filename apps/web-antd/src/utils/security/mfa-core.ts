// MFAManualInfo 表示身份验证器手动绑定所需信息。
export type MFAManualInfo = {
  account: string; // 身份验证器账号名称
  formattedSecret: string; // 分组展示后的 MFA 秘钥
  issuer: string; // 身份验证器发行方
  secret: string; // 原始 MFA 秘钥
};

// MFA_DEFAULT_ISSUER 表示未配置前端 AppID 时的默认发行方。
const MFA_DEFAULT_ISSUER = 'admin';

// extractMfaSecret 从 otpauth 地址中解析 TOTP 手动绑定秘钥。
export function extractMfaSecret(buildMfaUrl = '') {
  return extractMfaManualInfo(buildMfaUrl).secret;
}

// extractMfaManualInfo 从 otpauth 地址中解析手动绑定所需的发行方、账号与秘钥。
export function extractMfaManualInfo(buildMfaUrl = ''): MFAManualInfo {
  const raw = String(buildMfaUrl || '').trim();
  const info: MFAManualInfo = {
    account: '',
    formattedSecret: '',
    issuer: '',
    secret: '',
  };
  if (!raw) {
    return info;
  }
  try {
    const url = new URL(raw);
    const label = safeDecode(url.pathname.replace(/^\/+/, ''));
    const labelParts = label.split(':');
    info.issuer = String(url.searchParams.get('issuer') || '').trim();
    if (labelParts.length > 1) {
      info.issuer ||= labelParts[0] || '';
      info.account = labelParts.slice(1).join(':');
    } else {
      info.account = labelParts[0] || '';
    }
    info.secret = String(url.searchParams.get('secret') || '').toUpperCase();
  } catch {
    const matched = raw.match(/[?&]secret=([^&]+)/i);
    info.secret = matched?.[1] ? safeDecode(matched[1]).toUpperCase() : '';
  }
  info.formattedSecret = formatMfaSecret(info.secret);
  return info;
}

// formatMfaSecret 把秘钥格式化为 4 位一组，方便手动录入身份验证器。
export function formatMfaSecret(secret = '') {
  return String(secret || '')
    .replaceAll(/\s+/g, '')
    .toUpperCase()
    .replaceAll(/(.{4})(?=.)/g, '$1 ')
    .trim();
}

// getMfaDefaultIssuer 返回携带前端 AppID 的默认发行方，便于多站点身份验证器区分账号。
export function getMfaDefaultIssuer() {
  const appID = String(import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '').trim();
  if (!appID) {
    return MFA_DEFAULT_ISSUER;
  }
  return `${MFA_DEFAULT_ISSUER}-${appID}`;
}

// mfaIssuerLabel 返回页面可展示的 MFA 发行方，缺失时使用当前前端 AppID 兜底。
export function mfaIssuerLabel(info?: Pick<MFAManualInfo, 'issuer'>) {
  return String(info?.issuer || '').trim() || getMfaDefaultIssuer();
}

// mfaAccountLabel 返回页面可展示的 MFA 绑定账号。
export function mfaAccountLabel(
  info?: Pick<MFAManualInfo, 'account'>,
  fallback = '-',
) {
  return String(info?.account || '').trim() || String(fallback || '-');
}

// mfaBindingLabel 返回“发行方 / 绑定账号”组合展示文本。
export function mfaBindingLabel(info: MFAManualInfo, accountFallback = '-') {
  return `${mfaIssuerLabel(info)} / ${mfaAccountLabel(info, accountFallback)}`;
}

// safeDecode 安全解码 otpauth 标签，避免异常地址影响页面渲染。
function safeDecode(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
