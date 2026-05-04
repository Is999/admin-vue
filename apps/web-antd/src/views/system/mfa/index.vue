<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { AuthApi } from '#/api';
import type { SystemAdminApi, SystemProfileApi } from '#/api/system';

import { computed, onMounted, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';

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
  Steps,
} from 'ant-design-vue';

import { checkMfaSecureApi } from '#/api';
import {
  fetchProfileInfo,
  refreshProfileMfaSecretKey,
  updateProfileMfaStatus,
} from '#/api/system';
import { $t } from '#/locales';
import {
  extractMfaManualInfo,
  extractMfaSecret,
  getMfaAuthenticatorApps,
  getMfaBindSteps,
  getMfaGuideSteps,
  getMfaMicrosoftScanTip,
  mfaAccountLabel,
  mfaIssuerLabel,
  ticketPayload,
} from '#/utils/security/mfa';

// MFA_SCENARIO_STATUS 表示修改MFA状态二次校验场景。
const MFA_SCENARIO_STATUS = 2;

// profile 保存当前登录管理员资料。
const profile = ref<SystemProfileApi.Item>({});
// loading 控制页面加载状态。
const loading = ref(false);
// submitLoading 控制绑定与关闭按钮提交状态。
const submitLoading = ref(false);
// secure 保存用户输入的 6 位 MFA 动态验证码。
const secure = ref('');

