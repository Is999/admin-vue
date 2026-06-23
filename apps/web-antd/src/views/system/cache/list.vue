<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemCacheApi } from '#/api/system';

import { computed, h, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';

import {
  DownOutlined,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Pagination,
  Space,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchCacheKeyInfo,
  fetchCacheList,
  fetchCacheServerInfo,
  fetchSearchCacheKeyInfo,
  renewAllCache,
  renewCache,
  searchCacheKeys,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import { resolveBackendMessage } from '../shared';
import { useColumns } from './data';
import {
  buildTemplateSearchPattern,
  formatCacheCategory,
  formatInfoValue,
  formatRefreshScope,
  isTemplateCacheKey,
  isTemplateSearchKeyword,
  showCacheInfoModal,
} from './helper';
import TemplateKeysDrawer from './modules/template-keys-drawer.vue';

// route 用于接收业务页面跳转时携带的缓存定位参数。
const route = useRoute();
// serverInfo 保存 Redis 服务信息。
const serverInfo = ref<SystemCacheApi.ServerInfo>({});
// searchKeyword 保存 Redis Key 搜索关键字。
const searchKeyword = ref('');
// searchResult 保存 Redis Key 搜索结果。
const searchResult = ref<SystemCacheApi.SearchItem[]>([]);
// searchLoading 表示当前是否正在执行分页搜索。
const searchLoading = ref(false);
// searchPage 保存当前 Redis Key 搜索页码。
const searchPage = ref(1);
// searchPageSize 保存当前 Redis Key 搜索每页数量。
const searchPageSize = ref(20);
// searchTotal 保存当前搜索条件下已确认存在的真实 Key 数量。
const searchTotal = ref(0);
// searchHasMore 表示当前搜索结果是否还有下一页。
const searchHasMore = ref(false);
// searchLimited 表示后端是否触发最大搜索窗口保护。
const searchLimited = ref(false);
// topCardsExpanded 控制顶部两张卡片是否同步展开。
const topCardsExpanded = ref(true);
// routeSearchSource 保存来源页面说明，便于在缓存管理页提示当前是由哪个业务页定位过来的。
const routeSearchSource = ref('');
// routeSearchTemplateKeys 保存来源页面携带的模板缓存 key 定义，便于在缓存管理页提示当前对应的模板上下文。
const routeSearchTemplateKeys = ref<string[]>([]);
// lastAppliedRouteSearchSignature 避免同一组路由参数重复触发自动检索和自动查看。
const lastAppliedRouteSearchSignature = ref('');
// hasTemplateSearchResult 判断当前检索结果是否适合打开模板实例子页面。
const hasTemplateSearchResult = computed(
  () =>
    isTemplateSearchKeyword(searchKeyword.value.trim()) &&
    searchResult.value.some((item) => item.item?.isTemplate),
);
// topCardBodyClass 返回顶部两张卡片统一的联动高度样式。
const topCardBodyClass = computed(() =>
  topCardsExpanded.value ? 'h-[360px]' : 'h-[196px]',
);

// TopCardToggleIcon 返回顶部两张卡片同步收缩按钮图标。
const TopCardToggleIcon = computed(() =>
  topCardsExpanded.value ? UpOutlined : DownOutlined,
);
// searchResultSummaryText 展示当前分页窗口和后端保护状态。
const searchResultSummaryText = computed(() => {
  if (searchTotal.value <= 0 && searchResult.value.length === 0) {
    return '';
  }
  const limitedText = searchLimited.value
    ? $t('business.message.cacheSearchLimitedSuffix')
    : '';
  return $t('business.message.cacheSearchSummary', [
    searchPage.value,
    searchPageSize.value,
    searchTotal.value,
    limitedText,
  ]);
});

// cacheSearchProviderPrefixes 定义前端已知的模板 provider 前缀，用于在搜索前提示当前预计走哪条链路。
const cacheSearchProviderPrefixes = [
  'admin:info:',
  'admin_permission_ids:',
  'admin_permission_uuids:',
  'admin_profile:',
  'admin_role_ids:',
  'admin_roles_detail:',
  'config_uuid:',
  'role_permission:',
  'route_permission_ids:',
  'secret_key_aes:',
  'secret_key_route:',
  'secret_key_rsa:',
];

// toggleTopCards 切换顶部概览和检索卡片的联动展开状态。
function toggleTopCards() {
  topCardsExpanded.value = !topCardsExpanded.value;
}

// canRefreshSearchItem 判断搜索结果中的缓存实例是否允许刷新。
function canRefreshSearchItem(item: SystemCacheApi.SearchItem) {
  return !!item.item?.autoRebuild;
}

// searchModeHint 根据当前搜索条件提示预计走哪条链路，帮助用户提前规避 Redis 扫描慢查询。
const searchModeHint = computed(() => {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    return {
      level: 'default',
      text: $t('business.message.cacheSearchDefaultHint'),
    };
  }
  const targets = splitSearchKeywords(keyword);
  if (targets.some((item) => isDangerousSearchKeyword(item))) {
    return {
      level: 'danger',
      text: $t('business.message.cacheSearchDangerHint'),
    };
  }
  if (targets.length > 1) {
    return {
      level: 'info',
      text: $t('business.message.cacheSearchMultiHint'),
    };
  }
  const current = targets[0] || '';
  if (!isWildcardCacheSearchPattern(current)) {
    return {
      level: 'success',
      text: $t('business.message.cacheSearchExactHint'),
    };
  }
  if (
    cacheSearchProviderPrefixes.some((prefix) => current.startsWith(prefix))
  ) {
    return {
      level: 'success',
      text: $t('business.message.cacheSearchProviderHint'),
    };
  }
  return {
    level: 'danger',
    text: $t('business.message.cacheSearchUnknownWildcardHint'),
  };
});

// searchModeHintClass 返回搜索提示对应的展示样式。
const searchModeHintClass = computed(() => {
  switch (searchModeHint.value.level) {
    case 'danger': {
      return 'text-red-500';
    }
    case 'info': {
      return 'text-blue-500';
    }
    case 'success': {
      return 'text-emerald-500';
    }
    case 'warning': {
      return 'text-orange-500';
    }
    default: {
      return 'text-gray-400';
    }
  }
});
// redisOverviewItems 定义 Redis 概览卡片展示项。
const redisOverviewItems = computed(() => [
  {
    label: $t('business.message.redisVersion'),
    value: getServerInfoValue('Server', 'redis_version'),
  },
  {
    label: $t('business.message.runMode'),
    value: formatRedisMode(),
  },
  {
    label: $t('business.message.nodeRole'),
    value: formatRedisRole(),
  },
  {
    label: $t('business.message.connectionCount'),
    value: getServerInfoValue('Clients', 'connected_clients'),
  },
  {
    label: $t('business.message.databaseCount'),
    value: formatKeyspaceDBCount(),
  },
  {
    label: $t('business.message.memory'),
    value: getServerInfoValue('Memory', 'used_memory_human'),
  },
  {
    label: $t('business.message.hitRate'),
    value: formatHitRateValue(),
  },
  {
    label: $t('business.message.commandsPerSecond'),
    value: getServerInfoValue('Stats', 'instantaneous_ops_per_sec'),
  },
  {
    label: $t('business.message.totalKeys'),
    value: formatKeyspaceValue('keys'),
  },
  {
    label: $t('business.message.expiredKeys'),
    value: formatKeyspaceValue('expires'),
  },
]);

// ================= 模板实例子页面配置 =================
// TemplateKeysDrawerView 用于承载模板缓存命中的真实 Key 子页面。
const [TemplateKeysDrawerView, templateKeysDrawerApi] = useVbenDrawer({
  connectedComponent: TemplateKeysDrawer,
  destroyOnClose: true,
});

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载内置缓存目标列表。
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询内置可刷新缓存目标列表。
        query: async () => {
          return await fetchCacheList();
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'index',
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: true,
      search: false,
      zoom: true,
    },
  },
});

