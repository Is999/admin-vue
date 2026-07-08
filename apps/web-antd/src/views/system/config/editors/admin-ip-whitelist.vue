<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  Input,
  message,
  Skeleton,
  Space,
  Tag,
} from 'ant-design-vue';

import { fetchConfigList, updateConfig } from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { resolveRequestErrorMessage } from '#/utils/file/download';

import { ADMIN_IP_WHITELIST_PATH, ADMIN_IP_WHITELIST_UUID } from './registry';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const configItem = ref<null | SystemConfigApi.Item>(null);
const ipInput = ref('');
const bulkText = ref('');
const ipList = ref<string[]>([]);

// normalizeIpToken 清理输入 token，IPv6 方括号仅用于展示时兼容，不写入配置值。
function normalizeIpToken(value: any) {
  const text = String(value ?? '').trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    return text.slice(1, -1).trim();
  }
  return text;
}

// parseIpTokens 将数组、JSON 字符串或分隔文本统一拆成候选 IP。
function parseIpTokens(value: any): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeIpToken(item)).filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => normalizeIpToken(item))
      .filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) {
    return [];
  }
  try {
    return parseIpTokens(JSON.parse(text));
  } catch {
    return text
      .split(/[\s,;，；]+/)
      .map((item) => normalizeIpToken(item))
      .filter(Boolean);
  }
}

// normalizeIpList 清理空值并按大小写无关方式去重，保留首次输入展示。
function normalizeIpList(value: any) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of parseIpTokens(value)) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

// isValidIPv4 校验普通 IPv4 地址，避免 CIDR 和通配符被误保存。
function isValidIPv4(value: string) {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const number = Number(part);
    return Number.isInteger(number) && number >= 0 && number <= 255;
  });
}

// isValidIPv6 使用浏览器 URL 解析器校验 IPv6 字面量。
function isValidIPv6(value: string) {
  if (!value.includes(':')) {
    return false;
  }
  const normalized =
    value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  try {
    return Boolean(new URL(`http://[${normalized}]`).hostname);
  } catch {
    return false;
  }
}

// isValidIp 只允许后端当前支持的精确 IP 字符串。
function isValidIp(value: string) {
  return isValidIPv4(value) || isValidIPv6(value);
}

const invalidIps = computed(() => ipList.value.filter((ip) => !isValidIp(ip)));
const ipValueText = computed(() => JSON.stringify(ipList.value, null, 2));

// mergeIpText 合并输入文本，重复项只保留一份。
function mergeIpText(text: string) {
  const tokens = parseIpTokens(text);
  if (tokens.length === 0) {
    message.warning($t('business.message.adminIpWhitelistEmptyInput'));
    return;
  }
  const beforeCount = ipList.value.length;
  ipList.value = normalizeIpList([...ipList.value, ...tokens]);
  const duplicateCount = tokens.length - (ipList.value.length - beforeCount);
  if (duplicateCount > 0) {
    message.info(
      $t('business.message.adminIpWhitelistDuplicateIgnored', [duplicateCount]),
    );
  }
}

// loadConfig 拉取目标字典项并同步 IP 列表。
async function loadConfig() {
  loading.value = true;
  try {
    const response = await fetchConfigList({
      page: 1,
      pageSize: 1,
      uuid: ADMIN_IP_WHITELIST_UUID,
    });
    const item = response.list?.[0] || null;
    configItem.value = item;
    ipList.value = normalizeIpList(item?.value);
    ipInput.value = '';
    bulkText.value = '';
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.adminIpWhitelistLoadFailed'),
    );
    message.error(
      $t('business.message.adminIpWhitelistLoadFailedWithReason', [
        errorMessage,
      ]),
    );
  } finally {
    loading.value = false;
  }
}

// addIpInput 添加单个输入框里的 IP。
function addIpInput() {
  mergeIpText(ipInput.value);
  ipInput.value = '';
}

