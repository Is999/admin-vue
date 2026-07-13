import type { AuthApi, CommonApi } from '#/api';

import { h } from 'vue';

import { Input } from 'ant-design-vue';

import { checkMfaSecureApi } from '#/api';
import { fetchProfileInfo, refreshProfileMfaSecretKey } from '#/api/system';
import { $t } from '#/locales';
import {
  currentSessionStateIdentity,
  registerSessionStateCleanup,
  SESSION_STATE_CHANGED,
} from '#/utils/session-state-gate';

import { extractMfaManualInfo, extractMfaSecret } from './mfa-core';
import { createMfaOverlayDialog } from './mfa-overlay';
import { isMfaTicketScenarioMatch } from './mfa-ticket-policy';

export type { MFAManualInfo } from './mfa-core';
export {
  extractMfaManualInfo,
  extractMfaSecret,
  formatMfaSecret,
  getMfaDefaultIssuer,
  mfaAccountLabel,
  mfaBindingLabel,
  mfaIssuerLabel,
} from './mfa-core';
export {
  getMfaAuthenticatorApps,
  getMfaAuthenticatorHelpLinks,
  getMfaBindSteps,
  getMfaGuideSteps,
  getMfaMicrosoftScanTip,
} from './mfa-guide';

// MFATicketPayload 表示后端敏感操作需要的 MFA 二次校验字段。
export type MFATicketPayload = CommonApi.TwoStepReq;

// MFACheckDialogOptions 定义 MFA 校验弹窗配置。
export type MFACheckDialogOptions = {
  accountName?: string; // 账号兜底展示名称
  allowRefresh?: boolean; // 是否允许在弹窗中刷新二维码
  buildMfaUrl?: string; // MFA 绑定地址
  cancelErrorMessage?: string; // 取消时抛出的错误信息
  headerDescription?: string; // 顶部说明文案
  headerMessage?: string; // 顶部标题文案
  okText?: string; // 确认按钮文案
  requestConfig?: Record<string, any>; // 登录事务可将 MFA 请求固定到本次签发的会话
  requireTwoStep?: boolean; // 是否要求后端返回二次校验票据
  title?: string; // 弹窗标题
};

// MFACheckDialogResult 定义 MFA 校验弹窗的返回结果。
export type MFACheckDialogResult = {
  response: AuthApi.CheckMfaResult; // 后端返回的 MFA 校验结果
  secure: string; // 当前用户输入的 6 位动态验证码
};

// MFASubmitRetryOptions 定义 submitWithMfaRetry 的可选弹窗上下文。
export type MFASubmitRetryOptions = {
  loadProfileContext?: boolean; // 是否在重试时自动加载当前用户 MFA 上下文
} & MFACheckDialogOptions;

// CachedMFATwoStep 表示前端在当前会话内缓存的最近一次 MFA 二次校验票据。
type CachedMFATwoStep = {
  expireAt: number; // 票据绝对过期时间，毫秒
  scenario: number; // 当前票据签发场景
  sessionIdentity: string; // 票据所属前端登录身份，刷新 token 时保持不变
  ticket: AuthApi.TwoStepTicket; // 后端签发的二次票据
};

// MFA_TWO_STEP_EXPIRE_SAFETY_MS 表示前端本地复用票据时预留的安全余量，避免边界时刻刚好撞上后端过期。
const MFA_TWO_STEP_EXPIRE_SAFETY_MS = 3000;
// cachedMFATwoStep 保存当前会话最近一次可复用的 MFA 二次票据。
let cachedMFATwoStep: CachedMFATwoStep | null = null;

// isMfaAgainError 判断业务错误是否要求重新进行MFA二次确认。
export function isMfaAgainError(error: any) {
  const data = error?.response?.data ?? error;
  const code = Number(data?.code || 0);
  return code === 8 || code === 6;
}

// rememberMfaTwoStepTicket 缓存最近一次 MFA 二次校验票据，供频率窗口内的敏感操作直接复用。
function rememberMfaTwoStepTicket(
  scenario: number,
  ticket?: AuthApi.TwoStepTicket,
) {
  if (!ticket?.key || !ticket?.value) {
    return;
  }
  const ttl = Math.max(Number(ticket.expire || 0), 0) * 1000;
  // 这里按“前端实际收到票据的时间”计算本地复用窗口，避免浏览器与服务端存在时钟偏差时，
  // 把明明仍在有效期内的票据提前判成过期，导致窗口内每次操作都重新弹 MFA。
  const expireAt =
    ttl > 0
      ? Date.now() + Math.max(ttl - MFA_TWO_STEP_EXPIRE_SAFETY_MS, 1000)
      : Date.now();
  cachedMFATwoStep = {
    expireAt,
    scenario,
    sessionIdentity: currentSessionStateIdentity(),
    ticket,
  };
}