// onMounted 初始加载 Redis 服务信息。
onMounted(() => {
  loadServerInfo();
});

// 监听业务页跳转附带的 query 参数，自动定位指定缓存 key。
watch(
  () => [
    route.query.targets,
    route.query.templateKeys,
    route.query.keyword,
    route.query.autoViewKey,
    route.query.source,
  ],
  () => {
    applyRouteSearchQuery();
  },
  { immediate: true },
);

// onActionClick 处理缓存目标操作列事件。
function onActionClick(e: OnActionClickParams<SystemCacheApi.Item>) {
  switch (e.code) {
    case 'refreshCache': {
      onRenew(e.row.key, e.row.type);
      break;
    }
    case 'viewDetail': {
      onViewKeyInfo(e.row.key);
      break;
    }
    case 'warmupCache': {
      openTemplateWarmupDrawer(e.row);
      break;
    }
  }
}

// openTemplateWarmupDrawer 打开模板缓存实例抽屉，提供缓存预热入口。
function openTemplateWarmupDrawer(row: SystemCacheApi.Item) {
  if (!isTemplateCacheKey(row.key)) {
    message.warning($t('business.message.templateKeyMissingForWarmup'));
    return;
  }
  topCardsExpanded.value = true;
  const pattern = buildTemplateSearchPattern(row.key);
  searchKeyword.value = pattern;
  openTemplateKeysDrawer(pattern, row.key);
}

