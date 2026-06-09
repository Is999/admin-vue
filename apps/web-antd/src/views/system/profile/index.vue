<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
// ================= 类型与依赖引入 =================
import type { AuthApi } from '#/api';
import type { SystemAdminApi, SystemProfileApi } from '#/api/system';

import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, VbenButton, z } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Card,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  QRCode,
  Space,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { requestClient } from '#/api/request';
import {
  fetchProfileInfo,
  updateProfileInfo,
  updateProfileMfaStatus,
  updateProfilePassword,
} from '#/api/system';
import { $t } from '#/locales';
import { resolveRequestErrorMessage } from '#/utils/file/download';
import { cropAvatarFile, resolveDisplayFileURL } from '#/utils/file/image';
import {
  extractMfaSecret,
  formatMfaSecret,
  isMfaAgainError,
  requestMfaTwoStep,
  ticketPayload,
} from '#/utils/security/mfa';
import {
  copyTextToClipboard,
  generateRandomPassword,
  getPasswordRuleMessage,
  isValidStrongPassword,
  validateStrongPassword,
} from '#/utils/security/password';
import { createResumableUpload } from '#/utils/transfer/resumable-upload';

// MFA_SCENARIO_CHANGE_PASSWORD 表示修改密码二次校验场景。
const MFA_SCENARIO_CHANGE_PASSWORD = 1;
// MFA_SCENARIO_STATUS 表示修改MFA状态二次校验场景。
const MFA_SCENARIO_STATUS = 2;
// profile 保存当前登录管理员资料。
const profile = ref<SystemProfileApi.Item>({});
// loading 控制页面加载状态。
const loading = ref(false);
// router 用于跳转到 MFA 静态绑定页。
const router = useRouter();
// route 用于识别守卫附带的强制改密查询参数。
const route = useRoute();
// userStore 用于同步登录态里的必须改密标记。
const userStore = useUserStore();

// profileId 读取当前登录管理员 ID。
const profileId = computed(() => Number(profile.value.id || 0));
// profileMfaStatus 读取 MFA 状态字段。
const profileMfaStatus = computed(() => Number(profile.value.mfaStatus || 0));
// profileMfaUrl 读取 MFA 绑定地址字段。
const profileMfaUrl = computed(() =>
  profileMfaStatus.value === 1 ? '' : String(profile.value.buildMFAURL || ''),
);
// profileMfaSecret 从绑定地址中解析手动添加秘钥。
const profileMfaSecret = computed(() =>
  formatMfaSecret(extractMfaSecret(profileMfaUrl.value)),
);
// profileHasMfaBindingMaterial 标识当前页面是否存在可展示的 MFA 绑定材料。
const profileHasMfaBindingMaterial = computed(() =>
  Boolean(profileMfaUrl.value || profileMfaSecret.value),
);
// profileForceMfaEnabled 标识系统是否开启强制启用 MFA。
const profileForceMfaEnabled = computed(() =>
  Boolean(profile.value.forceMFAEnabled),
);
// profileMfaBindRequired 标识当前账号是否必须重新绑定并启用 MFA。
const profileMfaBindRequired = computed(() =>
  Boolean(profile.value.mfaBindRequired),
);
// profileMfaDeviceUnavailable 标识账号已启用 MFA，但当前设备/秘钥已不可用，只能联系管理员处理。
const profileMfaDeviceUnavailable = computed(
  () => profileMfaStatus.value === 1 && !profile.value.existMFA,
);
// profileNeedResetPassword 归一化必须改密状态。
const profileNeedResetPassword = computed(
  () =>
    Number(
      profile.value.needResetPassword ||
        userStore.userInfo?.needResetPassword ||
        0,
    ) === 1,
);
// avatarUploading 控制头像上传中的按钮状态。
const avatarUploading = ref(false);
// avatarPreviewURL 保存当前头像预览地址。
const avatarPreviewURL = ref('');
// avatarPreviewFailed 标识当前头像预览是否加载失败，失败后回退到占位展示。
const avatarPreviewFailed = ref(false);
// avatarInputRef 绑定头像文件选择器。
const avatarInputRef = ref<HTMLInputElement | null>(null);

