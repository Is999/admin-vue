<script lang="ts" setup>
import type { PeriodicRecentTask } from './periodic-task-detail-data';

import type { RuntimeConfigApi } from '#/api/ops/runtime-config';
import type { TaskApi } from '#/api/ops/task';

import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenDrawer } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  BranchesOutlined,
  EyeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  fetchTaskItemsOverview,
  fetchTaskRuns,
  fetchTaskWorkflows,
} from '#/api/ops/task';
import {
  hasAnyPermission,
  OPS_ACTION_PERMISSION_CODES,
  OPS_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  currentSessionStateIdentity,
  registerSessionStateCleanup,
} from '#/utils/session-state-gate';

import { formatDurationMs } from '../../shared';
import CopyableTextCell from './copyable-text-cell.vue';
import { mergePeriodicRecentTasks } from './periodic-task-detail-data';

type PeriodicTaskDetailDrawerData = {
  // activeTasks 是当前 active release 中的周期任务配置。
  activeTasks?: RuntimeConfigApi.PeriodicTaskItem[];
  // task 是用户当前查看的周期任务草稿。
  task?: RuntimeConfigApi.PeriodicTaskItem;
};

// PERIODIC_RECENT_TASK_LIMIT 限制详情抽屉单次读取量，避免频繁扫描历史任务。
const PERIODIC_RECENT_TASK_LIMIT = 20;
// PERIODIC_WORKFLOW_HISTORY_DAYS 与后端默认工作流历史保留期一致，覆盖低频周期任务。
const PERIODIC_WORKFLOW_HISTORY_DAYS = 7;

const rt = (key: string) => $t(`admin.runtimeConfig.${key}`);
const router = useRouter();
const accessStore = useAccessStore();
// periodicTask 保存当前查看的周期任务草稿。
const periodicTask = ref<null | RuntimeConfigApi.PeriodicTaskItem>(null);
// activePeriodicTasks 保存当前 active release 中的周期任务配置。
const activePeriodicTasks = ref<RuntimeConfigApi.PeriodicTaskItem[]>([]);
// recentTasks 保存 Redis 热状态与 DB 终态合并后的最近执行记录。
const recentTasks = ref<PeriodicRecentTask[]>([]);
// recentWorkflows 保存 DB 中按周期任务名称聚合的短期工作流历史。
const recentWorkflows = ref<TaskApi.TaskWorkflowHistoryItem[]>([]);
// recentTasksLoading 控制最近执行记录加载状态。
const recentTasksLoading = ref(false);
// recentLiveTasksLoadFailed 标记 Redis 热状态是否加载失败。
const recentLiveTasksLoadFailed = ref(false);
// recentTaskHistoryLoadFailed 标记 DB 任务终态历史是否加载失败。
const recentTaskHistoryLoadFailed = ref(false);
// recentWorkflowsLoadFailed 独立标记历史库降级，不影响 Redis 近期任务展示。
const recentWorkflowsLoadFailed = ref(false);
// periodicDetailFullscreen 控制周期任务详情抽屉是否占满当前视口。
const periodicDetailFullscreen = ref(false);
// periodicDetailFullscreenLabel 返回当前全屏切换按钮的国际化文案。
const periodicDetailFullscreenLabel = computed(() =>
  rt(
    periodicDetailFullscreen.value
      ? 'detailExitFullscreen'
      : 'detailFullscreen',
  ),
);
// recentTasksRequestSeq 隔离切换账号或任务前发起的旧请求结果。
const recentTasksRequestSeq = ref(0);

// activePeriodicTask 返回与草稿同名的当前运行态配置。
const activePeriodicTask = computed(() => {
  const name = String(periodicTask.value?.name || '').trim();
  return (
    activePeriodicTasks.value.find(
      (item) => String(item.name || '').trim() === name,
    ) || null
  );
});

// effectivePeriodicTask 优先采用 active release 的队列和工作流，避免草稿未发布时误导查询。
const effectivePeriodicTask = computed(
  () => activePeriodicTask.value || periodicTask.value,
);