// clearMfaTwoStepTicket 清理当前会话缓存的 MFA 二次校验票据。
function clearMfaTwoStepTicket() {
  cachedMFATwoStep = null;
}

registerSessionStateCleanup(clearMfaTwoStepTicket);

// loadCachedMfaTwoStepTicket 读取当前页面运行期内存中的 MFA 二次校验票据。
function loadCachedMfaTwoStepTicket() {
  return cachedMFATwoStep;
}

// getReusableMfaTwoStepTicket 获取当前窗口内仍可复用的 MFA 二次校验票据。
function getReusableMfaTwoStepTicket(scenario: number) {
  const cachedTicket = loadCachedMfaTwoStepTicket();
  if (!cachedTicket) {
    return undefined;
  }
  if (cachedTicket.sessionIdentity !== currentSessionStateIdentity()) {
    clearMfaTwoStepTicket();
    return undefined;
  }
  if (Date.now() >= cachedTicket.expireAt) {
    clearMfaTwoStepTicket();
    return undefined;
  }
  if (!isMfaTicketScenarioMatch(scenario, cachedTicket.scenario)) {
    return undefined;
  }
  return cachedTicket.ticket;
}

// ticketPayload 把MFA二次校验票据转换为接口字段。
export function ticketPayload(
  ticket?: AuthApi.TwoStepTicket,
): MFATicketPayload {
  if (!ticket) {
    return {};
  }
  return {
    twoStepKey: ticket.key,
    twoStepValue: ticket.value,
  };
}

// renderMfaManualSecret 渲染手动绑定秘钥，二维码无法扫描时可直接录入。
export function renderMfaManualSecret(buildMfaUrl = '') {
  const info = extractMfaManualInfo(buildMfaUrl);
  if (!info.secret) {
    return null;
  }
  return h('div', { class: 'space-y-1' }, [
    h(
      'div',
      { class: 'text-sm text-gray-500' },
      $t('business.message.mfaManualSecret'),
    ),
    h(Input, {
      readOnly: true,
      value: info.formattedSecret,
    }),
  ]);
}

// createMfaCheckDialog 创建 MFA 校验全屏遮罩层，并返回 Promise 与显式销毁能力。
export function createMfaCheckDialog(
  scenario: number,
  options: MFACheckDialogOptions = {},
) {
  const {
    allowRefresh = Boolean(options.buildMfaUrl),
    buildMfaUrl = '',
    cancelErrorMessage = $t('business.message.mfaCancelled'),
    okText = $t('business.message.mfaConfirm'),
    requestConfig,
    requireTwoStep = true,
    title = $t('business.message.mfaSecondConfirmTitle'),
    ...dialogOptions
  } = options;

  const dialog = createMfaOverlayDialog<AuthApi.CheckMfaResult>({
    ...dialogOptions,
    allowRefresh,
    buildMfaUrl,
    cancelErrorMessage,
    okText,
    onRefresh: allowRefresh
      ? async () => {
          const result = await refreshProfileMfaSecretKey(
            undefined,
            requestConfig ? { ...requestConfig } : undefined,
          );
          const profile = await fetchProfileInfo(
            requestConfig ? { ...requestConfig } : undefined,
          ).catch(() => undefined);
          return {
            accountName: String(profile?.username || '').trim() || undefined,
            buildMfaUrl:
              String(result?.buildMFAURL || '').trim() ||
              String(profile?.buildMFAURL || '').trim() ||
              undefined,
          };
        }
      : undefined,
    onSubmit: async ({ buildMfaUrl: currentBuildMfaUrl, secure }) => {
      const result = await checkMfaSecureApi(
        {
          scenarios: scenario,
          secure,
          mfaSecureKey: extractMfaSecret(currentBuildMfaUrl) || undefined,
        },
        {
          ...requestConfig,
          skipGlobalErrorMessage: true,
        },
      );
      if (!result?.isOk || (requireTwoStep && !result.twoStep)) {
        throw new Error($t('business.message.mfaCodeInvalid'));
      }
      return result;
    },
    submitErrorMessage: $t('business.message.mfaCodeInvalid'),
    title,
  });

  return {
    destroy: dialog.destroy,
    promise: dialog.promise.then(({ result, secure }) => ({
      response: result,
      secure,
    })),
  };
}