// profileSchema 定义基础资料表单。
const profileSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'realName',
    label: $t('business.message.profileRealName'),
  },
  {
    component: 'Input',
    fieldName: 'email',
    label: $t('business.message.profileEmail'),
  },
  {
    component: 'Input',
    fieldName: 'phone',
    label: $t('business.message.profilePhone'),
  },
  {
    component: 'Textarea',
    fieldName: 'description',
    label: $t('business.message.profileDescription'),
  },
];

// passwordSchema 定义安全设置表单。
const passwordSchema: VbenFormSchema[] = [
  {
    component: 'InputPassword',
    fieldName: 'passwordOld',
    label: $t('business.message.oldPassword'),
    rules: 'required',
  },
  {
    component: 'InputPassword',
    fieldName: 'passwordNew',
    label: $t('business.message.newPassword'),
    help: $t('business.message.passwordRuleHelp'),
    rules: z
      .string()
      .min(1, { message: $t('business.message.enterNewPassword') })
      .refine((value) => isValidStrongPassword(value), {
        message: getPasswordRuleMessage($t('business.message.newPassword')),
      }),
    suffix: () =>
      h(Space, { size: 4 }, () => [
        h(
          VbenButton,
          {
            onClick: onGenerateNewPassword,
            size: 'sm',
            type: 'primary',
          },
          () => $t('business.message.generate'),
        ),
        h(
          VbenButton,
          {
            onClick: onCopyNewPassword,
            size: 'sm',
          },
          () => $t('business.message.copy'),
        ),
      ]),
  },
  {
    component: 'InputPassword',
    fieldName: 'confirmPassword',
    label: $t('business.message.confirmPassword'),
    rules: 'required',
  },
];

// [ProfileForm, profileFormApi] 创建个人基础资料表单。
const [ProfileForm, profileFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
  },
  schema: profileSchema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// [PasswordForm, passwordFormApi] 创建密码表单。
const [PasswordForm, passwordFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
  },
  schema: passwordSchema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// onMounted 进入页面时加载当前登录用户资料。
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('login-mfa-user-updated', onLoginMfaUserUpdated);
  }
  loadProfile();
});

// onBeforeUnmount 组件销毁时清理全局 MFA 状态同步监听。
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('login-mfa-user-updated', onLoginMfaUserUpdated);
  }
});

// loadProfile 查询当前登录管理员资料并回填表单。
async function loadProfile() {
  loading.value = true;
  try {
    const data = await fetchProfileInfo();
    profile.value = data;
    avatarPreviewURL.value = resolveDisplayFileURL(
      String(data.avatar || ''),
      requestClient.getBaseUrl(),
    );
    avatarPreviewFailed.value = false;
    profileFormApi.setValues(profile.value);
  } finally {
    loading.value = false;
  }
}

// onSaveProfile 保存基础资料。
async function onSaveProfile() {
  const { valid } = await profileFormApi.validate();
  if (!valid) {
    return;
  }
  if (!profileId.value) {
    message.error($t('business.message.currentUserIdMissing'));
    return;
  }
  const values = await profileFormApi.getValues<SystemAdminApi.SaveParams>();
  await updateProfileInfo({
    avatar: String(profile.value.avatar || '').trim(),
    description: values.description,
    email: values.email,
    phone: values.phone,
    realName: values.realName,
  });
  message.success($t('business.message.profileSaved'));
  await loadProfile();
}

// onLoginMfaUserUpdated 把全局登录态里最新的 MFA 结果同步到当前个人信息页。
// 强制绑定场景会先完成登录态校验再重放原请求；这里补一次页面内状态合并，避免界面仍显示旧的“未启用”状态。
function onLoginMfaUserUpdated(event: Event) {
  const detail = (event as CustomEvent<Record<string, any> | undefined>).detail;
  if (!detail || typeof detail !== 'object') {
    return;
  }
  profile.value = {
    ...profile.value,
    ...detail,
    mfaStatus: Number(
      detail.mfaStatus ?? profile.value.mfaStatus ?? 0,
    ) as SystemAdminApi.Status,
  };
}

