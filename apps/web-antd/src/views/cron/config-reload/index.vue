<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { TaskApi } from '#/api/cron/task';

import { computed, onMounted, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { Alert, Card, message, Space, Tooltip } from 'ant-design-vue';

import { fetchConfigReloadStatus, runConfigReload } from '#/api/cron/task';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
  hasAnyPermission,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  buildHotReloadStatusLabel,
  buildHotReloadTriggerLabel,
  safePrettyJson,
} from '../shared';

type OverflowTooltipProps = InstanceType<typeof Tooltip>['$props'];

// ================= 页面状态 =================
// accessStore 保存当前登录账号的 uuid 权限码集合，用于判断是否自动拉取热加载状态。
const accessStore = useAccessStore();
// submitting 避免查询与执行热加载时重复点击。
const submitting = ref(false);
// configReloadStatusText 保存热加载接口原始响应，便于排障复制。
const configReloadStatusText = ref('');
// configReloadStatus 保存最近一次配置热加载状态对象。
const configReloadStatus = ref<null | TaskApi.TaskConfigReloadStatusResp>(null);
// showConfigReloadRaw 控制原始 JSON 回执是否展开。
const showConfigReloadRaw = ref(false);

// canManageConfigReload 判断当前账号是否具备任一热加载相关操作权限。
const canManageConfigReload = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_RUN,
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
  ]),
);

// hotReloadSummaryRows 生成“热加载状态总览”区域所需字段。
const hotReloadSummaryRows = computed(() => {
  const status = configReloadStatus.value;
  if (!status) {
    return [];
  }
  return [
    {
      label: $t('business.message.currentStatus'),
      value: buildHotReloadStatusLabel(status.lastStatus),
      description: $t('business.message.hotReloadCurrentStatusDesc'),
    },
    {
      label: $t('business.message.isEnabled'),
      value: status.enabled
        ? $t('business.message.enabled')
        : $t('business.message.disabled'),
      description: $t('business.message.hotReloadEnabledDesc'),
    },
    {
      label: $t('business.message.isWatching'),
      value: status.watching
        ? $t('business.message.backgroundWatching')
        : $t('business.message.notWatching'),
      description: $t('business.message.hotReloadWatchingDesc'),
    },
    {
      label: $t('business.message.latestTriggerSource'),
      value: buildHotReloadTriggerLabel(status.lastTriggerSource),
      description: $t('business.message.latestTriggerSourceDesc'),
    },
    {
      label: $t('business.message.configFile'),
      value: status.configFile || '-',
      description: $t('business.message.configFileDesc'),
    },
    {
      label: $t('business.message.pollInterval'),
      value: $t('business.message.secondsValue', [
        status.checkIntervalSeconds || 0,
      ]),
      description: $t('business.message.pollIntervalDesc'),
    },
    {
      label: $t('business.message.configVersion'),
      value: status.configVersion || '-',
      description: $t('business.message.configVersionDesc'),
    },
    {
      label: $t('business.message.restartRequired'),
      value: status.restartRequired
        ? $t('business.message.needRestartProcess')
        : $t('business.message.noRestartRequired'),
      description: $t('business.message.restartRequiredDesc'),
    },
    {
      label: $t('business.message.restartReason'),
      value: status.restartReason || '-',
      description: $t('business.message.restartReasonDesc'),
    },
    {
      label: $t('business.message.latestResultMessage'),
      value: status.lastMessage || '-',
      description: $t('business.message.latestResultMessageDesc'),
    },
    {
      label: $t('business.message.latestFailureCategory'),
      value: status.lastFailureCategory || '-',
      description: $t('business.message.latestFailureCategoryDesc'),
    },
    {
      label: $t('business.message.successCount'),
      value: $t('business.message.timesValue', [status.reloadCount || 0]),
      description: $t('business.message.successCountDesc'),
    },
    {
      label: $t('business.message.suppressedFailureCount'),
      value: $t('business.message.timesValue', [
        status.suppressedFailureCount || 0,
      ]),
      description: $t('business.message.suppressedFailureCountDesc'),
    },
  ];
});

