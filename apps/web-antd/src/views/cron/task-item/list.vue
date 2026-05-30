<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { TaskApi } from '#/api/cron/task';

import { computed, h, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import { RangePicker } from 'ant-design-vue/es/date-picker';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteTask,
  fetchTaskItemsOverview,
  fetchTaskQueues,
  getTaskInfo,
  runTaskNow,
} from '#/api/cron/task';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
  hasAnyPermission,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import {
  getTaskQueueDescription,
  safePrettyJson,
  TASK_QUEUE_OPTIONS,
} from '../shared';
import { TASK_STATE_OPTIONS, useColumns } from './data';

type TableActionParams<T = any> = {
  code: string;
  row: T;
};

type TaskStateFilterValue = '' | TaskApi.ListTaskItemsReq['state'];
type TaskStateTotals = Partial<
  Record<TaskApi.ListTaskItemsReq['state'], number>
>;
type TaskTimeRangeValue = [Dayjs, Dayjs] | undefined;

const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const queueOptions = ref<Array<{ label: string; value: string }>>(
  TASK_QUEUE_OPTIONS.map((item) => ({ label: item.label, value: item.value })),
);
const searchQueue = ref('');
const searchState = ref<TaskStateFilterValue>('');
const searchGroup = ref('');
// searchTaskName 记录任务名称关键字，便于按 task_periodic.name 追踪定时任务执行情况。
const searchTaskName = ref('');
const searchWorkflowId = ref('');
// searchTimeRange 保存任务活动时间范围；scheduled 状态对应 nextProcessAt。
const searchTimeRange = ref<TaskTimeRangeValue>();
// routeWorkflowNode 保存工作流状态页带入的节点名称，用于提示当前列表正在定位哪个节点。
const routeWorkflowNode = ref('');
const routeSource = ref('');
const aggregateMode = ref(false);
const currentQueryQueue = ref('');
const currentQueryState = ref<TaskStateFilterValue>('');
const currentQueryGroup = ref('');
// currentQueryTaskName 保存本次列表实际使用的任务名称筛选条件，用于结果摘要回显。
const currentQueryTaskName = ref('');
const currentQueryWorkflowId = ref('');
// currentQueryTimeStart/End 保存本次实际查询的时间边界，用于摘要回显。
const currentQueryTimeStart = ref('');
const currentQueryTimeEnd = ref('');
const currentTaskRows = ref<TaskApi.TaskItem[]>([]);
// currentStateTotals 保存后端返回的状态总数快照，用于空状态聚合时显示其它可切换状态。
const currentStateTotals = ref<TaskStateTotals>({});
const autoOpenedTaskSignature = ref('');
const initializing = ref(true);
const suppressRouteQueryWatch = ref(false);
const showQueueHint = ref(false);

type HandleSearchOptions = {
  // clearTaskDetailQuery 表示是否清理任务详情深链参数，手动查询时避免重复弹出旧详情。
  clearTaskDetailQuery?: boolean;
};

type ClearTaskDetailRouteQueryOptions = {
  // clearSource 表示是否同步清理来源提示，重置或手动查询时当前结果已不再来自原入口。
  clearSource?: boolean;
};

type OverflowTooltipProps = InstanceType<typeof Tooltip>['$props'];
// TaskDetailModalHandle 保存当前任务详情弹框实例，便于打开新详情前只关闭旧详情，不影响其它确认弹窗。
type TaskDetailModalHandle = { destroy: () => void };

// taskDetailModalHandle 指向当前任务详情弹框；遮罩点击或操作按钮关闭后会重置。
let taskDetailModalHandle: null | TaskDetailModalHandle = null;

const canBatchRun = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.TASK_RUN,
  ]),
);

const canBatchDelete = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.TASK_DELETE,
  ]),
);

const queueHintText = computed(() =>
  queueOptions.value
    .map((item) => `${item.value}: ${getTaskQueueDescription(item.value)}`)
    .join('\n'),
);

const currentStateSummary = computed(() => {
  if (currentQueryState.value) {
    const matched = TASK_STATE_OPTIONS.find(
      (item) => item.value === currentQueryState.value,
    );
    return matched?.label || currentQueryState.value;
  }
  return currentQueryGroup.value
    ? $t('business.message.allStatesWithAggregating')
    : $t('business.message.allStatesWithoutAggregating');
});

// workflowNodeLocateGuide 展示工作流拓扑跳转带入的精准定位条件。
const workflowNodeLocateGuide = computed(() => {
  if (!currentQueryWorkflowId.value || !currentQueryTaskName.value) {
    return null;
  }
  const nodeName = routeWorkflowNode.value || currentQueryTaskName.value;
  return {
    description: $t('business.message.taskNodeLocatedDesc', [
      currentQueryWorkflowId.value,
      currentQueryTaskName.value,
      nodeName,
    ]),
    message: $t('business.message.taskNodeLocatedTitle', [nodeName]),
  };
});

const taskListOverviewCards = computed(() => {
  // workflowCardLabel 根据当前是否按工作流筛选，展示不同卡片标题。
  let workflowCardLabel = $t('business.message.linkedWorkflow');
  // workflowCardValue 展示当前筛选链路或当前页已关联链路的任务数量。
  let workflowCardValue = String(
    currentTaskRows.value.filter((item) =>
      Boolean(item.workflowId || getTaskHeaderValue(item, 'x-app-workflow-id')),
    ).length,
  );
  if (currentQueryWorkflowId.value) {
    workflowCardLabel = $t('business.message.filteredWorkflow');
    workflowCardValue = currentQueryWorkflowId.value;
  }
  return [
    {
      description: currentQueryQueue.value
        ? $t('business.message.currentFocusedQueue', [currentQueryQueue.value])
        : $t('business.message.multiQueueAggregateView'),
      label: $t('business.message.queryQueue'),
      value: currentQueryQueue.value || $t('business.message.allQueues'),
    },
    {
      description: $t('business.message.hitStatusDesc'),
      label: $t('business.message.hitStatus'),
      value: currentStateSummary.value,
    },
    {
      description: $t('business.message.runnableTaskCountDesc'),
      label: $t('business.message.taskRunNow'),
      value: String(currentPageRunnableTasks.value.length),
    },
    {
      description: $t('business.message.deletableTaskCountDesc'),
      label: $t('business.message.deletable'),
      value: String(currentPageDeletableTasks.value.length),
    },
    {
      description: $t('business.message.failedTaskCountDesc'),
      label: $t('business.message.failedTasks'),
      value: String(currentPageFailedTasks.value.length),
    },
    {
      description: currentQueryWorkflowId.value
        ? $t('business.message.workflowFilteredDesc')
        : $t('business.message.workflowLinkedCountDesc'),
      label: workflowCardLabel,
      value: workflowCardValue,
    },
  ];
});

