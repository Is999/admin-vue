import { $t } from '#/locales';

import { formatDurationMs } from './shared';

// taskQueueTagMap 定义任务队列标签颜色。
export function taskQueueTagMap() {
  return {
    critical: {
      color: 'error',
      text: $t('business.message.queueCriticalLabel'),
    },
    default: {
      color: 'processing',
      text: $t('business.message.queueDefaultLabel'),
    },
    maintenance: {
      color: 'purple',
      text: $t('business.message.queueMaintenanceLabel'),
    },
  };
}

// countRiskTagMeta 根据数量是否大于 0 返回风险提示标签。
export function countRiskTagMeta(value: unknown, riskColor = 'warning') {
  const count = Number(value || 0);
  return count > 0
    ? { color: riskColor, text: count }
    : { color: 'default', text: count };
}

// latencyTagMeta 按毫秒耗时突出慢请求或队列延迟。
export function latencyTagMeta(value: unknown) {
  const latency = Number(value || 0);
  if (!Number.isFinite(latency) || latency <= 0) {
    return { color: 'default', text: '-' };
  }
  if (latency >= 1000) {
    return { color: 'error', text: formatDurationMs(latency) };
  }
  if (latency >= 300) {
    return { color: 'warning', text: formatDurationMs(latency) };
  }
  return { color: 'success', text: formatDurationMs(latency) };
}