// onChooseAvatarFile 打开头像文件选择器。
function onChooseAvatarFile() {
  avatarInputRef.value?.click();
}

// onAvatarFileChange 上传头像并回填可访问地址。
async function onAvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const originalFile = input?.files?.[0];
  const file = originalFile ? await cropAvatarFile(originalFile, '1:1') : null;
  if (!file) {
    if (input) {
      input.value = '';
    }
    return;
  }
  avatarUploading.value = true;
  try {
    const session = await createResumableUpload({
      bizType: 'admin-avatar',
      concurrency: 2,
      file,
    });
    const avatarURL = session.accessUrl || session.downloadUrl || '';
    if (!avatarURL) {
      throw new Error($t('business.message.avatarUploadMissingUrl'));
    }
    avatarPreviewURL.value = resolveDisplayFileURL(
      avatarURL,
      requestClient.getBaseUrl(),
    );
    avatarPreviewFailed.value = false;
    profile.value = {
      ...profile.value,
      avatar: avatarURL,
    };
    message.success($t('business.message.avatarUploadedRememberSave'));
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.avatarUploadUnavailable'),
    );
    message.error($t('business.message.avatarUploadFailed', [errorMessage]));
  } finally {
    avatarUploading.value = false;
    if (input) {
      input.value = '';
    }
  }
}

// onAvatarPreviewError 头像预览加载失败时回退到占位态，避免 broken image 常驻页面。
function onAvatarPreviewError() {
  avatarPreviewFailed.value = true;
}

// onGenerateNewPassword 生成新密码并同步回填确认密码，减少手工输入错误。
async function onGenerateNewPassword() {
  const password = generateRandomPassword();
  await passwordFormApi.setValues({
    confirmPassword: password,
    passwordNew: password,
  });
}

// onCopyNewPassword 复制当前表单里的新密码，便于临时保存或跨设备输入。
async function onCopyNewPassword() {
  const values = await passwordFormApi.getValues<{ passwordNew?: string }>();
  await copyTextToClipboard(
    values.passwordNew || '',
    $t('business.message.newPasswordCopied'),
    $t('business.message.newPasswordEmpty'),
  );
}

// onUpdatePassword 修改当前账号密码。
async function onUpdatePassword() {
  const { valid } = await passwordFormApi.validate();
  if (!valid) {
    return;
  }
  if (!profileId.value) {
    message.error($t('business.message.currentUserIdMissing'));
    return;
  }
  const values = await passwordFormApi.getValues<{
    confirmPassword: string;
    passwordNew: string;
    passwordOld: string;
  }>();
  const passwordError = validateStrongPassword(
    values.passwordNew,
    $t('business.message.newPassword'),
  );
  if (passwordError) {
    message.error(passwordError);
    return;
  }
  if (values.passwordNew !== values.confirmPassword) {
    message.error($t('business.message.passwordConfirmMismatch'));
    return;
  }
  await submitWithMfa(MFA_SCENARIO_CHANGE_PASSWORD, (ticket) =>
    updateProfilePassword({
      confirmPassword: values.confirmPassword,
      passwordNew: values.passwordNew,
      passwordOld: values.passwordOld,
      ...ticketPayload(ticket),
    }),
  );
  profile.value = {
    ...profile.value,
    needResetPassword: 0,
  };
  userStore.setUserInfo({
    ...userStore.userInfo,
    needResetPassword: 0,
  } as any);
  passwordFormApi.resetForm();
  message.success($t('business.message.passwordChanged'));
  if (route.query.forceChangePassword) {
    await router.replace({ name: 'SystemProfile', query: {} });
  }
  await loadProfile();
}