// profileMfaStatus 读取 MFA 状态字段。
const profileMfaStatus = computed(() => Number(profile.value.mfaStatus || 0));
// profileMfaUrl 读取 MFA 绑定地址字段。
const profileMfaUrl = computed(() =>
  profileMfaStatus.value === 1 ? '' : String(profile.value.buildMFAURL || ''),
);
// profileMfaInfo 解析手动绑定身份验证器所需信息。
const profileMfaInfo = computed(() =>
  extractMfaManualInfo(profileMfaUrl.value),
);
// profileName 归一化当前登录账号名称。
const profileName = computed(() => String(profile.value.username || '-'));
// profileMfaIssuer 展示身份验证器中的发行方，缺失时不伪造站点名。
const profileMfaIssuer = computed(() => mfaIssuerLabel(profileMfaInfo.value));
// profileMfaAccount 展示身份验证器中的绑定账号。
const profileMfaAccount = computed(() =>
  mfaAccountLabel(profileMfaInfo.value, profileName.value),
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
// bindDisabled 判断当前页面是否缺少可绑定秘钥。
const bindDisabled = computed(() => !profileMfaInfo.value.secret);
// mfaAuthenticatorApps 渲染推荐身份验证器列表，语言切换时重新取当前文案。
const mfaAuthenticatorApps = computed(() => getMfaAuthenticatorApps());
// mfaBindSteps 渲染绑定步骤，避免语言包加载前固定成原始 key。
const mfaBindSteps = computed(() => getMfaBindSteps());
// mfaGuideSteps 渲染 MFA 说明步骤，避免语言包加载前固定成原始 key。
const mfaGuideSteps = computed(() => getMfaGuideSteps());
// mfaMicrosoftScanTip 渲染微软身份验证器扫码提示。
const mfaMicrosoftScanTip = computed(() => getMfaMicrosoftScanTip());

// onMounted 进入页面时加载当前管理员 MFA 资料。
onMounted(() => {
  loadProfile();
});

// loadProfile 查询当前登录管理员资料并刷新二维码与手动秘钥。
async function loadProfile(successMessage?: string) {
  loading.value = true;
  try {
    const data = await fetchProfileInfo();
    profile.value = data;
    if (typeof successMessage === 'string' && successMessage) {
      message.success(successMessage);
    }
  } finally {
    loading.value = false;
  }
}

// onRefreshQr 手动刷新当前 MFA 二维码与手动秘钥。
async function onRefreshQr() {
  if (profileMfaStatus.value === 1) {
    message.warning($t('business.message.mfaSelfRebindDenied'));
    return;
  }
  const data = await refreshProfileMfaSecretKey();
  const buildMfaUrl = String(data?.buildMFAURL || '');
  profile.value = {
    ...profile.value,
    buildMFAURL: buildMfaUrl,
    mfaStatus: 0 as SystemAdminApi.Status,
  };
  await loadProfile(
    profileForceMfaEnabled.value
      ? $t('business.message.mfaQrRegeneratedForce')
      : $t('business.message.mfaQrRegenerated'),
  );
}

// onReloadProfile 手动刷新当前页面资料，避免点击事件对象误传给提示文案。
async function onReloadProfile() {
  await loadProfile();
}

// onCopySecret 复制原始秘钥，避免格式化空格影响身份验证器识别。
async function onCopySecret() {
  const secret = profileMfaInfo.value.secret;
  if (!secret) {
    message.warning($t('business.message.accountMfaSecretUnavailable'));
    return;
  }
  try {
    await navigator.clipboard.writeText(secret);
    message.success($t('business.message.mfaSecretCopied'));
  } catch {
    message.error($t('business.message.copySecretFailedManual'));
  }
}

// onEnableMfa 校验动态码并启用当前账号 MFA。
async function onEnableMfa() {
  if (bindDisabled.value) {
    message.error($t('business.message.accountMfaSecretUnavailable'));
    return;
  }
  const ticket = await verifyMfaCode();
  await updateMfaStatus(1, ticket);
  message.success($t('business.message.mfaStaticBindingSucceeded'));
  secure.value = '';
  await loadProfile();
}

// onDisableMfa 校验动态码并关闭当前账号 MFA。
async function onDisableMfa() {
  if (profileForceMfaEnabled.value && !(await confirmForceDisableMfa())) {
    return;
  }
  const ticket = await verifyMfaCode();
  await updateMfaStatus(0, ticket);
  message.success(
    profileForceMfaEnabled.value
      ? $t('business.message.mfaDisabledForce')
      : $t('business.message.mfaDisabled'),
  );
  secure.value = '';
  await loadProfile();
}

// verifyMfaCode 校验当前输入的 MFA 动态码并换取二次校验票据。
async function verifyMfaCode() {
  const code = secure.value.trim();
  if (!/^\d{6}$/.test(code)) {
    message.error($t('business.message.mfaCodeRequired'));
    throw new Error($t('business.message.mfaCodeRequired'));
  }
  submitLoading.value = true;
  try {
    const result = await checkMfaSecureApi(
      {
        mfaSecureKey: extractMfaSecret(profileMfaUrl.value) || undefined,
        scenarios: MFA_SCENARIO_STATUS,
        secure: code,
      },
      {
        skipGlobalErrorMessage: true,
      },
    );
    if (!result?.isOk || !result.twoStep) {
      message.error($t('business.message.mfaCodeInvalid'));
      throw new Error($t('business.message.mfaCodeInvalid'));
    }
    return result.twoStep;
  } finally {
    submitLoading.value = false;
  }
}

// updateMfaStatus 提交 MFA 状态更新，后端会校验二次校验票据。
async function updateMfaStatus(
  mfaStatus: number,
  ticket: AuthApi.TwoStepTicket,
) {
  await updateProfileMfaStatus({
    mfaStatus,
    mfaSecureKey:
      mfaStatus === 1
        ? extractMfaSecret(profileMfaUrl.value) || undefined
        : undefined,
    ...ticketPayload(ticket),
  });
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
</script>

<template>
  <Page auto-content-height>
    <div class="grid gap-3 xl:grid-cols-[360px_1fr]">
      <Card
        size="small"
        :title="$t('business.message.mfaStatusCardTitle')"
        :loading="loading"
      >
        <Descriptions :column="1" size="small" bordered>
          <DescriptionsItem :label="$t('business.message.mfaLoginAccount')">
            {{ profileName }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.mfaIssuer')">
            {{ profileMfaIssuer }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.mfaBoundAccount')">
            {{ profileMfaAccount }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('business.message.mfaStatus')">
            {{
              profileMfaStatus === 1
                ? $t('business.message.enabled')
                : $t('business.message.disabled')
            }}
          </DescriptionsItem>
        </Descriptions>
        <Alert
          class="mt-3"
          :message="mfaMicrosoftScanTip"
          show-icon
          type="info"
        />
        <Alert
          v-if="profileForceMfaEnabled && profileMfaStatus !== 1"
          class="mt-3"
          :description="$t('business.message.mfaForceBindRequiredDesc')"
          :message="$t('business.message.mfaForceBindRequiredTitle')"
          show-icon
          type="warning"
        />
        <Alert
          v-else-if="profileMfaDeviceUnavailable"
          class="mt-3"
          :description="$t('business.message.mfaDeviceUnavailable')"
          :message="$t('business.message.mfaDeviceUnavailableTitle')"
          show-icon
          type="error"
        />
        <Alert
          v-else-if="profileMfaBindRequired"
          class="mt-3"
          :description="$t('business.message.mfaBindRequiredDesc')"
          :message="$t('business.message.mfaBindRequiredTitle')"
          show-icon
          type="warning"
        />
      </Card>

      <Card
        size="small"
        :title="$t('business.message.mfaStaticBindCardTitle')"
        :loading="loading"
      >
        <div class="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div class="space-y-3">
            <div class="flex justify-center">
              <div v-if="profileMfaUrl" class="mfa-qr-shell">
                <div class="mfa-qr-glow"></div>
                <div class="mfa-qr-frame">
                  <div class="mfa-qr-header">
                    <div class="mfa-qr-badge">MFA SECURE</div>
                    <div class="mfa-qr-caption">
                      {{ profileMfaIssuer }}
                    </div>
                  </div>
                  <div class="mfa-qr-board">
                    <QRCode
                      bg-color="#ffffff"
                      color="#000000"
                      :key="profileMfaUrl"
                      :size="192"
                      :value="profileMfaUrl"
                    />
                  </div>
                  <div class="mfa-qr-footer">
                    <div class="mfa-qr-account">
                      {{ profileMfaAccount }}
                    </div>
                    <div class="mfa-qr-tip">
                      {{ $t('business.message.mfaQrManualSwitchTip') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <VbenButton
              v-if="profileMfaStatus !== 1"
              block
              @click="onRefreshQr"
            >
              {{ $t('business.message.mfaRegenerateQr') }}
            </VbenButton>
          </div>
          <div class="space-y-4">
            <Steps
              :current="profileMfaStatus === 1 ? 2 : 1"
              :items="mfaBindSteps"
            />
            <Descriptions :column="1" size="small" bordered>
              <DescriptionsItem :label="$t('business.message.mfaIssuer')">
                {{ profileMfaIssuer }}
              </DescriptionsItem>
              <DescriptionsItem :label="$t('business.message.mfaAccount')">
                {{ profileMfaAccount }}
              </DescriptionsItem>
              <DescriptionsItem :label="$t('business.message.mfaManualSecret')">
                <Space class="w-full" wrap>
                  <Input
                    :value="profileMfaInfo.formattedSecret || '-'"
                    class="min-w-[260px]"
                    readonly
                  />
                  <VbenButton :disabled="bindDisabled" @click="onCopySecret">
                    {{ $t('business.message.mfaCopySecret') }}
                  </VbenButton>
                </Space>
              </DescriptionsItem>
            </Descriptions>
            <Space wrap>
              <Input
                v-model:value="secure"
                class="w-[220px]"
                :maxlength="6"
                :placeholder="$t('business.message.mfaCodePlaceholder')"
                @press-enter="
                  profileMfaStatus === 1 ? onDisableMfa() : onEnableMfa()
                "
              />
              <VbenButton
                v-if="profileMfaStatus !== 1"
                :disabled="bindDisabled"
                :loading="submitLoading"
                type="primary"
                @click="onEnableMfa"
              >
                {{ $t('business.message.mfaEnableButton') }}
              </VbenButton>
              <VbenButton
                v-else
                danger
                :loading="submitLoading"
                @click="onDisableMfa"
              >
                {{ $t('business.message.mfaDisableButton') }}
              </VbenButton>
              <VbenButton @click="onReloadProfile">
                {{ $t('business.message.refresh') }}
              </VbenButton>
            </Space>
          </div>
        </div>
      </Card>
    </div>

    <Card
      class="mt-3"
      size="small"
      :title="$t('business.message.mfaBindingGuideCardTitle')"
    >
      <div class="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div class="space-y-3">
          <Alert
            :message="$t('business.message.mfaTotpIntro')"
            show-icon
            type="info"
          />
          <Descriptions :column="1" size="small" bordered>
            <DescriptionsItem :label="$t('business.message.mfaApplicableApps')">
              {{ mfaAuthenticatorApps.join('、') }}
            </DescriptionsItem>
            <DescriptionsItem
              :label="$t('business.message.mfaOfflineAvailable')"
            >
              {{ $t('business.message.mfaOfflineAvailableDesc') }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.mfaScanFailed')">
              {{ $t('business.message.mfaScanFailedDesc') }}
            </DescriptionsItem>
          </Descriptions>
        </div>
        <div class="space-y-4">
          <Steps direction="vertical" :items="mfaGuideSteps" />
          <div class="flex flex-wrap gap-2 text-sm">
            <a
              href="https://support.google.com/accounts/answer/1066447"
              rel="noreferrer"
              target="_blank"
            >
              {{ $t('business.message.mfaGoogleHelp') }}
            </a>
            <a
              href="https://support.microsoft.com/account-billing/use-microsoft-authenticator-with-microsoft-365-1412611f-ad8d-43ab-807c-7965e5155411"
              rel="noreferrer"
              target="_blank"
            >
              {{ $t('business.message.mfaMicrosoftHelp') }}
            </a>
          </div>
        </div>
      </div>
    </Card>
  </Page>
</template>

<style scoped>
.mfa-qr-shell {
  position: relative;
}

.mfa-qr-glow {
  position: absolute;
  inset: 18px;
  pointer-events: none;
  background:
    radial-gradient(circle at top, rgb(59 130 246 / 28%), transparent 58%),
    radial-gradient(circle at bottom, rgb(168 85 247 / 22%), transparent 60%);
  border-radius: 24px;
  filter: blur(18px);
}

.mfa-qr-frame {
  position: relative;
  min-width: 236px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    rgb(255 255 255 / 98%),
    rgb(248 250 252 / 94%)
  );
  border: 1px solid rgb(59 130 246 / 22%);
  border-radius: 24px;
  box-shadow:
    0 18px 50px rgb(15 23 42 / 16%),
    inset 0 1px 0 rgb(255 255 255 / 85%);
}

.mfa-qr-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: linear-gradient(135deg, rgb(239 246 255), rgb(245 243 255));
}

.mfa-qr-badge {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(139 92 246));
  border-radius: 999px;
}

.mfa-qr-caption {
  font-size: 12px;
  font-weight: 600;
  color: rgb(71 85 105);
}

.mfa-qr-board {
  display: flex;
  justify-content: center;
  padding: 18px 18px 12px;
  background: linear-gradient(180deg, rgb(255 255 255), rgb(248 250 252));
}

.mfa-qr-footer {
  padding: 0 16px 16px;
  text-align: center;
}

.mfa-qr-account {
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: rgb(15 23 42);
  word-break: break-all;
}

.mfa-qr-tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(100 116 139);
}
</style>
