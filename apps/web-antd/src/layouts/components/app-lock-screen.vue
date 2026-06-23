<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';

import { VbenAvatar, VbenButton } from '@vben/common-ui';
import { LockKeyhole } from '@vben/icons';
import { useAccessStore } from '@vben/stores';

import { useDateFormat, useNow, useScrollLock } from '@vueuse/core';
import { Input, message, Segmented, Space } from 'ant-design-vue';

import { checkMfaSecureApi, checkSecureApi } from '#/api';
import { $t, $te } from '#/locales';

// LockMode 表示锁屏解锁方式。
type LockMode = 'mfa' | 'password' | 'temporary';

// Props 定义锁屏组件入参。
interface Props {
  avatar?: string; // 当前登录用户头像
}

defineOptions({
  name: 'AppLockScreen',
});

const props = withDefaults(defineProps<Props>(), {
  avatar: '',
});

const emit = defineEmits<{ toLogin: [] }>();

// MFA_SCENARIO_UNLOCK 表示锁屏 MFA 解锁沿用登录 MFA 场景。
const MFA_SCENARIO_UNLOCK = 0;
// UNLOCK_VERIFY_AUTH_FAILED_CODE 表示后端通用验证失败业务码。
const UNLOCK_VERIFY_AUTH_FAILED_CODE = 1002;
// UNLOCK_VERIFY_INVALID_PASSWORD_CODE 表示登录密码验证失败业务码。
const UNLOCK_VERIFY_INVALID_PASSWORD_CODE = 100_001;
// UNLOCK_VERIFY_INVALID_MFA_CODE 表示 MFA 动态验证码验证失败业务码。
const UNLOCK_VERIFY_INVALID_MFA_CODE = 100_005;
// UNLOCK_VERIFY_ERROR_CODES 表示锁屏校验失败但不应退出登录的业务码集合。
const UNLOCK_VERIFY_ERROR_CODES = new Set([
  UNLOCK_VERIFY_AUTH_FAILED_CODE,
  UNLOCK_VERIFY_INVALID_MFA_CODE,
  UNLOCK_VERIFY_INVALID_PASSWORD_CODE,
]);

// accessStore 保存当前锁屏状态和临时密码。
const accessStore = useAccessStore();
// now 保存当前时间，驱动锁屏时钟刷新。
const now = useNow();
// meridiem 保存当前上午/下午标识。
const meridiem = useDateFormat(now, 'A');
// hour 保存当前小时。
const hour = useDateFormat(now, 'HH');
// minute 保存当前分钟。
const minute = useDateFormat(now, 'mm');
// date 保存当前日期。
const date = useDateFormat(now, 'YYYY-MM-DD dddd');

// showUnlockForm 控制是否展示解锁表单。
const showUnlockForm = ref(false);
// unlockMode 保存当前选择的解锁方式。
const unlockMode = ref<LockMode>('temporary');
// temporaryPassword 保存用户输入的锁屏临时密码。
const temporaryPassword = ref('');
// loginPassword 保存用户输入的当前账号登录密码。
const loginPassword = ref('');
// mfaCode 保存用户输入的 MFA 动态验证码。
const mfaCode = ref('');
// submitting 控制解锁按钮加载状态。
const submitting = ref(false);

// avatarSrc 表示传给头像组件的安全头像地址，避免可选 props 直接透传到必填 src。
const avatarSrc = computed(() => props.avatar);

// unlockModeOptions 定义解锁方式切换项。
const unlockModeOptions = computed(() => [
  { label: $t('business.message.temporaryPassword'), value: 'temporary' },
  { label: $t('business.message.loginPassword'), value: 'password' },
  { label: 'MFA', value: 'mfa' },
]);

// currentPlaceholder 根据解锁方式生成输入框占位文案。
const currentPlaceholder = computed(() => {
  if (unlockMode.value === 'password') {
    return $t('business.message.lockLoginPasswordPlaceholder');
  }
  if (unlockMode.value === 'mfa') {
    return $t('business.message.lockMfaCodePlaceholder');
  }
  return $t('business.message.lockTemporaryPasswordPlaceholder');
});

// currentValue 当前解锁方式对应的输入内容。
const currentValue = computed({
  get() {
    if (unlockMode.value === 'password') {
      return loginPassword.value;
    }
    if (unlockMode.value === 'mfa') {
      return mfaCode.value;
    }
    return temporaryPassword.value;
  },
  set(value: string) {
    if (unlockMode.value === 'password') {
      loginPassword.value = value;
      return;
    }
    if (unlockMode.value === 'mfa') {
      mfaCode.value = value;
      return;
    }
    temporaryPassword.value = value;
  },
});

