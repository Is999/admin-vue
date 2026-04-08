<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { TaskApi } from '#/api/cron/task';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';

import { CopyOutlined } from '@ant-design/icons-vue';
import { Alert, Button, Card, message, Space, Tag } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getTaskWorkflowStatus } from '#/api/cron/task';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import { safePrettyJson } from '../shared';
import { useWorkflowQuerySchema } from '../task-console/data';

// ================= 表单配置 =================
// 工作流状态查询表单，支持从任务列表携带 workflowId 自动回填。
const [WorkflowQueryForm, workflowQueryFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  schema: useWorkflowQuerySchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-1 gap-y-4',
});

// ================= 页面状态 =================
// WORKFLOW_STATUS_AUTO_REFRESH_INTERVAL_MS 表示工作流状态自动刷新间隔；10 秒能兼顾页面新鲜度和管理端查询压力。
const WORKFLOW_STATUS_AUTO_REFRESH_INTERVAL_MS = 10_000;
// WORKFLOW_TERMINAL_STATUSES 表示停止自动刷新的终态集合；后端工作流成功态为 success，completed 用于兼容任务中心完成态。
const WORKFLOW_TERMINAL_STATUSES = new Set(['completed', 'failed', 'success']);

// submitting 避免用户连续点击导致重复查询同一工作流。
const submitting = ref(false);
// workflowStatusAutoRefreshing 表示当前是否有自动刷新请求在途，避免定时器重入造成并发查询。
const workflowStatusAutoRefreshing = ref(false);
// workflowStatusAutoRefreshTimer 保存工作流状态自动刷新定时器，组件卸载或终态时必须清理。
const workflowStatusAutoRefreshTimer = ref<null | number>(null);
// workflowStatusRequestSeq 标记最近一次查询序号，避免旧自动刷新响应覆盖新 workflowId 的查询结果。
const workflowStatusRequestSeq = ref(0);
// route 用于接收任务列表或任务总控台跳转携带的 workflowId。
const route = useRoute();
// router 用于跳转到任务列表继续查看节点任务。
const router = useRouter();
// workflowStatusResultText 保存原始响应文本，便于排障时复制完整回执。
const workflowStatusResultText = ref('');
// workflowStatus 保存最近一次工作流状态查询结果。
const workflowStatus = ref<null | TaskApi.WorkflowStatusResp>(null);
// workflowQuerySource 记录 workflowId 的来源页面，帮助用户确认链路上下文。
const workflowQuerySource = ref('');
// autoQueriedWorkflowId 防止同一个路由 workflowId 被 watch 重复自动查询。
const autoQueriedWorkflowId = ref('');
// showWorkflowStatusRaw 控制原始 JSON 回执是否展开。
const showWorkflowStatusRaw = ref(false);

// WorkflowGraphNode 表示拓扑视图中的节点，level 来自依赖关系计算，用于按执行阶段分组。
type WorkflowGraphNode = TaskApi.WorkflowNodeItem & {
  dependencyText: string;
  level: number;
  originalIndex: number;
};

// WorkflowGraphLevel 表示同一执行阶段的节点集合，同级节点通常可以并行执行。
type WorkflowGraphLevel = {
  level: number;
  nodes: WorkflowGraphNode[];
  summary: string;
};

// WorkflowStatusQueryOptions 描述一次工作流状态查询的页面副作用控制。
type WorkflowStatusQueryOptions = {
  // clearOnError 表示失败时是否清空当前状态；手动查询需要清空，自动刷新保留上一帧可用数据。
  clearOnError?: boolean;
  // errorPrefix 表示写入原始回执区域的错误前缀，用于区分手动查询和自动刷新。
  errorPrefix?: string;
  // showSuccessMessage 表示是否弹出成功提示；自动刷新不提示，避免刷屏。
  showSuccessMessage?: boolean;
};

