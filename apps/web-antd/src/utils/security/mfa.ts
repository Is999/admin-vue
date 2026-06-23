import type { MFAManualInfo } from './mfa-core';

import type { AuthApi, CommonApi } from '#/api';

import { h, render } from 'vue';

import { Alert, Button, Input, message, QRCode, Space } from 'ant-design-vue';

import { checkMfaSecureApi } from '#/api';
import { fetchProfileInfo, refreshProfileMfaSecretKey } from '#/api/system';
import { $t } from '#/locales';

import {
  extractMfaManualInfo,
  extractMfaSecret,
  mfaBindingLabel,
} from './mfa-core';
import {
  getMfaAuthenticatorApps,
  getMfaGuideSteps,
  getMfaMicrosoftScanTip,
  normalizeMfaSecure,
  resolveDialogErrorMessage,
} from './mfa-guide';
import {
  buildMfaCodeInputBlock,
  buildMfaDialogActions,
  buildMfaGuideDescription,
  copyMfaSecret,
  focusMfaCheckInput,
} from './mfa-ui';

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
  ticket: AuthApi.TwoStepTicket; // 后端签发的二次票据
};

// MFA_TWO_STEP_CACHE_KEY 表示当前标签页缓存最近一次 MFA 二次票据的 sessionStorage key。
const MFA_TWO_STEP_CACHE_KEY = 'admin:mfa-two-step-ticket';
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

// isReusableMfaTicketScenario 判断指定场景是否允许复用最近一次 MFA 二次票据。
// MFA 状态启用/关闭场景依赖本次绑定链路里的秘钥来源元信息，仍要求严格同场景校验。
function isReusableMfaTicketScenario(scenario: number) {
  return scenario > 0 && scenario !== 2;
}

// isMfaTicketScenarioMatch 判断当前请求场景是否允许复用缓存票据。
function isMfaTicketScenarioMatch(
  expectScenario: number,
  ticketScenario: number,
) {
  if (expectScenario === ticketScenario) {
    return true;
  }
  return (
    isReusableMfaTicketScenario(expectScenario) &&
    isReusableMfaTicketScenario(ticketScenario)
  );
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
    ticket,
  };
  try {
    sessionStorage.setItem(
      MFA_TWO_STEP_CACHE_KEY,
      JSON.stringify(cachedMFATwoStep),
    );
  } catch {
    // 忽略浏览器存储异常，至少保留当前运行时内存缓存。
  }
}

// clearMfaTwoStepTicket 清理当前会话缓存的 MFA 二次校验票据。
function clearMfaTwoStepTicket() {
  cachedMFATwoStep = null;
  try {
    sessionStorage.removeItem(MFA_TWO_STEP_CACHE_KEY);
  } catch {
    // 忽略浏览器存储异常，避免影响主流程。
  }
}

