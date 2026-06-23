<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { AuthApi } from '#/api';
import type { SystemAdminApi, SystemProfileApi } from '#/api/system';

import { computed, h, onMounted, ref } from 'vue';

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
  getMfaAuthenticatorHelpLinks,
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
// mfaAuthenticatorHelpLinks 渲染身份验证器帮助入口，语言切换时重新取当前文案。
const mfaAuthenticatorHelpLinks = computed(() =>
  getMfaAuthenticatorHelpLinks(),
);
// mfaBindSteps 渲染绑定步骤，避免语言包加载前固定成原始 key。
const mfaBindSteps = computed(() => getMfaBindSteps());
// mfaGuideSteps 渲染 MFA 说明步骤，并在安装说明内联应用帮助链接。
const mfaGuideSteps = computed(() =>
  getMfaGuideSteps().map((step, index) => ({
    ...step,
    description:
      index === 0
        ? buildMfaInstallDescription(step.description)
        : step.description,
  })),
);
// mfaMicrosoftScanTip 渲染微软身份验证器扫码提示。
const mfaMicrosoftScanTip = computed(() => getMfaMicrosoftScanTip());

// buildMfaAuthenticatorLink 渲染说明句内的身份验证器应用链接。
function buildMfaAuthenticatorLink(label: string, href: string) {
  return h(
    'a',
    {
      class: 'mfa-guide-app-link',
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
      href: getMfaHelpUrl('Google Authenticator'),
      label: 'Google Authenticator',
    },
    {
      href: getMfaHelpUrl('Microsoft Authenticator'),
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

// getMfaHelpUrl 通过应用名匹配现有帮助链接，避免模板里再展示“帮助”链接行。
function getMfaHelpUrl(appName: string) {
  return (
    mfaAuthenticatorHelpLinks.value.find((link) => link.label.includes(appName))
      ?.href || '#'
  );
}

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
    <div class="mfa-page-stack">
      <div class="mfa-main-grid">
        <Card
          class="mfa-page-card"
          size="small"
          :title="$t('business.message.mfaStatusCardTitle')"
          :loading="loading"
        >
          <div class="mfa-status-stack">
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
            <div class="mfa-status-alerts">
              <Alert :message="mfaMicrosoftScanTip" show-icon type="info" />
              <Alert
                v-if="profileForceMfaEnabled && profileMfaStatus !== 1"
                :description="$t('business.message.mfaForceBindRequiredDesc')"
                :message="$t('business.message.mfaForceBindRequiredTitle')"
                show-icon
                type="warning"
              />
              <Alert
                v-else-if="profileMfaDeviceUnavailable"
                :description="$t('business.message.mfaDeviceUnavailable')"
                :message="$t('business.message.mfaDeviceUnavailableTitle')"
                show-icon
                type="error"
              />
              <Alert
                v-else-if="profileMfaBindRequired"
                :description="$t('business.message.mfaBindRequiredDesc')"
                :message="$t('business.message.mfaBindRequiredTitle')"
                show-icon
                type="warning"
              />
            </div>
          </div>
        </Card>

        <Card
          class="mfa-page-card"
          size="small"
          :title="$t('business.message.mfaStaticBindCardTitle')"
          :loading="loading"
        >
          <div class="mfa-bind-layout">
            <div class="mfa-qr-column">
              <div v-if="profileMfaUrl" class="mfa-qr-panel">
                <div class="mfa-qr-frame">
                  <div class="mfa-qr-header">
                    <div class="mfa-qr-title">
                      {{ $t('business.message.mfaScanBind') }}
                    </div>
                    <div class="mfa-qr-account" :title="profileMfaAccount">
                      {{ profileMfaAccount }}
                    </div>
                  </div>
                  <div class="mfa-qr-board">
                    <QRCode
                      class="mfa-qr-code"
                      :bordered="false"
                      bg-color="#ffffff"
                      color="#000000"
                      :key="profileMfaUrl"
                      :size="202"
                      :value="profileMfaUrl"
                    />
                  </div>
                </div>
              </div>
              <VbenButton
                v-if="profileMfaStatus !== 1"
                block
                class="mfa-qr-refresh"
                @click="onRefreshQr"
              >
                {{ $t('business.message.mfaRegenerateQr') }}
              </VbenButton>
            </div>
            <div class="mfa-bind-detail">
              <Steps
                class="mfa-bind-steps"
                :current="profileMfaStatus === 1 ? 2 : 1"
                :items="mfaBindSteps"
              />
              <Descriptions
                class="mfa-bind-descriptions"
                :column="1"
                size="small"
                bordered
              >
                <DescriptionsItem :label="$t('business.message.mfaIssuer')">
                  {{ profileMfaIssuer }}
                </DescriptionsItem>
                <DescriptionsItem :label="$t('business.message.mfaAccount')">
                  {{ profileMfaAccount }}
                </DescriptionsItem>
                <DescriptionsItem
                  :label="$t('business.message.mfaManualSecret')"
                >
                  <div class="mfa-secret-row">
                    <Input
                      :value="profileMfaInfo.formattedSecret || '-'"
                      class="mfa-secret-input"
                      readonly
                    />
                    <VbenButton :disabled="bindDisabled" @click="onCopySecret">
                      {{ $t('business.message.mfaCopySecret') }}
                    </VbenButton>
                  </div>
                </DescriptionsItem>
              </Descriptions>
              <div class="mfa-verify-row">
                <Input
                  v-model:value="secure"
                  class="mfa-code-input"
                  :maxlength="6"
                  :placeholder="$t('business.message.mfaCodePlaceholder')"
                  size="large"
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
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card
        class="mfa-page-card"
        size="small"
        :title="$t('business.message.mfaBindingGuideCardTitle')"
      >
        <div class="mfa-guide-grid">
          <div class="mfa-guide-summary">
            <Alert
              :message="$t('business.message.mfaTotpIntro')"
              show-icon
              type="info"
            />
            <Descriptions :column="1" size="small" bordered>
              <DescriptionsItem
                :label="$t('business.message.mfaApplicableApps')"
              >
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
          <div class="mfa-guide-detail">
            <Steps direction="vertical" :items="mfaGuideSteps" />
          </div>
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.mfa-page-stack {
  display: grid;
  gap: 8px;
}

.mfa-main-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 8px;
}

.mfa-page-card :deep(.ant-card-body) {
  padding: 12px 14px;
}

.mfa-status-stack,
.mfa-status-alerts,
.mfa-guide-summary,
.mfa-guide-detail {
  display: grid;
  gap: 8px;
}

.mfa-bind-layout {
  display: grid;
  grid-template-columns: 192px minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.mfa-qr-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.mfa-qr-panel {
  width: 192px;
  max-width: 100%;
}

.mfa-qr-frame {
  overflow: hidden;
  background: rgb(127 127 127 / 6%);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
}

.mfa-qr-header {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgb(59 130 246 / 8%);
}

.mfa-qr-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  color: var(--vben-text-color);
  white-space: nowrap;
}

.mfa-qr-board {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px 8px;
  background: #fff;
}

.mfa-qr-board :deep(.ant-qrcode) {
  width: 176px !important;
  height: 176px !important;
  padding: 0;
  background: #fff;
  border: 0;
}

.mfa-qr-account {
  max-width: 92px;
  padding: 2px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: var(--vben-text-color-secondary);
  white-space: nowrap;
  background: rgb(127 127 127 / 10%);
  border: 1px solid rgb(127 127 127 / 14%);
  border-radius: 999px;
}

.mfa-qr-refresh {
  width: 100%;
  margin-top: auto;
}

.mfa-bind-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  height: 100%;
}

.mfa-bind-steps {
  margin-bottom: 0;
}

.mfa-bind-descriptions :deep(.ant-descriptions-item-label) {
  width: 132px;
  color: var(--vben-text-color-secondary);
}

.mfa-secret-row,
.mfa-verify-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.mfa-secret-row {
  padding: 2px 0;
}

.mfa-verify-row {
  margin-top: auto;
}

.mfa-secret-input {
  flex: 1 1 320px;
  min-width: 260px;
}

.mfa-code-input {
  width: 220px;
}

.mfa-secret-row :deep(.ant-input),
.mfa-secret-row :deep(button),
.mfa-verify-row :deep(.ant-input),
.mfa-verify-row :deep(button) {
  height: 40px;
}

.mfa-guide-app-link {
  font-weight: 600;
  color: hsl(var(--primary));
}

.mfa-guide-app-link:hover {
  color: hsl(var(--primary) / 80%);
  text-decoration: underline;
}

.mfa-guide-grid {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 12px;
}

@media (max-width: 1280px) {
  .mfa-main-grid,
  .mfa-guide-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .mfa-bind-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .mfa-qr-column {
    max-width: 192px;
  }
}

@media (max-width: 640px) {
  .mfa-qr-column,
  .mfa-code-input,
  .mfa-secret-input {
    width: 100%;
    min-width: 0;
    max-width: none;
  }
}
</style>
