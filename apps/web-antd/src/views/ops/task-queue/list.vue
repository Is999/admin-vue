<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { TaskApi } from '#/api/ops/task';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';

import { ReloadOutlined } from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  message,
  Modal,
  Table,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchTaskQueues,
  pauseTaskQueue,
  resumeTaskQueue,
} from '#/api/ops/task';
import { $t } from '#/locales';

import { useColumns } from './data';

// TableActionParams 定义表格操作列的事件负载。
type TableActionParams<T = any> = {
  code: string;
  row: T;
};

// ================= 页面状态 =================
// workerSummaryText 用于展示在线 Worker 节点快照。
const workerSummaryText = ref('');
// queueRows 保存当前队列快照，供页面顶部概览卡复用。
const queueRows = ref<TaskApi.TaskQueueItem[]>([]);
// workerRows 保存当前在线 Worker 节点快照。
const workerRows = ref<TaskApi.TaskServerItem[]>([]);
// snapshotLoading 表示队列与 Worker 运行快照正在加载。
const snapshotLoading = ref(false);
// snapshotLoadFailed 表示最近一次运行快照加载失败。
const snapshotLoadFailed = ref(false);
// router 用于跳转到任务列表并带入队列筛选条件。
const router = useRouter();
// showWorkerSnapshot 控制 Worker 原始快照展开。
const showWorkerSnapshot = ref(false);

// workerColumns 定义在线 Worker 的结构化运行视图。
const workerColumns = computed(() => [
  {
    dataIndex: 'id',
    ellipsis: true,
    title: $t('business.message.workerInstance'),
    width: 220,
  },
  {
    dataIndex: 'host',
    title: $t('business.message.workerHost'),
    width: 180,
  },
  {
    dataIndex: 'pid',
    title: 'PID',
    width: 90,
  },
  {
    dataIndex: 'status',
    title: $t('business.message.workerStatus'),
    width: 110,
  },
  {
    dataIndex: 'concurrency',
    title: $t('business.message.workerConcurrency'),
    width: 110,
  },
  {
    dataIndex: 'strictPriority',
    title: $t('business.message.strictPriority'),
    width: 120,
  },
  {
    dataIndex: 'queues',
    title: $t('business.message.queueWeights'),
    width: 260,
  },
  {
    dataIndex: 'startedAt',
    title: $t('business.message.workerStartedAt'),
    width: 190,
  },
]);

// formatWorkerQueues 格式化 Worker 队列权重。
function formatWorkerQueues(queues?: Record<string, number>) {
  return Object.entries(queues || {})
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, weight]) => `${name}:${weight}`)
    .join(' · ');
}

const queueOverviewCards = computed(() => {
  const rows = queueRows.value;
  const pausedCount = rows.filter((item) => item.paused).length;
  const failedCount = rows.reduce(
    (sum, item) => sum + Number(item.failed || 0),
    0,
  );
  const pendingCount = rows.reduce(
    (sum, item) => sum + Number(item.pending || 0),
    0,
  );
  const activeCount = rows.reduce(
    (sum, item) => sum + Number(item.active || 0),
    0,
  );
  return [
    {
      description: $t('business.message.queueTotalDesc'),
      label: $t('business.message.queueTotal'),
      value: String(rows.length),
    },
    {
      description: $t('business.message.pausedQueueDesc'),
      label: $t('business.message.pausedQueue'),
      value: String(pausedCount),
    },
    {
      description: $t('business.message.onlineWorkerDesc'),
      label: $t('business.message.onlineWorker'),
      value: String(workerRows.value.length),
    },
    {
      description: $t('business.message.pendingTaskTotalDesc'),
      label: $t('business.message.pendingTask'),
      value: String(pendingCount),
    },
    {
      description: $t('business.message.activeTaskTotalDesc'),
      label: $t('business.message.activeTask'),
      value: String(activeCount),
    },
    {
      description: $t('business.message.todayFailedDesc'),
      label: $t('business.message.todayFailed'),
      value: String(failedCount),
    },
  ];
});