// loadCachedMfaTwoStepTicket 读取当前标签页缓存的 MFA 二次校验票据。
function loadCachedMfaTwoStepTicket() {
  if (cachedMFATwoStep) {
    return cachedMFATwoStep;
  }
  try {
    const raw = sessionStorage.getItem(MFA_TWO_STEP_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedMFATwoStep | null;
    if (!parsed?.ticket?.key || !parsed.ticket?.value) {
      return null;
    }
    cachedMFATwoStep = parsed;
    return cachedMFATwoStep;
  } catch {
    return null;
  }
}

// getReusableMfaTwoStepTicket 获取当前窗口内仍可复用的 MFA 二次校验票据。
function getReusableMfaTwoStepTicket(scenario: number) {
  const cachedTicket = loadCachedMfaTwoStepTicket();
  if (!cachedTicket) {
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

// buildMfaGuideSummary 渲染紧凑版 MFA 绑定说明，避免全屏遮罩里重复滚动过长。
function buildMfaGuideSummary() {
  return h('div', { class: 'space-y-2' }, [
    h('div', { class: 'flex items-center justify-between gap-2' }, [
      h(
        'div',
        { class: 'text-sm font-medium text-foreground' },
        $t('business.message.mfaGuideSummaryTitle'),
      ),
      h(
        'div',
        { class: 'text-xs leading-5 text-foreground/55' },
        $t('business.message.mfaGuideSummaryDesc'),
      ),
    ]),
    h(
      'div',
      { class: 'grid gap-2 md:grid-cols-3' },
      getMfaGuideSteps().map((step, index) =>
        h(
          'div',
          {
            class:
              'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-2',
          },
          [
            h('div', { class: 'flex items-center gap-2' }, [
              h(
                'div',
                {
                  class:
                    'flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white',
                },
                String(index + 1),
              ),
              h(
                'div',
                { class: 'text-sm font-medium text-foreground' },
                step.title,
              ),
            ]),
            h(
              'div',
              { class: 'mt-2 text-xs leading-5 text-foreground/60' },
              buildMfaGuideDescription(step, index),
            ),
          ],
        ),
      ),
    ),
  ]);
}

// buildMfaBindingMeta 渲染绑定所需的发行方、账号与手动添加秘钥，保持信息完整但压缩高度。
function buildMfaBindingMeta(
  info: MFAManualInfo,
  options: MFACheckDialogOptions,
) {
  return h('div', { class: 'grid gap-2 sm:grid-cols-2' }, [
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-2.5',
      },
      [
        h(
          'div',
          { class: 'text-xs font-medium text-foreground/55' },
          $t('business.message.mfaApplicableApps'),
        ),
        h(
          'div',
          { class: 'mt-1.5 text-sm leading-5 text-foreground' },
          getMfaAuthenticatorApps().join('、'),
        ),
      ],
    ),
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-2.5',
      },
      [
        h(
          'div',
          { class: 'text-xs font-medium text-foreground/55' },
          $t('business.message.mfaIssuerAccount'),
        ),
        h(
          'div',
          { class: 'mt-1.5 text-sm leading-5 text-foreground' },
          mfaBindingLabel(
            info,
            options.accountName || $t('business.message.mfaCurrentAccount'),
          ),
        ),
      ],
    ),
  ]);
}

