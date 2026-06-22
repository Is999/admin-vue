import { h, nextTick, render } from 'vue';

import { Alert, Button, Input, message, QRCode, Space } from 'ant-design-vue';

import { $t } from '#/locales';

import { extractMfaManualInfo, mfaBindingLabel } from './mfa-core';

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

// getMfaBindSteps 返回静态绑定与首次绑定通用步骤。
export function getMfaBindSteps() {
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
export function getMfaGuideSteps() {
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

// MFAOverlayDialogOptions 定义全屏 MFA 遮罩弹层的通用参数。
export type MFAOverlayDialogOptions<Result = unknown> = {
  accountName?: string; // 账号兜底展示名称
  allowRefresh?: boolean; // 是否允许在弹窗中刷新二维码
  buildMfaUrl?: string; // MFA 绑定地址
  cancelErrorMessage?: string; // 取消时抛出的错误信息
  headerDescription?: string; // 顶部说明文案
  headerMessage?: string; // 顶部标题文案
  okText?: string; // 确认按钮文案
  onRefresh?: () => Promise<
    | undefined
    | {
        accountName?: string;
        buildMfaUrl?: string;
      }
  >; // 刷新二维码回调
  onSubmit: (context: {
    buildMfaUrl: string;
    secure: string;
  }) => Promise<Result>; // 提交回调
  refreshSuccessMessage?: string; // 刷新成功提示文案
  submitErrorMessage?: string; // 提交失败兜底文案
  title?: string; // 弹窗标题
};

// MFAOverlayDialogResult 定义全屏 MFA 遮罩弹层返回结果。
export type MFAOverlayDialogResult<Result = unknown> = {
  result: Result; // 提交回调返回结果
  secure: string; // 当前用户输入的 6 位动态验证码
};

// copyMfaSecret 复制 MFA 原始秘钥，便于手动添加到身份验证器。
async function copyMfaSecret(secret = '') {
  const rawSecret = String(secret || '').trim();
  if (!rawSecret) {
    message.warning($t('business.message.mfaSecretUnavailable'));
    return;
  }
  try {
    await navigator.clipboard.writeText(rawSecret);
    message.success($t('business.message.mfaSecretCopied'));
  } catch {
    message.error($t('business.message.copySecretFailedManual'));
  }
}

// normalizeMfaSecure 统一清洗 MFA 动态验证码，只保留 6 位数字。
function normalizeMfaSecure(value = '') {
  return String(value || '')
    .replaceAll(/\D+/g, '')
    .slice(0, 6);
}

// focusMfaCheckInput 在弹层打开或刷新后重新聚焦验证码输入框。
function focusMfaCheckInput() {
  void nextTick(() => {
    document
      .querySelector<HTMLInputElement>('[data-mfa-check-input="true"]')
      ?.focus();
  });
}

// buildMfaAuthenticatorLink 渲染说明句内的身份验证器应用链接，避免额外占一行。
function buildMfaAuthenticatorLink(label: string, href: string) {
  return h(
    'a',
    {
      class: 'font-medium text-primary hover:text-primary/80 hover:underline',
      href,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    label,
  );
}

// buildMfaInstallDescription 把安装说明里的应用名替换为官方帮助链接。
function buildMfaInstallDescription(description: string) {
  const appLinks = [
    {
      href: MFA_GOOGLE_AUTHENTICATOR_HELP_URL,
      label: 'Google Authenticator',
    },
    {
      href: MFA_MICROSOFT_AUTHENTICATOR_HELP_URL,
      label: 'Microsoft Authenticator',
    },
  ];
  let cursor = 0;
  const nodes: Array<ReturnType<typeof h> | string> = [];
  for (const link of appLinks) {
    const index = description.indexOf(link.label, cursor);
    if (index === -1) {
      continue;
    }
    if (index > cursor) {
      nodes.push(description.slice(cursor, index));
    }
    nodes.push(buildMfaAuthenticatorLink(link.label, link.href));
    cursor = index + link.label.length;
  }
  if (cursor < description.length) {
    nodes.push(description.slice(cursor));
  }
  return nodes.length > 0 ? nodes : description;
}

// buildMfaGuideDescription 渲染绑定步骤说明，安装步骤内联应用帮助链接。
function buildMfaGuideDescription(
  step: { description: string },
  index: number,
) {
  if (index === 0) {
    return buildMfaInstallDescription(step.description);
  }
  return step.description;
}

// buildMfaCodeInputBlock 渲染验证码提示与输入框，统一控制内部间距。
function buildMfaCodeInputBlock(
  secure: string,
  errorMessage: string,
  onSecureChange: (value: string) => void,
  onSubmit?: () => void,
) {
  return h('div', { class: 'space-y-3' }, [
    h(Alert, {
      description: $t('business.message.mfaBindContinueAlertDesc'),
      message: $t('business.message.mfaBindContinueAlertTitle'),
      showIcon: true,
      type: 'info',
    }),
    errorMessage
      ? h(Alert, {
          message: errorMessage,
          showIcon: true,
          type: 'error',
        })
      : null,
    h(Input, {
      autofocus: true,
      class: 'mfa-check-input',
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
  ]);
}

// buildMfaGuideSummary 渲染紧凑版 MFA 绑定说明，避免全屏遮罩里重复滚动过长。
function buildMfaGuideSummary() {
  return h('div', { class: 'space-y-3' }, [
    h('div', { class: 'flex items-center justify-between gap-3' }, [
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
      { class: 'grid gap-3 md:grid-cols-3' },
      getMfaGuideSteps().map((step, index) =>
        h(
          'div',
          {
            class:
              'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-3',
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
  info: ReturnType<typeof extractMfaManualInfo>,
  options: MFAOverlayDialogOptions<unknown>,
) {
  return h('div', { class: 'grid gap-3 sm:grid-cols-2' }, [
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-3',
      },
      [
        h(
          'div',
          { class: 'text-xs font-medium text-foreground/55' },
          $t('business.message.mfaApplicableApps'),
        ),
        h(
          'div',
          { class: 'mt-2 text-sm leading-6 text-foreground' },
          getMfaAuthenticatorApps().join('、'),
        ),
      ],
    ),
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 p-3',
      },
      [
        h(
          'div',
          { class: 'text-xs font-medium text-foreground/55' },
          $t('business.message.mfaIssuerAccount'),
        ),
        h(
          'div',
          { class: 'mt-2 text-sm leading-6 text-foreground' },
          mfaBindingLabel(
            info,
            options.accountName || $t('business.message.mfaCurrentAccount'),
          ),
        ),
      ],
    ),
  ]);
}

// resolveDialogErrorMessage 优先解析服务端业务提示，否则回退到本地兜底文案。
function resolveDialogErrorMessage(error: any, fallback: string) {
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

// buildMfaVerificationContent 生成 MFA 二次确认主体内容，有绑定地址时展示完整说明。
function buildMfaVerificationContent(
  buildMfaUrl: string,
  options: MFAOverlayDialogOptions,
  secure: string,
  errorMessage: string,
  onSecureChange: (value: string) => void,
  onSubmit?: () => void,
  onRefresh?: () => void,
  refreshLoading = false,
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
      h(Input, {
        autofocus: true,
        class: 'mfa-check-input',
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
    ]);
  }
  return h('div', { class: 'space-y-5' }, [
    h(
      'div',
      {
        class:
          'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60 px-5 py-4',
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
          { class: 'mt-2 text-xl font-semibold text-foreground' },
          options.headerMessage || $t('business.message.mfaBindingInfoTitle'),
        ),
        h(
          'div',
          { class: 'mt-2 text-sm leading-6 text-foreground/65' },
          options.headerDescription || getMfaMicrosoftScanTip(),
        ),
      ],
    ),
    h('div', { class: 'grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]' }, [
      h(
        'div',
        {
          class:
            'space-y-3 rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/50 p-4',
        },
        [
          h(
            'div',
            { class: 'text-sm font-medium text-foreground/80' },
            $t('business.message.mfaBindingQrArea'),
          ),
          h('div', { class: 'flex justify-center' }, [
            h(QRCode, {
              bgColor: '#ffffff',
              color: '#000000',
              key: buildMfaUrl,
              size: 168,
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
            { class: 'border-t border-[var(--vben-border-color)]/80 pt-3' },
            [
              h(
                'div',
                { class: 'text-xs font-medium text-foreground/55' },
                $t('business.message.mfaManualSecret'),
              ),
              h(
                Space,
                { class: 'mt-2 w-full', direction: 'vertical', size: 8 },
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
      h('div', { class: 'min-w-0 space-y-3' }, [
        buildMfaGuideSummary(),
        buildMfaBindingMeta(info, options),
        h(
          'div',
          {
            class:
              'rounded-2xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/50 p-4',
          },
          [
            h(
              'div',
              { class: 'mb-3 flex items-center justify-between gap-3' },
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

// createMfaOverlayDialog 创建 MFA 校验全屏遮罩层，并通过回调完成业务提交。
export function createMfaOverlayDialog<Result = unknown>(
  options: MFAOverlayDialogOptions<Result>,
) {
  const {
    allowRefresh = Boolean(options.allowRefresh && options.onRefresh),
    buildMfaUrl = '',
    cancelErrorMessage = $t('business.message.mfaCancelled'),
    okText = $t('business.message.mfaConfirm'),
    refreshSuccessMessage = $t('business.message.mfaQrRegenerated'),
    submitErrorMessage = $t('business.message.mfaCodeInvalid'),
    title = $t('business.message.mfaSecondConfirmTitle'),
  } = options;
  let currentOptions: MFAOverlayDialogOptions<Result> = {
    ...options,
    allowRefresh,
  };
  let currentBuildMfaUrl = buildMfaUrl;
  let refreshLoading = false;
  let submitting = false;
  let secure = '';
  let dialogErrorMessage = '';
  let destroyed = false;
  const container = document.createElement('div');
  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(container);
  let resolveDialog: ((value: MFAOverlayDialogResult<Result>) => void) | null =
    null;
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
                'relative flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-8',
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
                            'border-b border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60 px-6 py-5 sm:px-8',
                        },
                        [
                          h(
                            'div',
                            {
                              class:
                                'flex flex-wrap items-start justify-between gap-4',
                            },
                            [
                              h('div', { class: 'space-y-2' }, [
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
                                      'text-2xl font-semibold text-foreground',
                                  },
                                  title,
                                ),
                                h(
                                  'div',
                                  {
                                    class:
                                      'max-w-3xl text-sm leading-6 text-foreground/65',
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
                            'max-h-[calc(100vh-180px)] overflow-y-auto px-5 py-5 sm:px-6',
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
                          ),
                        ],
                      ),
                      h(
                        'div',
                        {
                          class:
                            'border-t border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/40 px-6 py-4 sm:px-8',
                        },
                        [
                          h(
                            'div',
                            {
                              class:
                                'flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end',
                            },
                            [
                              h(
                                Button,
                                {
                                  disabled: submitting,
                                  onClick: () => {
                                    destroyOverlay();
                                    rejectDialog?.(
                                      new Error(cancelErrorMessage),
                                    );
                                  },
                                  size: 'large',
                                },
                                {
                                  default: () =>
                                    $t('business.message.mfaCancel'),
                                },
                              ),
                              h(
                                Button,
                                {
                                  loading: submitting,
                                  onClick: () => {
                                    void submitCheck();
                                  },
                                  size: 'large',
                                  type: 'primary',
                                },
                                { default: () => okText },
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
    if (refreshLoading || !currentOptions.onRefresh) {
      return;
    }
    dialogErrorMessage = '';
    refreshLoading = true;
    refreshOverlay();
    try {
      const nextContext = await currentOptions.onRefresh();
      currentBuildMfaUrl =
        String(nextContext?.buildMfaUrl || '').trim() || currentBuildMfaUrl;
      currentOptions = {
        ...currentOptions,
        accountName:
          String(nextContext?.accountName || '').trim() ||
          currentOptions.accountName,
      };
      message.success(refreshSuccessMessage);
    } catch (error) {
      dialogErrorMessage = resolveDialogErrorMessage(
        error,
        $t('business.message.mfaRefreshQrFailed'),
      );
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
      return;
    }
    if (!/^\d{6}$/.test(secure)) {
      dialogErrorMessage = $t('business.message.mfaCodeRequired');
      refreshOverlay(true);
      return;
    }
    submitting = true;
    refreshOverlay();
    try {
      const result = await currentOptions.onSubmit({
        buildMfaUrl: currentBuildMfaUrl,
        secure,
      });
      dialogErrorMessage = '';
      destroyOverlay();
      resolveDialog?.({
        result,
        secure,
      });
    } catch (error) {
      dialogErrorMessage = resolveDialogErrorMessage(error, submitErrorMessage);
      refreshOverlay(true);
    } finally {
      submitting = false;
      refreshOverlay();
    }
  };

  const promise = new Promise<MFAOverlayDialogResult<Result>>(
    (resolve, reject) => {
      resolveDialog = resolve;
      rejectDialog = reject;
      refreshOverlay(true);
    },
  );
  return {
    destroy() {
      destroyOverlay();
    },
    promise,
  };
}