// formatDurationMs 把毫秒耗时格式化为节点列表中的短文本。
function formatDurationMs(ms?: number) {
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

// calcWorkflowDurationMs 兼容后端历史响应中未返回 durationMs 的工作流实例。
function calcWorkflowDurationMs(workflow: TaskApi.WorkflowStatusResp) {
  const apiDuration = Number(workflow.durationMs || 0);
  if (Number.isFinite(apiDuration) && apiDuration > 0) {
    return apiDuration;
  }
  const start = Date.parse(workflow.createdAt || '');
  const endText = workflow.finishedAt || workflow.updatedAt || '';
  const end = Date.parse(endText);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return end - start;
}

// normalizeRouteQueryValue 统一提取单值 query 参数。
function normalizeRouteQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

// normalizeWorkflowStatus 统一工作流状态大小写，兼容历史响应和任务中心完成态。
function normalizeWorkflowStatus(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

// isWorkflowTerminalStatus 判断工作流是否已经进入失败或完成终态，终态不再继续自动刷新。
function isWorkflowTerminalStatus(status?: string) {
  return WORKFLOW_TERMINAL_STATUSES.has(normalizeWorkflowStatus(status));
}

// stopWorkflowStatusAutoRefresh 停止工作流状态自动刷新，避免离开页面后继续请求后端。
function stopWorkflowStatusAutoRefresh() {
  if (workflowStatusAutoRefreshTimer.value === null) {
    return;
  }
  window.clearInterval(workflowStatusAutoRefreshTimer.value);
  workflowStatusAutoRefreshTimer.value = null;
}

// syncWorkflowStatusAutoRefresh 根据最新工作流状态启动或停止自动刷新。
function syncWorkflowStatusAutoRefresh(
  currentWorkflow: null | TaskApi.WorkflowStatusResp,
) {
  if (
    !currentWorkflow?.workflowId ||
    isWorkflowTerminalStatus(currentWorkflow.status)
  ) {
    stopWorkflowStatusAutoRefresh();
    return;
  }
  if (workflowStatusAutoRefreshTimer.value !== null) {
    return;
  }
  workflowStatusAutoRefreshTimer.value = window.setInterval(() => {
    void refreshWorkflowStatusSilently();
  }, WORKFLOW_STATUS_AUTO_REFRESH_INTERVAL_MS);
}

// requestWorkflowStatus 按 workflowId 查询并写入页面状态，同时用请求序号防止旧响应覆盖新查询。
async function requestWorkflowStatus(
  workflowId: string,
  options: WorkflowStatusQueryOptions = {},
) {
  const currentRequestSeq = workflowStatusRequestSeq.value + 1;
  workflowStatusRequestSeq.value = currentRequestSeq;
  try {
    const responseData = await getTaskWorkflowStatus({ workflowId });
    if (currentRequestSeq !== workflowStatusRequestSeq.value) {
      return false;
    }
    workflowStatus.value = responseData;
    workflowStatusResultText.value = safePrettyJson(responseData);
    syncWorkflowStatusAutoRefresh(responseData);
    if (options.showSuccessMessage) {
      message.success($t('business.message.workflowStatusQueried'));
    }
    return true;
  } catch (error) {
    if (currentRequestSeq !== workflowStatusRequestSeq.value) {
      return false;
    }
    if (options.clearOnError) {
      workflowStatus.value = null;
      stopWorkflowStatusAutoRefresh();
    }
    workflowStatusResultText.value = $t(
      'business.message.workflowStatusError',
      [
        options.errorPrefix || $t('business.message.queryFailedShort'),
        String(error),
      ],
    );
    return false;
  }
}

// refreshWorkflowStatusSilently 使用最近一次 workflowId 静默刷新状态；终态或无 workflowId 时主动停止定时器。
async function refreshWorkflowStatusSilently() {
  const currentWorkflow = workflowStatus.value;
  if (
    !currentWorkflow?.workflowId ||
    isWorkflowTerminalStatus(currentWorkflow.status)
  ) {
    stopWorkflowStatusAutoRefresh();
    return;
  }
  if (workflowStatusAutoRefreshing.value || submitting.value) {
    return;
  }
  workflowStatusAutoRefreshing.value = true;
  try {
    await requestWorkflowStatus(currentWorkflow.workflowId, {
      clearOnError: false,
      errorPrefix: $t('business.message.autoRefreshFailed'),
    });
  } finally {
    workflowStatusAutoRefreshing.value = false;
  }
}

// workflowSummaryRows 生成工作流整体状态摘要。
const workflowSummaryRows = computed(() => {
  const currentWorkflow = workflowStatus.value;
  if (!currentWorkflow) {
    return [];
  }
  return [
    {
      label: $t('business.message.workflowInstanceId'),
      value: currentWorkflow.workflowId || '-',
    },
    {
      label: $t('business.message.workflowName'),
      value: currentWorkflow.workflowName || '-',
    },
    {
      label: $t('business.message.workflowStatus'),
      value: currentWorkflow.status || '-',
    },
    {
      label: $t('business.message.triggerSource'),
      value: currentWorkflow.source || '-',
    },
    {
      label: $t('business.message.executionQueue'),
      value: currentWorkflow.queue || '-',
    },
    {
      label: $t('business.message.shardTotal'),
      value: String(currentWorkflow.shardTotal || 0),
    },
    {
      label: $t('business.message.totalDuration'),
      value: formatDurationMs(calcWorkflowDurationMs(currentWorkflow)),
    },
    {
      label: $t('business.message.grayPercent'),
      value: `${currentWorkflow.grayPercent || 0}%`,
    },
    {
      label: $t('business.message.createdAt'),
      value: currentWorkflow.createdAt || '-',
    },
    {
      label: $t('business.message.latestUpdateTime'),
      value: currentWorkflow.updatedAt || '-',
    },
    {
      label: $t('business.message.finishedAt'),
      value: currentWorkflow.finishedAt || '-',
    },
  ];
});

// workflowNodeRows 便于模板直接展示节点明细。
const workflowNodeRows = computed(() => workflowStatus.value?.nodes || []);

// workflowNodeDependents 按节点名称反向索引后续节点，用于拓扑卡片展示依赖去向。
const workflowNodeDependents = computed(() => {
  const dependents: Record<string, string[]> = {};
  for (const node of workflowNodeRows.value) {
    for (const dependencyName of normalizeNodeDependencies(node)) {
      if (!dependents[dependencyName]) {
        dependents[dependencyName] = [];
      }
      dependents[dependencyName].push(node.name);
    }
  }
  return dependents;
});

// workflowGraphLevels 按 dependsOn 计算执行层级，根节点在第 1 阶段，后续节点按最长依赖链推进。
const workflowGraphLevels = computed<WorkflowGraphLevel[]>(() => {
  const rows = workflowNodeRows.value;
  const nodeMap = new Map(rows.map((node) => [node.name, node]));
  const originalIndexMap = new Map(
    rows.map((node, index) => [node.name, index]),
  );
  const levelCache = new Map<string, number>();
  const visiting = new Set<string>();

  // resolveLevel 递归计算节点阶段；遇到历史脏数据中的未知依赖或循环依赖时降级到当前已知层级，避免页面崩溃。
  function resolveLevel(node: TaskApi.WorkflowNodeItem): number {
    const cached = levelCache.get(node.name);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(node.name)) {
      return 0;
    }
    visiting.add(node.name);
    const dependencyLevels: number[] = [];
    for (const dependencyName of normalizeNodeDependencies(node)) {
      const dependencyNode = nodeMap.get(dependencyName);
      if (dependencyNode) {
        dependencyLevels.push(resolveLevel(dependencyNode));
      }
    }
    visiting.delete(node.name);
    const level =
      dependencyLevels.length === 0 ? 0 : Math.max(...dependencyLevels) + 1;
    levelCache.set(node.name, level);
    return level;
  }

  const graphNodes = rows
    .map((node) => {
      const dependencies = normalizeNodeDependencies(node);
      return {
        ...node,
        dependencyText: dependencies.join(' / ') || '-',
        level: resolveLevel(node),
        originalIndex: originalIndexMap.get(node.name) || 0,
      };
    })
    .toSorted((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }
      const leftStartedAt = parseWorkflowNodeTime(left.startedAt);
      const rightStartedAt = parseWorkflowNodeTime(right.startedAt);
      if (leftStartedAt !== rightStartedAt) {
        return leftStartedAt - rightStartedAt;
      }
      return left.originalIndex - right.originalIndex;
    });

  const levelMap = new Map<number, WorkflowGraphNode[]>();
  for (const node of graphNodes) {
    const levelNodes = levelMap.get(node.level) || [];
    levelNodes.push(node);
    levelMap.set(node.level, levelNodes);
  }

  return [...levelMap.entries()]
    .toSorted(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
    .map(([level, nodes]) => {
      const failedCount = nodes.filter(
        (node) => getWorkflowNodeStatus(node) === 'failed',
      ).length;
      const runningCount = nodes.filter(
        (node) => getWorkflowNodeStatus(node) === 'running',
      ).length;
      return {
        level,
        nodes,
        summary: $t('business.message.workflowStageSummary', [
          nodes.length,
          failedCount,
          runningCount,
        ]),
      };
    });
});

// workflowErrorText 返回工作流级别的失败信息。
const workflowErrorText = computed(
  () =>
    workflowStatus.value?.errorMessage ||
    $t('business.message.noWorkflowFailureError'),
);

// failedWorkflowNodes 汇总失败节点，作为顶部操作建议的数据来源。
const failedWorkflowNodes = computed(() =>
  workflowNodeRows.value.filter(
    (item) =>
      String(item.status || '').toLowerCase() === 'failed' ||
      Number(item.failed || 0) > 0,
  ),
);

// workflowOperationGuide 根据状态给出下一步排查建议，避免只展示后端字段。
const workflowOperationGuide = computed(() => {
  const currentWorkflow = workflowStatus.value;
  if (!currentWorkflow) {
    return null;
  }
  const failedNodes = failedWorkflowNodes.value;
  if (failedNodes.length > 0 || currentWorkflow.errorMessage) {
    const nodeNames = failedNodes
      .map((item) => String(item.name || '').trim())
      .filter(Boolean)
      .join('、');
    return {
      description: $t('business.message.workflowFailedNodesGuideDesc', [
        currentWorkflow.queue || '-',
        nodeNames ? $t('business.message.currentFailedNodes', [nodeNames]) : '',
      ]),
      message: $t('business.message.workflowFailedNodesGuideTitle'),
      type: 'error' as const,
    };
  }
  if (normalizeWorkflowStatus(currentWorkflow.status) === 'failed') {
    return {
      description: $t('business.message.workflowFailedGuideDesc'),
      message: $t('business.message.workflowFailedGuideTitle'),
      type: 'error' as const,
    };
  }
  if (
    ['pending', 'running'].includes(
      String(currentWorkflow.status || '').toLowerCase(),
    )
  ) {
    return {
      description: $t('business.message.workflowRunningGuideDesc'),
      message: $t('business.message.workflowRunningGuideTitle'),
      type: 'warning' as const,
    };
  }
  return {
    description: $t('business.message.workflowCompletedGuideDesc'),
    message: $t('business.message.workflowCompletedGuideTitle'),
    type: 'success' as const,
  };
});

// applyRouteQueryToWorkflowForm 把路由里的 workflowId 回填到查询表单。
async function applyRouteQueryToWorkflowForm() {
  const routeWorkflowId = normalizeRouteQueryValue(route.query.workflowId);
  workflowQuerySource.value = normalizeRouteQueryValue(route.query.source);
  if (!routeWorkflowId) {
    return '';
  }
  await workflowQueryFormApi.setFieldValue(
    'workflowId',
    routeWorkflowId,
    false,
  );
  return routeWorkflowId;
}

// handleQueryWorkflowStatus 查询工作流实例状态。
async function handleQueryWorkflowStatus() {
  const { valid } = await workflowQueryFormApi.validate();
  if (!valid) {
    return;
  }
  stopWorkflowStatusAutoRefresh();
  submitting.value = true;
  try {
    const values = await workflowQueryFormApi.getValues<Record<string, any>>();
    await requestWorkflowStatus(String(values.workflowId || '').trim(), {
      clearOnError: true,
      errorPrefix: $t('business.message.queryFailedShort'),
      showSuccessMessage: true,
    });
  } finally {
    submitting.value = false;
  }
}

// handleOpenWorkflowStatusTasks 从工作流状态区直接跳到相关任务列表。
async function handleOpenWorkflowStatusTasks() {
  const currentWorkflow = workflowStatus.value;
  if (!currentWorkflow) {
    return;
  }
  await router.push({
    name: 'CronTaskItem',
    query: {
      queue: currentWorkflow.queue,
      source: $t('business.message.workflowStatusSource', [
        currentWorkflow.workflowName,
        currentWorkflow.workflowId,
      ]),
    },
  });
}

// handleOpenWorkflowNodeTasks 从节点执行明细跳转到对应队列的任务列表。
async function handleOpenWorkflowNodeTasks(node: TaskApi.WorkflowNodeItem) {
  const currentWorkflow = workflowStatus.value;
  if (!currentWorkflow) {
    return;
  }
  const taskName = buildWorkflowNodeTaskName(node);
  await router.push({
    name: 'CronTaskItem',
    query: {
      queue: node.queue || currentWorkflow.queue,
      source: $t('business.message.workflowStatusNodeSource', [
        currentWorkflow.workflowName,
        node.name,
        node.taskType,
      ]),
      taskName,
      workflowId: currentWorkflow.workflowId,
      workflowNode: node.name,
    },
  });
}

// buildWorkflowNodeTaskName 返回任务列表用于定位节点任务的名称关键字。
// 任务列表后端会同时匹配展示名、任务头和 payload；这里优先使用 node.name，并搭配 workflowId，能精准命中同一工作流下的节点分片任务。
function buildWorkflowNodeTaskName(node: TaskApi.WorkflowNodeItem) {
  return String(node.name || node.taskType || '').trim();
}

// normalizeNodeDependencies 清理节点依赖名称，避免空字符串影响拓扑层级。
function normalizeNodeDependencies(node: TaskApi.WorkflowNodeItem) {
  return (node.dependsOn || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

// parseWorkflowNodeTime 把节点时间转成可排序数值，缺失时间排在同阶段后面。
function parseWorkflowNodeTime(value?: string) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

// getWorkflowNodeStatus 统一节点状态大小写，避免后端历史值大小写差异影响样式。
function getWorkflowNodeStatus(node: TaskApi.WorkflowNodeItem) {
  return String(node.status || '')
    .trim()
    .toLowerCase();
}

// getWorkflowNodeDependents 返回当前节点的直接后续节点名称。
function getWorkflowNodeDependents(nodeName: string) {
  return workflowNodeDependents.value[nodeName] || [];
}

// getWorkflowNodeStatusColor 返回 Ant Tag 状态颜色。
function getWorkflowNodeStatusColor(node: TaskApi.WorkflowNodeItem) {
  switch (getWorkflowNodeStatus(node)) {
    case 'failed': {
      return 'error';
    }
    case 'pending': {
      return 'default';
    }
    case 'running': {
      return 'processing';
    }
    case 'success': {
      return 'success';
    }
    default: {
      return 'blue';
    }
  }
}

// getWorkflowNodeCardClass 返回拓扑节点卡片状态类名，突出失败、成功和执行中节点。
function getWorkflowNodeCardClass(node: TaskApi.WorkflowNodeItem) {
  const status = getWorkflowNodeStatus(node);
  if (['failed', 'pending', 'running', 'success'].includes(status)) {
    return `workflow-node-card--${status}`;
  }
  return 'workflow-node-card--default';
}

// calcWorkflowNodeProgress 计算节点实例完成比例，expected 为 0 的聚合节点按状态兜底展示。
function calcWorkflowNodeProgress(node: TaskApi.WorkflowNodeItem) {
  const expected = Number(node.expected || 0);
  if (!Number.isFinite(expected) || expected <= 0) {
    return getWorkflowNodeStatus(node) === 'success' ? 100 : 0;
  }
  const finished =
    Number(node.succeeded || 0) +
    Number(node.failed || 0) +
    Number(node.skipped || 0);
  return Math.max(0, Math.min(100, Math.round((finished / expected) * 100)));
}

// formatWorkflowNodeStageTitle 展示拓扑阶段编号，按执行顺序从 01 开始。
function formatWorkflowNodeStageTitle(level: number) {
  return $t('business.message.workflowStageTitle', [
    String(level + 1).padStart(2, '0'),
  ]);
}

// handleCopyWorkflowStatusReceipt 复制工作流状态接口原始回执，便于排障粘贴给后端或日志平台。
async function handleCopyWorkflowStatusReceipt() {
  await copyTextToClipboard(
    workflowStatusResultText.value,
    $t('business.message.workflowReceiptCopied'),
    $t('business.message.noWorkflowReceiptToCopy'),
  );
}

onMounted(() => {
  void (async () => {
    const routeWorkflowId = await applyRouteQueryToWorkflowForm();
    if (routeWorkflowId && autoQueriedWorkflowId.value !== routeWorkflowId) {
      autoQueriedWorkflowId.value = routeWorkflowId;
      await handleQueryWorkflowStatus();
    }
  })();
});

onBeforeUnmount(() => {
  stopWorkflowStatusAutoRefresh();
});

watch(
  () => route.fullPath,
  async () => {
    const routeWorkflowId = await applyRouteQueryToWorkflowForm();
    if (!routeWorkflowId) {
      stopWorkflowStatusAutoRefresh();
      return;
    }
    if (autoQueriedWorkflowId.value === routeWorkflowId) {
      return;
    }
    autoQueriedWorkflowId.value = routeWorkflowId;
    await handleQueryWorkflowStatus();
  },
);
</script>

<template>
  <Page :title="$t('business.message.workflowStatus')">
    <div class="space-y-4">
      <Alert
        v-if="workflowQuerySource"
        :message="
          $t('business.message.workflowIdFromSource', [workflowQuerySource])
        "
        show-icon
        type="info"
      />
      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.queryWorkflowInstanceStatus')"
      >
        <div class="mb-4 flex justify-end gap-2">
          <VbenButton
            v-access="
              asActionPermission(
                CRON_ACTION_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
              )
            "
            type="primary"
            :disabled="submitting"
            @click="handleQueryWorkflowStatus"
          >
            {{
              submitting
                ? $t('business.message.querying')
                : $t('business.message.queryStatus')
            }}
          </VbenButton>
        </div>
        <WorkflowQueryForm />
        <template v-if="workflowStatus">
          <Alert
            v-if="workflowOperationGuide"
            class="mt-4"
            :description="workflowOperationGuide.description"
            :message="workflowOperationGuide.message"
            show-icon
            :type="workflowOperationGuide.type"
          />
          <Space class="mt-4" :size="8" wrap>
            <Button
              size="small"
              type="primary"
              @click="handleOpenWorkflowStatusTasks"
            >
              {{ $t('business.message.openRelatedTaskList') }}
            </Button>
            <Button
              size="small"
              @click="showWorkflowStatusRaw = !showWorkflowStatusRaw"
            >
              {{
                showWorkflowStatusRaw
                  ? $t('business.message.closeRawReceipt')
                  : $t('business.message.viewRawReceipt')
              }}
            </Button>
            <Button
              size="small"
              :disabled="!workflowStatusResultText"
              @click="handleCopyWorkflowStatusReceipt"
            >
              <template #icon>
                <CopyOutlined />
              </template>
              {{ $t('business.message.copyReceipt') }}
            </Button>
          </Space>
          <Alert
            class="mt-4"
            :description="workflowErrorText"
            :message="
              workflowStatus.errorMessage
                ? $t('business.message.currentWorkflowFailureReason')
                : $t('business.message.noWorkflowFailure')
            "
            show-icon
            :type="workflowStatus.errorMessage ? 'error' : 'success'"
          />
          <pre
            v-if="showWorkflowStatusRaw && workflowStatusResultText"
            class="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-violet-500/20 bg-slate-950 px-4 py-4 text-sm text-violet-100 shadow-inner"
            v-text="workflowStatusResultText"
          ></pre>
          <div
            class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            <div
              v-for="item in workflowSummaryRows"
              :key="item.label"
              class="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div class="text-xs text-[var(--vben-text-color-secondary)]">
                {{ item.label }}
              </div>
              <div class="mt-1 break-all text-sm font-semibold">
                {{ item.value || '-' }}
              </div>
            </div>
          </div>
          <section class="workflow-topology-card mt-4">
            <div class="workflow-topology-card__header">
              <div>
                <div class="text-base font-semibold">
                  {{ $t('business.message.workflowTopologyTitle') }}
                </div>
                <div
                  class="mt-1 text-xs text-[var(--vben-text-color-secondary)]"
                >
                  {{ $t('business.message.workflowTopologyDesc') }}
                </div>
              </div>
              <Tag class="workflow-topology-card__count" color="blue">
                {{
                  $t('business.message.workflowNodeCount', [
                    workflowNodeRows.length,
                  ])
                }}
              </Tag>
            </div>

            <div class="workflow-flow-scroll">
              <div v-if="workflowGraphLevels.length > 0" class="workflow-flow">
                <section
                  v-for="stage in workflowGraphLevels"
                  :key="stage.level"
                  class="workflow-stage"
                >
                  <div class="workflow-stage__header">
                    <div class="workflow-stage__badge">
                      {{ String(stage.level + 1).padStart(2, '0') }}
                    </div>
                    <div class="workflow-stage__heading">
                      <div class="workflow-stage__title">
                        {{ formatWorkflowNodeStageTitle(stage.level) }}
                      </div>
                      <div class="workflow-stage__summary">
                        {{ stage.summary }}
                      </div>
                    </div>
                  </div>

                  <div class="workflow-stage__nodes">
                    <article
                      v-for="node in stage.nodes"
                      :key="node.name"
                      class="workflow-node-card"
                      :class="getWorkflowNodeCardClass(node)"
                    >
                      <div class="workflow-node-card__header">
                        <div class="workflow-node-card__identity">
                          <span class="workflow-node-card__status-dot"></span>
                          <div class="min-w-0">
                            <div class="workflow-node-card__title">
                              {{ node.name || '-' }}
                            </div>
                            <div class="workflow-node-card__subtitle">
                              {{ node.taskType || '-' }}
                            </div>
                          </div>
                        </div>
                        <Tag
                          class="workflow-node-card__status-tag"
                          :color="getWorkflowNodeStatusColor(node)"
                        >
                          {{ node.status || '-' }}
                        </Tag>
                      </div>

                      <div class="workflow-node-chip-row">
                        <span class="workflow-node-chip">
                          {{ node.queue || '-' }}
                        </span>
                        <span
                          class="workflow-node-chip workflow-node-chip--expected"
                        >
                          {{
                            $t('business.message.expectedCount', [
                              node.expected || 0,
                            ])
                          }}
                        </span>
                      </div>

                      <div class="workflow-node-metrics">
                        <div class="workflow-node-metric">
                          <div class="workflow-node-metric__value">
                            {{ node.succeeded || 0 }}
                          </div>
                          <div class="workflow-node-metric__label">
                            {{ $t('business.message.success') }}
                          </div>
                        </div>
                        <div class="workflow-node-metric">
                          <div class="workflow-node-metric__value">
                            {{ node.failed || 0 }}
                          </div>
                          <div class="workflow-node-metric__label">
                            {{ $t('business.message.failed') }}
                          </div>
                        </div>
                        <div class="workflow-node-metric">
                          <div class="workflow-node-metric__value">
                            {{ node.skipped || 0 }}
                          </div>
                          <div class="workflow-node-metric__label">
                            {{ $t('business.message.skipped') }}
                          </div>
                        </div>
                      </div>

                      <div class="workflow-node-progress-wrap">
                        <div class="workflow-node-progress__meta">
                          <span>{{ $t('business.message.progress') }}</span>
                          <span>{{ calcWorkflowNodeProgress(node) }}%</span>
                        </div>
                        <div class="workflow-node-progress">
                          <div
                            class="workflow-node-progress__bar"
                            :style="{
                              width: `${calcWorkflowNodeProgress(node)}%`,
                            }"
                          ></div>
                        </div>
                      </div>

                      <div class="workflow-node-relations">
                        <div class="workflow-node-relation">
                          <span class="workflow-node-relation__label">
                            {{ $t('business.message.depends') }}
                          </span>
                          <span class="workflow-node-relation__value">
                            {{ node.dependencyText }}
                          </span>
                        </div>
                        <div class="workflow-node-relation">
                          <span class="workflow-node-relation__label">
                            {{ $t('business.message.next') }}
                          </span>
                          <span class="workflow-node-relation__value">
                            {{
                              getWorkflowNodeDependents(node.name).join(
                                ' / ',
                              ) || '-'
                            }}
                          </span>
                        </div>
                        <div class="workflow-node-relation">
                          <span class="workflow-node-relation__label">
                            {{ $t('business.message.duration') }}
                          </span>
                          <span class="workflow-node-relation__value">
                            {{ formatDurationMs(node.durationMs) }}
                          </span>
                        </div>
                      </div>

                      <div class="workflow-node-times">
                        <div class="workflow-node-time">
                          <span class="workflow-node-time__label">
                            {{ $t('business.message.startedAt') }}
                          </span>
                          <span class="workflow-node-time__value">
                            {{ node.startedAt || '-' }}
                          </span>
                        </div>
                        <div class="workflow-node-time">
                          <span class="workflow-node-time__label">
                            {{ $t('business.message.finishedAt') }}
                          </span>
                          <span class="workflow-node-time__value">
                            {{ node.finishedAt || '-' }}
                          </span>
                        </div>
                      </div>

                      <Button
                        class="workflow-node-action"
                        size="small"
                        @click="handleOpenWorkflowNodeTasks(node)"
                      >
                        {{ $t('business.message.openNodeQueueTasks') }}
                      </Button>

                      <Alert
                        v-if="node.errorMessage"
                        class="workflow-node-error"
                        :description="node.errorMessage"
                        :message="$t('business.message.nodeFailure')"
                        show-icon
                        type="error"
                      />
                    </article>
                  </div>
                </section>
              </div>
              <div
                v-else
                class="px-4 py-8 text-center text-sm text-[var(--vben-text-color-secondary)]"
              >
                {{ $t('business.message.noNodeDetails') }}
              </div>
            </div>
          </section>
        </template>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.workflow-topology-card {
  --workflow-text-color: #0f172a;
  --workflow-muted-color: #64748b;
  --workflow-panel-bg: linear-gradient(180deg, rgb(248 250 252 / 96%), #fff);
  --workflow-panel-border: rgb(226 232 240 / 90%);
  --workflow-panel-shadow: 0 12px 30px rgb(15 23 42 / 7%);
  --workflow-header-bg: linear-gradient(
    180deg,
    rgb(255 255 255 / 88%),
    transparent
  );
  --workflow-header-border: rgb(226 232 240 / 86%);
  --workflow-canvas-bg: rgb(248 250 252 / 72%);
  --workflow-grid-x: rgb(226 232 240 / 52%);
  --workflow-grid-y: rgb(226 232 240 / 42%);
  --workflow-flow-line: linear-gradient(
    90deg,
    rgb(59 130 246 / 34%),
    rgb(20 184 166 / 42%)
  );
  --workflow-arrow-bg: rgb(248 250 252);
  --workflow-arrow-border: rgb(37 99 235 / 62%);
  --workflow-stage-bg: rgb(255 255 255 / 92%);
  --workflow-stage-border: rgb(203 213 225 / 88%);
  --workflow-stage-shadow: 0 10px 24px rgb(15 23 42 / 6%);
  --workflow-stage-badge-color: #1d4ed8;
  --workflow-stage-badge-bg: linear-gradient(
    180deg,
    rgb(239 246 255),
    rgb(219 234 254)
  );
  --workflow-stage-badge-border: rgb(147 197 253 / 86%);
  --workflow-node-bg: rgb(255 255 255 / 96%);
  --workflow-node-border: rgb(203 213 225 / 82%);
  --workflow-node-shadow: 0 14px 30px rgb(15 23 42 / 8%);
  --workflow-node-metric-bg: rgb(248 250 252 / 86%);
  --workflow-node-metric-border: rgb(226 232 240 / 92%);
  --workflow-node-separator: rgb(226 232 240 / 82%);
  --workflow-chip-color: #1d4ed8;
  --workflow-chip-bg: rgb(219 234 254 / 82%);
  --workflow-chip-border: rgb(147 197 253 / 72%);
  --workflow-chip-expected-color: #7e22ce;
  --workflow-chip-expected-bg: rgb(243 232 255 / 84%);
  --workflow-chip-expected-border: rgb(216 180 254 / 72%);
  --workflow-progress-bg: rgb(148 163 184 / 20%);
  --workflow-status-default: #2563eb;
  --workflow-status-default-ring: rgb(37 99 235 / 14%);
  --workflow-status-success: #16a34a;
  --workflow-status-success-ring: rgb(22 163 74 / 16%);
  --workflow-status-failed: #e11d48;
  --workflow-status-failed-ring: rgb(225 29 72 / 16%);
  --workflow-status-running: #0284c7;
  --workflow-status-running-ring: rgb(2 132 199 / 16%);
  --workflow-status-pending: #64748b;
  --workflow-status-pending-ring: rgb(100 116 139 / 16%);

  overflow: hidden;
  color: var(--workflow-text-color);
  background: var(--workflow-panel-bg);
  border: 1px solid var(--workflow-panel-border);
  border-radius: 8px;
  box-shadow: var(--workflow-panel-shadow);
}

.workflow-topology-card__header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--workflow-header-bg);
  border-bottom: 1px solid var(--workflow-header-border);
}

.workflow-topology-card__count {
  margin-inline-end: 0;
}

.workflow-flow-scroll {
  padding: 18px;
  overflow-x: auto;
  background:
    linear-gradient(90deg, var(--workflow-grid-x) 1px, transparent 1px),
    linear-gradient(180deg, var(--workflow-grid-y) 1px, transparent 1px);
  background-color: var(--workflow-canvas-bg);
  background-size: 28px 28px;
}

.workflow-flow {
  position: relative;
  display: grid;
  grid-auto-columns: minmax(330px, 370px);
  grid-auto-flow: column;
  gap: 22px;
  align-items: start;
  min-width: max-content;
  padding: 4px 2px 8px;
}

.workflow-flow::before {
  position: absolute;
  top: 38px;
  right: 28px;
  left: 28px;
  height: 2px;
  content: '';
  background: var(--workflow-flow-line);
}

.workflow-stage {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
}

.workflow-stage:not(:last-child)::after {
  position: absolute;
  top: 32px;
  right: -18px;
  width: 12px;
  height: 12px;
  content: '';
  background: var(--workflow-arrow-bg);
  border-top: 2px solid var(--workflow-arrow-border);
  border-right: 2px solid var(--workflow-arrow-border);
  transform: rotate(45deg);
}

.workflow-stage__header {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 76px;
  padding: 12px;
  color: var(--workflow-text-color);
  background: var(--workflow-stage-bg);
  border: 1px solid var(--workflow-stage-border);
  border-radius: 8px;
  box-shadow: var(--workflow-stage-shadow);
}

.workflow-stage__badge {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  font-size: 13px;
  font-weight: 800;
  color: var(--workflow-stage-badge-color);
  background: var(--workflow-stage-badge-bg);
  border: 1px solid var(--workflow-stage-badge-border);
  border-radius: 8px;
}

.workflow-stage__heading {
  min-width: 0;
}

.workflow-stage__title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}

