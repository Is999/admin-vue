import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { CollectorApi } from '#/api/ops/collector';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import { collectorTransportTagMap } from '../table-tags';

// getCollectorStateOptions 生成任务状态下拉选项，确保语言切换后文案来自当前语言包。
export function getCollectorStateOptions(): Array<{
  label: string;
  value: CollectorApi.TaskState;
}> {
  return [
    { label: $t('business.message.collectorStatePending'), value: 0 },
    { label: $t('business.message.collectorStateRunning'), value: 1 },
    { label: $t('business.message.collectorStateDone'), value: 2 },
    { label: $t('business.message.collectorStateRetry'), value: 3 },
    { label: $t('business.message.collectorStateDead'), value: 4 },
  ];
}

// COLLECTOR_TRANSPORT_OPTIONS 统一维护事件投递通道下拉选项。
export const COLLECTOR_TRANSPORT_OPTIONS = [
  { label: 'db', value: 'db' },
  { label: 'kafka', value: 'kafka' },
  { label: 'redis', value: 'redis' },
];

export function renderCollectorState(state: CollectorApi.TaskState) {
  switch (state) {
    case 0: {
      return h(Tag, { color: 'processing' }, () =>
        $t('business.message.collectorStatePending'),
      );
    }
    case 1: {
      return h(Tag, { color: 'warning' }, () =>
        $t('business.message.collectorStateRunning'),
      );
    }
    case 2: {
      return h(Tag, { color: 'success' }, () =>
        $t('business.message.collectorStateDone'),
      );
    }
    case 3: {
      return h(Tag, { color: 'error' }, () =>
        $t('business.message.collectorStateRetry'),
      );
    }
    case 4: {
      return h(Tag, { color: 'default' }, () =>
        $t('business.message.collectorStateDead'),
      );
    }
    default: {
      return String(state);
    }
  }
}

// useColumns 构造 Collector任务表格列定义。
export function useColumns(): VxeGridPropTypes.Columns<CollectorApi.TaskItem> {
  return [
    { type: 'checkbox', width: 50 },
    { field: 'id', title: 'ID', width: 90 },
    { field: 'eventId', title: $t('business.message.eventId'), minWidth: 220 },
    {
      field: 'bizType',
      title: $t('business.message.bizType'),
      minWidth: 160,
    },
    {
      field: 'partitionKey',
      title: $t('business.message.partitionKey'),
      minWidth: 160,
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: collectorTransportTagMap() },
        name: 'CellTag',
      },
      field: 'transport',
      title: $t('business.message.channel'),
      width: 100,
    },
    {
      field: 'state',
      title: $t('business.message.status'),
      width: 100,
      slots: {
        default: ({ row }: { row: CollectorApi.TaskItem }) =>
          renderCollectorState(row.state),
      },
    },
    { field: 'attempt', title: $t('business.message.retryCount'), width: 90 },
    { field: 'nextRunAt', title: $t('business.message.nextRunAt'), width: 170 },
    { field: 'startedAt', title: $t('business.message.startTime'), width: 170 },
    { field: 'finishedAt', title: $t('business.message.endTime'), width: 170 },
    { field: 'createdAt', title: $t('business.message.createdAt'), width: 170 },
    {
      field: 'payload',
      title: $t('business.message.eventPayload'),
      minWidth: 260,
    },
    {
      field: 'lastError',
      title: $t('business.message.failureReason'),
      minWidth: 260,
    },
  ];
}