// isMfaMode 判断当前是否使用 MFA 动态码解锁。
const isMfaMode = computed(() => unlockMode.value === 'mfa');

// 监听解锁方式变化后聚焦输入框。
watch(unlockMode, () => {
  focusUnlockInput();
});

// handleModeChange 处理解锁方式切换。
function handleModeChange(value: number | string) {
  unlockMode.value = String(value) as LockMode;
}

// toggleUnlockForm 切换锁屏时钟与解锁表单。
function toggleUnlockForm() {
  showUnlockForm.value = !showUnlockForm.value;
  if (showUnlockForm.value) {
    focusUnlockInput();
  }
}

// focusUnlockInput 聚焦当前解锁输入框。
function focusUnlockInput() {
  nextTick(() => {
    document
      .querySelector<HTMLInputElement>('[data-lock-screen-input="true"]')
      ?.focus();
  });
}

// handleSubmit 根据当前解锁方式执行校验。
async function handleSubmit() {
  const value = currentValue.value.trim();
  if (!value) {
    message.error(currentPlaceholder.value);
    return;
  }
  submitting.value = true;
  try {
    let passed = false;
    if (unlockMode.value === 'temporary') {
      passed = validateTemporaryPassword(value);
    } else if (unlockMode.value === 'password') {
      passed = await validateLoginPassword(value);
    } else {
      passed = await validateMfaCode(value);
    }
    if (!passed) {
      return;
    }
    clearUnlockFields();
    accessStore.unlockScreen();
  } finally {
    submitting.value = false;
  }
}

// validateTemporaryPassword 校验锁屏时设置的本地临时密码。
function validateTemporaryPassword(value: string) {
  if (!accessStore.lockScreenPassword) {
    message.error($t('business.message.lockTemporaryPasswordUnavailable'));
    return false;
  }
  if (accessStore.lockScreenPassword !== value) {
    message.error($t('business.message.lockTemporaryPasswordInvalid'));
    return false;
  }
  return true;
}

// validateLoginPassword 调用后端校验当前账号登录密码。
async function validateLoginPassword(value: string) {
  const response = await checkSecureApi(
    { secure: value },
    {
      responseReturn: 'body',
      skipReAuthenticate: true,
      skipGlobalErrorMessage: true,
    },
  ).catch((error) => {
    showUnlockVerifyError(error, 'business.message.loginPasswordVerifyFailed');
    return undefined;
  });
  const result = unwrapUnlockVerifyData(response);
  if (!response) {
    return false;
  }
  if (!result?.isOk) {
    message.error(
      readUnlockVerifyMessage(
        response,
        'business.message.loginPasswordInvalid',
      ),
    );
    return false;
  }
  return true;
}

// validateMfaCode 调用后端校验 MFA 动态验证码。
async function validateMfaCode(value: string) {
  if (!/^\d{6}$/.test(value)) {
    message.error($t('business.message.lockMfaCodePlaceholder'));
    return false;
  }
  const result = await checkMfaSecureApi(
    {
      scenarios: MFA_SCENARIO_UNLOCK,
      secure: value,
    },
    {
      responseReturn: 'body',
      skipReAuthenticate: true,
      skipGlobalErrorMessage: true,
      skipLoginMfaHandler: true,
    },
  ).catch((error) => {
    showUnlockVerifyError(error, 'business.message.mfaCodeVerifyFailed');
    return undefined;
  });
  const data = unwrapUnlockVerifyData(result);
  if (!result) {
    return false;
  }
  if (!data?.isOk) {
    message.error(
      readUnlockVerifyMessage(result, 'business.message.mfaCodeInvalid'),
    );
    return false;
  }
  return true;
}

// unwrapUnlockVerifyData 兼容 responseReturn=body 与默认 data 两种响应结构。
function unwrapUnlockVerifyData(response: any) {
  return response?.data && typeof response.data === 'object'
    ? response.data
    : response;
}

// readUnlockVerifyMessage 读取后端业务错误提示，验证错误只提示不退出登录。
function readUnlockVerifyMessage(response: any, fallbackKey: string) {
  const text = String(response?.message || response?.error || '').trim();
  if (!text) {
    return $t(fallbackKey);
  }
  return $te(text) ? $t(text) : text;
}