// canOpenTaskList 控制任务查询和任务列表跳转入口。
const canOpenTaskList = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    OPS_ROUTE_PERMISSION_CODES.TASK_ITEM,
  ]),
);
// canOpenTaskDetail 控制任务列表自动打开详情入口。
const canOpenTaskDetail = computed(
  () =>
    canOpenTaskList.value &&
    hasAnyPermission(accessStore.accessCodes, [
      OPS_ACTION_PERMISSION_CODES.TASK_INFO_GET,
    ]),
);
// canOpenWorkflowStatus 控制工作流状态页跳转入口。
const canOpenWorkflowStatus = computed(
  () =>
    hasAnyPermission(accessStore.accessCodes, [
      OPS_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]) &&
    hasAnyPermission(accessStore.accessCodes, [
      OPS_ACTION_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]),
);

// periodicRuntimeAlert 描述草稿与当前运行态配置的匹配关系。
const periodicRuntimeAlert = computed(() => {
  if (!activePeriodicTask.value) {
    return {
      description: rt('periodicDetailDraftOnlyDesc'),
      message: rt('periodicDetailDraftOnly'),
      type: 'warning' as const,
    };
  }
  if (!activePeriodicTask.value.enabled) {
    return {
      description: rt('periodicDetailDisabledDesc'),
      message: rt('periodicDetailDisabled'),
      type: 'warning' as const,
    };
  }
  return {
    description: rt('periodicDetailRuntimeDesc'),
    message: rt('periodicDetailRuntime'),
    type: 'success' as const,
  };
});

// recentTaskColumns 定义周期任务最近执行记录列。
const recentTaskColumns = computed(() => [
  { title: rt('taskId'), dataIndex: 'id', key: 'id', width: 190 },
  { title: rt('status'), dataIndex: 'state', key: 'state', width: 110 },
  { title: rt('taskType'), dataIndex: 'taskType', key: 'taskType', width: 170 },
  { title: rt('queue'), dataIndex: 'queue', key: 'queue', width: 120 },
  {
    title: rt('workflowId'),
    dataIndex: 'workflowId',
    key: 'workflowId',
    width: 240,
  },
  { title: rt('taskActivityAt'), key: 'activityAt', width: 180 },
  {
    title: rt('taskTraceTotal'),
    dataIndex: 'traceTotal',
    key: 'traceTotal',
    width: 110,
  },
  { title: rt('taskDuration'), key: 'duration', width: 120 },
  { title: $t('business.message.dataSource'), key: 'dataSource', width: 90 },
  { title: rt('action'), key: 'action', width: 88 },
]);

// recentWorkflowColumns 定义终态工作流汇总列，不展示已丢弃的成功分片明细。
const recentWorkflowColumns = computed(() => [
  {
    title: rt('workflowId'),
    dataIndex: 'workflowId',
    key: 'workflowId',
    width: 240,
  },
  {
    title: rt('workflow'),
    dataIndex: 'workflowName',
    key: 'workflowName',
    width: 180,
  },
  { title: rt('status'), dataIndex: 'status', key: 'status', width: 110 },
  {
    title: rt('taskTotal'),
    dataIndex: 'taskTotal',
    key: 'taskTotal',
    width: 100,
  },
  {
    title: rt('taskTraceTotal'),
    dataIndex: 'traceTotal',
    key: 'traceTotal',
    width: 110,
  },
  {
    title: rt('taskDuration'),
    dataIndex: 'durationMs',
    key: 'durationMs',
    width: 110,
  },
  {
    title: rt('finishedAt'),
    dataIndex: 'finishedAt',
    key: 'finishedAt',
    width: 180,
  },
  { title: rt('action'), key: 'action', width: 88 },
]);

// recentTaskScroll 仅在有数据时启用横向滚动，避免空表的固有宽度撑大抽屉。
const recentTaskScroll = computed(() =>
  recentTasks.value.length > 0 ? { x: 1420 } : undefined,
);

// Drawer 承载周期任务运行态匹配和最近执行记录。
const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (!isOpen) {
      periodicDetailFullscreen.value = false;
      recentTasksRequestSeq.value += 1;
      recentTasksLoading.value = false;
      return;
    }
    const data = drawerApi.getData<PeriodicTaskDetailDrawerData>() || {};
    periodicTask.value = data.task || null;
    activePeriodicTasks.value = data.activeTasks || [];
    recentTasks.value = [];
    recentWorkflows.value = [];
    recentLiveTasksLoadFailed.value = false;
    recentTaskHistoryLoadFailed.value = false;
    recentWorkflowsLoadFailed.value = false;
    void loadRecentTasks();
  },
  showConfirmButton: false,
});

