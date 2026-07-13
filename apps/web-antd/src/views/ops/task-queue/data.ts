import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  asActionPermission,
  OPS_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import { countRiskTagMeta, latencyTagMeta } from '../table-tags';

// TableActionHandler 定义表格操作列点击事件签名。
type TableActionHandler<T = any> = (params: { code: string; row: T }) => void;

// getMemoryFractionDigits 按容量大小控制小数位，避免展示过长的小数。
function getMemoryFractionDigits(unitIndex: number, size: number) {
  if (unitIndex === 0 || size >= 100) {
    return 0;
  }
  if (size >= 10) {
    return 1;
  }
  return 2;
}

// formatMemoryUsage 将后端返回的 bytes 转成带单位的二进制容量，便于队列页直接阅读。
function formatMemoryUsage(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const maximumFractionDigits = getMemoryFractionDigits(unitIndex, size);
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
  return `${formatter.format(size)} ${units[unitIndex]}`;
}

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
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: unknown }) =>
            countRiskTagMeta(value, 'warning'),
        },
        name: 'CellTag',
      },
      field: 'retry',
      title: $t('business.message.retryQueue'),
      width: 100,
    },
    {
      field: 'completed',
      title: $t('business.message.collectorStateDone'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: unknown }) =>
            countRiskTagMeta(value, 'error'),
        },
        name: 'CellTag',
      },
      field: 'failed',
      title: $t('business.message.todayFailed'),
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
      field: 'latencyMs',
      title: $t('business.message.latencyMs'),
      width: 110,
    },
    {
      field: 'memoryUsage',
      formatter: ({ cellValue }: { cellValue: unknown }) =>
        formatMemoryUsage(cellValue),
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
            auth: asActionPermission(
              OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_PAUSE,
            ),
            code: 'pauseConsume',
            icon: 'toggle',
            iconOnly: true,
            text: $t('business.message.pauseConsume'),
            visible: (row: T) => !(row as any).paused,
          },
          {
            auth: asActionPermission(
              OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_RESUME,
            ),
            code: 'resumeConsume',
            icon: 'play',
            iconOnly: true,
            text: $t('business.message.resumeConsume'),
            visible: (row: T) => (row as any).paused,
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
