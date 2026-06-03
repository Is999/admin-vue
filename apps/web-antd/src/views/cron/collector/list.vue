<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { CollectorApi } from '#/api/cron/collector';

import { computed, onMounted, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchCollectorOverview,
  fetchCollectorTasks,
  retryCollectorTasks,
  runCollector,
} from '#/api/cron/collector';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
  hasAnyPermission,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  COLLECTOR_TRANSPORT_OPTIONS,
  getCollectorStateOptions,
  useColumns,
} from './data';

// ================= 页面状态 =================
// accessStore 保存当前账号的 uuid 权限码集合。
const accessStore = useAccessStore();
// submitting 用于统一控制“运行/重试”等高风险操作的重复点击。
const submitting = ref(false);
// currentRows 保存当前页任务快照，用于统计与批量重试。
const currentRows = ref<CollectorApi.TaskItem[]>([]);
// currentTotal 保存当前筛选条件下的任务总数。
const currentTotal = ref(0);
// overview 保存 collector 当前积压、配置与近窗口处理统计。
const overview = ref<CollectorApi.OverviewResp | null>(null);

// 查询条件：业务类型。
const searchBizType = ref('');
// 查询条件：投递通道。
const searchTransport = ref<'' | CollectorApi.Transport>('');
// 查询条件：任务状态。
const searchState = ref<'' | CollectorApi.TaskState>('');

// runLimit 控制“手动执行一轮”最大处理数量，避免误操作造成过大冲击。
const runLimit = ref(200);
// retryDelaySeconds 控制批量重试的延迟秒，便于避开瞬时抖动。
const retryDelaySeconds = ref(60);
// retryLimit 控制一次批量重试的最大条数，避免一键放大事故。
const retryLimit = ref(200);
// resetAttempt 用于控制是否重置尝试次数，具体语义以服务端实现为准。
const resetAttempt = ref(true);

// canRunCollector 控制“执行一轮”按钮展示。
const canRunCollector = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.COLLECTOR_RUN,
  ]),
);

// canRetryCollector 控制“批量重试”按钮展示。
const canRetryCollector = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.COLLECTOR_RETRY,
  ]),
);

// collectorStateOptions 生成当前语言下的 Collector 状态选项。
const collectorStateOptions = computed(() => getCollectorStateOptions());

// stateSummaryCards 生成当前页的状态统计卡片，便于快速判断当前积压/失败分布。
const stateSummaryCards = computed(() => {
  const rows = currentRows.value;
  const countByState: Record<CollectorApi.TaskState, number> = {} as Record<
    CollectorApi.TaskState,
    number
  >;
  for (const item of rows) {
    const state = Number(item.state) as CollectorApi.TaskState;
    countByState[state] = (countByState[state] || 0) + 1;
  }
  return collectorStateOptions.value.map((item) => ({
    label: item.label,
    value: String(countByState[item.value] || 0),
  }));
});

// pageGuideText 汇总生产运维建议，降低误操作成本。
const pageGuideText = computed(() => {
  if ((overview.value?.runningTimeoutCount || 0) > 0) {
    return {
      description: $t('business.message.collectorTimeoutRiskDesc'),
      message: $t('business.message.collectorTimeoutRiskTitle'),
      type: 'warning' as const,
    };
  }
  if ((overview.value?.readyCount || 0) > 5000) {
    return {
      description: $t('business.message.collectorBacklogRiskDesc'),
      message: $t('business.message.collectorBacklogRiskTitle'),
      type: 'warning' as const,
    };
  }
  if (currentRows.value.some((item) => item.state === 4)) {
    return {
      description: $t('business.message.collectorDeadRiskDesc'),
      message: $t('business.message.collectorDeadRiskTitle'),
      type: 'warning' as const,
    };
  }
  if (currentRows.value.some((item) => item.state === 3)) {
    return {
      description: $t('business.message.collectorRetryRiskDesc'),
      message: $t('business.message.collectorRetryRiskTitle'),
      type: 'info' as const,
    };
  }
  return {
    description: $t('business.message.collectorHealthyDesc'),
    message: $t('business.message.collectorHealthyTitle'),
    type: 'success' as const,
  };
});