// showUnlockVerifyError 展示非登录失效类校验错误，避免被全局错误流重复提示。
function showUnlockVerifyError(error: any, fallbackKey: string) {
  const status = Number(error?.status || error?.response?.status || 0);
  const code = Number(error?.response?.data?.code || error?.code || 0);
  if (status === 401 && !UNLOCK_VERIFY_ERROR_CODES.has(code)) {
    handleToLogin();
    return;
  }
  message.error(
    readUnlockVerifyMessage(error?.response?.data || error, fallbackKey),
  );
}

// clearUnlockFields 清理所有解锁输入，避免解锁后残留敏感内容。
function clearUnlockFields() {
  temporaryPassword.value = '';
  loginPassword.value = '';
  mfaCode.value = '';
}

// handleToLogin 清理本地输入并回到登录页。
function handleToLogin() {
  clearUnlockFields();
  emit('toLogin');
}

// isBodyLocked 锁定页面滚动，避免锁屏层展示期间底层内容滚动。
const isBodyLocked = useScrollLock(document.body);
isBodyLocked.value = true;
onScopeDispose(() => {
  isBodyLocked.value = false;
});
</script>

<template>
  <div class="fixed z-[2000] size-full bg-background">
    <transition name="slide-left">
      <div v-show="!showUnlockForm" class="size-full">
        <div
          class="flex-col-center group fixed left-1/2 top-6 z-[2001] -translate-x-1/2 cursor-pointer text-xl font-semibold text-foreground/80 hover:text-foreground"
          @click="toggleUnlockForm"
        >
          <LockKeyhole
            class="size-5 transition-all duration-300 group-hover:scale-125"
          />
          <span>{{ $t('business.message.clickToUnlock') }}</span>
        </div>
        <div class="flex h-full w-full items-center justify-center">
          <div class="flex w-full justify-center gap-4 px-4 sm:gap-6 md:gap-8">
            <div
              class="relative flex h-[140px] w-[140px] items-center justify-center rounded-xl bg-accent text-[36px] sm:h-[160px] sm:w-[160px] sm:text-[42px] md:h-[200px] md:w-[200px] md:text-[72px]"
            >
              <span
                class="absolute left-3 top-3 text-xs font-semibold sm:text-sm md:text-xl"
              >
                {{ meridiem }}
              </span>
              {{ hour }}
            </div>
            <div
              class="flex h-[140px] w-[140px] items-center justify-center rounded-xl bg-accent text-[36px] sm:h-[160px] sm:w-[160px] sm:text-[42px] md:h-[200px] md:w-[200px] md:text-[72px]"
            >
              {{ minute }}
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition name="slide-right">
      <div
        v-if="showUnlockForm"
        class="flex-center size-full"
        @keydown.enter.prevent="handleSubmit"
      >
        <div class="flex-col-center mb-10 w-[92%] max-w-[360px] px-4">
          <VbenAvatar :src="avatarSrc" class="mb-6 size-20 enter-x" />
          <Segmented
            :options="unlockModeOptions"
            :value="unlockMode"
            block
            class="mb-4 w-full enter-x"
            @change="handleModeChange"
          />
          <div class="mb-2 w-full enter-x">
            <Input
              v-if="isMfaMode"
              v-model:value="currentValue"
              data-lock-screen-input="true"
              :maxlength="6"
              :placeholder="currentPlaceholder"
              size="large"
            />
            <Input.Password
              v-else
              v-model:value="currentValue"
              data-lock-screen-input="true"
              :placeholder="currentPlaceholder"
              size="large"
            />
          </div>
          <Space class="w-full enter-x" direction="vertical" :size="8">
            <VbenButton
              class="w-full"
              :disabled="submitting"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ $t('business.message.unlock') }}
            </VbenButton>
            <VbenButton class="w-full" variant="ghost" @click="handleToLogin">
              {{ $t('business.message.backToLogin') }}
            </VbenButton>
            <VbenButton
              class="w-full"
              variant="ghost"
              @click="toggleUnlockForm"
            >
              {{ $t('business.message.back') }}
            </VbenButton>
          </Space>
        </div>
      </div>
    </transition>

    <div
      class="absolute bottom-5 w-full text-center text-xl enter-y md:text-2xl xl:text-xl 2xl:text-3xl"
    >
      <div v-if="showUnlockForm" class="mb-2 text-2xl enter-x md:text-3xl">
        {{ hour }}:{{ minute }}
        <span class="text-base md:text-lg">{{ meridiem }}</span>
      </div>
      <div class="text-xl md:text-3xl">{{ date }}</div>
    </div>
  </div>
</template>