// onToggleMfa 启用或关闭当前账号MFA。
async function onToggleMfa(nextStatus: number) {
  if (
    nextStatus === 0 &&
    profileForceMfaEnabled.value &&
    !(await confirmForceDisableMfa())
  ) {
    return;
  }
  const ticket = await requestMfaTwoStep(
    MFA_SCENARIO_STATUS,
    nextStatus === 1
      ? $t('business.message.mfaEnableShort')
      : $t('business.message.mfaDisableShort'),
    profileMfaUrl.value,
  );
  await updateProfileMfaStatus({
    mfaStatus: nextStatus,
    mfaSecureKey:
      nextStatus === 1
        ? extractMfaSecret(profileMfaUrl.value) || undefined
        : undefined,
    ...ticketPayload(ticket),
  });
  let successMessage = $t('business.message.mfaDisabled');
  if (nextStatus === 1) {
    successMessage = $t('business.message.mfaEnabled');
  } else if (profileForceMfaEnabled.value) {
    successMessage = $t('business.message.mfaDisabledForce');
  }
  message.success(successMessage);
  await loadProfile();
}

// confirmForceDisableMfa 在系统强制启用 MFA 时，关闭前明确提示下次登录影响。
function confirmForceDisableMfa() {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: $t('business.message.mfaCancel'),
      content: $t('business.message.mfaDisableConfirmContent'),
      okText: $t('business.message.mfaDisableConfirmOk'),
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: $t('business.message.mfaDisableConfirmTitle'),
    });
  });
}

// onOpenMfaBinding 跳转到 MFA 静态绑定页，便于查看完整说明与手动绑定信息。
async function onOpenMfaBinding() {
  if (profileMfaStatus.value === 1) {
    message.warning($t('business.message.mfaSelfRebindDenied'));
    return;
  }
  await router.push({ name: 'SystemMfa' });
}