// importBulkText 从批量文本框导入 IP。
function importBulkText() {
  mergeIpText(bulkText.value);
  bulkText.value = '';
}

// importExample 把字典示例导入当前编辑列表。
function importExample() {
  mergeIpText(JSON.stringify(normalizeIpList(configItem.value?.example)));
}

// removeIp 移除指定 IP。
function removeIp(ip: string) {
  ipList.value = ipList.value.filter((item) => item !== ip);
}

// clearIps 清空当前编辑列表。
function clearIps() {
  ipList.value = [];
}

// resetIps 恢复为当前后端值。
function resetIps() {
  ipList.value = normalizeIpList(configItem.value?.value);
}

// saveConfig 保存 IP 白名单数组。
async function saveConfig() {
  if (!configItem.value) {
    message.warning($t('business.message.adminIpWhitelistConfigMissing'));
    return;
  }
  if (invalidIps.value.length > 0) {
    message.error(
      $t('business.message.adminIpWhitelistInvalidCount', [
        invalidIps.value.length,
      ]),
    );
    return;
  }
  saving.value = true;
  const current = configItem.value;
  try {
    await updateConfig(current.id, {
      example: current.example,
      page: ADMIN_IP_WHITELIST_PATH,
      pid: current.pid,
      remark: current.remark,
      title: current.title,
      type: current.type,
      uuid: current.uuid,
      value: normalizeIpList(ipList.value),
      version: current.version,
    });
    message.success($t('business.message.adminIpWhitelistSaved'));
    await loadConfig();
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.adminIpWhitelistSaveFailed'),
    );
    message.error(
      $t('business.message.adminIpWhitelistSaveFailedWithReason', [
        errorMessage,
      ]),
    );
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page auto-content-height>
    <div class="ip-whitelist-page">
      <div class="ip-whitelist-header">
        <div>
          <h2>{{ $t('business.message.adminIpWhitelistEditorTitle') }}</h2>
          <p>{{ $t('business.message.adminIpWhitelistEditorDesc') }}</p>
        </div>
        <Space>
          <Button @click="router.push('/system/config')">
            {{ $t('business.message.backToDictionary') }}
          </Button>
          <VbenButton :loading="loading" @click="loadConfig">
            {{ $t('business.message.refreshList') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(
                SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_UPDATE,
              )
            "
            :loading="saving"
            type="primary"
            @click="saveConfig"
          >
            {{ $t('business.message.save') }}
          </VbenButton>
        </Space>
      </div>

      <Alert
        :description="$t('business.message.adminIpWhitelistEditorGuideDesc')"
        :message="$t('business.message.adminIpWhitelistEditorGuide')"
        show-icon
        type="info"
      />

      <Skeleton v-if="loading && !configItem" active />
      <Empty
        v-else-if="!configItem"
        :description="$t('business.message.adminIpWhitelistConfigMissing')"
      />
      <div v-else class="ip-whitelist-content">
        <section class="ip-whitelist-panel">
          <div class="ip-whitelist-panel-head">
            <div>
              <h3>{{ $t('business.message.adminIpWhitelistList') }}</h3>
              <p>
                {{
                  $t('business.message.adminIpWhitelistSelectedCount', [
                    ipList.length,
                  ])
                }}
              </p>
            </div>
            <Space>
              <Button size="small" @click="resetIps">
                {{ $t('business.message.reset') }}
              </Button>
              <Button size="small" @click="clearIps">
                {{ $t('business.message.clearSelected') }}
              </Button>
            </Space>
          </div>

          <Alert
            v-if="invalidIps.length > 0"
            :message="
              $t('business.message.adminIpWhitelistInvalidCount', [
                invalidIps.length,
              ])
            "
            class="ip-whitelist-warning"
            show-icon
            type="warning"
          />

          <div class="ip-whitelist-add-row">
            <Input
              v-model:value="ipInput"
              :placeholder="
                $t('business.message.adminIpWhitelistInputPlaceholder')
              "
              @keyup.enter="addIpInput"
            />
            <Button type="primary" @click="addIpInput">
              {{ $t('business.message.adminIpWhitelistAdd') }}
            </Button>
          </div>

          <div v-if="ipList.length > 0" class="ip-whitelist-tags">
            <Tag
              v-for="ip in ipList"
              :key="ip"
              :color="isValidIp(ip) ? 'processing' : 'error'"
              closable
              @close.prevent="removeIp(ip)"
            >
              <span>{{ ip }}</span>
              <span v-if="!isValidIp(ip)" class="ip-whitelist-tag-note">
                {{ $t('business.message.adminIpWhitelistInvalidTag') }}
              </span>
            </Tag>
          </div>
          <Empty
            v-else
            :description="$t('business.message.adminIpWhitelistEmpty')"
          />
        </section>

        <section class="ip-whitelist-panel">
          <div class="ip-whitelist-panel-head">
            <div>
              <h3>{{ $t('business.message.adminIpWhitelistBulkTitle') }}</h3>
              <p>{{ $t('business.message.adminIpWhitelistBulkDesc') }}</p>
            </div>
          </div>

          <Input.TextArea
            v-model:value="bulkText"
            :placeholder="
              $t('business.message.adminIpWhitelistBulkPlaceholder')
            "
            :rows="8"
          />
          <Space class="ip-whitelist-bulk-actions">
            <Button type="primary" @click="importBulkText">
              {{ $t('business.message.adminIpWhitelistBulkImport') }}
            </Button>
            <Button @click="importExample">
              {{ $t('business.message.adminIpWhitelistUseExample') }}
            </Button>
          </Space>

          <Descriptions
            :column="1"
            class="ip-whitelist-meta"
            size="small"
            bordered
          >
            <DescriptionsItem :label="$t('business.message.configUuid')">
              {{ configItem.uuid }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.version')">
              {{ configItem.version }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.pagePath')">
              {{ ADMIN_IP_WHITELIST_PATH }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.remarkDescription')">
              {{ configItem.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>

          <div class="ip-whitelist-preview-head">
            <h3>{{ $t('business.message.adminIpWhitelistCurrentConfig') }}</h3>
            <p>
              {{ $t('business.message.adminIpWhitelistCurrentConfigDesc') }}
            </p>
          </div>
          <pre class="ip-whitelist-preview">{{ ipValueText }}</pre>
        </section>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.ip-whitelist-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ip-whitelist-header,
.ip-whitelist-panel {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ip-whitelist-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
}

.ip-whitelist-header h2,
.ip-whitelist-panel h3 {
  margin: 0;
  font-weight: 600;
}

.ip-whitelist-header h2 {
  font-size: 18px;
}

.ip-whitelist-header p,
.ip-whitelist-panel p,
.ip-whitelist-preview-head p {
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
}

.ip-whitelist-content {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(380px, 0.85fr);
  gap: 16px;
}

.ip-whitelist-panel {
  padding: 16px;
}

.ip-whitelist-panel-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.ip-whitelist-warning {
  margin-bottom: 12px;
}

.ip-whitelist-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-bottom: 14px;
}

.ip-whitelist-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ip-whitelist-tags :deep(.ant-tag) {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  max-width: 100%;
  padding: 4px 8px;
  margin-inline-end: 0;
  font-size: 13px;
}

.ip-whitelist-tag-note {
  color: hsl(var(--destructive));
}

.ip-whitelist-bulk-actions {
  margin-top: 12px;
}

.ip-whitelist-meta,
.ip-whitelist-preview-head {
  margin-top: 16px;
}

.ip-whitelist-preview {
  min-height: 160px;
  padding: 12px;
  margin: 12px 0 0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 1180px) {
  .ip-whitelist-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .ip-whitelist-header,
  .ip-whitelist-panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .ip-whitelist-add-row {
    grid-template-columns: 1fr;
  }
}
</style>
