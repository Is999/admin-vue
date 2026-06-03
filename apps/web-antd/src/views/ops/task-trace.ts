import type { TaskApi } from '#/api/ops/task';

import { $t } from '#/locales';

import { formatDurationMs, formatTraceCount } from './shared';

// TaskTraceTone 表示处理量指标在卡片中的展示语义。
export type TaskTraceTone =
  | 'danger'
  | 'default'
  | 'info'
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning';

// TaskTraceMetricItem 表示任务处理量指标展示项。
export type TaskTraceMetricItem = {
  label: string;
  tone: TaskTraceTone;
  value?: number | string;
};

// TaskTraceSummaryRow 表示任务详情弹窗中的处理量摘要行。
export type TaskTraceSummaryRow = [string, number | string | undefined, string];

// TASK_TRACE_ACTIONS 定义后端当前稳定的处理量动作枚举。
const TASK_TRACE_ACTIONS = new Set([
  'custom',
  'delete',
  'error',
  'insert',
  'read',
  'skip',
  'update',
  'upsert',
]);

// hasTaskExecutionTrace 判断执行追踪是否包含可展示的数据。
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

// formatTaskTraceAction 把后端动作枚举转换为当前语言文案。
export function formatTaskTraceAction(action?: string) {
  const normalized = String(action || '')
    .trim()
    .toLowerCase();
  const actionLabels: Record<string, string> = {
    custom: $t('business.message.taskTraceActionCustom'),
    delete: $t('business.message.taskTraceActionDelete'),
    error: $t('business.message.taskTraceActionError'),
    insert: $t('business.message.taskTraceActionInsert'),
    read: $t('business.message.taskTraceActionRead'),
    skip: $t('business.message.taskTraceActionSkip'),
    update: $t('business.message.taskTraceActionUpdate'),
    upsert: $t('business.message.taskTraceActionUpsert'),
  };
  return actionLabels[normalized] || normalized || '-';
}

// normalizeTaskTraceAction 返回可用于样式类名的动作枚举。
export function normalizeTaskTraceAction(action?: string) {
  const normalized = String(action || 'custom')
    .trim()
    .toLowerCase();
  return TASK_TRACE_ACTIONS.has(normalized) ? normalized : 'custom';
}

// taskTraceActionColor 返回运行指标动作标签颜色。
export function taskTraceActionColor(action?: string) {
  const colorMap: Record<string, string> = {
    custom: 'default',
    delete: 'orange',
    error: 'error',
    insert: 'green',
    read: 'blue',
    skip: 'gold',
    update: 'cyan',
    upsert: 'green',
  };
  return colorMap[normalizeTaskTraceAction(action)] || 'default';
}

// buildTaskTraceMetricItems 生成工作流和节点卡片共用的处理量指标。
export function buildTaskTraceMetricItems(
  trace?: TaskApi.TaskExecutionTrace,
): TaskTraceMetricItem[] {
  return [
    {
      label: $t('business.message.taskTraceTotalCount'),
      tone: 'primary',
      value: trace?.totalCount,
    },
    {
      label: $t('business.message.taskTraceReadCount'),
      tone: 'info',
      value: trace?.readCount,
    },
    {
      label: $t('business.message.taskTraceUpdateCount'),
      tone: 'success',
      value: trace?.updateCount,
    },
    {
      label: $t('business.message.taskTraceInsertCount'),
      tone: 'success',
      value: trace?.insertCount,
    },
    {
      label: $t('business.message.taskTraceDeleteCount'),
      tone: 'warning',
      value: trace?.deleteCount,
    },
    {
      label: $t('business.message.taskTraceUpsertCount'),
      tone: 'success',
      value: trace?.upsertCount,
    },
    {
      label: $t('business.message.taskTraceSkipCount'),
      tone: 'warning',
      value: trace?.skipCount,
    },
    {
      label: $t('business.message.taskTraceErrorCount'),
      tone: 'danger',
      value: trace?.errorCount,
    },
    {
      label: $t('business.message.taskTraceDuration'),
      tone: 'neutral',
      value: formatDurationMs(trace?.durationMs),
    },
  ];
}

// buildTaskTraceSummaryRows 生成任务详情弹窗中的处理量摘要。
export function buildTaskTraceSummaryRows(
  trace: TaskApi.TaskExecutionTrace,
): TaskTraceSummaryRow[] {
  return [
    [$t('business.message.taskTraceTotalCount'), trace.totalCount, 'primary'],
    [$t('business.message.taskTraceReadCount'), trace.readCount, 'info'],
    [$t('business.message.taskTraceInsertCount'), trace.insertCount, 'success'],
    [$t('business.message.taskTraceUpdateCount'), trace.updateCount, 'success'],
    [$t('business.message.taskTraceDeleteCount'), trace.deleteCount, 'warning'],
    [$t('business.message.taskTraceUpsertCount'), trace.upsertCount, 'success'],
    [$t('business.message.taskTraceSkipCount'), trace.skipCount, 'warning'],
    [$t('business.message.taskTraceErrorCount'), trace.errorCount, 'danger'],
    [
      $t('business.message.taskTraceDuration'),
      formatDurationMs(trace.durationMs),
      'default',
    ],
    [
      $t('business.message.taskTraceDetailCount'),
      (trace.details || []).length,
      'default',
    ],
  ];
}

// buildTaskTraceDetailRows 返回完整处理量明细。
export function buildTaskTraceDetailRows(trace: TaskApi.TaskExecutionTrace) {
  return trace.details || [];
}

// formatTaskTraceDetails 生成处理量明细摘要文本。
export function formatTaskTraceDetails(
  details?: TaskApi.TaskExecutionTraceDetail[],
  limit = 4,
) {
  const rows = (details || []).slice(0, limit);
  if (rows.length === 0) {
    return '-';
  }
  const text = rows
    .map(
      (detail) =>
        `${formatTaskTraceAction(detail.action)} ${detail.name || '-'}: ${formatTraceCount(
          detail.count,
        )}`,
    )
    .join(' / ');
  if ((details || []).length > rows.length) {
    return `${text} ...`;
  }
  return text;
}