// overviewBacklogCards 汇总当前 Collector 全局积压状态。
const overviewBacklogCards = computed(() => {
  const currentOverview = overview.value;
  return [
    {
      label: $t('business.message.collectorReadyToRun'),
      value: String(currentOverview?.readyCount || 0),
      description: $t('business.message.collectorOldestBacklog', [
        formatSeconds(currentOverview?.oldestReadyAgeSeconds || 0),
      ]),
    },
    {
      label: $t('business.message.collectorStateRunning'),
      value: String(currentOverview?.runningCount || 0),
      description: $t('business.message.collectorTimeoutCount', [
        currentOverview?.runningTimeoutCount || 0,
      ]),
    },
    {
      label: $t('business.message.collectorStateRetry'),
      value: String(currentOverview?.retryCount || 0),
      description: $t('business.message.collectorDeadCount', [
        currentOverview?.deadCount || 0,
      ]),
    },
    {
      label: $t('business.message.collectorDoneTotal'),
      value: String(currentOverview?.doneCount || 0),
      description: $t('business.message.collectorPendingCount', [
        currentOverview?.pendingCount || 0,
      ]),
    },
  ];
});

// overviewWindowCards 汇总最近 1/5/15 分钟吞吐与耗时。
const overviewWindowCards = computed(() => {
  const currentOverview = overview.value;
  const windows = [
    currentOverview?.recent1m,
    currentOverview?.recent5m,
    currentOverview?.recent15m,
  ].filter(Boolean);
  return windows.map((item) => ({
    label: $t('business.message.collectorRecentMinutes', [item!.windowMinutes]),
    value: `${item!.successCount} / ${item!.failCount}`,
    description: $t('business.message.collectorAvgMaxCost', [
      formatMilliseconds(item!.avgCostMs),
      formatMilliseconds(item!.maxCostMs),
    ]),
  }));
});

// bizTypeTopRows 汇总最近 15 分钟最需要关注的业务类型排行。
const bizTypeTopRows = computed(() => overview.value?.bizTypeTop15m || []);

// transportStatCards 汇总当前不同 transport 的来源分布。
const transportStatCards = computed(() => {
  const rows = overview.value?.transportStats || [];
  return rows.map((item) => ({
    label: item.transport || 'unknown',
    value: String(item.totalCount || 0),
    description: $t('business.message.collectorTransportStatDesc', [
      item.readyCount || 0,
      item.runningCount || 0,
      item.retryCount || 0,
      item.deadCount || 0,
    ]),
  }));
});

// collectorConfigSummary 汇总当前生效的重要 Collector 参数，便于判断是否需要继续调参。
const collectorConfigSummary = computed(() => {
  const currentOverview = overview.value;
  if (!currentOverview) {
    return $t('business.message.collectorOverviewLoading');
  }
  return [
    $t('business.message.collectorKafkaBatch', [
      currentOverview.kafkaBatchSize,
    ]),
    $t('business.message.collectorRedisRead', [currentOverview.redisReadCount]),
    $t('business.message.collectorDbBatch', [
      currentOverview.dbRunnerBatchSize,
    ]),
    $t('business.message.collectorPollInterval', [
      currentOverview.dbRunnerIntervalSecs,
    ]),
    $t('business.message.collectorLeaseSeconds', [
      currentOverview.runningLeaseSeconds,
    ]),
    $t('business.message.collectorMaxRetry', [currentOverview.maxRetryTimes]),
  ].join(' | ');
});

// overviewFreshnessText 展示概览生成时间和缓存命中信息，避免巡检时误判实时性。
const overviewFreshnessText = computed(() => {
  const currentOverview = overview.value;
  if (!currentOverview) {
    return $t('business.message.collectorOverviewLoading');
  }
  const cacheMode = currentOverview.overviewCacheHit
    ? $t('business.message.cacheHit')
    : $t('business.message.realtimeAggregate');
  return [
    $t('business.message.collectorOverviewTime', [
      currentOverview.overviewGeneratedAt || '-',
    ]),
    cacheMode,
    $t('business.message.collectorCacheWindow', [
      currentOverview.overviewCacheTTLSeconds || 0,
    ]),
    $t('business.message.collectorCacheAge', [
      formatSeconds(currentOverview.overviewCacheAgeSeconds || 0),
    ]),
  ].join(' | ');
});

