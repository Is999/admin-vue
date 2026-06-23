import { $t } from '#/locales';

// MFAAuthenticatorHelpLink 表示身份验证器官方帮助链接。
export type MFAAuthenticatorHelpLink = {
  href: string; // 帮助地址
  label: string; // 应用名称
};

// MFAGuideStep 表示 MFA 绑定说明步骤。
export type MFAGuideStep = {
  description: string; // 步骤说明
  title: string; // 步骤标题
};

// MFA_GOOGLE_AUTHENTICATOR_HELP_URL 指向 Google Authenticator 官方帮助页。
const MFA_GOOGLE_AUTHENTICATOR_HELP_URL =
  'https://support.google.com/accounts/answer/1066447';
// MFA_MICROSOFT_AUTHENTICATOR_HELP_URL 指向 Microsoft Authenticator 官方帮助页。
const MFA_MICROSOFT_AUTHENTICATOR_HELP_URL =
  'https://support.microsoft.com/account-billing/use-microsoft-authenticator-with-microsoft-365-1412611f-ad8d-43ab-807c-7965e5155411';

// getMfaAuthenticatorApps 返回推荐的 TOTP 身份验证器应用列表，避免语言包加载前固定成原始 key。
export function getMfaAuthenticatorApps() {
  return [
    'Google Authenticator',
    'Microsoft Authenticator',
    $t('business.message.mfaAuthenticatorAuthingToken'),
    $t('business.message.mfaAuthenticatorNingdunToken'),
  ];
}

// getMfaAuthenticatorHelpLinks 返回身份验证器帮助入口，供绑定页与弹框共用。
export function getMfaAuthenticatorHelpLinks(): MFAAuthenticatorHelpLink[] {
  return [
    {
      href: MFA_GOOGLE_AUTHENTICATOR_HELP_URL,
      label: 'Google Authenticator',
    },
    {
      href: MFA_MICROSOFT_AUTHENTICATOR_HELP_URL,
      label: 'Microsoft Authenticator',
    },
  ];
}

// getMfaBindSteps 返回静态绑定与首次绑定通用步骤。
export function getMfaBindSteps(): MFAGuideStep[] {
  return [
    {
      description: $t('business.message.mfaBindAddAccountDesc'),
      title: $t('business.message.mfaBindAddAccountTitle'),
    },
    {
      description: $t('business.message.mfaBindFillSecretDesc'),
      title: $t('business.message.mfaBindFillSecretTitle'),
    },
    {
      description: $t('business.message.mfaBindVerifyEnableDesc'),
      title: $t('business.message.mfaBindVerifyEnableTitle'),
    },
  ];
}

// getMfaGuideSteps 返回 MFA 绑定说明步骤。
export function getMfaGuideSteps(): MFAGuideStep[] {
  return [
    {
      description: $t('business.message.mfaGuideInstallDesc'),
      title: $t('business.message.mfaGuideInstallTitle'),
    },
    {
      description: $t('business.message.mfaGuideScanDesc'),
      title: $t('business.message.mfaGuideScanTitle'),
    },
    {
      description: $t('business.message.mfaGuideVerifyDesc'),
      title: $t('business.message.mfaGuideVerifyTitle'),
    },
  ];
}

// getMfaMicrosoftScanTip 返回微软身份验证器扫码提示。
export function getMfaMicrosoftScanTip() {
  return $t('business.message.mfaMicrosoftScanTip');
}

// normalizeMfaSecure 统一清洗 MFA 动态验证码，只保留 6 位数字。
export function normalizeMfaSecure(value = '') {
  return String(value || '')
    .replaceAll(/\D+/g, '')
    .slice(0, 6);
}

// resolveDialogErrorMessage 优先解析服务端业务提示，否则回退到本地兜底文案。
export function resolveDialogErrorMessage(error: any, fallback: string) {
  const responseMessage = String(error?.response?.data?.message || '').trim();
  if (responseMessage) {
    return responseMessage;
  }
  const errorMessage = String(error?.message || '').trim();
  if (errorMessage && errorMessage !== 'Request failed with status code 200') {
    return errorMessage;
  }
  return fallback;
}
