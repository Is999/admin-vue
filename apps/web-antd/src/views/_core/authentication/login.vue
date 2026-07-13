<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, h, onMounted, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { InspectionPanel, LockKeyhole, UserRoundPen } from '@vben/icons';
import { $t } from '@vben/locales';

import { Modal } from 'ant-design-vue';

import { getLoginCaptchaApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

// authStore 表示登录态 Pinia Store，负责提交账号密码和写入 token。
const authStore = useAuthStore();
// captchaImage 保存后端返回的图形验证码 data URL。
const captchaImage = ref('');
// captchaKey 保存图形验证码缓存 key，登录时必须随验证码文本一起提交。
const captchaKey = ref('');
// captchaLoading 表示验证码拉取中状态，用于禁用提交和刷新按钮。
const captchaLoading = ref(false);
// loginRef 保存登录表单组件实例，便于刷新验证码后清空验证码输入框。
const loginRef = ref<null | { getFormApi: () => any }>(null);

// 登录页挂载时兜底清理可能遗留的全局确认框，并预先拉取一张验证码图片。
onMounted(async () => {
  Modal.destroyAll();
  await loadLoginCaptcha(true);
});

// loadLoginCaptcha 拉取登录图形验证码，并在需要时清空当前输入框。
async function loadLoginCaptcha(resetField = false) {
  captchaLoading.value = true;
  try {
    const result = await getLoginCaptchaApi();
    captchaImage.value = result?.image || '';
    captchaKey.value = result?.key || '';
  } catch {
    captchaImage.value = '';
    captchaKey.value = '';
  } finally {
    captchaLoading.value = false;
  }
  if (resetField) {
    await loginRef.value?.getFormApi().setFieldValue('captcha', '', false);
  }
}

// handleLoginSubmit 在提交时把验证码 key 一并带给后端；登录失败后自动刷新验证码，避免复用已消费值。
async function handleLoginSubmit(values: Record<string, any>) {
  if (captchaLoading.value || !captchaKey.value) {
    if (!captchaLoading.value) {
      await loadLoginCaptcha(true);
    }
    return;
  }
  try {
    await authStore.authLogin({
      ...values,
      key: captchaKey.value,
    });
  } catch {
    await loadLoginCaptcha(true);
  }
}

// formSchema 定义登录表单字段，图形验证码为强制字段，不再受环境开关控制。
const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'Input',
      componentProps: {
        size: 'large',
        placeholder: $t('authentication.usernameTip'),
      },
      renderComponentContent: () => ({
        prefix: () =>
          h(UserRoundPen, {
            class: 'size-4 text-muted-foreground',
          }),
      }),
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'InputPassword',
      renderComponentContent: () => ({
        prefix: () =>
          h(LockKeyhole, {
            class: 'size-4 text-muted-foreground',
          }),
      }),
      componentProps: {
        size: 'large',
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'Input',
      componentProps: {
        size: 'large',
        placeholder: $t('authentication.captchaTip'),
      },
      renderComponentContent: () => ({
        prefix: () =>
          h(InspectionPanel, {
            class: 'size-4 text-muted-foreground',
          }),
      }),
      fieldName: 'captcha',
      label: $t('authentication.captcha'),
      rules: z.string().min(1, { message: $t('authentication.captchaTip') }),
      suffix: () =>
        h(
          'button',
          {
            class:
              'inline-flex h-10 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white p-0 align-middle leading-none shadow-sm transition hover:border-primary/50 disabled:cursor-not-allowed',
            'aria-label': $t('authentication.captchaRefreshAriaLabel'),
            disabled: captchaLoading.value,
            onClick: (event: Event) => {
              event.preventDefault();
              void loadLoginCaptcha(true);
            },
            type: 'button',
          },
          captchaImage.value
            ? h('img', {
                alt: $t('authentication.captchaImageAlt'),
                class: 'block h-full w-full bg-white object-fill',
                src: captchaImage.value,
              })
            : h(
                'span',
                {
                  class:
                    'flex h-full w-full items-center justify-center bg-white px-3 text-xs text-slate-500',
                },
                captchaLoading.value
                  ? $t('authentication.captchaLoading')
                  : $t('authentication.captchaClickToLoad'),
              ),
        ),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading || captchaLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    @submit="handleLoginSubmit"
  />
</template>