// requestMfaCheck 弹出 MFA 校验弹窗并返回后端校验结果。
export async function requestMfaCheck(
  scenario: number,
  options: MFACheckDialogOptions = {},
) {
  const sessionIdentity = currentSessionStateIdentity();
  const dialog = createMfaCheckDialog(scenario, options);
  const result = await dialog.promise;
  assertMfaSessionIdentity(sessionIdentity);
  rememberMfaTwoStepTicket(result.response.scenarios, result.response.twoStep);
  return result.response;
}

// requestMfaTwoStep 弹出MFA动态码输入框并换取二次校验票据。
export async function requestMfaTwoStep(
  scenario: number,
  title = $t('business.message.mfaSecondConfirmTitle'),
  buildMfaUrl = '',
  options: Omit<
    MFACheckDialogOptions,
    'buildMfaUrl' | 'requireTwoStep' | 'title'
  > = {},
) {
  const cachedTicket = getReusableMfaTwoStepTicket(scenario);
  if (cachedTicket) {
    return cachedTicket;
  }
  const result = await requestMfaCheck(scenario, {
    ...options,
    buildMfaUrl,
    requireTwoStep: true,
    title,
  });
  if (!result.twoStep) {
    throw new Error($t('business.message.mfaTwoStepTicketMissing'));
  }
  return result.twoStep;
}

// loadCurrentMfaDialogOptions 按需拉取当前登录用户资料，补齐 MFA 弹窗上下文。
async function loadCurrentMfaDialogOptions(
  options: MFASubmitRetryOptions = {},
): Promise<MFACheckDialogOptions> {
  const resolved: MFACheckDialogOptions = {
    accountName: options.accountName,
    buildMfaUrl: options.buildMfaUrl,
    cancelErrorMessage: options.cancelErrorMessage,
    headerDescription: options.headerDescription,
    headerMessage: options.headerMessage,
    okText: options.okText,
    requireTwoStep: options.requireTwoStep,
    title: options.title,
  };
  if (options.loadProfileContext === false) {
    return resolved;
  }
  if (resolved.accountName && resolved.buildMfaUrl) {
    return resolved;
  }
  try {
    const profile = await fetchProfileInfo();
    return {
      ...resolved,
      accountName:
        resolved.accountName ||
        String(profile.username || '').trim() ||
        undefined,
      buildMfaUrl:
        resolved.buildMfaUrl ||
        String(profile.buildMFAURL || '').trim() ||
        undefined,
    };
  } catch {
    return resolved;
  }
}

// submitWithMfaRetry 在后端返回MFA过期时弹窗获取票据并重试一次业务操作。
export async function submitWithMfaRetry<T>(
  scenario: number,
  submit: (ticket?: AuthApi.TwoStepTicket) => Promise<T>,
  title = $t('business.message.mfaSecondConfirmTitle'),
  options: MFASubmitRetryOptions = {},
) {
  const sessionIdentity = currentSessionStateIdentity();
  const cachedTicket = getReusableMfaTwoStepTicket(scenario);
  try {
    const result = await submit(cachedTicket);
    assertMfaSessionIdentity(sessionIdentity);
    return result;
  } catch (error) {
    assertMfaSessionIdentity(sessionIdentity, error);
    if (!isMfaAgainError(error)) {
      throw error;
    }
    clearMfaTwoStepTicket();
    const dialogOptions = await loadCurrentMfaDialogOptions({
      ...options,
      requireTwoStep: true,
      title,
    });
    assertMfaSessionIdentity(sessionIdentity);
    const result = await requestMfaCheck(scenario, dialogOptions);
    assertMfaSessionIdentity(sessionIdentity);
    if (!result.twoStep) {
      throw new Error($t('business.message.mfaTwoStepTicketMissing'), {
        cause: error,
      });
    }
    const ticket = result.twoStep;
    const retriedResult = await submit(ticket);
    assertMfaSessionIdentity(sessionIdentity);
    return retriedResult;
  }
}

// assertMfaSessionIdentity 阻止旧账号的 MFA 异步分支缓存票据或重放敏感操作。
function assertMfaSessionIdentity(sessionIdentity: string, cause?: unknown) {
  if (sessionIdentity !== currentSessionStateIdentity()) {
    throw new Error(SESSION_STATE_CHANGED, { cause });
  }
}