// unregisterPeriodicTaskSessionCleanup 在账号切换时清理旧账号的周期任务详情。
const unregisterPeriodicTaskSessionCleanup = registerSessionStateCleanup(
  resetPeriodicTaskDetail,
);

// loadRecentTasks 并行读取 Redis 热状态、DB 任务终态和工作流历史，任一数据源异常可独立降级。
async function loadRecentTasks() {
  const task = effectivePeriodicTask.value;
  const name = String(task?.name || '').trim();
  if (
    !name ||
    (!canOpenTaskList.value && !canOpenWorkflowStatus.value) ||
    recentTasksLoading.value
  ) {
    return;
  }
  const sourceSessionIdentity = currentSessionStateIdentity();
  const requestSeq = recentTasksRequestSeq.value + 1;
  recentTasksRequestSeq.value = requestSeq;
  recentTasksLoading.value = true;
  recentLiveTasksLoadFailed.value = false;
  recentTaskHistoryLoadFailed.value = false;
  recentWorkflowsLoadFailed.value = false;
  try {
    const queue = String(task?.queue || '').trim() || undefined;
    const historyEnd = new Date();
    const historyStart = new Date(
      historyEnd.getTime() - PERIODIC_WORKFLOW_HISTORY_DAYS * 86_400_000,
    );
    const [liveTaskResult, taskHistoryResult, workflowResult] =
      await Promise.allSettled([
        canOpenTaskList.value
          ? fetchTaskItemsOverview({
              includeAggregating: false,
              liveOnly: true,
              page: 1,
              pageSize: PERIODIC_RECENT_TASK_LIMIT,
              queue,
              taskName: name,
            })
          : Promise.resolve(null),
        canOpenTaskList.value
          ? fetchTaskRuns({
              endTime: historyEnd.toISOString(),
              pageSize: PERIODIC_RECENT_TASK_LIMIT,
              periodicName: name,
              queue,
              startTime: historyStart.toISOString(),
            })
          : Promise.resolve(null),
        canOpenWorkflowStatus.value
          ? fetchTaskWorkflows({
              endTime: historyEnd.toISOString(),
              pageSize: PERIODIC_RECENT_TASK_LIMIT,
              periodicName: name,
              queue,
              startTime: historyStart.toISOString(),
            })
          : Promise.resolve(null),
      ]);
    if (
      requestSeq !== recentTasksRequestSeq.value ||
      sourceSessionIdentity !== currentSessionStateIdentity()
    ) {
      return;
    }
    const liveTasks =
      liveTaskResult.status === 'fulfilled' && liveTaskResult.value
        ? liveTaskResult.value.tasks || []
        : [];
    const taskRuns =
      taskHistoryResult.status === 'fulfilled' && taskHistoryResult.value
        ? taskHistoryResult.value.items || []
        : [];
    recentTasks.value = mergePeriodicRecentTasks(
      liveTasks,
      taskRuns,
      PERIODIC_RECENT_TASK_LIMIT,
    );
    recentLiveTasksLoadFailed.value = liveTaskResult.status === 'rejected';
    recentTaskHistoryLoadFailed.value = taskHistoryResult.status === 'rejected';
    if (workflowResult.status === 'fulfilled' && workflowResult.value) {
      recentWorkflows.value = workflowResult.value.items || [];
    } else if (workflowResult.status === 'rejected') {
      recentWorkflowsLoadFailed.value = true;
    }
  } finally {
    if (requestSeq === recentTasksRequestSeq.value) {
      recentTasksLoading.value = false;
    }
  }
}

// resetPeriodicTaskDetail 清理抽屉中的会话态数据。
function resetPeriodicTaskDetail() {
  recentTasksRequestSeq.value += 1;
  periodicDetailFullscreen.value = false;
  recentTasksLoading.value = false;
  recentLiveTasksLoadFailed.value = false;
  recentTaskHistoryLoadFailed.value = false;
  recentWorkflowsLoadFailed.value = false;
  recentTasks.value = [];
  recentWorkflows.value = [];
  periodicTask.value = null;
  activePeriodicTasks.value = [];
  drawerApi.close();
}

