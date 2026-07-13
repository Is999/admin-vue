import type { MFAGuideStep } from './mfa-guide';

import { h, nextTick } from 'vue';

import { Alert, Button, Input, message } from 'ant-design-vue';

import { $t } from '#/locales';

import { getMfaAuthenticatorHelpLinks } from './mfa-guide';

// copyMfaSecret 复制 MFA 原始秘钥，便于手动添加到身份验证器。
export async function copyMfaSecret(secret = '') {
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

// focusMfaCheckInput 在弹层打开或刷新后重新聚焦验证码输入框。
export function focusMfaCheckInput() {
  void nextTick(() => {
    document
      .querySelector<HTMLInputElement>('[data-mfa-check-input="true"]')
      ?.focus();
  });
}

// buildMfaGuideDescription 渲染绑定步骤说明，安装步骤内联应用帮助链接。
export function buildMfaGuideDescription(
  step: Pick<MFAGuideStep, 'description'>,
  index: number,
) {
  if (index === 0) {
    return buildMfaInstallDescription(step.description);
  }
  return step.description;
}

// buildMfaDialogActions 渲染 MFA 弹层确认与取消按钮。
export function buildMfaDialogActions(options: {
  cancelText: string;
  disabled?: boolean;
  loading?: boolean;
  okText: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return h('div', { class: 'flex flex-none flex-row items-center gap-3' }, [
    h(
      Button,
      {
        class: 'h-10 min-w-[96px]',
        loading: options.loading,
        onClick: options.onSubmit,
        size: 'large',
        type: 'primary',
      },
      { default: () => options.okText },
    ),
    h(
      Button,
      {
        class: 'h-10 min-w-[96px]',
        disabled: options.disabled,
        onClick: options.onCancel,
        size: 'large',
      },
      { default: () => options.cancelText },
    ),
  ]);
}

// buildMfaCodeInputBlock 渲染 MFA 验证码提示与输入框，供普通弹窗和全屏遮罩共用。
export function buildMfaCodeInputBlock(
  secure: string,
  errorMessage: string,
  onSecureChange: (value: string) => void,
  onSubmit?: () => void,
  renderActions?: () => any,
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
    h(
      'div',
      {
        class:
          'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start',
        style: { marginTop: '8px' },
      },
      [
        h(Input, {
          'aria-label': $t('business.message.mfaCodePlaceholder'),
          autocomplete: 'one-time-code',
          class: 'mfa-check-input h-10 min-w-0 sm:max-w-[560px] sm:flex-1',
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
  const appLinks = getMfaAuthenticatorHelpLinks();
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
