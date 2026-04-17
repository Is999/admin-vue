import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TaskApi } from '#/api/cron/task';

import { h } from 'vue';

import { CopyOutlined, LinkOutlined } from '@ant-design/icons-vue';
import { Button, Tooltip } from 'ant-design-vue';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import { TASK_QUEUE_OPTIONS } from '../shared';

// TableActionHandler 定义表格操作列点击事件签名。
type TableActionHandler<T = any> = (params: { code: string; row: T }) => void;

const workflowIDHeaderName = 'x-app-workflow-id';

// formatDurationMs 把毫秒耗时格式化为任务列表可读文本。
function formatDurationMs(value: unknown) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) {
    return '-';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
  }
  if (ms < 3_600_000) {
    return `${(ms / 60_000).toFixed(ms >= 600_000 ? 0 : 1)}m`;
  }
  return `${(ms / 3_600_000).toFixed(ms >= 36_000_000 ? 0 : 1)}h`;
}

// formatTraceCount 统一格式化任务运行指标数量，避免大数字挤占列表空间。
export function formatTraceCount(value?: number) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return '0';
  }
  return Math.trunc(count).toLocaleString();
}

// getTaskExecutionTrace 获取任务运行指标摘要，兼容旧任务 result.executionTrace 兜底。
export function getTaskExecutionTrace(task: TaskApi.TaskItem) {
  const resultTrace = task.result?.executionTrace as
    | TaskApi.TaskExecutionTrace
    | undefined;
  return task.executionTrace || resultTrace;
}

// hasTaskExecutionTrace 判断运行指标是否包含可展示的数据。
export function hasTaskExecutionTrace(trace?: TaskApi.TaskExecutionTrace) {
  if (!trace) {
    return false;
  }
  return (
    Number(trace.totalCount || 0) > 0 ||
    Number(trace.readCount || 0) > 0 ||
    Number(trace.insertCount || 0) > 0 ||
    Number(trace.updateCount || 0) > 0 ||
    Number(trace.deleteCount || 0) > 0 ||
    Number(trace.upsertCount || 0) > 0 ||
    Number(trace.skipCount || 0) > 0 ||
    Number(trace.errorCount || 0) > 0 ||
    (trace.details || []).length > 0
  );
}

// getTaskWorkflowId 提取任务关联的工作流 ID，兼容标准字段和历史 header。
export function getTaskWorkflowId(task: TaskApi.TaskItem) {
  const directWorkflowID = String(task.workflowId || '').trim();
  if (directWorkflowID) {
    return directWorkflowID;
  }
  const matchedHeader = Object.entries(task.headers || {}).find(
    ([key]) =>
      String(key || '')
        .trim()
        .toLowerCase() === workflowIDHeaderName,
  );
  return String(matchedHeader?.[1] || '').trim();
}

