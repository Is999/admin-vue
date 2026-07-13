import type { SystemCacheApi } from '#/api/system';

import { h } from 'vue';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Modal,
  Space,
} from 'ant-design-vue';

import JsonEditor from '#/components/json-editor/index.vue';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

// cacheCategoryKeyMap 定义缓存分类到多语言 key 的映射。
const cacheCategoryKeyMap: Record<string, string> = {
  auth: 'business.message.cacheCategoryAuth',
  config: 'business.message.cacheCategoryConfig',
  secret: 'business.message.cacheCategorySecret',
  session: 'business.message.cacheCategorySession',
  system: 'business.message.cacheCategorySystem',
};

// refreshScopeKeyMap 定义缓存刷新粒度到多语言 key 的映射。
const refreshScopeKeyMap: Record<string, string> = {
  all: 'business.message.refreshScopeAll',
  prefix: 'business.message.refreshScopePrefix',
  single: 'business.message.refreshScopeSingle',
};

// formatInfoValue 统一格式化 Redis 服务信息展示值。
export function formatInfoValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return String(value);
}

// formatCacheCategory 把缓存分类编码转换成当前语言文案。
export function formatCacheCategory(value?: string) {
  const key = cacheCategoryKeyMap[value || ''];
  return key ? $t(key) : value || '-';
}

// formatRefreshScope 把缓存刷新粒度编码转换成当前语言文案。
export function formatRefreshScope(value?: string) {
  const key = refreshScopeKeyMap[value || ''];
  return key ? $t(key) : value || '-';
}

// formatTTLValue 统一格式化 TTL 展示。
export function formatTTLValue(ttl?: number) {
  if (ttl === undefined || ttl === null) {
    return '-';
  }
  if (ttl < 0) {
    return ttl === -1
      ? $t('business.message.permanent')
      : $t('business.message.cacheMiss');
  }
  return $t('business.message.ttlSecondsValue', [ttl]);
}

// buildJsonText 统一把缓存值转换为便于展示的 JSON 文本。
export function buildJsonText(data: any) {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data, null, 2);
}

// parseCacheJsonValue 尝试把缓存值解析为 JSON，成功时返回结构化结果，失败时返回 null。
function parseCacheJsonValue(data: any) {
  if (data === undefined || data === null) {
    return null;
  }
  if (typeof data === 'string') {
    const text = data.trim();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (typeof data === 'object') {
    return data;
  }
  return null;
}

// buildCacheValueViewer 根据缓存值类型构建展示节点。
export function buildCacheValueViewer(data: any, fieldName: string) {
  const jsonValue = parseCacheJsonValue(data);
  if (jsonValue !== null) {
    return h(JsonEditor, {
      id: fieldName,
      name: fieldName,
      readonly: true,
      rows: 14,
      value: JSON.stringify(jsonValue, null, 2),
    });
  }
  return h(
    'pre',
    {
      class:
        'max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
    },
    buildJsonText(data),
  );
}

// showStructuredValueModal 使用统一的 JSON/文本查看器展示结构化值，并支持复制。
export function showStructuredValueModal(
  title: string,
  value: any,
  valueLabel = $t('business.message.cacheValue'),
  width = 860,
) {
  const valueText = buildJsonText(value);
  Modal.info({
    closable: true,
    content: h('div', { class: 'space-y-4' }, [
      h('div', { class: 'flex items-center justify-between gap-3' }, [
        h('div', { class: 'text-xs text-gray-500' }, valueLabel),
        h(Space, { size: 8 }, () => [
          h(
            Button,
            {
              size: 'small',
              onClick: () =>
                copyTextToClipboard(
                  valueText,
                  $t('business.message.valueCopiedToClipboard', [valueLabel]),
                  $t('business.message.noValueToCopy', [valueLabel]),
                ),
            },
            () => $t('business.message.copyValueLabel', [valueLabel]),
          ),
        ]),
      ]),
      buildCacheValueViewer(value, 'structured-value'),
    ]),
    maskClosable: true,
    title,
    width,
  });
}

// isTemplateCacheKey 判断当前缓存键是否仍是模板键。
export function isTemplateCacheKey(key: string) {
  return key.includes('%') || key.includes('{');
}

// isTemplateSearchKeyword 判断当前搜索词是否为模板/通配模式。
export function isTemplateSearchKeyword(keyword: string) {
  return keyword.includes('*') || keyword.includes('?');
}

// buildTemplateSearchPattern 把模板缓存键转换成可直接搜索真实 Redis Key 的模式。
export function buildTemplateSearchPattern(key: string) {
  return key
    .replaceAll(/%[sdv]/g, '*')
    .replaceAll(/\{[^}]+\}/g, '*')
    .replaceAll(/\*+/g, '*');
}

// showCacheInfoModal 使用结构化弹窗展示缓存详情与元信息。
export function showCacheInfoModal(
  title: string,
  info: SystemCacheApi.KeyInfo,
) {
  const cacheValueText = buildJsonText(info.value);
  Modal.info({
    closable: true,
    maskClosable: true,
    content: h('div', { class: 'space-y-4' }, [
      h(
        Descriptions,
        {
          bordered: true,
          column: 2,
          size: 'small',
          title: $t('business.message.cacheDetail'),
        },
        () => [
          h(
            DescriptionsItem,
            { label: $t('business.message.cacheKey') },
            () => info.key || '-',
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.redisType') },
            () => info.type || '-',
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.remainingTtl') },
            () => formatTTLValue(info.ttl),
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.valueCount') },
            () => String(info.total ?? '-'),
          ),
        ],
      ),
      h(
        Descriptions,
        {
          bordered: true,
          column: 2,
          size: 'small',
          title: $t('business.message.cacheItemMeta'),
        },
        () => [
          h(
            DescriptionsItem,
            { label: $t('business.message.cacheIndex') },
            () => info.item?.index || '-',
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.cacheCategory') },
            () => formatCacheCategory(info.item?.category),
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.templateKey') },
            () =>
              info.item?.isTemplate
                ? $t('business.message.yes')
                : $t('business.message.no'),
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.exampleKey') },
            () => info.item?.exampleKey || '-',
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.autoRebuild') },
            () =>
              info.item?.autoRebuild
                ? $t('business.message.supported')
                : $t('business.message.unsupported'),
          ),
          h(
            DescriptionsItem,
            { label: $t('business.message.refreshScope') },
            () => formatRefreshScope(info.item?.refreshScope),
          ),
        ],
      ),
      h('div', { class: 'flex items-center justify-between gap-3' }, [
        h(
          'div',
          { class: 'text-xs text-gray-500' },
          $t('business.message.cacheValue'),
        ),
        h(Space, { size: 8 }, () => [
          h(
            Button,
            {
              size: 'small',
              onClick: () =>
                copyTextToClipboard(
                  cacheValueText,
                  $t('business.message.cacheValueCopied'),
                  $t('business.message.noCacheValueToCopy'),
                ),
            },
            () => $t('business.message.copyCacheValue'),
          ),
        ]),
      ]),
      buildCacheValueViewer(info.value, 'cache-detail-value'),
    ]),
    title,
    width: 860,
  });
}