// loadServerInfo 刷新 Redis 服务信息。
async function loadServerInfo() {
  serverInfo.value = await fetchCacheServerInfo().catch(() => ({}));
}

// normalizeRouteQueryValue 把路由 query 归一化为单个字符串。
function normalizeRouteQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(',');
  }
  return String(value || '').trim();
}

// normalizeRouteQueryTargets 把路由 query 中的目标缓存 key 归一化为数组。
function normalizeRouteQueryTargets(value: unknown) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value.map((item) => String(item || '').trim()).filter(Boolean),
      ),
    ];
  }
  const text = String(value || '').trim();
  return text ? [text] : [];
}

// splitSearchKeywords 把输入框内容拆成多个待查询的缓存 key / pattern。
function splitSearchKeywords(keyword: string) {
  return [
    ...new Set(
      keyword
        .split(/[\n,，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

// isWildcardCacheSearchPattern 判断当前检索条件是否包含通配符。
function isWildcardCacheSearchPattern(keyword: string) {
  return keyword.includes('*') || keyword.includes('?');
}

// runWithConcurrencyLimit 以受控并发执行异步任务，避免串行等待或瞬时并发过高。
async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit = 4,
) {
  const safeLimit = Math.max(1, Math.floor(limit));
  const results: T[] = Array.from({ length: tasks.length });
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]!();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(safeLimit, tasks.length) }, () =>
      runWorker(),
    ),
  );
  return results;
}

// buildEmptyCacheSearchResp 构造空分页搜索结果，统一处理参数为空或部分搜索失败的降级场景。
function buildEmptyCacheSearchResp(
  page = searchPage.value,
  pageSize = searchPageSize.value,
): SystemCacheApi.SearchResp {
  return {
    hasMore: false,
    list: [],
    page,
    pageSize,
    total: 0,
  };
}

// applyCacheSearchResp 把后端分页搜索结果同步到页面状态。
function applyCacheSearchResp(resp: SystemCacheApi.SearchResp) {
  searchResult.value = resp.list || [];
  searchPage.value = resp.page || 1;
  searchPageSize.value = resp.pageSize || searchPageSize.value;
  searchTotal.value = Number(resp.total || 0);
  searchHasMore.value = !!resp.hasMore;
  searchLimited.value = !!resp.limited;
}

// buildCurrentCacheSearchResp 把主页面当前分页状态打包给模板抽屉，避免打开抽屉后重复请求同一页。
function buildCurrentCacheSearchResp(): SystemCacheApi.SearchResp {
  return {
    hasMore: searchHasMore.value,
    list: searchResult.value,
    page: searchPage.value,
    pageSize: searchPageSize.value,
    total: searchTotal.value,
    limited: searchLimited.value,
  };
}

// isPatternSearchTarget 判断当前检索条件是否依赖通配或模板展开。
// 业务页若已明确给出真实缓存 key，就可以直接走详情接口，避免额外依赖搜索权限。
function isPatternSearchTarget(keyword: string) {
  const currentKeyword = String(keyword || '').trim();
  return (
    isTemplateSearchKeyword(currentKeyword) ||
    isTemplateCacheKey(currentKeyword)
  );
}

// isValidSearchKeyword 判断单个缓存检索条件是否满足最小字符要求。
function isValidSearchKeyword(keyword: string) {
  return keyword.replaceAll('*', '').replaceAll('?', '').length >= 3;
}