// ================= 表格配置 =================
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    keepSource: true,
    maxHeight: 680,
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async ({ page }: { page: any }) => {
          const responseData = await fetchCollectorTasks({
            bizType: searchBizType.value.trim() || undefined,
            transport: (searchTransport.value === ''
              ? undefined
              : searchTransport.value) as any,
            state: (searchState.value === ''
              ? undefined
              : searchState.value) as any,
            page: page.currentPage,
            pageSize: page.pageSize,
          });
          currentRows.value = responseData.list || [];
          currentTotal.value = responseData.total || 0;
          return {
            list: responseData.list || [],
            total: responseData.total || 0,
          };
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: false,
      zoom: true,
    },
  },
});

// ================= 业务方法 =================
// handleQuery 刷新列表数据。
function handleQuery() {
  void Promise.all([gridApi.query(), loadOverview()]);
}

// handleReset 清空筛选条件并刷新列表。
function handleReset() {
  searchBizType.value = '';
  searchTransport.value = '';
  searchState.value = '';
  void Promise.all([gridApi.query(), loadOverview()]);
}

// loadOverview 拉取 Collector 概览与近窗口性能观察信息。
async function loadOverview() {
  overview.value = await fetchCollectorOverview();
}

// handleRunCollector 执行一轮 collector outbox 任务。
function handleRunCollector() {
  if (submitting.value) {
    return;
  }
  Modal.confirm({
    title: $t('business.message.collectorConfirmRunTitle'),
    content: $t('business.message.collectorConfirmRunDesc'),
    okText: $t('business.message.confirmRun'),
    cancelText: $t('business.message.cancel'),
    async onOk() {
      submitting.value = true;
      try {
        const responseData = await runCollector({
          limit: Number(runLimit.value || 0) || undefined,
        });
        message.success(
          $t('business.message.collectorRunTriggered', [
            responseData.processed || 0,
          ]),
        );
        await Promise.all([gridApi.query(), loadOverview()]);
      } catch (error) {
        message.error(
          $t('business.message.collectorRunFailed', [String(error)]),
        );
      } finally {
        submitting.value = false;
      }
    },
  });
}

// resolveRetryCandidates 根据当前列表筛选出可重试任务 ID（优先 state=待重试/死信）。
function resolveRetryCandidates() {
  const ids = currentRows.value
    .filter((item) => item.state === 3 || item.state === 4)
    .map((item) => Number(item.id))
    .filter((item) => Number.isFinite(item) && item > 0);
  const limitValue = Number(retryLimit.value || 0);
  return limitValue > 0 ? ids.slice(0, limitValue) : ids;
}

// handleRetryBatch 对当前筛选结果中可重试任务执行批量重试。
function handleRetryBatch() {
  if (submitting.value) {
    return;
  }
  const ids = resolveRetryCandidates();
  if (ids.length === 0) {
    message.warning($t('business.message.noRetryableTasksOnPage'));
    return;
  }
  Modal.confirm({
    title: $t('business.message.confirmBatchRetry'),
    content: $t('business.message.collectorConfirmRetryDesc', [ids.length]),
    okText: $t('business.message.confirmRetry'),
    cancelText: $t('business.message.cancel'),
    async onOk() {
      submitting.value = true;
      try {
        await retryCollectorTasks({
          delaySeconds: Number(retryDelaySeconds.value || 0) || undefined,
          ids,
          resetAttempt: !!resetAttempt.value,
        });
        message.success($t('business.message.batchRetrySubmitted'));
        await Promise.all([gridApi.query(), loadOverview()]);
      } catch (error) {
        message.error(
          $t('business.message.collectorRetryFailed', [String(error)]),
        );
      } finally {
        submitting.value = false;
      }
    },
  });
}

onMounted(() => {
  void Promise.all([gridApi.query(), loadOverview()]);
});

