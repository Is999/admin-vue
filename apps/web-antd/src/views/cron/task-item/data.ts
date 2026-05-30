import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TaskApi } from '#/api/cron/task';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import { TASK_QUEUE_OPTIONS } from '../shared';

// TableActionHandler 定义表格操作列点击事件签名。
type TableActionHandler<T = any> = (params: { code: string; row: T }) => void;

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
    buildClampTextColumn(
      {
        field: 'workflowId',
        title: $t('business.message.workflowId'),
        minWidth: 240,
      },
      {
        copyButtonText: $t('business.message.copyWorkflowId'),
        dblclickCopySuccessMessage: $t('business.message.workflowIdCopied'),
        emptyDblclickCopyMessage: $t('business.message.noWorkflowIdToCopy'),
        lines: 1,
      },
    ),
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