// buildMfaVerificationContent 生成 MFA 二次确认主体内容，有绑定地址时展示完整说明。
function buildMfaVerificationContent(
  buildMfaUrl: string,
  options: MFACheckDialogOptions,
  secure: string,
  errorMessage: string,
  onSecureChange: (value: string) => void,
  onSubmit?: () => void,
  onRefresh?: () => void,
  refreshLoading = false,
  renderActions?: () => any,
) {
  const info = extractMfaManualInfo(buildMfaUrl);
  if (!buildMfaUrl) {
    return h('div', { class: 'space-y-6' }, [
      h('div', { class: 'space-y-2 text-center md:text-left' }, [
        h(
          'div',
          { class: 'text-lg font-semibold text-foreground' },
          $t('business.message.mfaInputAuthenticatorCodeTitle'),
        ),
        h(
          'div',
          { class: 'text-sm leading-6 text-foreground/65' },
          options.headerDescription ||
            $t('business.message.mfaSensitiveDefaultDesc'),
        ),
      ]),
      errorMessage
        ? h(Alert, {
            message: errorMessage,
            showIcon: true,
            type: 'error',
          })
        : null,
      h(
        'div',
        {
          class:
            'rounded-2xl border border-dashed border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60 px-5 py-4',
        },
        [
          h(
            'div',
            { class: 'text-sm font-medium text-foreground' },
            $t('business.message.mfaVerifyRequirementsTitle'),
          ),
          h(
            'div',
            { class: 'mt-2 text-sm leading-6 text-foreground/60' },
            $t('business.message.mfaVerifyRequirementsDesc'),
          ),
        ],
      ),
      h(
        'div',
        {
          class:
            'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start',
          style: { marginTop: '8px' },
        },
        [
          h(Input, {
            autofocus: true,
            class: 'mfa-check-input h-10 min-w-0 sm:max-w-[420px] sm:flex-1',
            maxlength: 6,
            onChange: (event: Event) => {
              onSecureChange((event.target as HTMLInputElement).value);
            },
            onPressEnter: () => {
              onSubmit?.();
            },
            placeholder: $t('business.message.mfaCodePlaceholder'),
            size: 'large',
            value: secure,
            'data-mfa-check-input': 'true',
          }),
          renderActions?.() ?? null,
        ],
      ),
    ]);
  }
  return h('div', { class: 'space-y-2' }, [
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60 px-3 py-2.5',
      },
      [
        h(
          'div',
          {
            class:
              'text-xs font-semibold tracking-[0.18em] text-primary/80 uppercase',
          },
          'MFA Security Check',
        ),
        h(
          'div',
          { class: 'mt-1.5 text-lg font-semibold text-foreground' },
          options.headerMessage || $t('business.message.mfaBindingInfoTitle'),
        ),
        h(
          'div',
          { class: 'mt-1.5 text-sm leading-5 text-foreground/65' },
          options.headerDescription || getMfaMicrosoftScanTip(),
        ),
      ],
    ),
    h('div', { class: 'grid gap-2 xl:grid-cols-[268px_minmax(0,1fr)]' }, [
      h(
        'div',
        {
          class:
            'space-y-2 rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/50 p-2.5',
        },
        [
          h(
            'div',
            { class: 'text-sm font-medium text-foreground/80' },
            $t('business.message.mfaBindingQrArea'),
          ),
          h('div', { class: 'flex justify-center rounded-lg bg-white p-0.5' }, [
            h(QRCode, {
              bgColor: '#ffffff',
              bordered: false,
              class: '!h-[212px] !w-[212px] !border-0 !p-0',
              color: '#000000',
              key: buildMfaUrl,
              size: 238,
              value: buildMfaUrl,
            }),
          ]),
          options.allowRefresh
            ? h(
                Button,
                {
                  block: true,
                  loading: refreshLoading,
                  onClick: () => {
                    onRefresh?.();
                  },
                  size: 'large',
                },
                { default: () => $t('business.message.mfaRegenerateQr') },
              )
            : null,
          h(
            'div',
            { class: 'text-xs leading-5 text-foreground/55' },
            $t('business.message.mfaQrManualFallback'),
          ),
          h(
            'div',
            { class: 'border-t border-[var(--vben-border-color)]/80 pt-2' },
            [
              h(
                'div',
                { class: 'text-xs font-medium text-foreground/55' },
                $t('business.message.mfaManualSecret'),
              ),
              h(
                Space,
                { class: 'mt-1.5 w-full', direction: 'vertical', size: 6 },
                () => [
                  h(Input, {
                    class: 'w-full',
                    readOnly: true,
                    value: info.formattedSecret || '-',
                  }),
                  h(
                    Button,
                    {
                      block: true,
                      disabled: !info.secret,
                      onClick: () => {
                        void copyMfaSecret(info.secret);
                      },
                    },
                    {
                      default: () => $t('business.message.mfaCopySecret'),
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h('div', { class: 'min-w-0 space-y-2' }, [
        buildMfaGuideSummary(),
        buildMfaBindingMeta(info, options),
        h(
          'div',
          {
            class:
              'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/50 p-2.5',
          },
          [
            h(
              'div',
              { class: 'mb-2 flex items-center justify-between gap-2' },
              [
                h(
                  'div',
                  { class: 'text-sm font-medium text-foreground' },
                  $t('business.message.mfaInputCodeTitle'),
                ),
                h(
                  'div',
                  { class: 'text-xs leading-5 text-foreground/55' },
                  $t('business.message.mfaInputCodeHint'),
                ),
              ],
            ),
            buildMfaCodeInputBlock(
              secure,
              errorMessage,
              onSecureChange,
              onSubmit,
              renderActions,
            ),
          ],
        ),
      ]),
    ]),
  ]);
}

// resolveMfaDialogLayout 统一返回 MFA 全屏遮罩中的卡片宽度。
function resolveMfaDialogLayout(buildMfaUrl: string) {
  if (buildMfaUrl) {
    return {
      cardClass: 'max-w-[1080px]',
    };
  }
  return {
    cardClass: 'max-w-[760px]',
  };
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
    requireTwoStep = true,
    title = $t('business.message.mfaSecondConfirmTitle'),
  } = options;
  // currentOptions 保存当前弹层上下文，刷新二维码后会同步更新账号名和提示文案。
  let currentOptions: MFACheckDialogOptions = {
    ...options,
    allowRefresh,
  };
  // currentBuildMfaUrl 保存当前生效的 MFA 绑定地址，二维码刷新后会替换成最新地址。
  let currentBuildMfaUrl = buildMfaUrl;
  // refreshLoading 标识当前是否正在刷新二维码，避免重复点击触发并发请求。
  let refreshLoading = false;
  // submitting 标识当前是否正在提交 MFA 校验请求。
  let submitting = false;
  // secure 保存当前弹层里输入的 6 位动态验证码。
  let secure = '';
  // dialogErrorMessage 保存当前遮罩层内需要展示的错误提示，避免全局 message 被遮罩挡住。
  let dialogErrorMessage = '';
  // destroyed 标识当前遮罩层是否已经销毁，避免重复恢复 body 状态。
  let destroyed = false;
  // container 保存当前挂载到 body 的遮罩层容器。
  const container = document.createElement('div');
  // previousBodyOverflow 保存 body 原始滚动状态，销毁时恢复。
  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(container);
  let resolveDialog: ((value: MFACheckDialogResult) => void) | null = null;
  let rejectDialog: ((reason?: any) => void) | null = null;

  // destroyOverlay 卸载遮罩层并恢复 body 状态。
  const destroyOverlay = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    render(null, container);
    container.remove();
    document.body.style.overflow = previousBodyOverflow;
  };

  // refreshOverlay 重新渲染当前全屏 MFA 遮罩层。
  const refreshOverlay = (needFocus = false) => {
    if (destroyed) {
      return;
    }
    const layout = resolveMfaDialogLayout(currentBuildMfaUrl);
    render(
      h(
        'div',
        {
          class:
            'fixed inset-0 z-[2600] overflow-y-auto bg-background/88 backdrop-blur-xl',
        },
        [
          h('div', {
            class:
              'absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.12),transparent_38%)]',
          }),
          h(
            'div',
            {
              class:
                'relative flex min-h-screen items-center justify-center px-4 py-3 sm:px-5 lg:px-6',
            },
            [
              h(
                'div',
                {
                  class: `relative w-full ${layout.cardClass}`,
                },
                [
                  h(
                    'div',
                    {
                      class:
                        'overflow-hidden rounded-[28px] border border-[var(--vben-border-color)] bg-background shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
                    },
                    [
                      h(
                        'div',
                        {
                          class:
                            'border-b border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60 px-4 py-3 sm:px-6',
                        },
                        [
                          h(
                            'div',
                            {
                              class:
                                'flex flex-wrap items-start justify-between gap-4',
                            },
                            [
                              h('div', { class: 'space-y-1.5' }, [
                                h(
                                  'div',
                                  {
                                    class:
                                      'text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase',
                                  },
                                  $t(
                                    'business.message.mfaSensitiveOperationLabel',
                                  ),
                                ),
                                h(
                                  'div',
                                  {
                                    class:
                                      'text-xl font-semibold text-foreground',
                                  },
                                  title,
                                ),
                                h(
                                  'div',
                                  {
                                    class:
                                      'max-w-3xl text-sm leading-5 text-foreground/65',
                                  },
                                  currentBuildMfaUrl
                                    ? $t(
                                        'business.message.mfaSensitiveBindDesc',
                                      )
                                    : $t(
                                        'business.message.mfaSensitiveVerifyDesc',
                                      ),
                                ),
                              ]),
                              h(
                                'div',
                                {
                                  class:
                                    'rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-medium text-primary',
                                },
                                currentBuildMfaUrl
                                  ? $t(
                                      'business.message.mfaBindAndVerifyIntegrated',
                                    )
                                  : $t('business.message.mfaCodeConfirm'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      h(
                        'div',
                        {
                          class:
                            'max-h-[calc(100vh-132px)] overflow-y-auto px-4 py-3 sm:px-5',
                        },
                        [
                          buildMfaVerificationContent(
                            currentBuildMfaUrl,
                            currentOptions,
                            secure,
                            dialogErrorMessage,
                            (value) => {
                              secure = normalizeMfaSecure(value);
                              dialogErrorMessage = '';
                              refreshOverlay();
                            },
                            () => {
                              void submitCheck();
                            },
                            currentOptions.allowRefresh
                              ? () => {
                                  void handleRefresh();
                                }
                              : undefined,
                            refreshLoading,
                            () =>
                              buildMfaDialogActions({
                                cancelText: $t('business.message.mfaCancel'),
                                disabled: submitting,
                                loading: submitting,
                                okText,
                                onCancel: () => {
                                  destroyOverlay();
                                  rejectDialog?.(new Error(cancelErrorMessage));
                                },
                                onSubmit: () => {
                                  void submitCheck();
                                },
                              }),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      container,
    );
    if (needFocus) {
      focusMfaCheckInput();
    }
  };

  // handleRefresh 重新生成当前账号的 MFA 二维码，并同步刷新弹窗上下文。
  const handleRefresh = async () => {
    if (refreshLoading) {
      return;
    }
    dialogErrorMessage = '';
    refreshLoading = true;
    refreshOverlay();
    try {
      const result = await refreshProfileMfaSecretKey();
      const profile = await fetchProfileInfo().catch(() => undefined);
      currentBuildMfaUrl =
        String(result?.buildMFAURL || '').trim() ||
        String(profile?.buildMFAURL || '').trim() ||
        currentBuildMfaUrl;
      currentOptions = {
        ...currentOptions,
        accountName:
          String(profile?.username || '').trim() || currentOptions.accountName,
      };
      message.success($t('business.message.mfaQrRegenerated'));
    } catch {
      dialogErrorMessage = $t('business.message.mfaRefreshQrFailed');
    } finally {
      refreshLoading = false;
      refreshOverlay(true);
    }
  };

  // submitCheck 执行 MFA 动态码校验。
  const submitCheck = async () => {
    if (submitting) {
      return;
    }
    dialogErrorMessage = '';
    if (!secure) {
      dialogErrorMessage = $t('business.message.mfaCodeMissing');
      refreshOverlay(true);
      throw new Error($t('business.message.mfaCodeMissing'));
    }
    if (!/^\d{6}$/.test(secure)) {
      dialogErrorMessage = $t('business.message.mfaCodeRequired');
      refreshOverlay(true);
      throw new Error($t('business.message.mfaCodeRequired'));
    }
    submitting = true;
    refreshOverlay();
    try {
      const result = await checkMfaSecureApi(
        {
          scenarios: scenario,
          secure,
          mfaSecureKey: extractMfaSecret(currentBuildMfaUrl) || undefined,
        },
        {
          skipGlobalErrorMessage: true,
        },
      );
      if (!result?.isOk || (requireTwoStep && !result.twoStep)) {
        dialogErrorMessage = $t('business.message.mfaCodeInvalid');
        throw new Error($t('business.message.mfaCodeInvalid'));
      }
      dialogErrorMessage = '';
      destroyOverlay();
      resolveDialog?.({
        response: result,
        secure,
      });
    } catch (error) {
      dialogErrorMessage = resolveDialogErrorMessage(
        error,
        $t('business.message.mfaCodeInvalid'),
      );
      refreshOverlay(true);
    } finally {
      submitting = false;
      refreshOverlay();
    }
  };

  const promise = new Promise<MFACheckDialogResult>((resolve, reject) => {
    resolveDialog = resolve;
    rejectDialog = reject;
    refreshOverlay(true);
  });
  return {
    destroy() {
      destroyOverlay();
    },
    promise,
  };
}

// requestMfaCheck 弹出 MFA 校验弹窗并返回后端校验结果。
export async function requestMfaCheck(
  scenario: number,
  options: MFACheckDialogOptions = {},
) {
  const dialog = createMfaCheckDialog(scenario, options);
  const result = await dialog.promise;
  rememberMfaTwoStepTicket(result.response.scenarios, result.response.twoStep);
  return result.response;
}

// requestMfaTwoStep 弹出MFA动态码输入框并换取二次校验票据。
export async function requestMfaTwoStep(
  scenario: number,
  title = $t('business.message.mfaSecondConfirmTitle'),
  buildMfaUrl = '',
) {
  const cachedTicket = getReusableMfaTwoStepTicket(scenario);
  if (cachedTicket) {
    return cachedTicket;
  }
  const result = await requestMfaCheck(scenario, {
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
  const cachedTicket = getReusableMfaTwoStepTicket(scenario);
  try {
    return await submit(cachedTicket);
  } catch (error) {
    if (!isMfaAgainError(error)) {
      throw error;
    }
    clearMfaTwoStepTicket();
    const dialogOptions = await loadCurrentMfaDialogOptions({
      ...options,
      requireTwoStep: true,
      title,
    });
    const result = await requestMfaCheck(scenario, dialogOptions);
    if (!result.twoStep) {
      throw new Error($t('business.message.mfaTwoStepTicketMissing'), {
        cause: error,
      });
    }
    const ticket = result.twoStep;
    return await submit(ticket);
  }
}
