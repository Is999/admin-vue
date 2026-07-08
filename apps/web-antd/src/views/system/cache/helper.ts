import type { SystemCacheApi } from '#/api/system';

import { h } from 'vue';

import { Descriptions, DescriptionsItem, Modal } from 'ant-design-vue';

import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import JsonDetailViewer from '../components/json-detail-viewer.vue';

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
    content: h(JsonDetailViewer, {
      copyLabel: $t('business.message.copyValueLabel', [valueLabel]),
      onCopy: () =>
        copyTextToClipboard(
          valueText,
          $t('business.message.valueCopiedToClipboard', [valueLabel]),
          $t('business.message.noValueToCopy', [valueLabel]),
        ),
      searchPlaceholder: $t('business.message.cacheValueSearchPlaceholder'),
      value,
    }),
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
    content: h('div', { style: { display: 'grid', gap: '16px' } }, [
      h('section', { style: { display: 'grid', gap: '8px' } }, [
        h(
          'div',
          {
            style: {
              fontSize: '16px',
              fontWeight: '600',
              lineHeight: '24px',
            },
          },
          $t('business.message.cacheDetail'),
        ),
        h(
          Descriptions,
          {
            bordered: true,
            column: 2,
            size: 'small',
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
      ]),
      h('section', { style: { display: 'grid', gap: '8px' } }, [
        h(
          'div',
          {
            style: {
              fontSize: '16px',
              fontWeight: '600',
              lineHeight: '24px',
            },
          },
          $t('business.message.cacheItemMeta'),
        ),
        h(
          Descriptions,
          {
            bordered: true,
            column: 2,
            size: 'small',
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
      ]),
      h(JsonDetailViewer, {
        copyLabel: $t('business.message.copyCacheValue'),
        onCopy: () =>
          copyTextToClipboard(
            cacheValueText,
            $t('business.message.cacheValueCopied'),
            $t('business.message.noCacheValueToCopy'),
          ),
        searchPlaceholder: $t('business.message.cacheValueSearchPlaceholder'),
        value: info.value,
      }),
    ]),
    title,
    width: 1080,
  });
}