const currentTaskSummaryRows = computed(() => {
  const rows = currentTaskRows.value;
  const runnableCount = rows.filter((item) => canRunTask(item)).length;
  const deletableCount = rows.filter((item) => canDeleteTask(item)).length;
  const failedCount = rows.filter((item) =>
    Boolean(String(item.lastErr || '').trim()),
  ).length;
  const workflowLinkedCount = rows.filter((item) =>
    Boolean(getTaskHeaderValue(item, 'x-app-workflow-id')),
  ).length;
  return [
    {
      label: $t('business.message.currentPageTaskCount'),
      value: String(rows.length),
    },
    { label: $t('business.message.taskRunNow'), value: String(runnableCount) },
    { label: $t('business.message.deletable'), value: String(deletableCount) },
    {
      label: $t('business.message.withFailureInfo'),
      value: String(failedCount),
    },
    {
      label: $t('business.message.linkedWorkflow'),
      value: String(workflowLinkedCount),
    },
    {
      label: $t('business.message.taskNameFilter'),
      value: currentQueryTaskName.value || $t('business.message.notFiltered'),
    },
    {
      label: $t('business.message.taskActivityTime'),
      value: currentQueryTimeRangeLabel.value,
    },
  ];
});

// currentQueryTimeRangeLabel 格式化当前查询时间范围，未筛选时保持明确提示。
const currentQueryTimeRangeLabel = computed(() => {
  if (!currentQueryTimeStart.value && !currentQueryTimeEnd.value) {
    return $t('business.message.notFiltered');
  }
  return `${formatTaskQueryTime(currentQueryTimeStart.value)} ~ ${formatTaskQueryTime(
    currentQueryTimeEnd.value,
  )}`;
});

const quickSummaryActionButtons = computed(() => {
  const rows = currentTaskRows.value;
  const stateTotals = currentStateTotals.value || {};
  const useStateTotals =
    !searchTaskName.value.trim() && !searchWorkflowId.value.trim();
  const retryCount = rows.filter(
    (item) =>
      String(item.state || '')
        .trim()
        .toLowerCase() === 'retry',
  ).length;
  const archivedCount = rows.filter(
    (item) =>
      String(item.state || '')
        .trim()
        .toLowerCase() === 'archived',
  ).length;
  const scheduledCount = rows.filter(
    (item) =>
      String(item.state || '')
        .trim()
        .toLowerCase() === 'scheduled',
  ).length;
  return [
    {
      count: useStateTotals ? Number(stateTotals.retry || 0) : retryCount,
      label: $t('business.message.switchToRetryTasks'),
      state: 'retry' as TaskStateFilterValue,
    },
    {
      count: useStateTotals ? Number(stateTotals.archived || 0) : archivedCount,
      label: $t('business.message.switchToArchivedTasks'),
      state: 'archived' as TaskStateFilterValue,
    },
    {
      count: useStateTotals
        ? Number(stateTotals.scheduled || 0)
        : scheduledCount,
      label: $t('business.message.switchToScheduledTasks'),
      state: 'scheduled' as TaskStateFilterValue,
    },
  ].filter((item) => item.count > 0 && searchState.value !== item.state);
});

const currentPageRunnableTasks = computed(() =>
  currentTaskRows.value.filter((item) => canRunTask(item)),
);

const currentPageDeletableTasks = computed(() =>
  currentTaskRows.value.filter((item) => canDeleteTask(item)),
);

const currentPageFailedTasks = computed(() =>
  currentTaskRows.value.filter((item) =>
    Boolean(String(item.lastErr || '').trim()),
  ),
);

const currentPageFailedRunnableTasks = computed(() =>
  currentPageFailedTasks.value.filter((item) => canRunTask(item)),
);

const currentStateOperationGuide = computed(() => {
  const stateValue = String(currentQueryState.value || '').trim();
  switch (stateValue) {
    case 'active': {
      return {
        description: $t('business.message.activeTaskGuideDesc'),
        message: $t('business.message.activeTaskGuideTitle'),
        type: 'info' as const,
      };
    }
    case 'aggregating': {
      return {
        description: $t('business.message.aggregatingTaskGuideDesc'),
        message: $t('business.message.aggregatingTaskGuideTitle'),
        type: 'warning' as const,
      };
    }
    case 'archived': {
      return {
        description: $t('business.message.archivedTaskGuideDesc'),
        message: $t('business.message.archivedTaskGuideTitle'),
        type: 'error' as const,
      };
    }
    case 'completed': {
      return {
        description: $t('business.message.completedTaskGuideDesc'),
        message: $t('business.message.completedTaskGuideTitle'),
        type: 'success' as const,
      };
    }
    case 'pending': {
      return {
        description: $t('business.message.pendingTaskGuideDesc'),
        message: $t('business.message.pendingTaskGuideTitle'),
        type: 'info' as const,
      };
    }
    case 'retry': {
      return {
        description: $t('business.message.retryTaskGuideDesc'),
        message: $t('business.message.retryTaskGuideTitle'),
        type: 'warning' as const,
      };
    }
    case 'scheduled': {
      return {
        description: $t('business.message.scheduledTaskGuideDesc'),
        message: $t('business.message.scheduledTaskGuideTitle'),
        type: 'info' as const,
      };
    }
    default: {
      return {
        description: $t('business.message.allTaskGuideDesc'),
        message: $t('business.message.allTaskGuideTitle'),
        type: 'info' as const,
      };
    }
  }
});