const queueOpsGuide = computed(() => {
  if (queueRows.value.some((item) => item.paused)) {
    return {
      description: $t('business.message.pausedQueueDetectedDesc'),
      message: $t('business.message.pausedQueueDetected'),
      type: 'warning' as const,
    };
  }
  if (queueRows.value.some((item) => Number(item.failed || 0) > 0)) {
    return {
      description: $t('business.message.failedQueueDetectedDesc'),
      message: $t('business.message.failedQueueDetected'),
      type: 'error' as const,
    };
  }
  return {
    description: $t('business.message.queueHealthyDesc'),
    message: $t('business.message.queueHealthy'),
    type: 'success' as const,
  };
});

// ================= 表格配置 =================
// Grid 负责展示任务队列概览。
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    keepSource: true,
    maxHeight: 680,
    proxyConfig: {
      ajax: {
        query: async () => {
          snapshotLoading.value = true;
          snapshotLoadFailed.value = false;
          try {
            const responseData = await fetchTaskQueues();
            queueRows.value = responseData.queues || [];
            workerRows.value = responseData.servers || [];
            workerSummaryText.value = JSON.stringify(
              responseData.servers || [],
              null,
              2,
            );
            return {
              list: responseData.queues || [],
              total: responseData.queues?.length || 0,
            };
          } catch (error) {
            queueRows.value = [];
            workerRows.value = [];
            workerSummaryText.value = '';
            snapshotLoadFailed.value = true;
            throw error;
          } finally {
            snapshotLoading.value = false;
          }
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'name',
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      zoom: true,
    },
  },
});

// ================= 业务方法 =================
// onActionClick 处理操作列点击事件。
function onActionClick(e: TableActionParams<TaskApi.TaskQueueItem>) {
  switch (e.code) {
    case 'pauseConsume':
    case 'resumeConsume': {
      void handleToggleQueueConsume(e.row);
      break;
    }
    case 'viewTasks': {
      void handleOpenQueueTasks(e.row);
      break;
    }
  }
}

// handleOpenQueueTasks 跳转到任务列表页，并自动带入当前队列。
async function handleOpenQueueTasks(row: TaskApi.TaskQueueItem) {
  await router.push({
    name: 'OpsTaskItem',
    query: {
      queue: row.name,
      source: $t('business.message.taskQueueSource', [row.name]),
    },
  });
}

// handleToggleQueueConsume 根据当前暂停状态执行暂停或恢复。
async function handleToggleQueueConsume(row: TaskApi.TaskQueueItem) {
  const actionLabel = row.paused
    ? $t('business.message.resumeConsume')
    : $t('business.message.pauseConsume');
  Modal.confirm({
    title: $t('business.message.confirmQueueConsumeAction', [actionLabel]),
    content: $t('business.message.confirmQueueConsumeActionDesc', [
      row.name,
      actionLabel,
    ]),
    async onOk() {
      await (row.paused
        ? resumeTaskQueue({ queue: row.name })
        : pauseTaskQueue({ queue: row.name }));
      message.success(
        $t('business.message.queueConsumeActionSucceeded', [
          row.name,
          actionLabel,
        ]),
      );
      await gridApi.query();
    },
  });
}

// handleRefresh 刷新任务队列列表。
function handleRefresh() {
  void gridApi.query();
}
</script>