// isDangerousSearchKeyword 判断当前搜索词是否属于危险的前导通配模式。
// 这类模式会放大 Redis 全库扫描成本，页面侧直接拦截，避免用户误操作。
function isDangerousSearchKeyword(keyword: string) {
  const currentKeyword = String(keyword || '').trim();
  return currentKeyword.startsWith('*') || currentKeyword.startsWith('?');
}

// loadExactKeyTargets 逐个读取精确缓存 key 的元信息，供业务页跳转时直接定位已知实例。
async function loadExactKeyTargets(targets: string[]) {
  const resultMap = new Map<string, SystemCacheApi.SearchItem>();
  const failedTargets: string[] = [];
  await runWithConcurrencyLimit(
    targets.map((target) => async () => {
      try {
        const info = await fetchSearchCacheKeyInfo(target);
        resultMap.set(target, {
          item: info.item,
          key: target,
        });
      } catch {
        failedTargets.push(target);
      }
    }),
  );
  if (failedTargets.length > 0 && resultMap.size > 0) {
    message.warning(
      $t('business.message.cacheExactTargetsIgnored', [failedTargets.length]),
    );
  }
  return [...resultMap.values()].toSorted((left, right) =>
    left.key.localeCompare(right.key),
  );
}

// searchCacheKeywordTargets 支持对多个精确 key / 模板模式做合并检索。
async function searchCacheKeywordTargets(
  keyword: string,
  source = 'manual_search',
  page = 1,
  pageSize = searchPageSize.value,
) {
  const targets = splitSearchKeywords(keyword);
  if (targets.length === 0) {
    return buildEmptyCacheSearchResp(page, pageSize);
  }
  const resultMap = new Map<string, SystemCacheApi.SearchItem>();
  const failedTargets: string[] = [];
  let total = 0;
  let hasMore = false;
  let limited = false;
  const perTargetPageSize = Math.max(1, Math.floor(pageSize / targets.length));
  await runWithConcurrencyLimit(
    targets.map((target) => async () => {
      const currentResp = await searchCacheKeys({
        key: target,
        page,
        pageSize: perTargetPageSize,
        source,
      }).catch(() => {
        failedTargets.push(target);
        return buildEmptyCacheSearchResp(page, perTargetPageSize);
      });
      total += Number(currentResp.total || 0);
      hasMore = hasMore || !!currentResp.hasMore;
      limited = limited || !!currentResp.limited;
      for (const item of currentResp.list || []) {
        resultMap.set(item.key, item);
      }
    }),
  );
  if (failedTargets.length > 0 && resultMap.size > 0) {
    message.warning(
      $t('business.message.cacheSearchTargetsIgnored', [failedTargets.length]),
    );
  }
  return {
    hasMore,
    list: [...resultMap.values()].toSorted((left, right) =>
      left.key.localeCompare(right.key),
    ),
    page,
    pageSize,
    total,
    limited,
  } satisfies SystemCacheApi.SearchResp;
}

// applyRouteSearchQuery 根据路由参数自动搜索来源页面定位的缓存 key，并在单 key 场景下直接打开详情。
async function applyRouteSearchQuery() {
  const targetKeys = normalizeRouteQueryTargets(route.query.targets);
  const templateKeys = normalizeRouteQueryTargets(route.query.templateKeys);
  const keyword = normalizeRouteQueryValue(route.query.keyword);
  const autoViewKey = normalizeRouteQueryValue(route.query.autoViewKey);
  const source = normalizeRouteQueryValue(route.query.source);
  const effectiveKeyword =
    targetKeys.length > 0 ? targetKeys.join(',') : keyword;
  if (!effectiveKeyword) {
    routeSearchSource.value = '';
    routeSearchTemplateKeys.value = [];
    lastAppliedRouteSearchSignature.value = '';
    return;
  }
  const signature = `${effectiveKeyword}|${templateKeys.join('|')}|${autoViewKey}|${source}`;
  if (signature === lastAppliedRouteSearchSignature.value) {
    return;
  }
  const targets =
    targetKeys.length > 0 ? targetKeys : splitSearchKeywords(effectiveKeyword);
  if (targets.some((item) => !isValidSearchKeyword(item))) {
    message.warning($t('business.message.cacheLocatorInvalid'));
    lastAppliedRouteSearchSignature.value = signature;
    return;
  }
  topCardsExpanded.value = true;
  routeSearchSource.value = source;
  routeSearchTemplateKeys.value = templateKeys;
  searchKeyword.value = effectiveKeyword;
  const shouldUseExactKeyLookup =
    targets.length > 0 && targets.every((item) => !isPatternSearchTarget(item));
  if (shouldUseExactKeyLookup) {
    const exactItems = await loadExactKeyTargets(targets);
    applyCacheSearchResp({
      hasMore: false,
      list: exactItems,
      page: 1,
      pageSize:
        exactItems.length > 0 ? exactItems.length : searchPageSize.value,
      total: exactItems.length,
    });
  } else {
    applyCacheSearchResp(
      await searchCacheKeywordTargets(
        effectiveKeyword,
        'route_jump',
        1,
        searchPageSize.value,
      ),
    );
  }
  lastAppliedRouteSearchSignature.value = signature;
  if (searchResult.value.length === 0) {
    message.warning(
      source
        ? $t('business.message.cacheRouteSearchNoMatchFromSource', [source])
        : $t('business.message.cacheRouteSearchNoMatch'),
    );
    return;
  }
  if (
    autoViewKey &&
    searchResult.value.some((item) => item.key === autoViewKey)
  ) {
    await onViewSearchKeyInfo(autoViewKey);
    return;
  }
  if (!autoViewKey && searchResult.value.length === 1) {
    await onViewSearchKeyInfo(searchResult.value[0]!.key);
  }
}