// submitWithMfa 在需要时获取MFA二次校验票据并重试业务操作。
async function submitWithMfa<T>(
  scenario: number,
  submit: (ticket?: AuthApi.TwoStepTicket) => Promise<T>,
) {
  let firstTicket: AuthApi.TwoStepTicket | undefined;
  if (profileMfaStatus.value === 1) {
    firstTicket = await requestMfaTwoStep(
      scenario,
      $t('business.message.mfaSecondConfirmTitle'),
      profileMfaUrl.value,
    );
  }
  try {
    return await submit(firstTicket);
  } catch (error) {
    if (!isMfaAgainError(error)) {
      throw error;
    }
    const retryTicket = await requestMfaTwoStep(
      scenario,
      $t('business.message.mfaSecondConfirmTitle'),
      profileMfaUrl.value,
    );
    return await submit(retryTicket);
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="grid gap-3 xl:grid-cols-[360px_1fr]">
      <Card
        size="small"
        :title="$t('business.message.profileAccountInfoCardTitle')"
        :loading="loading"
      >
        <Descriptions :column="1" size="small" bordered>
          <DescriptionsItem :label="$t('business.message.userId')">
            {{ profileId || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.loginUsername')">
            {{ profile.username || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.accountStatus')">
            {{
              profile.status === 1
                ? $t('business.message.enabled')
                : $t('business.message.disabled')
            }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.mfaStatus')">
            {{
              profileMfaStatus === 1
                ? $t('business.message.enabled')
                : $t('business.message.disabled')
            }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.lastLoginIp')">
            {{ profile.lastLoginIP || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.lastLoginTime')">
            {{ profile.lastLoginTime || '-' }}
          </DescriptionsItem>
        </Descriptions>
      </Card>
      <div class="grid gap-3">
        <Card
          size="small"
          :title="$t('business.message.basicSettings')"
          :loading="loading"
        >
          <div class="mb-4 flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-4">
              <div
                v-if="avatarPreviewURL && !avatarPreviewFailed"
                class="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border border-[var(--ant-color-border-secondary)]"
              >
                <img
                  :src="avatarPreviewURL"
                  :alt="$t('business.message.avatarPreviewAlt')"
                  class="h-full w-full object-cover"
                  @error="onAvatarPreviewError"
                />
              </div>
              <div
                v-else
                class="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs text-gray-400"
              >
                {{ $t('business.message.noAvatar') }}
              </div>
            </div>
            <Space>
              <input
                ref="avatarInputRef"
                accept=".jpg,.jpeg,.png,.gif,.webp"
                class="hidden"
                type="file"
                @change="onAvatarFileChange"
              />
              <VbenButton
                :loading="avatarUploading"
                type="primary"
                @click="onChooseAvatarFile"
              >
                {{ $t('business.message.uploadAvatar') }}
              </VbenButton>
            </Space>
          </div>
          <div
            class="bg-[var(--vben-background-soft)]/40 mb-4 rounded-xl border border-[var(--vben-border-color)] px-4 py-3"
          >
            <div
              class="text-xs font-medium uppercase tracking-[0.08em] text-foreground/45"
            >
              {{ $t('business.message.avatarUrl') }}
            </div>
            <div class="mt-2 break-all text-sm text-foreground/65">
              {{ profile.avatar || '-' }}
            </div>
            <div v-if="avatarPreviewURL" class="mt-3">
              <a
                :href="avatarPreviewURL"
                class="text-sm text-primary underline-offset-4 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {{ $t('business.message.openAvatarUrl') }}
              </a>
            </div>
          </div>
          <ProfileForm />
          <Space class="mt-4">
            <VbenButton type="primary" @click="onSaveProfile">
              {{ $t('business.message.saveProfile') }}
            </VbenButton>
            <VbenButton @click="loadProfile">
              {{ $t('business.message.reset') }}
            </VbenButton>
          </Space>
        </Card>
        <Card size="small" :title="$t('business.message.securitySettings')">
          <Alert
            v-if="profileNeedResetPassword"
            class="mb-4"
            :message="$t('business.message.profilePasswordResetRequiredTitle')"
            :description="
              $t('business.message.profilePasswordResetRequiredDesc')
            "
            show-icon
            type="warning"
          />
          <Alert
            class="mb-3"
            :message="$t('business.message.profileMfaStandaloneTip')"
            show-icon
            type="info"
          />
          <Alert
            v-if="profileForceMfaEnabled && profileMfaStatus !== 1"
            class="mb-4"
            :description="$t('business.message.mfaForceBindRequiredDesc')"
            :message="$t('business.message.mfaForceBindRequiredTitle')"
            show-icon
            type="warning"
          />
          <Alert
            v-else-if="profileMfaDeviceUnavailable"
            class="mb-4"
            :description="$t('business.message.mfaDeviceUnavailable')"
            :message="$t('business.message.mfaDeviceUnavailableTitle')"
            show-icon
            type="error"
          />
          <Alert
            v-else-if="profileMfaBindRequired"
            class="mb-4"
            :description="$t('business.message.mfaBindRequiredDesc')"
            :message="$t('business.message.mfaBindRequiredTitle')"
            show-icon
            type="warning"
          />
          <div
            v-if="profileHasMfaBindingMaterial"
            class="mb-4 grid gap-3 xl:grid-cols-[168px_minmax(0,1fr)]"
          >
            <div v-if="profileMfaUrl" class="profile-mfa-qr-card">
              <div class="profile-mfa-qr-header">
                <div class="profile-mfa-qr-title">
                  {{ $t('business.message.mfaScanBind') }}
                </div>
                <div class="profile-mfa-qr-caption">
                  {{ $t('business.message.mfaScanQrCaption') }}
                </div>
              </div>
              <div class="profile-mfa-qr-board">
                <QRCode
                  bg-color="#ffffff"
                  color="#000000"
                  :size="124"
                  :value="profileMfaUrl"
                />
              </div>
              <div class="profile-mfa-qr-footer">
                <div class="profile-mfa-qr-account">
                  {{
                    profile.username || $t('business.message.mfaCurrentAccount')
                  }}
                </div>
                <div class="profile-mfa-qr-tip">
                  {{ $t('business.message.mfaQrRightManualTip') }}
                </div>
              </div>
            </div>
            <div class="min-w-0 space-y-3">
              <Descriptions :column="1" size="small" bordered>
                <DescriptionsItem :label="$t('business.message.mfaIssuer')">
                  admin
                </DescriptionsItem>
                <DescriptionsItem :label="$t('business.message.mfaAccount')">
                  {{ profile.username || '-' }}
                </DescriptionsItem>
                <DescriptionsItem
                  :label="$t('business.message.mfaManualSecret')"
                >
                  <Space class="w-full" wrap>
                    <Input
                      :value="profileMfaSecret || '-'"
                      class="min-w-[260px]"
                      readonly
                    />
                    <VbenButton
                      :disabled="!profileMfaSecret"
                      @click="
                        copyTextToClipboard(
                          profileMfaSecret,
                          $t('business.message.mfaManualSecretCopied'),
                          $t('business.message.mfaManualSecretUnavailable'),
                        )
                      "
                    >
                      {{ $t('business.message.mfaCopySecret') }}
                    </VbenButton>
                  </Space>
                </DescriptionsItem>
              </Descriptions>
              <Space wrap>
                <VbenButton
                  v-if="profileMfaStatus !== 1"
                  type="primary"
                  @click="onToggleMfa(1)"
                >
                  {{ $t('business.message.mfaEnableShort') }}
                </VbenButton>
                <VbenButton v-else danger @click="onToggleMfa(0)">
                  {{ $t('business.message.mfaDisableShort') }}
                </VbenButton>
                <VbenButton
                  v-if="profileMfaStatus !== 1"
                  @click="onOpenMfaBinding"
                >
                  {{ $t('business.message.mfaGoStaticBind') }}
                </VbenButton>
              </Space>
            </div>
          </div>
          <div
            v-else
            class="bg-[var(--vben-background-soft)]/35 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--vben-border-color)] px-4 py-3"
          >
            <div class="text-sm leading-6 text-foreground/70">
              {{
                profileMfaStatus === 1
                  ? $t('business.message.profileMfaEnabledNoMaterial')
                  : $t('business.message.profileMfaNoMaterial')
              }}
            </div>
            <Space wrap>
              <VbenButton
                v-if="profileMfaStatus !== 1"
                type="primary"
                @click="onToggleMfa(1)"
              >
                {{ $t('business.message.mfaEnableShort') }}
              </VbenButton>
              <VbenButton v-else danger @click="onToggleMfa(0)">
                {{ $t('business.message.mfaDisableShort') }}
              </VbenButton>
              <VbenButton
                v-if="profileMfaStatus !== 1"
                @click="onOpenMfaBinding"
              >
                {{ $t('business.message.mfaGoStaticBind') }}
              </VbenButton>
            </Space>
          </div>
          <PasswordForm />
          <Space class="mt-4">
            <VbenButton type="primary" @click="onUpdatePassword">
              {{ $t('business.message.changePassword') }}
            </VbenButton>
          </Space>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.profile-mfa-qr-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 98%),
    rgb(248 250 252 / 92%)
  );
  border: 1px solid rgb(59 130 246 / 18%);
  border-radius: 18px;
  box-shadow:
    0 10px 24px rgb(15 23 42 / 10%),
    inset 0 1px 0 rgb(255 255 255 / 88%);
}

.profile-mfa-qr-header {
  padding: 12px 14px 8px;
  background: linear-gradient(135deg, rgb(239 246 255), rgb(245 243 255));
}

.profile-mfa-qr-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  color: rgb(30 41 59);
}

.profile-mfa-qr-caption {
  margin-top: 2px;
  font-size: 11px;
  line-height: 16px;
  color: rgb(100 116 139);
}

.profile-mfa-qr-board {
  display: flex;
  justify-content: center;
  padding: 10px 12px 6px;
  background: linear-gradient(180deg, rgb(255 255 255), rgb(248 250 252));
}

.profile-mfa-qr-footer {
  padding: 0 14px 12px;
  text-align: center;
}

.profile-mfa-qr-account {
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
  color: rgb(15 23 42);
  word-break: break-all;
}

.profile-mfa-qr-tip {
  margin-top: 4px;
  font-size: 11px;
  line-height: 16px;
  color: rgb(100 116 139);
}
</style>
