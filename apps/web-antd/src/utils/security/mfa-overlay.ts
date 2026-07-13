import { h, render } from 'vue';

import { Alert, Button, Input, message, QRCode, Space } from 'ant-design-vue';

import { $t } from '#/locales';

import {
  extractMfaManualInfo,
  mfaAccountLabel,
  mfaBindingLabel,
  mfaIssuerLabel,
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

// MfaCancelledError 表示用户取消或会话切换主动销毁 MFA 弹层，不属于业务执行失败。
export class MfaCancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MfaCancelledError';
  }
}

// isMfaCancelledError 判断 MFA Promise 是否因主动取消而结束。
export function isMfaCancelledError(
  error: unknown,
): error is MfaCancelledError {
  return error instanceof MfaCancelledError;
}

// activeMfaOverlayDialogs 保存当前应用仍未结算的 MFA 遮罩销毁函数。
const activeMfaOverlayDialogs = new Set<() => void>();
// mfaOverlayBodyOverflow 保存首个遮罩打开前的 body 状态，仅在最后一个遮罩关闭时恢复。
let mfaOverlayBodyOverflow: null | string = null;

// destroyAllMfaOverlayDialogs 取消全部 MFA 遮罩；逆序销毁可正确恢复嵌套弹层前的 body 状态。
export function destroyAllMfaOverlayDialogs() {
  for (const destroy of [...activeMfaOverlayDialogs].toReversed()) {
    destroy();
  }
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
          getMfaAuthenticatorApps().join(
            $t('business.message.mfaAppListSeparator'),
          ),
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

// buildMfaVerifyIdentityMeta 渲染动态码确认页的发行方与账号，便于区分多个验证器条目。
function buildMfaVerifyIdentityMeta(
  info: ReturnType<typeof extractMfaManualInfo>,
  options: MFAOverlayDialogOptions<unknown>,
) {
  const rows = [
    {
      label: $t('business.message.mfaIssuer'),
      value: mfaIssuerLabel(info),
    },
    {
      label: $t('business.message.mfaAccount'),
      value: mfaAccountLabel(
        info,
        options.accountName || $t('business.message.mfaCurrentAccount'),
      ),
    },
  ];
  return h(
    'div',
    {
      class: 'grid gap-3 sm:grid-cols-2',
    },
    rows.map((row) =>
      h(
        'div',
        {
          class:
            'min-w-0 rounded-xl border border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/45 px-4 py-3',
        },
        [
          h(
            'div',
            {
              class: 'text-xs font-medium text-foreground/55',
            },
            row.label,
          ),
          h(
            'span',
            {
              class:
                'mt-1 block truncate text-sm font-semibold text-foreground',
              title: row.value,
            },
            row.value,
          ),
        ],
      ),
    ),
  );
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
  refreshDisabled = false,
  renderActions?: () => any,
) {
  const info = extractMfaManualInfo(buildMfaUrl);
  if (!buildMfaUrl) {
    return h('div', { class: 'space-y-4' }, [
      h('div', { class: 'space-y-1' }, [
        h(
          'div',
          { class: 'text-base font-semibold text-foreground' },
          $t('business.message.mfaInputAuthenticatorCodeTitle'),
        ),
        h(
          'div',
          { class: 'text-sm leading-6 text-foreground/65' },
          options.headerDescription ||
            $t('business.message.mfaSensitiveDefaultDesc'),
        ),
      ]),
      buildMfaVerifyIdentityMeta(info, options),
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
            'rounded-xl border border-dashed border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/55 px-4 py-3',
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
        },
        [
          h(Input, {
            'aria-label': $t('business.message.mfaCodePlaceholder'),
            autocomplete: 'one-time-code',
            class: 'mfa-check-input h-10 min-w-0 sm:max-w-[420px] sm:flex-1',
            inputmode: 'numeric',
            maxlength: 6,
            name: 'mfaVerificationCode',
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
          $t('business.message.mfaSecurityCheckLabel'),
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
    h('div', { class: 'grid gap-3 xl:grid-cols-[253px_minmax(0,1fr)]' }, [
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
          h('div', { class: 'flex justify-center rounded-lg bg-white p-0.5' }, [
            h(QRCode, {
              bgColor: '#ffffff',
              bordered: false,
              class: '!h-[189px] !w-[189px] !border-0 !p-0',
              color: '#000000',
              key: buildMfaUrl,
              size: 215,
              value: buildMfaUrl,
            }),
          ]),
          options.allowRefresh
            ? h(
                Button,
                {
                  block: true,
                  disabled: refreshDisabled,
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
                    'aria-label': $t('business.message.mfaManualSecret'),
                    autocomplete: 'off',
                    class: 'w-full',
                    name: 'mfaManualSecret',
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
    cardClass: 'max-w-[720px]',
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
  if (activeMfaOverlayDialogs.size === 0) {
    mfaOverlayBodyOverflow = document.body.style.overflow;
  }
  document.body.style.overflow = 'hidden';
  document.body.append(container);
  let resolveDialog: ((value: MFAOverlayDialogResult<Result>) => void) | null =
    null;
  let rejectDialog: ((reason?: any) => void) | null = null;
  let settled = false;
  let cancelDialog = () => {};

  // destroyOverlay 卸载遮罩层并恢复 body 状态。
  const destroyOverlay = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    render(null, container);
    container.remove();
    activeMfaOverlayDialogs.delete(cancelDialog);
    if (activeMfaOverlayDialogs.size === 0) {
      document.body.style.overflow = mfaOverlayBodyOverflow ?? '';
      mfaOverlayBodyOverflow = null;
    } else {
      document.body.style.overflow = 'hidden';
    }
  };

  // rejectOnce 取消弹窗并只拒绝一次 Promise，避免仅卸载 DOM 后调用方永久等待。
  const rejectOnce = (error: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    destroyOverlay();
    rejectDialog?.(error);
  };

  // resolveOnce 完成弹窗并只提交一次结果。
  const resolveOnce = (result: MFAOverlayDialogResult<Result>) => {
    if (settled) {
      return;
    }
    settled = true;
    destroyOverlay();
    resolveDialog?.(result);
  };

  cancelDialog = () => rejectOnce(new MfaCancelledError(cancelErrorMessage));

  // refreshOverlay 重新渲染当前全屏 MFA 遮罩层。
  const refreshOverlay = (needFocus = false) => {
    if (destroyed) {
      return;
    }
    const hasBindingUrl = Boolean(currentBuildMfaUrl);
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
                  'data-mfa-overlay-card': 'true',
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
                          class: [
                            'border-b border-[var(--vben-border-color)] bg-[var(--vben-background-soft)]/60',
                            hasBindingUrl
                              ? 'px-6 py-5 sm:px-8'
                              : 'px-5 py-4 sm:px-6',
                          ],
                        },
                        [
                          h(
                            'div',
                            {
                              class: [
                                'items-start justify-between gap-4',
                                hasBindingUrl ? 'flex flex-wrap' : 'flex',
                              ],
                            },
                            [
                              h('div', { class: 'min-w-0 space-y-1.5' }, [
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
                                    class: [
                                      'font-semibold text-foreground',
                                      hasBindingUrl ? 'text-2xl' : 'text-xl',
                                    ],
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
                                    'shrink-0 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary',
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
                          class: [
                            'max-h-[calc(100vh-180px)] overflow-y-auto px-5 sm:px-6',
                            hasBindingUrl ? 'py-5' : 'py-4',
                          ],
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
                            submitting,
                            () =>
                              buildMfaDialogActions({
                                cancelText: $t('business.message.mfaCancel'),
                                disabled: submitting || refreshLoading,
                                loading: submitting,
                                okText,
                                onCancel: () => {
                                  cancelDialog();
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
    if (
      destroyed ||
      settled ||
      refreshLoading ||
      submitting ||
      !currentOptions.onRefresh
    ) {
      return;
    }
    dialogErrorMessage = '';
    refreshLoading = true;
    refreshOverlay();
    try {
      const nextContext = await currentOptions.onRefresh();
      if (destroyed || settled) {
        return;
      }
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
      if (destroyed || settled) {
        return;
      }
      dialogErrorMessage = resolveDialogErrorMessage(
        error,
        $t('business.message.mfaRefreshQrFailed'),
      );
    } finally {
      refreshLoading = false;
      if (!destroyed && !settled) {
        refreshOverlay(true);
      }
    }
  };

  // submitCheck 执行 MFA 动态码校验。
  const submitCheck = async () => {
    if (destroyed || settled || submitting || refreshLoading) {
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
      resolveOnce({
        result,
        secure,
      });
    } catch (error) {
      if (destroyed || settled) {
        return;
      }
      dialogErrorMessage = resolveDialogErrorMessage(error, submitErrorMessage);
      refreshOverlay(true);
    } finally {
      submitting = false;
      if (!destroyed && !settled) {
        refreshOverlay();
      }
    }
  };

  const promise = new Promise<MFAOverlayDialogResult<Result>>(
    (resolve, reject) => {
      resolveDialog = resolve;
      rejectDialog = reject;
      refreshOverlay(true);
    },
  );
  activeMfaOverlayDialogs.add(cancelDialog);
  return {
    destroy: cancelDialog,
    promise,
  };
}