<template>
  <Page
    content-class="min-w-0 overflow-x-hidden"
    :title="$t('business.message.taskQueueOverview')"
  >
    <div class="grid min-w-0 max-w-full gap-2">
      <section
        class="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] px-5 py-4 text-slate-100 shadow-[0_16px_44px_rgba(15,23,42,0.3)]"
      >
        <div
          class="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] xl:items-start"
        >
          <div class="min-w-0">
            <div
              class="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80"
            >
              Queue Observatory
            </div>
            <div class="mt-2 text-2xl font-semibold tracking-tight text-white">
              {{ $t('business.message.taskQueuePanelTitle') }}
            </div>
            <div class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {{ $t('business.message.taskQueuePanelDesc') }}
            </div>
          </div>
          <div
            class="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-4"
          >
            <div
              v-for="item in queueOverviewCards"
              :key="item.label"
              class="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
            >
              <div
                class="truncate text-[11px] uppercase tracking-[0.18em] text-slate-400"
              >
                {{ item.label }}
              </div>
              <div class="mt-1 text-lg font-semibold text-white">
                {{ item.value }}
              </div>
              <div
                class="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-400"
              >
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Alert
        v-if="snapshotLoadFailed"
        show-icon
        type="error"
        :message="$t('business.message.taskQueueSnapshotLoadFailed')"
      />
      <Alert
        v-else
        :description="queueOpsGuide.description"
        :message="queueOpsGuide.message"
        show-icon
        :type="queueOpsGuide.type"
      />

      <div
        class="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60"
        >
          <div>
            <div
              class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.taskQueueList') }}
            </div>
            <div class="text-xs leading-5 text-slate-500 dark:text-slate-300">
              {{ $t('business.message.taskQueueListDesc') }}
            </div>
          </div>
          <VbenButton
            type="primary"
            :loading="snapshotLoading"
            @click="handleRefresh"
          >
            <ReloadOutlined />
            {{ $t('business.message.refreshQueue') }}
          </VbenButton>
        </div>
        <div class="min-w-0 overflow-x-auto px-0 py-0">
          <Grid :table-title="$t('business.message.taskQueueList')" />
        </div>
      </div>

      <Card
        class="min-w-0 border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.onlineWorkerSnapshot')"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm leading-6 text-slate-500 dark:text-slate-300">
            {{ $t('business.message.onlineWorkerSnapshotDesc') }}
          </div>
          <Button
            size="small"
            @click="showWorkerSnapshot = !showWorkerSnapshot"
          >
            {{
              showWorkerSnapshot
                ? $t('business.message.closeSnapshot')
                : $t('business.message.viewRawSnapshot')
            }}
          </Button>
        </div>
        <Table
          class="worker-table mt-4"
          :columns="workerColumns"
          :data-source="workerRows"
          :loading="snapshotLoading"
          :locale="{ emptyText: $t('business.message.noOnlineWorker') }"
          :pagination="false"
          :row-key="(record) => record.id"
          :scroll="{ x: 1280 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'status'">
              <Tag :color="record.status === 'active' ? 'success' : 'warning'">
                {{ record.status || '-' }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'strictPriority'">
              <Tag :color="record.strictPriority ? 'processing' : 'default'">
                {{
                  record.strictPriority
                    ? $t('business.message.enabled')
                    : $t('business.message.disabled')
                }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'queues'">
              <span
                class="block min-w-0 whitespace-normal break-words font-mono text-xs leading-5"
              >
                {{ formatWorkerQueues(record.queues) || '-' }}
              </span>
            </template>
            <template v-else-if="column.dataIndex === 'startedAt'">
              {{ record.startedAt || '-' }}
            </template>
          </template>
        </Table>
        <pre
          v-if="showWorkerSnapshot && workerSummaryText"
          class="mt-4 overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950 p-4 text-sm text-cyan-100 shadow-inner"
          v-text="workerSummaryText"
        ></pre>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.worker-table :deep(.ant-table) {
  color: hsl(var(--foreground));
  background: transparent;
}

.worker-table :deep(.ant-table-container) {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.worker-table :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-bottom-color: hsl(var(--border));
}

.worker-table :deep(.ant-table-thead > tr > th::before) {
  background-color: hsl(var(--heavy));
}

.worker-table :deep(.ant-table-tbody > tr > td) {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border-bottom-color: hsl(var(--border));
}

.worker-table :deep(.ant-table-tbody > tr:hover > td) {
  background: hsl(var(--accent-hover));
}
</style>