.workflow-stage__summary {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--workflow-muted-color);
  white-space: nowrap;
}

.workflow-stage__nodes {
  display: grid;
  gap: 12px;
}

.workflow-node-card {
  --workflow-node-accent: var(--workflow-status-default);
  --workflow-node-accent-ring: var(--workflow-status-default-ring);

  position: relative;
  min-height: 0;
  padding: 14px 14px 14px 16px;
  overflow: hidden;
  color: var(--workflow-text-color);
  background: var(--workflow-node-bg);
  border: 1px solid var(--workflow-node-border);
  border-radius: 8px;
  box-shadow: var(--workflow-node-shadow);
}

.workflow-node-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  content: '';
  background: var(--workflow-node-accent);
}

.workflow-node-card--success {
  --workflow-node-accent: var(--workflow-status-success);
  --workflow-node-accent-ring: var(--workflow-status-success-ring);
}

.workflow-node-card--failed {
  --workflow-node-accent: var(--workflow-status-failed);
  --workflow-node-accent-ring: var(--workflow-status-failed-ring);
}

.workflow-node-card--running {
  --workflow-node-accent: var(--workflow-status-running);
  --workflow-node-accent-ring: var(--workflow-status-running-ring);
}

.workflow-node-card--pending {
  --workflow-node-accent: var(--workflow-status-pending);
  --workflow-node-accent-ring: var(--workflow-status-pending-ring);
}

