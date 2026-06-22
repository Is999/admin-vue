import type { TaskApi } from '#/api/ops/task';

import { $t } from '#/locales';

// splitTextToItems 把逗号、换行分隔的文本转成字符串数组。
export function splitTextToItems(text: string) {
  return text
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// TASK_QUEUE_OPTIONS 定义运维任务当前约定的内置队列说明。
export const TASK_QUEUE_OPTIONS = [
  {
    label: $t('business.message.queueCriticalLabel'),
    value: 'critical',
    description: $t('business.message.queueCriticalDesc'),
  },
  {
    label: $t('business.message.queueDefaultLabel'),
    value: 'default',
    description: $t('business.message.queueDefaultDesc'),
  },
  {
    label: $t('business.message.queueMaintenanceLabel'),
    value: 'maintenance',
    description: $t('business.message.queueMaintenanceDesc'),
  },
] as const;

// TASK_QUEUE_FALLBACK_NAMES 定义“查全部”时的兜底队列清单。
export const TASK_QUEUE_FALLBACK_NAMES = TASK_QUEUE_OPTIONS.map(
  (item) => item.value,
);

// splitTextToNumberItems 把逗号、换行分隔的文本转成数字数组，并过滤非法值。
export function splitTextToNumberItems(text: string) {
  return splitTextToItems(text)
    .map(Number)
    .filter((item) => Number.isFinite(item) && item > 0);
}

// normalizeOptionalNumber 把可选值转换成 number | undefined，便于接口请求透传。
export function normalizeOptionalNumber(
  value: null | number | string | undefined,
) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

// parsePayloadText 把文本 JSON 转成对象，供手动投递任务使用。
export function parsePayloadText(text: string) {
  return JSON.parse(text) as Record<string, any>;
}

// safePrettyJson 把任意对象格式化为便于展示的 JSON 文本。
export function safePrettyJson(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

// formatDurationMs 把毫秒耗时格式化为运维页面通用短文本。
export function formatDurationMs(value?: unknown) {
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

// formatTraceCount 统一格式化任务运行指标数量，避免大数字挤占页面空间。
export function formatTraceCount(value?: unknown) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return '0';
  }
  return Math.trunc(count).toLocaleString();
}

// formatTraceMetricValue 格式化处理量指标值，兼容数量和耗时文本。
export function formatTraceMetricValue(value?: number | string) {
  return typeof value === 'string' ? value : formatTraceCount(value);
}

// formatProgressPercent 展示后端返回的执行进度百分比。
export function formatProgressPercent(
  progress?: TaskApi.TaskExecutionProgress,
) {
  const value = Number(progress?.percent || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }
  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)}%`;
}

// getProgressPercentValue 返回进度条宽度百分比，兼容历史响应。
export function getProgressPercentValue(
  progress?: TaskApi.TaskExecutionProgress,
) {
  const value = Number(progress?.percent || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

// getTaskQueueDescription 根据队列名返回中文说明，便于页面提示。
export function getTaskQueueDescription(queueName: string) {
  const matchedQueue = TASK_QUEUE_OPTIONS.find(
    (item) => item.value === queueName,
  );
  return matchedQueue?.description || $t('business.message.queueCustomDesc');
}

// buildHotReloadStatusLabel 根据热加载状态码生成更易懂的中文文案。
export function buildHotReloadStatusLabel(status: string) {
  switch (status) {
    case 'disabled': {
      return $t('business.message.hotReloadDisabled');
    }
    case 'failed': {
      return $t('business.message.hotReloadFailed');
    }
    case 'idle': {
      return $t('business.message.hotReloadIdle');
    }
    case 'success': {
      return $t('business.message.hotReloadSuccess');
    }
    default: {
      return status || $t('business.message.unknownStatus');
    }
  }
}

// buildHotReloadTriggerLabel 根据触发来源生成中文说明。
export function buildHotReloadTriggerLabel(triggerSource: string) {
  switch (triggerSource) {
    case 'manual_api': {
      return $t('business.message.hotReloadTriggerManualApi');
    }
    case 'startup': {
      return $t('business.message.hotReloadTriggerStartup');
    }
    case 'watcher': {
      return $t('business.message.hotReloadTriggerWatcher');
    }
    default: {
      return triggerSource || $t('business.message.noTriggerSource');
    }
  }
}

// buildSchedulerStatusLabel 根据调度器状态码生成更易懂的中文文案。
export function buildSchedulerStatusLabel(status: string) {
  switch (status) {
    case 'disabled': {
      return $t('business.message.schedulerDisabled');
    }
    case 'idle': {
      return $t('business.message.schedulerIdle');
    }
    case 'leader': {
      return $t('business.message.schedulerLeader');
    }
    case 'stopped': {
      return $t('business.message.schedulerStopped');
    }
    case 'waiting_leader': {
      return $t('business.message.schedulerWaitingLeader');
    }
    default: {
      return status || $t('business.message.unknownStatus');
    }
  }
}

// buildSchedulerSyncStatusLabel 根据同步结果生成中文说明。
export function buildSchedulerSyncStatusLabel(status: string) {
  switch (status) {
    case 'failed': {
      return $t('business.message.schedulerSyncFailed');
    }
    case 'success': {
      return $t('business.message.schedulerSyncSuccess');
    }
    default: {
      return status || $t('business.message.noSyncResult');
    }
  }
}