// renderWorkflowIdLink 渲染可直达工作流状态页的任务列表链接。
function renderWorkflowIdLink<T>(row: T, onActionClick: TableActionHandler<T>) {
  const workflowID = getTaskWorkflowId(row as TaskApi.TaskItem);
  if (!workflowID) {
    return h(
      'span',
      {
        style: {
          alignItems: 'center',
          display: 'inline-flex',
          height: '32px',
        },
      },
      '-',
    );
  }
  return h(
    'div',
    {
      style: {
        alignItems: 'center',
        display: 'flex',
        gap: '4px',
        height: '32px',
        maxWidth: '100%',
        minWidth: 0,
      },
    },
    [
      h(
        Tooltip,
        {
          placement: 'topLeft',
          title: workflowID,
        },
        {
          default: () =>
            h(
              Button,
              {
                size: 'small',
                style: {
                  alignItems: 'center',
                  display: 'inline-flex',
                  flex: '1 1 auto',
                  gap: '4px',
                  height: '32px',
                  justifyContent: 'flex-start',
                  lineHeight: '32px',
                  minWidth: 0,
                  padding: 0,
                },
                type: 'link',
                onClick: (event: MouseEvent) => {
                  event.stopPropagation();
                  onActionClick({ code: 'workflowStatus', row });
                },
              },
              () => [
                h(LinkOutlined, {
                  style: {
                    flex: '0 0 auto',
                    lineHeight: 1,
                  },
                }),
                h(
                  'span',
                  {
                    style: {
                      display: 'block',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                  workflowID,
                ),
              ],
            ),
        },
      ),
      h(
        Tooltip,
        {
          title: $t('business.message.copyWorkflowId'),
        },
        {
          default: () =>
            h(
              Button,
              {
                size: 'small',
                style: {
                  alignItems: 'center',
                  display: 'inline-flex',
                  flex: '0 0 auto',
                  height: '32px',
                  justifyContent: 'center',
                  lineHeight: '32px',
                  padding: 0,
                  width: '24px',
                },
                type: 'link',
                onClick: (event: MouseEvent) => {
                  event.stopPropagation();
                  void copyTextToClipboard(
                    workflowID,
                    $t('business.message.workflowIdCopied'),
                    $t('business.message.noWorkflowIdToCopy'),
                  );
                },
              },
              () => h(CopyOutlined),
            ),
        },
      ),
    ],
  );
}

// formatTaskTraceMetric 把单个运行指标格式化为 label: value 文本。
function formatTaskTraceMetric(label: string, value?: number | string) {
  return `${label}: ${
    typeof value === 'string' ? value : formatTraceCount(value)
  }`;
}

// formatTaskTraceOverview 生成任务列表运行指标摘要，悬浮后可查看完整参数。
function formatTaskTraceOverview(task: TaskApi.TaskItem) {
  const trace = getTaskExecutionTrace(task);
  if (!hasTaskExecutionTrace(trace)) {
    return '-';
  }
  const currentTrace = trace as TaskApi.TaskExecutionTrace;
  return [
    [
      formatTaskTraceMetric(
        $t('business.message.taskTraceTotalCount'),
        currentTrace.totalCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceReadCount'),
        currentTrace.readCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceInsertCount'),
        currentTrace.insertCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceUpdateCount'),
        currentTrace.updateCount,
      ),
    ].join(' / '),
    [
      formatTaskTraceMetric(
        $t('business.message.taskTraceDeleteCount'),
        currentTrace.deleteCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceUpsertCount'),
        currentTrace.upsertCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceSkipCount'),
        currentTrace.skipCount,
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceErrorCount'),
        currentTrace.errorCount,
      ),
    ].join(' / '),
    [
      formatTaskTraceMetric(
        $t('business.message.taskTraceDuration'),
        formatDurationMs(currentTrace.durationMs),
      ),
      formatTaskTraceMetric(
        $t('business.message.taskTraceDetailCount'),
        (currentTrace.details || []).length,
      ),
    ].join(' / '),
  ].join('\n');
}

// TASK_STATE_OPTIONS 定义任务列表支持的状态选项，便于页面统一复用。
export const TASK_STATE_OPTIONS: Array<{
  label: string;
  value: '' | TaskApi.ListTaskItemsReq['state'];
}> = [
  { label: $t('business.message.allStates'), value: '' },
  { label: $t('business.message.taskStatePending'), value: 'pending' },
  { label: $t('business.message.taskStateActive'), value: 'active' },
  { label: $t('business.message.taskStateScheduled'), value: 'scheduled' },
  { label: $t('business.message.taskStateRetry'), value: 'retry' },
  { label: $t('business.message.taskStateArchived'), value: 'archived' },
  { label: $t('business.message.taskStateCompleted'), value: 'completed' },
  { label: $t('business.message.taskStateAggregating'), value: 'aggregating' },
];

// useGridFormSchema 返回任务列表查询表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.queueName'),
      componentProps: {
        allowClear: true,
        options: TASK_QUEUE_OPTIONS,
        placeholder: $t('business.message.queueAllPlaceholder'),
      },
      help: $t('business.message.queueNameHelp'),
    },
    {
      component: 'Select',
      fieldName: 'state',
      label: $t('business.message.taskStatus'),
      defaultValue: '',
      componentProps: {
        options: TASK_STATE_OPTIONS,
        placeholder: $t('business.message.taskStatusAllPlaceholder'),
      },
    },
    {
      component: 'Input',
      fieldName: 'group',
      label: $t('business.message.taskGroup'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.taskGroupPlaceholder'),
      },
    },
    {
      component: 'Input',
      fieldName: 'taskName',
      label: $t('business.message.taskName'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.taskNameFilterPlaceholder'),
      },
      help: $t('business.message.taskNameFilterHelp'),
    },
  ];
}