.workflow-node-card__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.workflow-node-card__identity {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.workflow-node-card__status-dot {
  width: 10px;
  height: 10px;
  margin-top: 4px;
  background: var(--workflow-node-accent);
  border-radius: 999px;
  box-shadow: 0 0 0 4px var(--workflow-node-accent-ring);
}

.workflow-node-card__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.workflow-node-card__subtitle {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--workflow-muted-color);
  white-space: nowrap;
}

.workflow-node-card__status-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
  font-weight: 700;
}

.workflow-node-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.workflow-node-chip {
  max-width: 100%;
  padding: 3px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  color: var(--workflow-chip-color);
  white-space: nowrap;
  background: var(--workflow-chip-bg);
  border: 1px solid var(--workflow-chip-border);
  border-radius: 6px;
}

.workflow-node-chip--expected {
  color: var(--workflow-chip-expected-color);
  background: var(--workflow-chip-expected-bg);
  border-color: var(--workflow-chip-expected-border);
}

.workflow-node-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  text-align: center;
}

.workflow-node-metric {
  padding: 9px 6px;
  color: var(--workflow-text-color);
  background: var(--workflow-node-metric-bg);
  border: 1px solid var(--workflow-node-metric-border);
  border-radius: 8px;
}

.workflow-node-metric__value {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}