// togglePeriodicDetailFullscreen 切换周期任务详情的默认宽度和全屏宽度。
function togglePeriodicDetailFullscreen() {
  periodicDetailFullscreen.value = !periodicDetailFullscreen.value;
}

// periodicScheduleText 返回当前运行态采用的调度表达式。
function periodicScheduleText(task?: null | RuntimeConfigApi.PeriodicTaskItem) {
  if (!task) {
    return '-';
  }
  return String(task.cron || '').trim() || `@every ${task.everySeconds || 0}s`;
}

// taskStateText 返回任务状态文案。
function taskStateText(state?: string) {
  const stateKeys: Record<string, string> = {
    active: 'taskStateActive',
    aggregating: 'taskStateAggregating',
    archived: 'taskStateArchived',
    completed: 'taskStateCompleted',
    pending: 'taskStatePending',
    retry: 'taskStateRetry',
    scheduled: 'taskStateScheduled',
  };
  const key = stateKeys[String(state || '')];
  return key ? $t(`business.message.${key}`) : state || '-';
}

// taskStateColor 返回任务状态语义颜色。
function taskStateColor(state?: string) {
  const colors: Record<string, string> = {
    active: 'processing',
    aggregating: 'processing',
    archived: 'success',
    completed: 'success',
    pending: 'processing',
    retry: 'error',
    scheduled: 'processing',
  };
  return colors[String(state || '')] || 'default';
}

// taskActivityAt 返回任务当前状态下最有意义的最近活动时间。
function taskActivityAt(task: Partial<PeriodicRecentTask>) {
  return (
    task.completedAt ||
    task.lastFailedAt ||
    task.startedAt ||
    task.nextProcessAt ||
    task.deadline ||
    '-'
  );
}

// openTaskList 跳转任务列表，并保留周期任务名称和运行队列筛选。
async function openTaskList(record?: Partial<PeriodicRecentTask>) {
  const task = effectivePeriodicTask.value;
  if (!task || !canOpenTaskList.value) {
    return;
  }
  const query: Record<string, string> = {
    source: rt('periodicDetailSource'),
    taskName: task.name,
  };
  const queue = String(task.queue || '').trim();
  if (queue) {
    query.queue = queue;
  }
  if (record?.dataSource === 'database' && Number(record.historyId) > 0) {
    query.historyId = String(record.historyId);
  } else if (record?.id) {
    query.taskId = record.id;
  }
  drawerApi.close();
  await router.push({ name: 'OpsTaskItem', query });
}

// openWorkflowStatus 跳转指定任务的工作流状态页。
async function openWorkflowStatus(task: { workflowId?: string }) {
  const workflowId = String(task.workflowId || '').trim();
  if (!workflowId || !canOpenWorkflowStatus.value) {
    return;
  }
  drawerApi.close();
  await router.push({
    name: 'OpsWorkflowStatus',
    query: {
      source: rt('periodicDetailSource'),
      workflowId,
    },
  });
}

// formatTaskDuration 返回任务执行耗时；尚未开始时不展示伪造的零值。
function formatTaskDuration(task: Partial<PeriodicRecentTask>) {
  return task.durationMs === undefined
    ? '-'
    : formatDurationMs(task.durationMs);
}

onBeforeUnmount(() => {
  unregisterPeriodicTaskSessionCleanup();
  resetPeriodicTaskDetail();
});
</script>

