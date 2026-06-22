import { $t } from '#/locales';

// enabledStatusTagMap 统一 0/1 启停状态的只读标签样式。
export function enabledStatusTagMap() {
  return {
    0: { color: 'default', text: $t('business.message.disable') },
    1: { color: 'success', text: $t('business.message.enable') },
  };
}

// yesNoTagMap 统一布尔字段的只读标签样式。
export function yesNoTagMap() {
  return {
    false: { color: 'default', text: $t('business.message.no') },
    true: { color: 'processing', text: $t('business.message.yes') },
  };
}

// supportTagMap 区分能力是否支持，便于列表快速扫读。
export function supportTagMap() {
  return {
    false: { color: 'default', text: $t('business.message.unsupported') },
    true: { color: 'success', text: $t('business.message.supported') },
  };
}

// cacheCategoryTagMap 定义缓存分类标签颜色。
export function cacheCategoryTagMap() {
  return {
    auth: { color: 'blue', text: $t('business.message.cacheCategoryAuth') },
    config: {
      color: 'purple',
      text: $t('business.message.cacheCategoryConfig'),
    },
    secret: { color: 'red', text: $t('business.message.cacheCategorySecret') },
    session: {
      color: 'cyan',
      text: $t('business.message.cacheCategorySession'),
    },
    system: {
      color: 'geekblue',
      text: $t('business.message.cacheCategorySystem'),
    },
  };
}

// redisTypeTagMap 定义 Redis 数据结构标签颜色。
export function redisTypeTagMap() {
  return {
    hash: { color: 'cyan', text: 'hash' },
    list: { color: 'blue', text: 'list' },
    set: { color: 'purple', text: 'set' },
    string: { color: 'green', text: 'string' },
    zset: { color: 'geekblue', text: 'zset' },
  };
}

// refreshScopeTagMap 定义缓存刷新粒度标签颜色。
export function refreshScopeTagMap() {
  return {
    all: { color: 'success', text: $t('business.message.refreshScopeAll') },
    prefix: {
      color: 'processing',
      text: $t('business.message.refreshScopePrefix'),
    },
    single: {
      color: 'warning',
      text: $t('business.message.refreshScopeSingle'),
    },
  };
}

// configTypeTagMap 定义系统配置数据类型标签颜色。
export function configTypeTagMap() {
  return {
    0: { color: 'default', text: $t('business.message.configTypeGroup') },
    1: { color: 'purple', text: $t('business.message.configTypeObject') },
    2: { color: 'geekblue', text: $t('business.message.configTypeArray') },
    3: { color: 'green', text: $t('business.message.configTypeString') },
    4: { color: 'blue', text: $t('business.message.configTypeInteger') },
    5: { color: 'cyan', text: $t('business.message.configTypeFloat') },
    6: { color: 'orange', text: $t('business.message.configTypeBoolean') },
  };
}

// messageLevelTagMap 定义消息等级标签颜色。
export function messageLevelTagMap() {
  return {
    1: { color: 'processing', text: $t('business.message.messageLevelInfo') },
    2: { color: 'warning', text: $t('business.message.messageLevelWarning') },
    3: { color: 'error', text: $t('business.message.messageLevelError') },
  };
}

// readStatusTagMap 定义消息已读状态标签颜色。
export function readStatusTagMap() {
  return {
    0: { color: 'warning', text: $t('business.message.unread') },
    1: { color: 'success', text: $t('business.message.read') },
  };
}

// bizCodeTagMeta 根据业务码是否成功返回标签样式。
export function bizCodeTagMeta(value: unknown) {
  const code = Number(value);
  if (!Number.isFinite(code)) {
    return { color: 'default', text: value ?? '-' };
  }
  return code === 0 || code === 200
    ? { color: 'success', text: code }
    : { color: 'warning', text: code };
}

// countTagMeta 根据数量是否大于 0 返回强调标签。
export function countTagMeta(value: unknown, color = 'processing') {
  const count = Number(value || 0);
  return count > 0 ? { color, text: count } : { color: 'default', text: count };
}

// configLevelTagMeta 根据配置树层级返回标签样式。
export function configLevelTagMeta(value: unknown) {
  const text = String(value ?? '').trim();
  const level = Number(text.replaceAll(/\D+/g, ''));
  if (Number.isFinite(level) && level > 0) {
    let color = 'purple';
    if (level <= 1) {
      color = 'default';
    } else if (level === 2) {
      color = 'processing';
    }
    return {
      color,
      text: text || level,
    };
  }
  return { color: 'default', text: text || '-' };
}

// grayPercentTagMeta 突出秘钥灰度流量比例。
export function grayPercentTagMeta(value: unknown) {
  const percent = Number(value || 0);
  if (!Number.isFinite(percent) || percent <= 0) {
    return { color: 'default', text: '0%' };
  }
  return {
    color: percent >= 100 ? 'error' : 'warning',
    text: `${percent}%`,
  };
}