// useColumns 返回任务列表表格列配置。
export function useColumns<T = any>(
  onActionClick: TableActionHandler<T>,
): VxeTableGridOptions['columns'] {
  return [
    buildClampTextColumn(
      { field: 'id', title: $t('business.message.taskId'), minWidth: 240 },
      {
        copyButtonText: $t('business.message.copyTaskId'),
        dblclickCopySuccessMessage: $t('business.message.taskIdCopied'),
        emptyDblclickCopyMessage: $t('business.message.noTaskIdToCopy'),
        lines: 1,
      },
    ),
    { field: 'queue', title: $t('business.message.queue'), width: 120 },
    {
      field: 'workflowId',
      minWidth: 240,
      slots: {
        default: ({ row }: { row: T }) =>
          renderWorkflowIdLink(row, onActionClick),
      },
      title: $t('business.message.workflowId'),
    },
    buildClampTextColumn(
      {
        field: 'taskName',
        title: $t('business.message.taskName'),
        minWidth: 220,
      },
      { lines: 1 },
    ),
    buildClampTextColumn(
      {
        field: 'taskType',
        title: $t('business.message.taskType'),
        minWidth: 180,
      },
      { lines: 1 },
    ),
    {
      field: 'state',
      title: $t('business.message.taskStatus'),
      width: 110,
      cellRender: {
        name: 'CellTag',
        attrs: {
          tagMap: {
            active: {
              color: 'processing',
              text: $t('business.message.taskStateActive'),
            },
            aggregating: {
              color: 'purple',
              text: $t('business.message.taskStateAggregating'),
            },
            archived: {
              color: 'error',
              text: $t('business.message.taskStateArchivedShort'),
            },
            completed: {
              color: 'success',
              text: $t('business.message.taskStateCompleted'),
            },
            pending: {
              color: 'default',
              text: $t('business.message.taskStatePending'),
            },
            retry: {
              color: 'warning',
              text: $t('business.message.taskStateRetrying'),
            },
            scheduled: {
              color: 'blue',
              text: $t('business.message.taskStateScheduling'),
            },
          },
        },
      },
    },
    buildClampTextColumn(
      {
        field: 'group',
        title: $t('business.message.taskGroup'),
        minWidth: 140,
      },
      { lines: 1 },
    ),
    { field: 'retried', title: $t('business.message.retried'), width: 90 },
    { field: 'maxRetry', title: $t('business.message.maxRetry'), width: 100 },
    {
      field: 'timeoutSec',
      title: $t('business.message.timeoutSeconds'),
      width: 100,
    },
    {
      field: 'durationMs',
      title: $t('business.message.executionDuration'),
      width: 110,
      formatter: ({ cellValue }) => formatDurationMs(cellValue),
    },
    buildClampTextColumn(
      {
        field: 'executionTrace',
        title: $t('business.message.taskRuntimeMetrics'),
        minWidth: 300,
      },
      {
        copyButtonText: $t('business.message.copy'),
        getText: ({ row }) => formatTaskTraceOverview(row as TaskApi.TaskItem),
        lines: 2,
      },
    ),
    { field: 'startedAt', title: $t('business.message.startedAt'), width: 180 },
    {
      field: 'nextProcessAt',
      title: $t('business.message.nextProcessAt'),
      width: 180,
    },
    {
      field: 'completedAt',
      title: $t('business.message.completedAt'),
      width: 180,
    },
    buildClampTextColumn({
      field: 'lastErr',
      title: $t('business.message.lastError'),
      minWidth: 220,
    }),
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'id',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            icon: 'detail',
            iconOnly: true,
            text: $t('business.message.viewDetail'),
            auth: asActionPermission(
              CRON_ACTION_PERMISSION_CODES.TASK_INFO_GET,
            ),
          },
          {
            code: 'runNow',
            icon: 'play',
            iconOnly: true,
            text: $t('business.message.taskRunNow'),
            auth: asActionPermission(CRON_ACTION_PERMISSION_CODES.TASK_RUN),
          },
          {
            code: 'delete',
            icon: 'delete',
            iconOnly: true,
            text: $t('business.message.taskDelete'),
            auth: asActionPermission(CRON_ACTION_PERMISSION_CODES.TASK_DELETE),
            danger: true,
          },
        ],
      },
      field: 'operation',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 112,
    },
  ];
}
