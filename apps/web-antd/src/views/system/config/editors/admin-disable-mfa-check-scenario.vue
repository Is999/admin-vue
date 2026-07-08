<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';

import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Descriptions,
  DescriptionsItem,
  Empty,
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
import { showCacheSyncResult } from '#/utils/cache/sync';
import { resolveRequestErrorMessage } from '#/utils/file/download';

import {
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_UUID,
} from './registry';

interface ScenarioOption {
  label: string; // label 表示 MFA 场景展示名称。
  value: string; // value 表示后端约定的 MFA 场景值。
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const configItem = ref<null | SystemConfigApi.Item>(null);
const selectedScenarioKeys = ref<string[]>([]);

// normalizeConfigRecord 将配置值归一化为字符串对象，兼容后端 JSON 和历史字符串。
function normalizeConfigRecord(value: any): Record<string, string> {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  if (typeof value === 'string') {
    try {
      return normalizeConfigRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const item of value) {
      const key = String(item ?? '').trim();
      if (key) {
        result[key] = key;
      }
    }
    return result;
  }
  if (typeof value !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, label] of Object.entries(value as Record<string, any>)) {
    const nextKey = String(key).trim();
    if (nextKey) {
      result[nextKey] = String(label ?? nextKey);
    }
  }
  return result;
}

// scenarioSortValue 按数字场景排序，非数字场景排到最后并保持稳定。
function scenarioSortValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

// buildScenarioOptions 从 example 和当前 value 生成复选框选项，避免新增场景后前端硬编码漂移。
function buildScenarioOptions(
  item: null | SystemConfigApi.Item,
): ScenarioOption[] {
  const example = normalizeConfigRecord(item?.example);
  const currentValue = normalizeConfigRecord(item?.value);
  return [...new Set([...Object.keys(example), ...Object.keys(currentValue)])]
    .filter((key) => scenarioSortValue(key) > 0)
    .toSorted(
      (left, right) => scenarioSortValue(left) - scenarioSortValue(right),
    )
    .map((key) => ({
      label: example[key] || currentValue[key] || key,
      value: key,
    }));
}

const scenarioOptions = computed(() => buildScenarioOptions(configItem.value));
const selectedSet = computed(() => new Set(selectedScenarioKeys.value));
const checkAll = computed(
  () =>
    scenarioOptions.value.length > 0 &&
    selectedScenarioKeys.value.length === scenarioOptions.value.length,
);
const indeterminate = computed(
  () =>
    selectedScenarioKeys.value.length > 0 &&
    selectedScenarioKeys.value.length < scenarioOptions.value.length,
);
const selectedValuePreview = computed(() =>
  buildScenarioValue(selectedScenarioKeys.value),
);
const selectedValueText = computed(() =>
  JSON.stringify(selectedValuePreview.value, null, 2),
);

// buildScenarioValue 生成后端保存的禁用 MFA 场景对象。
function buildScenarioValue(keys: string[]) {
  const optionMap = new Map(
    scenarioOptions.value.map((item) => [item.value, item.label]),
  );
  const normalizedKeys = [...new Set(keys)]
    .filter((key) => optionMap.has(key))
    .toSorted(
      (left, right) => scenarioSortValue(left) - scenarioSortValue(right),
    );
  const result: Record<string, string> = {};
  for (const key of normalizedKeys) {
    result[key] = optionMap.get(key) || key;
  }
  return result;
}

// loadConfig 拉取目标字典项并同步选中状态。
async function loadConfig() {
  loading.value = true;
  try {
    const response = await fetchConfigList({
      page: 1,
      pageSize: 1,
      uuid: ADMIN_DISABLE_MFA_CHECK_SCENARIO_UUID,
    });
    const item = response.list?.[0] || null;
    configItem.value = item;
    const valueRecord = normalizeConfigRecord(item?.value);
    selectedScenarioKeys.value = Object.keys(valueRecord).filter(
      (key) => scenarioSortValue(key) > 0,
    );
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.mfaScenarioLoadFailed'),
    );
    message.error(
      $t('business.message.mfaScenarioLoadFailedWithReason', [errorMessage]),
    );
  } finally {
    loading.value = false;
  }
}

// toggleAll 处理全选与清空全部场景。
function toggleAll(checked: boolean) {
  selectedScenarioKeys.value = checked
    ? scenarioOptions.value.map((item) => item.value)
    : [];
}

// onToggleAllChange 兼容 Checkbox 事件结构，避免模板里写类型断言。
function onToggleAllChange(event: any) {
  toggleAll(Boolean((event.target as HTMLInputElement | null)?.checked));
}

// resetSelected 恢复为当前后端值。
function resetSelected() {
  selectedScenarioKeys.value = Object.keys(
    normalizeConfigRecord(configItem.value?.value),
  ).filter((key) => scenarioSortValue(key) > 0);
}