// formatSeconds 把秒数转成更易读的时长展示。
function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0s';
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${(seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)}h`;
}

// formatMilliseconds 把毫秒耗时格式化为便于巡检的文本。
function formatMilliseconds(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0ms';
  }
  if (ms < 1000) {
    return `${ms.toFixed(ms >= 100 ? 0 : 1)}ms`;
  }
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 2)}s`;
}
</script>

<template>
  <Page :title="$t('business.message.collectorTask')">
    <div class="space-y-4">
      <section
        class="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] px-5 py-4 text-slate-100 shadow-[0_16px_44px_rgba(15,23,42,0.3)]"
      >
        <div
          class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start"
        >
          <div>
            <div
              class="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80"
            >
              Collector Ops
            </div>
            <div class="mt-2 text-2xl font-semibold tracking-tight text-white">
              {{ $t('business.message.collectorConsoleTitle') }}
            </div>
            <div class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {{ $t('business.message.collectorConsoleDesc') }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
            <div
              v-for="item in stateSummaryCards"
              :key="item.label"
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
            >
              <div
                class="truncate text-[11px] uppercase tracking-[0.18em] text-slate-400"
              >
                {{ item.label }}
              </div>
              <div class="mt-1 text-lg font-semibold text-white">
                {{ item.value }}
              </div>
              <div class="mt-1 text-[11px] leading-4 text-slate-400">
                {{ $t('business.message.currentPage') }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Alert
        :description="pageGuideText.description"
        :message="pageGuideText.message"
        show-icon
        :type="pageGuideText.type"
      />

      <div class="grid gap-4 xl:grid-cols-2">
        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.collectorGlobalBacklog')"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in overviewBacklogCards"
              :key="item.label"
              class="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
            >
              <div class="text-xs text-slate-500 dark:text-slate-300">
                {{ item.label }}
              </div>
              <div
                class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ item.value }}
              </div>
              <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ item.description }}
              </div>
            </div>
          </div>
        </Card>

        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.collectorRecentWindowPerformance')"
        >
          <div class="grid gap-3 md:grid-cols-3">
            <div
              v-for="item in overviewWindowCards"
              :key="item.label"
              class="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
            >
              <div class="text-xs text-slate-500 dark:text-slate-300">
                {{ item.label }}
              </div>
              <div
                class="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ item.value }}
              </div>
              <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ $t('business.message.successFailed') }};
                {{ item.description }}
              </div>
            </div>
          </div>
          <div
            class="mt-3 rounded-xl border border-dashed border-slate-200/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-300"
          >
            {{ $t('business.message.currentParameters') }}:
            {{ collectorConfigSummary }}
          </div>
          <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {{ overviewFreshnessText }}
          </div>
        </Card>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.collectorBizTypeHotRank')"
        >
          <div v-if="bizTypeTopRows.length > 0" class="space-y-3">
            <div
              v-for="item in bizTypeTopRows"
              :key="item.bizType"
              class="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div
                    class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {{ item.bizType }}
                  </div>
                  <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {{
                      $t('business.message.collectorBizTypeStatDesc', [
                        item.readyCount,
                        item.runningCount,
                        item.retryCount,
                        item.deadCount,
                      ])
                    }}
                  </div>
                </div>
                <div
                  class="text-right text-xs text-slate-500 dark:text-slate-400"
                >
                  <div>
                    {{
                      $t('business.message.collectorSuccessFailCount', [
                        item.recentSuccessCount,
                        item.recentFailCount,
                      ])
                    }}
                  </div>
                  <div class="mt-1">
                    {{
                      $t('business.message.collectorAvgMaxCostSlash', [
                        formatMilliseconds(item.recentAvgCostMs),
                        formatMilliseconds(item.recentMaxCostMs),
                      ])
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-slate-500 dark:text-slate-300">
            {{ $t('business.message.collectorNoBizTypeRank') }}
          </div>
        </Card>

        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.collectorTransportDistribution')"
        >
          <div v-if="transportStatCards.length > 0" class="space-y-3">
            <div
              v-for="item in transportStatCards"
              :key="item.label"
              class="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div
                    class="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100"
                  >
                    {{ item.label }}
                  </div>
                  <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {{ item.description }}
                  </div>
                </div>
                <div class="text-right">
                  <div
                    class="text-2xl font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {{ item.value }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {{ $t('business.message.totalTaskCount') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-slate-500 dark:text-slate-300">
            {{ $t('business.message.collectorNoTransportDistribution') }}
          </div>
        </Card>
      </div>

      <div
        class="rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
      >
        <div
          class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60"
        >
          <div>
            <div
              class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.filterAndOperation') }}
            </div>
            <div class="text-xs leading-5 text-slate-500 dark:text-slate-300">
              {{ $t('business.message.collectorFilterOperationDesc') }}
            </div>
          </div>

          <Space :size="8" wrap>
            <VbenButton
              v-if="canRunCollector"
              v-access="
                asActionPermission(CRON_ACTION_PERMISSION_CODES.COLLECTOR_RUN)
              "
              type="primary"
              :disabled="submitting"
              @click="handleRunCollector"
            >
              {{
                submitting
                  ? $t('business.message.running')
                  : $t('business.message.runOnce')
              }}
            </VbenButton>
            <VbenButton
              v-if="canRetryCollector"
              v-access="
                asActionPermission(CRON_ACTION_PERMISSION_CODES.COLLECTOR_RETRY)
              "
              type="primary"
              :disabled="submitting"
              @click="handleRetryBatch"
            >
              {{
                submitting
                  ? $t('business.message.submitting')
                  : $t('business.message.batchRetry')
              }}
            </VbenButton>
          </Space>
        </div>

        <div class="grid gap-3 px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.eventCategoryBizType') }}
            </div>
            <Input
              v-model:value="searchBizType"
              allow-clear
              :placeholder="$t('business.message.collectorBizTypePlaceholder')"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.transportChannel') }}
            </div>
            <Select
              v-model:value="searchTransport"
              allow-clear
              class="w-full"
              :placeholder="$t('business.message.allTransportChannels')"
              :options="COLLECTOR_TRANSPORT_OPTIONS"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.taskState') }}
            </div>
            <Select
              v-model:value="searchState"
              allow-clear
              class="w-full"
              :placeholder="$t('business.message.allStates')"
              :options="collectorStateOptions"
            />
          </div>
          <div class="flex items-end gap-2">
            <Button type="primary" @click="handleQuery">
              {{ $t('business.message.search') }}
            </Button>
            <Button @click="handleReset">
              {{ $t('business.message.reset') }}
            </Button>
          </div>
        </div>

        <div
          class="grid gap-3 border-t border-slate-200/70 px-4 py-3 md:grid-cols-3 dark:border-slate-700/60"
        >
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.runLimitLabel') }}
            </div>
            <InputNumber
              v-model:value="runLimit"
              :min="1"
              :precision="0"
              class="w-full"
              :placeholder="$t('business.message.default200')"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.retryDelaySecondsLabel') }}
            </div>
            <InputNumber
              v-model:value="retryDelaySeconds"
              :min="0"
              :precision="0"
              class="w-full"
              :placeholder="$t('business.message.default60')"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.retryLimitLabel') }}
            </div>
            <InputNumber
              v-model:value="retryLimit"
              :min="1"
              :precision="0"
              class="w-full"
              :placeholder="$t('business.message.default200')"
            />
          </div>
        </div>

        <div
          class="border-t border-slate-200/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-300"
        >
          {{ $t('business.message.collectorMatchedTotalHint', [currentTotal]) }}
          <template v-if="resetAttempt">
            {{ $t('business.message.collectorResetAttemptHint') }}
          </template>
          <Button
            class="ml-2 px-0"
            size="small"
            type="link"
            @click="resetAttempt = !resetAttempt"
          >
            {{
              resetAttempt
                ? $t('business.message.switchToKeepAttempt')
                : $t('business.message.switchToResetAttempt')
            }}
          </Button>
        </div>
      </div>

      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.taskList')"
      >
        <Grid :table-title="$t('business.message.collectorTaskList')" />
      </Card>
    </div>
  </Page>
</template>