<template>
  <Drawer
    class="max-w-none! max-md:w-full!"
    :class="
      periodicDetailFullscreen
        ? 'w-screen!'
        : 'w-[min(1440px,calc(100vw-240px))]!'
    "
    :title="`${rt('periodicDetailTitle')} · ${periodicTask?.name || '-'}`"
  >
    <template #extra>
      <Button
        size="small"
        type="text"
        :aria-label="periodicDetailFullscreenLabel"
        :title="periodicDetailFullscreenLabel"
        @click.stop="togglePeriodicDetailFullscreen"
      >
        <template #icon>
          <FullscreenExitOutlined v-if="periodicDetailFullscreen" />
          <FullscreenOutlined v-else />
        </template>
        {{ periodicDetailFullscreenLabel }}
      </Button>
    </template>

    <div class="runtime-periodic-detail">
      <Alert
        show-icon
        :description="periodicRuntimeAlert.description"
        :message="periodicRuntimeAlert.message"
        :type="periodicRuntimeAlert.type"
      />

      <Card size="small" :title="rt('periodicRuntimeConfig')">
        <Descriptions bordered :column="3" size="small">
          <Descriptions.Item :label="rt('name')">
            {{ effectivePeriodicTask?.name || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="rt('workflow')">
            {{ effectivePeriodicTask?.workflow || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="rt('queue')">
            {{ effectivePeriodicTask?.queue || 'default' }}
          </Descriptions.Item>
          <Descriptions.Item :label="rt('schedule')">
            {{ periodicScheduleText(effectivePeriodicTask) }}
          </Descriptions.Item>
          <Descriptions.Item :label="rt('status')">
            <Tag
              :color="effectivePeriodicTask?.enabled ? 'success' : 'default'"
            >
              {{
                effectivePeriodicTask?.enabled ? rt('enabled') : rt('disabled')
              }}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item :label="rt('targets')">
            {{ effectivePeriodicTask?.targets?.join(', ') || '-' }}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Alert
        v-if="!canOpenTaskList && !canOpenWorkflowStatus"
        show-icon
        type="warning"
        :message="rt('periodicTaskPermissionRequired')"
        :description="rt('periodicTaskPermissionRequiredDesc')"
      />
      <Alert
        v-if="recentLiveTasksLoadFailed"
        show-icon
        type="warning"
        :message="rt('periodicRecentLoadFailed')"
        :description="rt('periodicRecentLoadFailedDesc')"
      />
      <Alert
        v-if="recentTaskHistoryLoadFailed"
        show-icon
        type="warning"
        :message="rt('periodicTaskHistoryLoadFailed')"
        :description="rt('periodicTaskHistoryLoadFailedDesc')"
      />
      <Alert
        v-if="recentWorkflowsLoadFailed"
        show-icon
        type="warning"
        :message="rt('periodicWorkflowHistoryLoadFailed')"
        :description="rt('periodicWorkflowHistoryLoadFailedDesc')"
      />

      <Card size="small">
        <template #title>
          {{ rt('periodicRecentTasks') }}
          <Tag>{{ recentTasks.length }}</Tag>
        </template>
        <template #extra>
          <Space>
            <Button v-if="canOpenTaskList" size="small" @click="openTaskList()">
              <template #icon><LinkOutlined /></template>
              {{ rt('openTaskList') }}
            </Button>
            <Button
              v-if="canOpenTaskList"
              :loading="recentTasksLoading"
              size="small"
              @click="loadRecentTasks"
            >
              <template #icon><ReloadOutlined /></template>
              {{ rt('refresh') }}
            </Button>
          </Space>
        </template>
        <Spin :spinning="recentTasksLoading">
          <Table
            v-if="canOpenTaskList"
            class="runtime-detail-table"
            :columns="recentTaskColumns"
            :data-source="recentTasks"
            :pagination="false"
            row-key="id"
            :scroll="recentTaskScroll"
            size="small"
          >
            <template #emptyText>
              <Empty :description="rt('periodicRecentEmpty')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'id'">
                <CopyableTextCell
                  :copy-label="$t('business.message.copyTaskId')"
                  :copied-message="$t('business.message.taskIdCopied')"
                  :empty-message="$t('business.message.noTaskIdToCopy')"
                  :text="record.id"
                />
              </template>
              <template v-else-if="column.key === 'state'">
                <Tag :color="taskStateColor(record.state)">
                  {{ taskStateText(record.state) }}
                </Tag>
              </template>
              <template v-else-if="column.key === 'workflowId'">
                <CopyableTextCell
                  :copy-label="$t('business.message.copyWorkflowId')"
                  :copied-message="$t('business.message.workflowIdCopied')"
                  :empty-message="$t('business.message.noWorkflowIdToCopy')"
                  :text="record.workflowId"
                />
              </template>
              <template v-else-if="column.key === 'activityAt'">
                {{ taskActivityAt(record) }}
              </template>
              <template v-else-if="column.key === 'duration'">
                {{ formatTaskDuration(record) }}
              </template>
              <template v-else-if="column.key === 'dataSource'">
                <Tag :color="record.dataSource === 'redis' ? 'blue' : 'green'">
                  {{ record.dataSource === 'redis' ? 'Redis' : 'DB' }}
                </Tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <Space :size="0">
                  <Tooltip v-if="canOpenTaskDetail" :title="rt('taskDetail')">
                    <Button
                      class="runtime-detail-action"
                      size="small"
                      type="link"
                      :aria-label="rt('taskDetail')"
                      @click="openTaskList(record)"
                    >
                      <template #icon><EyeOutlined /></template>
                    </Button>
                  </Tooltip>
                  <Tooltip
                    v-if="record.workflowId && canOpenWorkflowStatus"
                    :title="rt('workflowStatus')"
                  >
                    <Button
                      class="runtime-detail-action"
                      size="small"
                      type="link"
                      :aria-label="rt('workflowStatus')"
                      @click="openWorkflowStatus(record)"
                    >
                      <template #icon><BranchesOutlined /></template>
                    </Button>
                  </Tooltip>
                </Space>
              </template>
            </template>
          </Table>
        </Spin>
      </Card>

      <Card v-if="canOpenWorkflowStatus" size="small">
        <template #title>
          {{ rt('periodicWorkflowHistory') }}
          <Tag>{{ recentWorkflows.length }}</Tag>
        </template>
        <Spin :spinning="recentTasksLoading">
          <Table
            class="runtime-detail-table"
            :columns="recentWorkflowColumns"
            :data-source="recentWorkflows"
            :pagination="false"
            row-key="id"
            :scroll="recentWorkflows.length > 0 ? { x: 1118 } : undefined"
            size="small"
          >
            <template #emptyText>
              <Empty :description="rt('periodicWorkflowHistoryEmpty')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'workflowId'">
                <CopyableTextCell
                  :copy-label="$t('business.message.copyWorkflowId')"
                  :copied-message="$t('business.message.workflowIdCopied')"
                  :empty-message="$t('business.message.noWorkflowIdToCopy')"
                  :text="record.workflowId"
                />
              </template>
              <template v-else-if="column.key === 'status'">
                <Tag :color="record.status === 'success' ? 'success' : 'error'">
                  {{ record.status }}
                </Tag>
              </template>
              <template v-else-if="column.key === 'durationMs'">
                {{ formatDurationMs(record.durationMs) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <Tooltip :title="rt('workflowStatus')">
                  <Button
                    class="runtime-detail-action"
                    size="small"
                    type="link"
                    :aria-label="rt('workflowStatus')"
                    @click="openWorkflowStatus(record)"
                  >
                    <template #icon><BranchesOutlined /></template>
                  </Button>
                </Tooltip>
              </template>
            </template>
          </Table>
        </Spin>
      </Card>
    </div>
  </Drawer>
</template>

<style scoped>
.runtime-periodic-detail {
  display: grid;
  gap: 12px;
  min-width: 0;
  min-height: 260px;
}

.runtime-periodic-detail :deep(.ant-card) {
  min-width: 0;
}

.runtime-detail-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.runtime-detail-table :deep(.ant-table) {
  color: hsl(var(--foreground));
  background: transparent;
}

.runtime-detail-table :deep(.ant-table-container) {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.runtime-detail-table :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border-bottom-color: hsl(var(--border));
}

.runtime-detail-table :deep(.ant-table-thead > tr > th::before) {
  background-color: hsl(var(--heavy));
}

.runtime-detail-table :deep(.ant-table-tbody > tr > td) {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border-bottom-color: hsl(var(--border));
}

.runtime-detail-table :deep(.ant-table-tbody > tr:hover > td) {
  background: hsl(var(--accent-hover));
}

.runtime-detail-action {
  flex: none;
  width: 32px;
  padding: 0;
}

@media (max-width: 768px) {
  .runtime-periodic-detail :deep(.ant-descriptions-view) {
    overflow-x: auto;
  }
}
</style>