// openTemplateKeysDrawer 打开模板缓存实例子页面。
function openTemplateKeysDrawer(
  keyword: string,
  sourceKey?: string,
  initialResult?: SystemCacheApi.SearchItem[],
  initialSearchResp?: SystemCacheApi.SearchResp,
) {
  templateKeysDrawerApi
    .setData({
      initialResult,
      initialSearchResp,
      keyword,
      sourceKey,
    })
    .open();
}

// locateTemplateCacheKeys 遇到模板键时自动切换到搜索模式，帮助用户定位真实缓存 key。
async function locateTemplateCacheKeys(
  key: string,
  action: 'refresh' | 'view',
) {
  topCardsExpanded.value = true;
  const pattern = buildTemplateSearchPattern(key);
  searchKeyword.value = pattern;
  applyCacheSearchResp(
    await searchCacheKeys({
      key: pattern,
      page: 1,
      pageSize: searchPageSize.value,
      source: 'template_locate',
    }),
  );
  if (searchResult.value.length === 0) {
    openTemplateKeysDrawer(
      pattern,
      key,
      [],
      buildEmptyCacheSearchResp(1, searchPageSize.value),
    );
    message.warning(
      $t('business.message.templateCacheNoRealKeyFound', [pattern]),
    );
    return false;
  }
  if (action === 'view' && searchResult.value.length === 1) {
    const matchedKey = searchResult.value[0]?.key;
    if (matchedKey) {
      await onViewSearchKeyInfo(matchedKey);
    }
    return false;
  }
  if (action === 'refresh' && searchResult.value.length === 1) {
    const matchedKey = searchResult.value[0]?.key;
    if (matchedKey) {
      await renewCache(matchedKey);
      message.success($t('business.message.realCacheRefreshed', [matchedKey]));
      reloadCachePage();
    }
    return false;
  }
  openTemplateKeysDrawer(
    pattern,
    key,
    searchResult.value,
    buildCurrentCacheSearchResp(),
  );
  message.info(
    $t('business.message.templateCacheDrawerOpened', [
      searchResult.value.length,
      action === 'refresh'
        ? $t('business.message.refresh')
        : $t('business.message.viewDetail'),
    ]),
  );
  return false;
}

// getServerInfoValue 从 Redis INFO 分段数据中读取指定值。
function getServerInfoValue(section: string, field: string) {
  return formatInfoValue(serverInfo.value?.[section]?.[field]);
}

