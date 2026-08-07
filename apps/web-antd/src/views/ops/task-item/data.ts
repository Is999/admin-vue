import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TaskApi } from '#/api/ops/task';

import { h } from 'vue';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  OPS_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  formatTraceCount as formatSharedTraceCount,
  getTaskQueueOptions,
} from '../shared';
import { latencyTagMeta, taskQueueTagMap } from '../table-tags';
import {
  buildTaskTraceSummaryRows,
  hasTaskExecutionTrace,
} from '../task-trace';
import WorkflowIdCell from './components/workflow-id-cell.vue';

// TableActionHandler 定义表格操作列点击事件签名。
type TableActionHandler<T = any> = (params: { code: string; row: T }) => void;

// TASK_ID_EXACT_PATTERN 匹配系统生成的 UUID 任务 ID 及工作流分片稳定任务 ID。
const TASK_ID_EXACT_PATTERN =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}(?::[^\s]+:\d+)?$/i;

export { formatSharedTraceCount as formatTraceCount };

// isExactTaskID 判断输入是否可安全走队列内任务 ID 精确查询。
export function isExactTaskID(taskID: string) {
  return TASK_ID_EXACT_PATTERN.test(String(taskID || '').trim());
}

// getTaskExecutionTrace 获取任务运行指标摘要。
export function getTaskExecutionTrace(task: TaskApi.TaskItem) {
  return task.executionTrace;
}

// getTaskWorkflowId 提取任务关联的工作流 ID。
export function getTaskWorkflowId(task: TaskApi.TaskItem) {
  return String(task.workflowId || '').trim();
}

// renderWorkflowIdLink 渲染可直达工作流状态页的任务列表链接。
function renderWorkflowIdLink<T>(row: T, onActionClick: TableActionHandler<T>) {
  const workflowID = getTaskWorkflowId(row as TaskApi.TaskItem);
  return h(WorkflowIdCell, {
    text: workflowID,
    onOpen: () => onActionClick({ code: 'workflowStatus', row }),
  });
}

// formatTaskTraceMetric 把单个运行指标格式化为 label: value 文本。
function formatTaskTraceMetric(label: string, value?: number | string) {
  return `${label}: ${
    typeof value === 'string' ? value : formatSharedTraceCount(value)
  }`;
}

// formatTaskTraceOverview 生成任务列表运行指标摘要，悬浮后可查看完整参数。
export function formatTaskTraceOverview(task: TaskApi.TaskItem) {
  const trace = getTaskExecutionTrace(task);
  if (!hasTaskExecutionTrace(trace)) {
    return '-';
  }
  const currentTrace = trace as TaskApi.TaskExecutionTrace;
  const metrics = buildTaskTraceSummaryRows(currentTrace).map(
    ([label, value]) => formatTaskTraceMetric(label, value),
  );
  const lines: string[] = [];
  for (let index = 0; index < metrics.length; index += 4) {
    lines.push(metrics.slice(index, index + 4).join(' / '));
  }
  return lines.join('\n') || '-';
}

// getTaskStateOptions 按当前语言生成任务状态选项，避免模块初始化时固化翻译。
export function getTaskStateOptions(): Array<{
  label: string;
  value: '' | TaskApi.ListTaskItemsReq['state'];
}> {
  return [
    { label: $t('business.message.allStates'), value: '' },
    { label: $t('business.message.taskStatePending'), value: 'pending' },
    { label: $t('business.message.taskStateActive'), value: 'active' },
    { label: $t('business.message.taskStateScheduled'), value: 'scheduled' },
    { label: $t('business.message.taskStateRetry'), value: 'retry' },
    { label: $t('business.message.taskStateArchived'), value: 'archived' },
    { label: $t('business.message.taskStateCompleted'), value: 'completed' },
    {
      label: $t('business.message.taskStateAggregating'),
      value: 'aggregating',
    },
  ];
}

// useGridFormSchema 返回任务列表查询表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.queueName'),
      componentProps: {
        allowClear: true,
        options: getTaskQueueOptions(),
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
        options: getTaskStateOptions(),
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
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: taskQueueTagMap() },
        name: 'CellTag',
      },
      field: 'queue',
      title: $t('business.message.queue'),
      width: 120,
    },
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
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: unknown }) => latencyTagMeta(value),
        },
        name: 'CellTag',
      },
      field: 'durationMs',
      title: $t('business.message.executionDuration'),
      width: 110,
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
            auth: asActionPermission(OPS_ACTION_PERMISSION_CODES.TASK_INFO_GET),
          },
          {
            code: 'runNow',
            icon: 'play',
            iconOnly: true,
            text: $t('business.message.taskRunNow'),
            auth: asActionPermission(OPS_ACTION_PERMISSION_CODES.TASK_RUN),
          },
          {
            code: 'delete',
            icon: 'delete',
            iconOnly: true,
            text: $t('business.message.taskDelete'),
            auth: asActionPermission(OPS_ACTION_PERMISSION_CODES.TASK_DELETE),
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