// hotReloadTimeRows 生成“热加载时间轴”区域所需字段。
const hotReloadTimeRows = computed(() => {
  const status = configReloadStatus.value;
  if (!status) {
    return [];
  }
  return [
    {
      label: $t('business.message.latestCheckTime'),
      value: status.lastCheckedAt || '-',
      description: $t('business.message.latestCheckTimeDesc'),
    },
    {
      label: $t('business.message.latestReloadTime'),
      value: status.lastReloadAt || '-',
      description: $t('business.message.latestReloadTimeDesc'),
    },
    {
      label: $t('business.message.latestSuccessTime'),
      value: status.lastSuccessAt || '-',
      description: $t('business.message.latestSuccessTimeDesc'),
    },
    {
      label: $t('business.message.latestFailureTime'),
      value: status.lastFailureAt || '-',
      description: $t('business.message.latestFailureTimeDesc'),
    },
  ];
});

// buildOverflowTooltipProps 返回统一的长文本悬浮展示配置。
function buildOverflowTooltipProps(text: string): OverflowTooltipProps {
  return {
    overlayStyle: {
      maxWidth: '720px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    },
    placement: 'topLeft' as const,
    title: text,
  };
}

// handleFetchConfigReloadStatus 查询配置热加载状态。
async function handleFetchConfigReloadStatus() {
  submitting.value = true;
  try {
    const responseData = await fetchConfigReloadStatus();
    configReloadStatus.value = responseData;
    configReloadStatusText.value = safePrettyJson(responseData);
    message.success($t('business.message.configHotReloadStatusQueried'));
  } catch (error) {
    configReloadStatus.value = null;
    configReloadStatusText.value = $t('business.message.queryFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

// handleRunConfigReload 手动触发配置热加载。
async function handleRunConfigReload() {
  submitting.value = true;
  try {
    const responseData = await runConfigReload();
    configReloadStatus.value = responseData;
    configReloadStatusText.value = safePrettyJson(responseData);
    message.success($t('business.message.configHotReloadExecuted'));
  } catch (error) {
    configReloadStatus.value = null;
    configReloadStatusText.value = $t('business.message.runFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (
    hasAnyPermission(accessStore.accessCodes, [
      CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
    ])
  ) {
    void handleFetchConfigReloadStatus();
  }
});
</script>

<template>
  <Page :title="$t('business.message.configHotReload')">
    <div class="space-y-4">
      <Alert
        v-if="!canManageConfigReload"
        :message="$t('business.message.noConfigHotReloadPermission')"
        :description="$t('business.message.noConfigHotReloadPermissionDesc')"
        show-icon
        type="warning"
      />
      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.configHotReload')"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm leading-6 text-slate-500 dark:text-slate-300">
            {{ $t('business.message.configHotReloadGuide') }}
          </div>
          <Space :size="8" wrap>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
                )
              "
              :disabled="submitting"
              @click="handleFetchConfigReloadStatus"
            >
              {{ $t('business.message.queryHotReloadStatus') }}
            </VbenButton>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_RUN,
                )
              "
              type="primary"
              :disabled="submitting"
              @click="handleRunConfigReload"
            >
              {{ $t('business.message.triggerHotReload') }}
            </VbenButton>
            <VbenButton
              v-if="configReloadStatusText"
              :disabled="submitting"
              @click="showConfigReloadRaw = !showConfigReloadRaw"
            >
              {{
                showConfigReloadRaw
                  ? $t('business.message.closeRawReceipt')
                  : $t('business.message.viewRawReceipt')
              }}
            </VbenButton>
          </Space>
        </div>
        <div
          v-if="hotReloadSummaryRows.length > 0"
          class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          <div
            v-for="item in [...hotReloadSummaryRows, ...hotReloadTimeRows]"
            :key="item.label"
            class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40"
          >
            <div class="text-xs uppercase tracking-[0.16em] text-slate-400">
              {{ item.label }}
            </div>
            <Tooltip
              v-if="String(item.value || '').trim()"
              v-bind="buildOverflowTooltipProps(String(item.value))"
            >
              <div
                class="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                :title="String(item.value)"
              >
                {{ item.value }}
              </div>
            </Tooltip>
            <div
              v-else
              class="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ item.value }}
            </div>
            <div class="mt-2 text-xs leading-5 text-slate-500">
              {{ item.description }}
            </div>
          </div>
        </div>
        <pre
          v-if="showConfigReloadRaw && configReloadStatusText"
          class="mt-4 overflow-auto rounded-2xl border border-amber-500/20 bg-slate-950 px-4 py-4 text-sm text-amber-100 shadow-inner"
          v-text="configReloadStatusText"
        ></pre>
      </Card>
    </div>
  </Page>
</template>