// getServerInfoNumber 读取 Redis INFO 数值字段，非法或缺失时返回 null。
function getServerInfoNumber(section: string, field: string) {
  const rawValue = serverInfo.value?.[section]?.[field];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

// getKeyspaceMetric 解析 Keyspace 下 `db0:keys=1,expires=1` 这类统计字段。
function getKeyspaceMetric(metric: string) {
  const keyspace = serverInfo.value?.Keyspace || {};
  let total = 0;
  let matched = false;
  for (const sectionValue of Object.values(keyspace)) {
    if (!sectionValue) {
      continue;
    }
    for (const item of String(sectionValue).split(',')) {
      const [key, value] = item.split('=');
      if (key?.trim() !== metric) {
        continue;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      total += parsed;
      matched = true;
    }
  }
  return matched ? total : null;
}

// formatKeyspaceValue 统一展示 Redis Keyspace 聚合统计值。
function formatKeyspaceValue(metric: string) {
  const value = getKeyspaceMetric(metric);
  return value === null ? '-' : String(value);
}

// formatHitRateValue 计算 Redis 当前命中率。
function formatHitRateValue() {
  const hits = getServerInfoNumber('Stats', 'keyspace_hits');
  const misses = getServerInfoNumber('Stats', 'keyspace_misses');
  if (hits === null || misses === null) {
    return '-';
  }
  const total = hits + misses;
  if (total <= 0) {
    return '-';
  }
  return `${((hits / total) * 100).toFixed(2)}%`;
}

// formatRedisMode 统一格式化 Redis 当前运行模式。
function formatRedisMode() {
  const serverMode = String(serverInfo.value?.Server?.redis_mode || '')
    .trim()
    .toLowerCase();
  if (serverMode === 'cluster') {
    return $t('business.message.redisCluster');
  }
  const clusterEnabled = String(
    serverInfo.value?.Cluster?.cluster_enabled || '',
  ).trim();
  if (clusterEnabled === '1') {
    return $t('business.message.redisCluster');
  }
  if (serverMode === 'standalone') {
    return $t('business.message.redisStandalone');
  }
  return $t('business.message.redisStandalone');
}

// formatRedisRole 统一格式化当前节点角色。
function formatRedisRole() {
  const role = String(serverInfo.value?.Replication?.role || '')
    .trim()
    .toLowerCase();
  switch (role) {
    case 'master': {
      return $t('business.message.redisMaster');
    }
    case 'replica':
    case 'slave': {
      return $t('business.message.redisReplica');
    }
    default: {
      return '-';
    }
  }
}

// formatKeyspaceDBCount 统计当前 Redis 已使用数据库数量。
function formatKeyspaceDBCount() {
  const count = Object.keys(serverInfo.value?.Keyspace || {}).length;
  return count > 0 ? String(count) : '-';
}

// reloadCachePage 统一刷新页面中的缓存目标列表与 Redis 概览。
function reloadCachePage() {
  gridApi.query();
  loadServerInfo();
}

// onViewKeyInfo 查看 Redis Key 详情。
async function onViewKeyInfo(key: string) {
  if (isTemplateCacheKey(key)) {
    await locateTemplateCacheKeys(key, 'view');
    return;
  }
  const info = await fetchCacheKeyInfo(key).catch((error) => {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.cacheDetailViewFailed',
      ),
    );
    throw error;
  });
  showCacheInfoModal($t('business.message.cacheDetailTitle', [key]), info);
}

// loadCacheSearchPage 按当前关键字加载指定分页，避免一次性拉取过多真实 Key。
async function loadCacheSearchPage(page = 1) {
  topCardsExpanded.value = true;
  const keyword = searchKeyword.value.trim();
  const targets = splitSearchKeywords(keyword);
  if (
    targets.length === 0 ||
    targets.some((item) => !isValidSearchKeyword(item))
  ) {
    message.warning($t('business.message.nonWildcardCharsRequired'));
    return;
  }
  if (targets.some((item) => isDangerousSearchKeyword(item))) {
    message.warning($t('business.message.cacheSearchLeadingWildcardForbidden'));
    return;
  }
  routeSearchSource.value = '';
  routeSearchTemplateKeys.value = [];
  searchLoading.value = true;
  try {
    applyCacheSearchResp(
      await searchCacheKeywordTargets(
        keyword,
        'manual_search',
        page,
        searchPageSize.value,
      ),
    );
  } finally {
    searchLoading.value = false;
  }
  if (hasTemplateSearchResult.value) {
    message.info(
      $t('business.message.templateRealKeysFound', [searchResult.value.length]),
    );
  }
}

// onSearchKeys 搜索 Redis Key。
async function onSearchKeys() {
  await loadCacheSearchPage(1);
}

// onSearchPageChange 处理搜索结果分页变化。
async function onSearchPageChange(page: number, pageSize: number) {
  searchPageSize.value = pageSize;
  await loadCacheSearchPage(page);
}