const quickStateActions: Array<{
  description: string;
  label: string;
  state: TaskStateFilterValue;
}> = [
  {
    description: $t('business.message.commonStatesQuickDesc'),
    label: $t('business.message.commonStatesQuick'),
    state: '',
  },
  {
    description: $t('business.message.retryTasksQuickDesc'),
    label: $t('business.message.taskStateRetry'),
    state: 'retry',
  },
  {
    description: $t('business.message.archivedTasksQuickDesc'),
    label: $t('business.message.taskStateArchived'),
    state: 'archived',
  },
  {
    description: $t('business.message.scheduledTasksQuickDesc'),
    label: $t('business.message.taskStateScheduled'),
    state: 'scheduled',
  },
  {
    description: $t('business.message.pendingTasksQuickDesc'),
    label: $t('business.message.taskStatePending'),
    state: 'pending',
  },
  {
    description: $t('business.message.activeTasksQuickDesc'),
    label: $t('business.message.taskStateActive'),
    state: 'active',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    keepSource: true,
    maxHeight: 680,
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async ({ page }: { page: any }) => {
          const timeRange = buildTaskTimeRangeParams();
          const result = await queryTasksByFilters({
            group: searchGroup.value || undefined,
            page: page.currentPage,
            pageSize: page.pageSize,
            stateValue: searchState.value,
            timeEnd: timeRange.timeEnd,
            timeStart: timeRange.timeStart,
          });
          aggregateMode.value = result.aggregateMode;
          currentQueryQueue.value = searchQueue.value;
          currentQueryState.value = result.effectiveState;
          currentQueryGroup.value = searchGroup.value;
          currentQueryTaskName.value = searchTaskName.value.trim();
          currentQueryWorkflowId.value = searchWorkflowId.value;
          currentQueryTimeStart.value = timeRange.timeStart || '';
          currentQueryTimeEnd.value = timeRange.timeEnd || '';
          currentTaskRows.value = result.list;
          currentStateTotals.value = result.stateTotals;
          await tryAutoOpenTaskDetail();
          return {
            list: result.list,
            total: result.total,
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

function normalizeRouteQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

// normalizeRouteTimeRange 从路由参数恢复时间范围，非法或缺边界时忽略。
function normalizeRouteTimeRange(): TaskTimeRangeValue {
  const start = normalizeRouteQueryValue(route.query.timeStart);
  const end = normalizeRouteQueryValue(route.query.timeEnd);
  if (!start || !end) {
    return undefined;
  }
  const startAt = dayjs(start);
  const endAt = dayjs(end);
  if (!startAt.isValid() || !endAt.isValid() || startAt.isAfter(endAt)) {
    return undefined;
  }
  return [startAt, endAt];
}

async function clearTaskDetailRouteQuery(
  options: ClearTaskDetailRouteQueryOptions = {},
) {
  const { clearSource = false } = options;
  const nextQuery = { ...route.query };
  let changed = false;

  // taskId 是一次性详情深链参数，消费后必须移除，否则列表重新查询会再次打开弹窗。
  if (Object.prototype.hasOwnProperty.call(nextQuery, 'taskId')) {
    delete nextQuery.taskId;
    changed = true;
  }

  // source 只用于提示来源；用户手动查询后清理，避免提示和当前筛选条件不一致。
  if (clearSource) {
    routeSource.value = '';
    if (Object.prototype.hasOwnProperty.call(nextQuery, 'source')) {
      delete nextQuery.source;
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  suppressRouteQueryWatch.value = true;
  try {
    await router.replace({ path: route.path, query: nextQuery });
    await nextTick();
  } finally {
    suppressRouteQueryWatch.value = false;
  }
}

async function loadQueueOptions() {
  try {
    const responseData = await fetchTaskQueues();
    const dynamicOptions = (responseData.queues || [])
      .map((item) => String(item.name || '').trim())
      .filter(Boolean)
      .map((item) => ({
        label: item,
        value: item,
      }));
    if (dynamicOptions.length > 0) {
      queueOptions.value = dynamicOptions;
    }
  } catch {
    // 读取队列失败时继续使用内置兜底队列，避免查询入口失效。
  }
}

async function queryTasksByFilters(queryParams: {
  group?: string;
  page: number;
  pageSize: number;
  stateValue: TaskStateFilterValue;
  timeEnd?: string;
  timeStart?: string;
}) {
  const { group, page, pageSize, stateValue, timeEnd, timeStart } = queryParams;
  const responseData = await fetchTaskItemsOverview({
    group: String(group || '').trim() || undefined,
    includeAggregating: !!String(group || '').trim(),
    page,
    pageSize,
    queue: searchQueue.value.trim() || undefined,
    state: stateValue || undefined,
    taskName: searchTaskName.value.trim() || undefined,
    timeEnd,
    timeStart,
    workflowId: searchWorkflowId.value.trim() || undefined,
  });
  return {
    aggregateMode: !!responseData.aggregateMode,
    effectiveState: (responseData.effectiveState || '') as TaskStateFilterValue,
    list: responseData.tasks || [],
    stateTotals: responseData.stateTotals || {},
    total: responseData.total || 0,
  };
}

// buildTaskTimeRangeParams 将前端时间范围转换为后端约定的 RFC3339 字段。
function buildTaskTimeRangeParams() {
  const [startAt, endAt] = searchTimeRange.value || [];
  return {
    timeEnd: endAt ? endAt.toDate().toISOString() : undefined,
    timeStart: startAt ? startAt.toDate().toISOString() : undefined,
  };
}

// formatTaskQueryTime 将 RFC3339 时间转成页面展示时间。
function formatTaskQueryTime(value: string) {
  if (!value) {
    return $t('business.message.noLimit');
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
}

function buildTaskDetailPayload(
  input:
    | Pick<TaskApi.TaskItem, 'id' | 'queue'>
    | { queue: string; taskId: string },
) {
  return {
    queue: String(input.queue || '').trim(),
    taskId:
      'taskId' in input
        ? String(input.taskId || '').trim()
        : String(input.id || '').trim(),
  };
}

// getTaskHeaderValue 从任务头信息里提取指定字段，兼容大小写差异。
function getTaskHeaderValue(task: TaskApi.TaskItem, headerName: string) {
  const normalizedName = String(headerName || '')
    .trim()
    .toLowerCase();
  const headerEntries = Object.entries(task.headers || {});
  const matchedEntry = headerEntries.find(
    ([key]) =>
      String(key || '')
        .trim()
        .toLowerCase() === normalizedName,
  );
  return String(matchedEntry?.[1] || '').trim();
}

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

// formatTaskDurationMs 把任务耗时转换成详情弹窗展示文本。
function formatTaskDurationMs(ms?: number) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '-';
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  if (value < 60_000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
  }
  if (value < 3_600_000) {
    return `${(value / 60_000).toFixed(value >= 600_000 ? 0 : 1)}m`;
  }
  return `${(value / 3_600_000).toFixed(value >= 36_000_000 ? 0 : 1)}h`;
}

// formatTaskResultText 返回任务结果展示文本；历史任务未写 result 时给出明确提示，避免误以为页面异常。
function formatTaskResultText(task: TaskApi.TaskItem) {
  const result = task.result;
  if (!result || Object.keys(result).length === 0) {
    return $t('business.message.taskResultEmptyGuide');
  }
  return safePrettyJson(result);
}

// buildTaskOperationGuide 返回当前任务状态对应的处理建议，降低误操作成本。
function buildTaskOperationGuide(task: TaskApi.TaskItem) {
  const taskState = String(task.state || '')
    .trim()
    .toLowerCase();
  switch (taskState) {
    case 'active': {
      return {
        description: $t('business.message.taskDetailActiveDesc'),
        message: $t('business.message.taskDetailActiveTitle'),
        type: 'info' as const,
      };
    }
    case 'archived': {
      return {
        description: $t('business.message.taskDetailArchivedDesc'),
        message: $t('business.message.taskDetailArchivedTitle'),
        type: 'error' as const,
      };
    }
    case 'completed': {
      return {
        description: $t('business.message.taskDetailCompletedDesc'),
        message: $t('business.message.taskDetailCompletedTitle'),
        type: 'success' as const,
      };
    }
    case 'pending': {
      return {
        description: $t('business.message.taskDetailPendingDesc'),
        message: $t('business.message.taskDetailPendingTitle'),
        type: 'info' as const,
      };
    }
    case 'retry': {
      return {
        description: $t('business.message.taskDetailRetryDesc'),
        message: $t('business.message.taskDetailRetryTitle'),
        type: 'warning' as const,
      };
    }
    case 'scheduled': {
      return {
        description: $t('business.message.taskDetailScheduledDesc'),
        message: $t('business.message.taskDetailScheduledTitle'),
        type: 'info' as const,
      };
    }
    default: {
      return {
        description: $t('business.message.taskDetailDefaultDesc'),
        message: $t('business.message.taskDetailDefaultTitle'),
        type: 'info' as const,
      };
    }
  }
}

// closeTaskDetailModal 仅关闭任务详情弹框，避免 Modal.destroyAll 误关正在确认的删除/立即执行弹框。
function closeTaskDetailModal() {
  taskDetailModalHandle?.destroy();
  taskDetailModalHandle = null;
}

// openWorkflowStatusFromTask 按任务头里的 workflowId 跳转到独立工作流状态页。
async function openWorkflowStatusFromTask(task: TaskApi.TaskItem) {
  const workflowId = getTaskHeaderValue(task, 'x-app-workflow-id');
  if (!workflowId) {
    message.warning($t('business.message.taskWorkflowIdMissing'));
    return;
  }
  await router.push({
    name: 'CronTaskWorkflowStatus',
    query: {
      source: $t('business.message.taskListTaskDetailSource', [task.id]),
      workflowId,
    },
  });
}

function showTaskDetailModal(task: TaskApi.TaskItem) {
  closeTaskDetailModal();
  const workflowId = getTaskHeaderValue(task, 'x-app-workflow-id');
  const workflowName = getTaskHeaderValue(task, 'x-app-workflow-name');
  const workflowNode = getTaskHeaderValue(task, 'x-app-workflow-node');
  const workflowSource = getTaskHeaderValue(task, 'x-app-task-source');
  const operationGuide = buildTaskOperationGuide(task);
  const summaryRows = [
    [$t('business.message.taskId'), task.id || '-'],
    [$t('business.message.queueName'), task.queue || '-'],
    [
      $t('business.message.workflowInstanceId'),
      task.workflowId || workflowId || '-',
    ],
    [$t('business.message.taskName'), task.taskName || '-'],
    [$t('business.message.taskType'), task.taskType || '-'],
    [$t('business.message.taskStatus'), task.state || '-'],
    [$t('business.message.taskGroup'), task.group || '-'],
    [
      $t('business.message.retryProgress'),
      `${task.retried || 0} / ${task.maxRetry || 0}`,
    ],
    [$t('business.message.timeoutSeconds'), String(task.timeoutSec || 0)],
    [$t('business.message.startedAt'), task.startedAt || '-'],
    [
      $t('business.message.executionDuration'),
      formatTaskDurationMs(task.durationMs),
    ],
    [$t('business.message.nextProcessAt'), task.nextProcessAt || '-'],
    [$t('business.message.lastFailedAt'), task.lastFailedAt || '-'],
    [$t('business.message.completedAt'), task.completedAt || '-'],
    [
      $t('business.message.orphanedTask'),
      task.isOrphaned ? $t('business.message.yes') : $t('business.message.no'),
    ],
  ];
  const workflowSummaryRows = workflowId
    ? [
        [$t('business.message.workflowInstanceId'), workflowId],
        [$t('business.message.workflowName'), workflowName || '-'],
        [$t('business.message.workflowNode'), workflowNode || '-'],
        [$t('business.message.triggerSource'), workflowSource || '-'],
      ]
    : [];
  taskDetailModalHandle = Modal.info({
    afterClose: () => {
      taskDetailModalHandle = null;
    },
    closable: true,
    footer: null,
    icon: null,
    keyboard: true,
    maskClosable: true,
    title: $t('business.message.taskDetailTitle', [task.id]),
    width: 980,
    content: h('div', { class: 'space-y-4' }, [
      h(Alert, {
        description: operationGuide.description,
        message: operationGuide.message,
        showIcon: true,
        type: operationGuide.type,
      }),
      h(Alert, {
        class: 'mt-3',
        description: task.lastErr || $t('business.message.taskNoFailureError'),
        message: $t('business.message.latestFailureReason'),
        showIcon: true,
        type: task.lastErr ? 'error' : 'success',
      }),
      h(Space, { size: 8, wrap: true }, () => [
        h(
          Button,
          {
            size: 'small',
            onClick: () =>
              copyTextToClipboard(
                task.id || '',
                $t('business.message.taskIdCopied'),
                $t('business.message.noTaskIdToCopy'),
              ),
          },
          () => $t('business.message.copyTaskId'),
        ),
        task.workflowId || workflowId
          ? h(
              Button,
              {
                size: 'small',
                onClick: () =>
                  copyTextToClipboard(
                    String(task.workflowId || workflowId || ''),
                    $t('business.message.workflowIdCopied'),
                    $t('business.message.noWorkflowIdToCopy'),
                  ),
              },
              () => $t('business.message.copyWorkflowId'),
            )
          : null,
        task.workflowId || workflowId
          ? h(
              Button,
              {
                size: 'small',
                onClick: async () => {
                  searchWorkflowId.value = String(
                    task.workflowId || workflowId || '',
                  );
                  await handleSearch();
                },
              },
              () => $t('business.message.filterSameWorkflowTasks'),
            )
          : null,
        workflowId
          ? h(
              Button,
              {
                size: 'small',
                onClick: () =>
                  copyTextToClipboard(
                    workflowId,
                    $t('business.message.workflowIdCopied'),
                    $t('business.message.noWorkflowIdToCopy'),
                  ),
              },
              () => $t('business.message.copyWorkflowId'),
            )
          : null,
        workflowId
          ? h(
              Button,
              {
                size: 'small',
                type: 'primary',
                onClick: async () => {
                  closeTaskDetailModal();
                  await openWorkflowStatusFromTask(task);
                },
              },
              () => $t('business.message.viewWorkflowStatus'),
            )
          : null,
        canRunTask(task)
          ? h(
              Button,
              {
                size: 'small',
                onClick: () => {
                  closeTaskDetailModal();
                  handleRunTask(task);
                },
              },
              () => $t('business.message.runThisTaskNow'),
            )
          : null,
        canDeleteTask(task)
          ? h(
              Button,
              {
                danger: true,
                size: 'small',
                onClick: () => {
                  closeTaskDetailModal();
                  handleDeleteTask(task);
                },
              },
              () => $t('business.message.deleteThisTask'),
            )
          : null,
        h(Tag, { color: task.state === 'retry' ? 'error' : 'blue' }, () =>
          $t('business.message.taskStateTag', [task.state || '-']),
        ),
        h(Tag, { color: 'processing' }, () =>
          $t('business.message.taskQueueTag', [task.queue || '-']),
        ),
      ]),
      workflowSummaryRows.length > 0
        ? h('div', { class: 'space-y-2' }, [
            h(
              'div',
              { class: 'text-sm font-semibold' },
              $t('business.message.linkedWorkflow'),
            ),
            h(
              'div',
              { class: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4' },
              workflowSummaryRows.map(([label, value]) =>
                h(
                  'div',
                  {
                    class:
                      'rounded border border-[var(--vben-border-color)] px-4 py-3',
                  },
                  [
                    h(
                      'div',
                      {
                        class:
                          'text-xs text-[var(--vben-text-color-secondary)]',
                      },
                      label,
                    ),
                    h(
                      Tooltip,
                      buildOverflowTooltipProps(String(value || '-')),
                      {
                        default: () =>
                          h(
                            'div',
                            {
                              class: 'mt-1 truncate text-sm font-semibold',
                              title: String(value || '-'),
                            },
                            value || '-',
                          ),
                      },
                    ),
                  ],
                ),
              ),
            ),
          ])
        : null,
      h(
        'div',
        { class: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' },
        summaryRows.map(([label, value]) =>
          h(
            'div',
            {
              class:
                'rounded border border-[var(--vben-border-color)] px-4 py-3',
            },
            [
              h(
                'div',
                { class: 'text-xs text-[var(--vben-text-color-secondary)]' },
                label,
              ),
              h(Tooltip, buildOverflowTooltipProps(String(value || '-')), {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'mt-1 truncate text-sm font-semibold',
                      title: String(value || '-'),
                    },
                    value || '-',
                  ),
              }),
            ],
          ),
        ),
      ),
      h('div', { class: 'space-y-4' }, [
        h('div', {}, [
          h('div', { class: 'mb-2 flex items-center justify-between gap-2' }, [
            h(
              'div',
              { class: 'text-sm font-semibold' },
              $t('business.message.taskHeaders'),
            ),
            h(
              Button,
              {
                size: 'small',
                onClick: () =>
                  copyTextToClipboard(
                    safePrettyJson(task.headers || {}),
                    $t('business.message.taskHeadersCopied'),
                    $t('business.message.noTaskHeadersToCopy'),
                  ),
              },
              () => $t('business.message.copyHeaders'),
            ),
          ]),
          h(
            'pre',
            {
              class:
                'overflow-auto rounded bg-[#0f172a] p-4 text-sm text-white',
            },
            safePrettyJson(task.headers || {}),
          ),
        ]),
        h('div', {}, [
          h('div', { class: 'mb-2 flex items-center justify-between gap-2' }, [
            h(
              'div',
              { class: 'text-sm font-semibold' },
              $t('business.message.taskPayload'),
            ),
            h(
              Button,
              {
                size: 'small',
                onClick: () =>
                  copyTextToClipboard(
                    safePrettyJson(task.payload || {}),
                    $t('business.message.taskPayloadCopied'),
                    $t('business.message.noTaskPayloadToCopy'),
                  ),
              },
              () => $t('business.message.copyPayload'),
            ),
          ]),
          h(
            'pre',
            {
              class:
                'overflow-auto rounded bg-[#0f172a] p-4 text-sm text-white',
            },
            safePrettyJson(task.payload || {}),
          ),
        ]),
        h('div', {}, [
          h('div', { class: 'mb-2 flex items-center justify-between gap-2' }, [
            h(
              'div',
              { class: 'text-sm font-semibold' },
              $t('business.message.taskResult'),
            ),
            h(
              Button,
              {
                size: 'small',
                onClick: () =>
                  copyTextToClipboard(
                    formatTaskResultText(task),
                    $t('business.message.taskResultCopied'),
                    $t('business.message.noTaskResultToCopy'),
                  ),
              },
              () => $t('business.message.copyResult'),
            ),
          ]),
          h(
            'pre',
            {
              class:
                'overflow-auto rounded bg-[#0f172a] p-4 text-sm text-white',
            },
            formatTaskResultText(task),
          ),
        ]),
      ]),
    ]),
  });
}

async function queryTaskDetail(
  input:
    | Pick<TaskApi.TaskItem, 'id' | 'queue'>
    | { queue: string; taskId: string },
) {
  const requestPayload = buildTaskDetailPayload(input);
  const responseData = await getTaskInfo(requestPayload);
  showTaskDetailModal(responseData);
  return responseData;
}

async function tryAutoOpenTaskDetail() {
  const queue = searchQueue.value.trim();
  const taskId = normalizeRouteQueryValue(route.query.taskId);
  if (!queue || !taskId) {
    return;
  }
  const currentSignature = [
    queue,
    taskId,
    searchState.value,
    searchGroup.value,
    searchTaskName.value.trim(),
    searchWorkflowId.value,
    ...Object.values(buildTaskTimeRangeParams()),
  ].join('|');
  if (autoOpenedTaskSignature.value === currentSignature) {
    return;
  }
  autoOpenedTaskSignature.value = currentSignature;
  try {
    await queryTaskDetail({ queue, taskId });
    await clearTaskDetailRouteQuery();
  } catch {
    autoOpenedTaskSignature.value = '';
  }
}

function applyRouteQueryToFilters() {
  const routeQueue = normalizeRouteQueryValue(route.query.queue);
  const routeState = normalizeRouteQueryValue(
    route.query.state,
  ) as TaskStateFilterValue;
  const routeGroup = normalizeRouteQueryValue(route.query.group);
  // routeTaskName 允许外部页面把周期任务名带入任务列表，直接定位对应执行记录。
  const routeTaskName = normalizeRouteQueryValue(route.query.taskName);
  const routeWorkflowId = normalizeRouteQueryValue(route.query.workflowId);
  const routeNode = normalizeRouteQueryValue(route.query.workflowNode);
  searchQueue.value = routeQueue;
  searchState.value = TASK_STATE_OPTIONS.some(
    (item) => item.value === routeState,
  )
    ? routeState
    : '';
  searchGroup.value = routeGroup;
  searchTaskName.value = routeTaskName;
  searchWorkflowId.value = routeWorkflowId;
  searchTimeRange.value = normalizeRouteTimeRange();
  routeWorkflowNode.value = routeNode;
  routeSource.value = normalizeRouteQueryValue(route.query.source);
}

function onActionClick(e: TableActionParams<TaskApi.TaskItem>) {
  switch (e.code) {
    case 'delete': {
      handleDeleteTask(e.row);
      break;
    }
    case 'detail': {
      void handleQueryTaskDetail(e.row);
      break;
    }
    case 'runNow': {
      handleRunTask(e.row);
      break;
    }
  }
}

async function handleQueryTaskDetail(row: TaskApi.TaskItem) {
  await queryTaskDetail(row);
}

function canRunTask(row: TaskApi.TaskItem) {
  return ['archived', 'retry', 'scheduled'].includes(String(row.state || ''));
}

function canDeleteTask(row: TaskApi.TaskItem) {
  return ['archived', 'pending', 'retry', 'scheduled'].includes(
    String(row.state || ''),
  );
}

function handleRunTask(row: TaskApi.TaskItem) {
  if (!canRunTask(row)) {
    message.warning($t('business.message.taskRunNowStateLimited'));
    return;
  }
  Modal.confirm({
    title: $t('business.message.confirmRunTaskNow'),
    content: $t('business.message.confirmRunTaskNowContent', [row.id]),
    async onOk() {
      await runTaskNow({
        queue: row.queue,
        taskId: row.id,
      });
      message.success($t('business.message.taskRunNowSucceeded', [row.id]));
      await handleSearch();
    },
  });
}

function handleDeleteTask(row: TaskApi.TaskItem) {
  if (!canDeleteTask(row)) {
    message.warning($t('business.message.taskDeleteStateLimited'));
    return;
  }
  Modal.confirm({
    title: $t('business.message.confirmDeleteTask'),
    content: $t('business.message.confirmDeleteTaskContent', [row.id]),
    async onOk() {
      await deleteTask({
        queue: row.queue,
        taskId: row.id,
      });
      message.success($t('business.message.taskDeleteSucceeded', [row.id]));
      await handleSearch();
    },
  });
}

async function handleSearch(options: HandleSearchOptions = {}) {
  const { clearTaskDetailQuery = true } = options;
  autoOpenedTaskSignature.value = '';
  if (clearTaskDetailQuery) {
    await clearTaskDetailRouteQuery({ clearSource: true });
  }
  await gridApi.query();
}

async function handleQuickStateFilter(state: TaskStateFilterValue) {
  searchState.value = state;
  if (state !== 'aggregating') {
    searchGroup.value = '';
  }
  await handleSearch();
}

async function handleCopyFailedTaskIds(tasks: TaskApi.TaskItem[]) {
  const taskIds = tasks
    .map((item) => String(item.id || '').trim())
    .filter(Boolean)
    .join('\n');
  await copyTextToClipboard(
    taskIds,
    $t('business.message.failedTaskIdsCopied'),
    $t('business.message.noFailedTaskIdsToCopy'),
  );
}

async function handleCopyFailedTaskQueuePairs(tasks: TaskApi.TaskItem[]) {
  const taskText = tasks
    .map(
      (item) =>
        `${String(item.queue || '').trim()} / ${String(item.id || '').trim()}`,
    )
    .filter((item) => item !== ' / ')
    .join('\n');
  await copyTextToClipboard(
    taskText,
    $t('business.message.failedTaskQueuePairsCopied'),
    $t('business.message.noFailedTaskQueuePairsToCopy'),
  );
}

async function runTasksInBatch(tasks: TaskApi.TaskItem[]) {
  const successIds: string[] = [];
  const failedItems: Array<{ error: string; id: string }> = [];
  for (const item of tasks) {
    try {
      await runTaskNow({
        queue: item.queue,
        taskId: item.id,
      });
      successIds.push(item.id);
    } catch (error) {
      failedItems.push({
        error: String(error),
        id: item.id,
      });
    }
  }
  return { failedItems, successIds };
}

async function deleteTasksInBatch(tasks: TaskApi.TaskItem[]) {
  const successIds: string[] = [];
  const failedItems: Array<{ error: string; id: string }> = [];
  for (const item of tasks) {
    try {
      await deleteTask({
        queue: item.queue,
        taskId: item.id,
      });
      successIds.push(item.id);
    } catch (error) {
      failedItems.push({
        error: String(error),
        id: item.id,
      });
    }
  }
  return { failedItems, successIds };
}

function showBatchResultModal(params: {
  failedItems: Array<{ error: string; id: string }>;
  operationLabel: string;
  successIds: string[];
}) {
  const { failedItems, operationLabel, successIds } = params;
  if (failedItems.length === 0) {
    message.success(
      $t('business.message.batchTaskOperationSucceeded', [
        operationLabel,
        successIds.length,
      ]),
    );
    return;
  }
  Modal.warning({
    content: h('div', { class: 'space-y-3' }, [
      h(Alert, {
        description: $t('business.message.batchTaskOperationPartialDesc', [
          successIds.length,
          failedItems.length,
        ]),
        message: $t('business.message.batchTaskOperationPartialTitle', [
          operationLabel,
        ]),
        showIcon: true,
        type: 'warning',
      }),
      h(
        'pre',
        {
          class: 'overflow-auto rounded bg-[#0f172a] p-4 text-sm text-white',
        },
        safePrettyJson(failedItems),
      ),
      h(Space, { size: 8, wrap: true }, () => [
        h(
          Button,
          {
            size: 'small',
            type: 'primary',
            onClick: () =>
              copyTextToClipboard(
                failedItems.map((item) => item.id).join('\n'),
                $t('business.message.failedTaskIdsCopied'),
                $t('business.message.noFailedTaskIdsToCopy'),
              ),
          },
          () => $t('business.message.copyFailedTaskId'),
        ),
      ]),
    ]),
    title: $t('business.message.batchTaskOperationResult', [operationLabel]),
    width: 860,
  });
}

function handleBatchRunCurrentPage() {
  const tasks = currentPageRunnableTasks.value;
  if (tasks.length === 0) {
    message.warning($t('business.message.noRunnableTasksOnPage'));
    return;
  }
  Modal.confirm({
    title: $t('business.message.confirmBatchRunCurrentPage'),
    content: $t('business.message.confirmBatchRunCurrentPageContent', [
      tasks.length,
    ]),
    async onOk() {
      const result = await runTasksInBatch(tasks);
      showBatchResultModal({
        failedItems: result.failedItems,
        operationLabel: $t('business.message.taskRunNow'),
        successIds: result.successIds,
      });
      await handleSearch();
    },
  });
}

function handleBatchDeleteCurrentPage() {
  const tasks = currentPageDeletableTasks.value;
  if (tasks.length === 0) {
    message.warning($t('business.message.noDeletableTasksOnPage'));
    return;
  }
  Modal.confirm({
    title: $t('business.message.confirmBatchDeleteCurrentPage'),
    content: $t('business.message.confirmBatchDeleteCurrentPageContent', [
      tasks.length,
    ]),
    async onOk() {
      const result = await deleteTasksInBatch(tasks);
      showBatchResultModal({
        failedItems: result.failedItems,
        operationLabel: $t('business.message.delete'),
        successIds: result.successIds,
      });
      await handleSearch();
    },
  });
}

async function handleReset() {
  searchQueue.value = '';
  searchState.value = '';
  searchGroup.value = '';
  searchTaskName.value = '';
  searchWorkflowId.value = '';
  searchTimeRange.value = undefined;
  routeWorkflowNode.value = '';
  routeSource.value = '';
  currentQueryTimeStart.value = '';
  currentQueryTimeEnd.value = '';
  currentTaskRows.value = [];
  currentStateTotals.value = {};
  autoOpenedTaskSignature.value = '';
  await clearTaskDetailRouteQuery({ clearSource: true });
  await gridApi.query();
}

onMounted(async () => {
  await loadQueueOptions();
  applyRouteQueryToFilters();
  initializing.value = false;
  await handleSearch({ clearTaskDetailQuery: false });
});

watch(
  () => route.fullPath,
  async () => {
    if (initializing.value || suppressRouteQueryWatch.value) {
      return;
    }
    applyRouteQueryToFilters();
    await handleSearch({ clearTaskDetailQuery: false });
  },
);
</script>

<template>
  <Page :title="$t('business.message.taskList')">
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
              Task Runtime Explorer
            </div>
            <div class="mt-2 text-2xl font-semibold tracking-tight text-white">
              {{ $t('business.message.taskListConsoleTitle') }}
            </div>
            <div class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {{ $t('business.message.taskListConsoleDesc') }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
            <div
              v-for="item in taskListOverviewCards"
              :key="item.label"
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
            >
              <div
                class="truncate text-[11px] uppercase tracking-[0.18em] text-slate-400"
              >
                {{ item.label }}
              </div>
              <Tooltip
                v-bind="buildOverflowTooltipProps(String(item.value || '-'))"
              >
                <div
                  class="mt-1 truncate text-lg font-semibold text-white"
                  :title="String(item.value || '-')"
                >
                  {{ item.value }}
                </div>
              </Tooltip>
              <Tooltip
                v-bind="
                  buildOverflowTooltipProps(String(item.description || '-'))
                "
              >
                <div
                  class="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-400"
                  :title="String(item.description || '-')"
                >
                  {{ item.description }}
                </div>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>

      <Alert
        v-if="routeSource"
        :message="$t('business.message.currentResultFromSource', [routeSource])"
        show-icon
        type="info"
      />
      <Alert
        v-if="workflowNodeLocateGuide"
        :description="workflowNodeLocateGuide.description"
        :message="workflowNodeLocateGuide.message"
        show-icon
        type="success"
      />
      <Alert
        v-if="aggregateMode"
        :message="$t('business.message.aggregateQueryView')"
        :description="
          $t('business.message.aggregateQueryViewDesc', [currentStateSummary])
        "
        show-icon
        type="warning"
      />

      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.taskFilterQuickSwitch')"
      >
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div
              class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.45fr)_auto]"
            >
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.queueName') }}
                </div>
                <Select
                  v-model:value="searchQueue"
                  allow-clear
                  class="w-full"
                  :options="queueOptions"
                  :placeholder="$t('business.message.queueAllPlaceholder')"
                  show-search
                />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.taskStatus') }}
                </div>
                <Select
                  v-model:value="searchState"
                  class="w-full"
                  :options="TASK_STATE_OPTIONS"
                  :placeholder="$t('business.message.taskStatusAllPlaceholder')"
                />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.aggregateGroup') }}
                </div>
                <Input
                  v-model:value="searchGroup"
                  allow-clear
                  :placeholder="
                    $t('business.message.aggregateGroupPlaceholder')
                  "
                />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.taskName') }}
                </div>
                <Input
                  v-model:value="searchTaskName"
                  allow-clear
                  :placeholder="
                    $t('business.message.taskNameFilterPlaceholder')
                  "
                />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.workflowId') }}
                </div>
                <Input
                  v-model:value="searchWorkflowId"
                  allow-clear
                  :placeholder="
                    $t('business.message.workflowIdFilterPlaceholder')
                  "
                />
              </div>
              <div>
                <div class="mb-2 text-sm font-medium">
                  {{ $t('business.message.timeRange') }}
                </div>
                <RangePicker
                  v-model:value="searchTimeRange"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm:ss"
                  :placeholder="[
                    $t('business.message.startTime'),
                    $t('business.message.endTime'),
                  ]"
                  show-time
                />
              </div>
              <div class="flex items-end justify-end gap-2">
                <VbenButton @click="handleReset">
                  {{ $t('business.message.reset') }}
                </VbenButton>
                <VbenButton type="primary" @click="handleSearch">
                  {{ $t('business.message.search') }}
                </VbenButton>
              </div>
            </div>
            <div class="mt-3">
              <div class="mb-2 text-sm font-medium">
                {{ $t('business.message.quickStatusSwitch') }}
              </div>
              <Space :size="8" wrap>
                <Button
                  v-for="item in quickStateActions"
                  :key="item.label"
                  :type="searchState === item.state ? 'primary' : 'default'"
                  @click="handleQuickStateFilter(item.state)"
                >
                  {{ item.label }}
                </Button>
              </Space>
              <div class="mt-2 text-xs text-[var(--vben-text-color-secondary)]">
                {{
                  quickStateActions.find((item) => item.state === searchState)
                    ?.description ||
                  $t('business.message.autoDetectCommonStates')
                }}
              </div>
            </div>
          </div>
          <div class="space-y-3">
            <div
              class="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3"
            >
              <div
                class="text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                {{ currentStateOperationGuide.message }}
              </div>
              <div
                class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300"
              >
                {{ currentStateOperationGuide.description }}
              </div>
            </div>
            <div
              class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"
            >
              {{ $t('business.message.taskListOperationHint') }}
            </div>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
          <div
            v-for="item in currentTaskSummaryRows"
            :key="item.label"
            class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
          >
            <div class="text-[11px] text-[var(--vben-text-color-secondary)]">
              {{ item.label }}
            </div>
            <div class="mt-1 text-base font-semibold">
              {{ item.value }}
            </div>
          </div>
        </div>
      </Card>

      <div
        v-if="
          quickSummaryActionButtons.length > 0 ||
          currentPageFailedTasks.length > 0 ||
          canBatchRun ||
          canBatchDelete
        "
        class="rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
      >
        <div
          class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] xl:items-start"
        >
          <div v-if="quickSummaryActionButtons.length > 0" class="space-y-2">
            <div
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400"
            >
              {{ $t('business.message.viewSwitch') }}
            </div>
            <Space :size="[8, 8]" wrap>
              <Button
                v-for="item in quickSummaryActionButtons"
                :key="item.label"
                size="middle"
                @click="handleQuickStateFilter(item.state)"
              >
                {{ item.label }}（{{ item.count }}）
              </Button>
            </Space>
          </div>

          <div v-if="currentPageFailedTasks.length > 0" class="space-y-2">
            <div
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400"
            >
              {{ $t('business.message.failureTools') }}
            </div>
            <Space :size="[8, 8]" wrap>
              <Button
                size="middle"
                @click="handleCopyFailedTaskIds(currentPageFailedTasks)"
              >
                {{
                  $t('business.message.copyFailedTaskIds', [
                    currentPageFailedTasks.length,
                  ])
                }}
              </Button>
              <Button
                size="middle"
                @click="handleCopyFailedTaskQueuePairs(currentPageFailedTasks)"
              >
                {{ $t('business.message.copyQueueTaskIds') }}
              </Button>
              <Button
                v-if="currentPageFailedRunnableTasks.length > 0"
                size="middle"
                @click="handleCopyFailedTaskIds(currentPageFailedRunnableTasks)"
              >
                {{
                  $t('business.message.copyRunnableTaskIds', [
                    currentPageFailedRunnableTasks.length,
                  ])
                }}
              </Button>
            </Space>
          </div>

          <div
            v-if="canBatchRun || canBatchDelete"
            class="space-y-2 xl:justify-self-end"
          >
            <div
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 xl:text-right"
            >
              {{ $t('business.message.batchProcess') }}
            </div>
            <Space :size="[8, 8]" wrap>
              <Button
                v-if="canBatchRun"
                v-access="
                  asActionPermission(CRON_ACTION_PERMISSION_CODES.TASK_RUN)
                "
                size="middle"
                type="primary"
                @click="handleBatchRunCurrentPage"
              >
                {{
                  $t('business.message.batchRunNowCount', [
                    currentPageRunnableTasks.length,
                  ])
                }}
              </Button>
              <Button
                v-if="canBatchDelete"
                v-access="
                  asActionPermission(CRON_ACTION_PERMISSION_CODES.TASK_DELETE)
                "
                danger
                size="middle"
                @click="handleBatchDeleteCurrentPage"
              >
                {{
                  $t('business.message.batchDeleteCount', [
                    currentPageDeletableTasks.length,
                  ])
                }}
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <div
        class="rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60"
        >
          <div>
            <div
              class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.taskList') }}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-300">
              {{ $t('business.message.taskListGridDesc') }}
            </div>
          </div>
        </div>
        <Grid :table-title="$t('business.message.taskList')" />
      </div>

      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.queueNameGuide')"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm leading-6 text-slate-500 dark:text-slate-300">
            {{ $t('business.message.queueNameGuideDesc') }}
          </div>
          <Button size="small" @click="showQueueHint = !showQueueHint">
            {{
              showQueueHint
                ? $t('business.message.collapseDescription')
                : $t('business.message.viewDescription')
            }}
          </Button>
        </div>
        <pre
          v-if="showQueueHint"
          class="mt-4 overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950 p-4 text-sm text-cyan-100 shadow-inner"
          v-text="queueHintText"
        ></pre>
      </Card>
    </div>
  </Page>
</template>