.workflow-node-metric__label {
  margin-top: 4px;
  font-size: 11px;
  color: var(--workflow-muted-color);
}

.workflow-node-progress-wrap {
  margin-top: 12px;
}

.workflow-node-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--workflow-muted-color);
}

.workflow-node-progress {
  height: 7px;
  overflow: hidden;
  background: var(--workflow-progress-bg);
  border-radius: 999px;
}

.workflow-node-progress__bar {
  height: 100%;
  background: var(--workflow-node-accent);
  border-radius: inherit;
}

.workflow-node-relations {
  display: grid;
  gap: 7px;
  margin-top: 12px;
  font-size: 12px;
}

.workflow-node-relation {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
}

.workflow-node-relation__label {
  color: var(--workflow-muted-color);
}

.workflow-node-relation__value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  white-space: nowrap;
}

.workflow-node-times {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--workflow-node-separator);
}

.workflow-node-time {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  font-size: 12px;
}

.workflow-node-time__label {
  color: var(--workflow-muted-color);
}

.workflow-node-time__value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  white-space: nowrap;
}

.workflow-node-action {
  width: 100%;
  margin-top: 12px;
}

.workflow-node-error {
  margin-top: 12px;
}

:global(.dark) .workflow-topology-card,
:global(html.dark) .workflow-topology-card {
  --workflow-text-color: #e5e7eb;
  --workflow-muted-color: #94a3b8;
  --workflow-panel-bg: linear-gradient(
    180deg,
    rgb(15 23 42 / 92%),
    rgb(2 6 23 / 96%)
  );
  --workflow-panel-border: rgb(51 65 85 / 92%);
  --workflow-panel-shadow: 0 16px 36px rgb(0 0 0 / 26%);
  --workflow-header-bg: linear-gradient(
    180deg,
    rgb(15 23 42 / 72%),
    transparent
  );
  --workflow-header-border: rgb(51 65 85 / 90%);
  --workflow-canvas-bg: rgb(2 6 23 / 72%);
  --workflow-grid-x: rgb(30 41 59 / 70%);
  --workflow-grid-y: rgb(30 41 59 / 54%);
  --workflow-flow-line: linear-gradient(
    90deg,
    rgb(96 165 250 / 42%),
    rgb(45 212 191 / 36%)
  );
  --workflow-arrow-bg: rgb(2 6 23);
  --workflow-arrow-border: rgb(96 165 250 / 72%);
  --workflow-stage-bg: rgb(15 23 42 / 92%);
  --workflow-stage-border: rgb(51 65 85 / 96%);
  --workflow-stage-shadow: 0 14px 28px rgb(0 0 0 / 18%);
  --workflow-stage-badge-color: #bfdbfe;
  --workflow-stage-badge-bg: linear-gradient(
    180deg,
    rgb(30 64 175 / 54%),
    rgb(15 23 42)
  );
  --workflow-stage-badge-border: rgb(59 130 246 / 70%);
  --workflow-node-bg: rgb(15 23 42 / 96%);
  --workflow-node-border: rgb(51 65 85 / 94%);
  --workflow-node-shadow: 0 18px 34px rgb(0 0 0 / 22%);
  --workflow-node-metric-bg: rgb(2 6 23 / 52%);
  --workflow-node-metric-border: rgb(51 65 85 / 84%);
  --workflow-node-separator: rgb(51 65 85 / 82%);
  --workflow-chip-color: #bfdbfe;
  --workflow-chip-bg: rgb(30 64 175 / 32%);
  --workflow-chip-border: rgb(59 130 246 / 54%);
  --workflow-chip-expected-color: #e9d5ff;
  --workflow-chip-expected-bg: rgb(88 28 135 / 32%);
  --workflow-chip-expected-border: rgb(168 85 247 / 50%);
  --workflow-progress-bg: rgb(51 65 85 / 70%);
  --workflow-status-default: #60a5fa;
  --workflow-status-default-ring: rgb(96 165 250 / 18%);
  --workflow-status-success: #4ade80;
  --workflow-status-success-ring: rgb(74 222 128 / 18%);
  --workflow-status-failed: #fb7185;
  --workflow-status-failed-ring: rgb(251 113 133 / 18%);
  --workflow-status-running: #38bdf8;
  --workflow-status-running-ring: rgb(56 189 248 / 18%);
  --workflow-status-pending: #94a3b8;
  --workflow-status-pending-ring: rgb(148 163 184 / 18%);
}

@media (max-width: 768px) {
  .workflow-flow {
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: row;
    min-width: 0;
  }

  .workflow-flow::before,
  .workflow-stage:not(:last-child)::after {
    display: none;
  }
}
</style>