// onViewSearchKeyInfo 查看搜索结果中的 Redis Key 详情。
async function onViewSearchKeyInfo(key: string) {
  const info = await fetchSearchCacheKeyInfo(key).catch((error) => {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.cacheDetailViewFailed',
      ),
    );
    throw error;
  });
  showCacheInfoModal($t('business.message.cacheDetailTitle', [key]), info);
}

// onCopySearchKey 复制搜索结果中的单个缓存 Key，便于外部 Redis 客户端或日志系统继续排查。
async function onCopySearchKey(key: string) {
  await copyTextToClipboard(
    key,
    $t('business.message.cacheKeyCopied'),
    $t('business.message.noCacheKeyToCopy'),
  );
}

// onRenew 刷新指定缓存。
function onRenew(key: string, type?: string) {
  Modal.confirm({
    content: $t('business.message.confirmRenewCache', [key]),
    onOk: async () => {
      if (isTemplateCacheKey(key)) {
        await locateTemplateCacheKeys(key, 'refresh');
        return;
      }
      await renewCache(key, type);
      message.success($t('business.message.cacheRefreshed'));
      reloadCachePage();
    },
    title: $t('business.message.refreshCache'),
  });
}

// onRenewAll 刷新全部内置缓存。
function onRenewAll() {
  Modal.confirm({
    cancelText: $t('business.message.cancel'),
    content: h('div', { class: 'space-y-3' }, [
      h(
        'div',
        { class: 'font-medium text-red-500' },
        $t('business.message.cacheRenewAllDangerTitle'),
      ),
      h('div', $t('business.message.cacheRenewAllDangerDesc')),
      h(
        'div',
        { class: 'text-orange-500' },
        $t('business.message.cacheRenewAllAdvice'),
      ),
    ]),
    okButtonProps: {
      danger: true,
    },
    okText: $t('business.message.cacheRenewAllConfirm'),
    onOk: async () => {
      await renewAllCache();
      message.success($t('business.message.allCachesRefreshed'));
      reloadCachePage();
    },
    title: $t('business.message.cacheRenewAllModalTitle'),
  });
}
</script>