// saveConfig 保存选中的禁用 MFA 二次校验场景。
async function saveConfig() {
  if (!configItem.value) {
    message.warning($t('business.message.mfaScenarioConfigMissing'));
    return;
  }
  saving.value = true;
  const current = configItem.value;
  try {
    const cacheSyncResult = await updateConfig(current.id, {
      example: current.example,
      page: ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
      pid: current.pid,
      remark: current.remark,
      title: current.title,
      type: current.type,
      uuid: current.uuid,
      value: selectedValuePreview.value,
      version: current.version,
    });
    showCacheSyncResult(
      cacheSyncResult,
      $t('business.message.mfaScenarioSaved'),
    );
    await loadConfig();
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.mfaScenarioSaveFailed'),
    );
    message.error(
      $t('business.message.mfaScenarioSaveFailedWithReason', [errorMessage]),
    );
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page auto-content-height>
    <div class="mfa-scenario-page">
      <div class="mfa-scenario-header">
        <div>
          <h2>{{ $t('business.message.mfaScenarioEditorTitle') }}</h2>
          <p>{{ $t('business.message.mfaScenarioEditorDesc') }}</p>
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
        :description="$t('business.message.mfaScenarioEditorGuideDesc')"
        :message="$t('business.message.mfaScenarioEditorGuide')"
        show-icon
        type="info"
      />

      <Skeleton v-if="loading && !configItem" active />
      <Empty
        v-else-if="!configItem"
        :description="$t('business.message.mfaScenarioConfigMissing')"
      />
      <div v-else class="mfa-scenario-content">
        <section class="mfa-scenario-panel">
          <div class="mfa-scenario-panel-head">
            <div>
              <h3>{{ $t('business.message.mfaScenarioOptions') }}</h3>
              <p>
                {{
                  $t('business.message.mfaScenarioSelectedCount', [
                    selectedScenarioKeys.length,
                    scenarioOptions.length,
                  ])
                }}
              </p>
            </div>
            <Space>
              <Checkbox
                :checked="checkAll"
                :indeterminate="indeterminate"
                @change="onToggleAllChange"
              >
                {{ $t('business.message.selectAll') }}
              </Checkbox>
              <Button size="small" @click="toggleAll(false)">
                {{ $t('business.message.clearSelected') }}
              </Button>
              <Button size="small" @click="resetSelected">
                {{ $t('business.message.reset') }}
              </Button>
            </Space>
          </div>

          <CheckboxGroup
            v-model:value="selectedScenarioKeys"
            class="mfa-scenario-grid"
          >
            <label
              v-for="item in scenarioOptions"
              :key="item.value"
              class="mfa-scenario-option"
              :class="{
                'mfa-scenario-option--checked': selectedSet.has(item.value),
              }"
            >
              <Checkbox :value="item.value" />
              <span class="mfa-scenario-option-code">#{{ item.value }}</span>
              <span class="mfa-scenario-option-title">{{ item.label }}</span>
              <Tag
                v-if="selectedSet.has(item.value)"
                class="mfa-scenario-option-tag"
                color="warning"
              >
                {{ $t('business.message.mfaScenarioSkip') }}
              </Tag>
            </label>
          </CheckboxGroup>
        </section>

        <section class="mfa-scenario-panel">
          <div class="mfa-scenario-panel-head">
            <div>
              <h3>{{ $t('business.message.mfaScenarioCurrentConfig') }}</h3>
              <p>{{ $t('business.message.mfaScenarioCurrentConfigDesc') }}</p>
            </div>
          </div>
          <Descriptions :column="2" size="small" bordered>
            <DescriptionsItem :label="$t('business.message.configUuid')">
              {{ configItem.uuid }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.version')">
              {{ configItem.version }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.pagePath')">
              {{ ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('business.message.remarkDescription')">
              {{ configItem.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>
          <pre class="mfa-scenario-preview">{{ selectedValueText }}</pre>
        </section>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.mfa-scenario-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mfa-scenario-header,
.mfa-scenario-panel {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.mfa-scenario-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
}

.mfa-scenario-header h2,
.mfa-scenario-panel h3 {
  margin: 0;
  font-weight: 600;
}

.mfa-scenario-header h2 {
  font-size: 18px;
}

.mfa-scenario-header p,
.mfa-scenario-panel p {
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
}

.mfa-scenario-content {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
  gap: 16px;
}

.mfa-scenario-panel {
  padding: 16px;
}

.mfa-scenario-panel-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.mfa-scenario-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.mfa-scenario-option {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.mfa-scenario-option--checked {
  background: hsl(var(--accent));
  border-color: hsl(var(--primary));
}

.mfa-scenario-option-code {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.mfa-scenario-option-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mfa-scenario-option-tag {
  margin-inline-end: 0;
}

.mfa-scenario-preview {
  min-height: 220px;
  padding: 12px;
  margin: 14px 0 0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 1180px) {
  .mfa-scenario-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .mfa-scenario-header,
  .mfa-scenario-panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .mfa-scenario-grid {
    grid-template-columns: 1fr;
  }
}
</style>
