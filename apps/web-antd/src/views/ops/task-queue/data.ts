import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  asActionPermission,
  OPS_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// TableActionHandler 定义表格操作列点击事件签名。
type TableActionHandler<T = any> = (params: { code: string; row: T }) => void;

// useColumns 返回任务队列表格列配置。
export function useColumns<T = any>(
  onActionClick: TableActionHandler<T>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'name', title: $t('business.message.queueName'), minWidth: 220 },
    {
      field: 'paused',
      title: $t('business.message.isPaused'),
      width: 110,
      cellRender: {
        name: 'CellTag',
        attrs: {
          tagMap: {
            false: {
              color: 'success',
              text: $t('business.message.runningState'),
            },
            true: {
              color: 'warning',
              text: $t('business.message.pausedState'),
            },
          },
        },
      },
    },
    { field: 'size', title: $t('business.message.totalTaskCount'), width: 100 },
    {
      field: 'pending',
      title: $t('business.message.collectorStatePending'),
      width: 100,
    },
    {
      field: 'active',
      title: $t('business.message.collectorStateRunning'),
      width: 100,
    },
    {
      field: 'scheduled',
      title: $t('business.message.scheduledTask'),
      width: 100,
    },
    { field: 'retry', title: $t('business.message.retryQueue'), width: 100 },
    {
      field: 'completed',
      title: $t('business.message.collectorStateDone'),
      width: 100,
    },
    { field: 'failed', title: $t('business.message.todayFailed'), width: 100 },
    { field: 'latencyMs', title: $t('business.message.latencyMs'), width: 110 },
    {
      field: 'memoryUsage',
      title: $t('business.message.memoryUsage'),
      minWidth: 140,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'viewTasks',
            icon: 'taskList',
            iconOnly: true,
            text: $t('business.message.viewTasks'),
            auth: asActionPermission(OPS_ACTION_PERMISSION_CODES.TASK_INFO_GET),
          },
          {
            code: 'toggleConsume',
            icon: 'toggle',
            iconOnly: true,
            text: $t('business.message.toggleConsume'),
            auth: asActionPermission([
              OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_PAUSE,
              OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_RESUME,
            ]),
          },
        ],
      },
      field: 'operation',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 96,
    },
  ];
}