<template>
  <Page auto-content-height>
    <TemplateKeysDrawerView @refreshed="reloadCachePage" />
    <div
      class="mb-2 grid gap-2 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]"
    >
      <Card size="small" :title="$t('business.message.redisOverview')">
        <template #extra>
          <Space :size="8">
            <Button type="text" @click="loadServerInfo">
              <ReloadOutlined />
            </Button>
            <Button type="text" @click="toggleTopCards">
              <component :is="TopCardToggleIcon" />
            </Button>
          </Space>
        </template>
        <div :class="topCardBodyClass" class="overflow-auto pr-1">
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in redisOverviewItems"
              :key="item.label"
              class="rounded border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div class="text-xs text-gray-500">
                {{ item.label }}
              </div>
              <div class="mt-2 text-lg font-semibold leading-none">
                {{ item.value }}
              </div>
            </div>
          </div>
          <div class="mt-3 text-xs text-gray-400">
            {{ $t('business.message.redisOverviewDesc') }}
          </div>
        </div>
      </Card>
      <Card
        size="small"
        :title="$t('business.message.cacheKeySearch')"
        class="min-w-0"
      >
        <template #extra>
          <Button type="text" @click="toggleTopCards">
            <component :is="TopCardToggleIcon" />
          </Button>
        </template>
        <div
          :class="topCardBodyClass"
          class="flex min-h-0 min-w-0 flex-col pr-1"
        >
          <div
            class="mb-3 grid shrink-0 gap-2 xl:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Input
              v-model:value="searchKeyword"
              class="w-full min-w-0"
              :placeholder="$t('business.message.cacheSearchPlaceholder')"
              @press-enter="onSearchKeys"
            />
            <div class="flex flex-wrap items-center gap-2 xl:justify-end">
              <VbenButton
                v-access="
                  asActionPermission(
                    SYSTEM_ACTION_PERMISSION_CODES.CACHE_SEARCH,
                  )
                "
                :loading="searchLoading"
                type="primary"
                @click="onSearchKeys"
              >
                {{ $t('business.message.searchKey') }}
              </VbenButton>
              <VbenButton
                v-if="hasTemplateSearchResult"
                @click="
                  openTemplateKeysDrawer(
                    searchKeyword.trim(),
                    undefined,
                    searchResult,
                    buildCurrentCacheSearchResp(),
                  )
                "
              >
                {{ $t('business.message.viewAllKeysInSubPage') }}
              </VbenButton>
            </div>
          </div>
          <div class="mb-3 shrink-0 text-xs" :class="searchModeHintClass">
            {{ searchModeHint.text }}
          </div>
          <div class="min-h-0 min-w-0 flex-1 overflow-auto">
            <div v-if="routeSearchSource" class="mb-2 text-xs text-blue-500">
              {{
                $t('business.message.routeSearchSourceHint', [
                  routeSearchSource,
                ])
              }}
            </div>
            <div
              v-if="routeSearchTemplateKeys.length > 0"
              class="mb-2 text-xs text-purple-500"
            >
              {{
                $t('business.message.routeTemplateKeysHint', [
                  routeSearchTemplateKeys.join('，'),
                ])
              }}
            </div>
            <div
              v-if="searchResultSummaryText"
              class="mb-2 text-xs text-gray-400"
            >
              {{ searchResultSummaryText }}
            </div>
            <div
              v-for="item in searchResult"
              :key="item.key"
              class="mb-2 min-w-0 rounded border border-dashed border-gray-200 p-2 dark:border-gray-700"
            >
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <Tag
                  class="cursor-pointer"
                  color="blue"
                  @click="onViewSearchKeyInfo(item.key)"
                >
                  {{ item.key }}
                </Tag>
                <Tag v-if="item.item?.category" color="processing">
                  {{ formatCacheCategory(item.item.category) }}
                </Tag>
                <Tag v-if="item.item?.isTemplate" color="purple">
                  {{ $t('business.message.templateInstance') }}
                </Tag>
                <Tag v-if="item.item?.autoRebuild" color="success">
                  {{ $t('business.message.autoRebuildSupported') }}
                </Tag>
                <Tag v-if="item.item?.refreshScope">
                  {{ formatRefreshScope(item.item.refreshScope) }}
                </Tag>
              </div>
              <div class="mb-2 text-xs text-gray-500">
                {{
                  item.item?.remark ||
                  $t('business.message.nonBuiltInCacheReadonly')
                }}
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <VbenButton
                  v-access="
                    asActionPermission(
                      SYSTEM_ACTION_PERMISSION_CODES.CACHE_KEY_INFO,
                    )
                  "
                  @click="onViewSearchKeyInfo(item.key)"
                >
                  {{ $t('business.message.viewDetail') }}
                </VbenButton>
                <Tag v-if="!canRefreshSearchItem(item)" color="error">
                  {{ $t('business.message.onlyRefreshableBuiltInCache') }}
                </Tag>
                <VbenButton
                  v-if="canRefreshSearchItem(item)"
                  v-access="
                    asActionPermission(
                      SYSTEM_ACTION_PERMISSION_CODES.CACHE_RENEW,
                    )
                  "
                  type="primary"
                  @click="onRenew(item.key)"
                >
                  {{ $t('business.message.refreshCache') }}
                </VbenButton>
                <VbenButton @click="onCopySearchKey(item.key)">
                  {{ $t('business.message.copyKey') }}
                </VbenButton>
              </div>
            </div>
            <div
              v-if="searchResult.length === 0"
              class="py-6 text-center text-xs text-gray-400"
            >
              {{
                searchLoading
                  ? $t('business.message.cacheKeyLoading')
                  : $t('business.message.noSearchResult')
              }}
            </div>
            <div
              v-if="searchTotal > searchPageSize || searchHasMore"
              class="sticky bottom-0 mt-2 border-t border-gray-100 bg-white/95 pt-2 dark:border-gray-800 dark:bg-gray-950/95"
            >
              <Pagination
                :current="searchPage"
                :page-size="searchPageSize"
                :page-size-options="['10', '20', '50']"
                :show-total="
                  (total) => $t('business.message.realKeyTotal', [total])
                "
                :total="searchTotal"
                show-size-changer
                size="small"
                @change="onSearchPageChange"
                @show-size-change="onSearchPageChange"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
    <Grid :table-title="$t('business.message.cacheManagement')">
      <template #toolbar-tools>
        <VbenButton
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_RENEW_ALL)
          "
          type="primary"
          @click="onRenewAll"
        >
          {{ $t('business.message.refreshAllBuiltInCache') }}
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
