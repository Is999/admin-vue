<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { SystemCacheApi } from '#/api/system';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, VbenButton } from '@vben/common-ui';

import {
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  fetchSearchCacheKeyInfo,
  renewCache,
  searchCacheKeys,
  warmupCacheTemplate,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { downloadBlobFile } from '#/utils/file/download';
import { copyTextToClipboard } from '#/utils/security/password';

import { resolveBackendMessage } from '../../shared';
import {
  formatCacheCategory,
  formatRefreshScope,
  formatTTLValue,
  isTemplateCacheKey,
  isTemplateSearchKeyword,
  showCacheInfoModal,
} from '../helper';

// TemplateKeyDrawerData 定义模板缓存实例抽屉打开时传入的数据。
interface TemplateKeyDrawerData {
  initialResult?: SystemCacheApi.SearchItem[];
  initialSearchResp?: SystemCacheApi.SearchResp;
  keyword?: string;
  sourceKey?: string;
  warmupSupported?: boolean;
}

// emit 向父级回传刷新事件，便于联动主页面。
const emit = defineEmits<{ refreshed: [] }>();

// loading 表示当前是否正在加载模板缓存实例列表。
const loading = ref(false);
// keyword 保存当前模板缓存搜索模式。
const keyword = ref('');
// keyFilter 保存真实缓存 Key 的二次筛选条件。
const keyFilter = ref('');
// sourceKey 保存触发模板实例搜索的模板键定义。
const sourceKey = ref('');
// warmupSupported 表示当前来源模板是否属于后端安全预热白名单。
const warmupSupported = ref(false);
// searchResult 保存当前模板实例搜索命中的真实缓存键列表。
const searchResult = ref<SystemCacheApi.SearchItem[]>([]);
// searchPage 保存模板实例当前页码。
const searchPage = ref(1);
// searchPageSize 保存模板实例每页数量，避免抽屉一次性渲染过多 Key。
const searchPageSize = ref(20);
// searchTotal 保存模板实例已确认真实 Key 总数。
const searchTotal = ref(0);
// searchHasMore 表示模板实例是否还有下一页。
const searchHasMore = ref(false);
// searchLimited 表示后端是否触发模板搜索窗口保护。
const searchLimited = ref(false);
// batchRefreshing 表示是否正在批量刷新当前搜索结果。
const batchRefreshing = ref(false);
// ttlInspecting 表示是否正在批量读取当前筛选结果的 TTL。
const ttlInspecting = ref(false);
// warmupLoading 表示是否正在执行模板预热。
const warmupLoading = ref(false);
// warmupLimit 表示模板预热数量上限，0 表示不限制（由后端安全阈值兜底）。
const warmupLimit = ref(0);

// runWithConcurrencyLimit 以受控并发执行异步任务，避免批量 TTL 查看时瞬时打满详情接口。
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

// filteredSearchResult 返回按真实 Key 二次筛选后的当前结果集。
const filteredSearchResult = computed(() => {
  const filterText = keyFilter.value.trim();
  if (!filterText) {
    return searchResult.value;
  }
  return searchResult.value.filter((item) => item.key.includes(filterText));
});

// refreshableSearchResult 返回当前筛选结果中允许执行刷新操作的内置缓存实例。
const refreshableSearchResult = computed(() =>
  filteredSearchResult.value.filter((item) => !!item.item?.autoRebuild),
);

// summaryText 统一展示当前模式、总量和筛选后的数量。
const summaryText = computed(() => {
  const patternText = keyword.value || '-';
  const limitedText = searchLimited.value
    ? $t('business.message.cacheSearchLimitedSuffix')
    : '';
  return $t('business.message.templateCacheSearchSummary', [
    patternText,
    searchPage.value,
    filteredSearchResult.value.length,
    searchTotal.value,
    refreshableSearchResult.value.length,
    limitedText,
  ]);
});

// [Drawer, drawerApi] 创建模板缓存实例列表抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<TemplateKeyDrawerData>() || {};
    keyword.value = data.keyword || '';
    keyFilter.value = '';
    sourceKey.value = data.sourceKey || '';
    warmupSupported.value = data.warmupSupported === true;
    if (data.initialSearchResp) {
      applySearchResp(data.initialSearchResp);
    } else {
      searchResult.value = data.initialResult || [];
      searchPage.value = 1;
      searchTotal.value = searchResult.value.length;
      searchHasMore.value = false;
      searchLimited.value = false;
    }
    if (keyword.value && searchResult.value.length === 0) {
      await loadSearchResult();
    }
  },
  showConfirmButton: false,
  title: $t('business.message.templateCacheInstanceKeys'),
});

// applySearchResp 把后端分页搜索结果同步到抽屉状态。
function applySearchResp(resp: SystemCacheApi.SearchResp) {
  searchResult.value = resp.list || [];
  searchPage.value = resp.page || 1;
  searchPageSize.value = resp.pageSize || searchPageSize.value;
  searchTotal.value = Number(resp.total || 0);
  searchHasMore.value = !!resp.hasMore;
  searchLimited.value = !!resp.limited;
}

// loadSearchResult 重新拉取模板缓存实例列表。
async function loadSearchResult(page = 1) {
  const currentKeyword = keyword.value.trim();
  if (!currentKeyword) {
    message.warning($t('business.message.templateCacheSearchPatternRequired'));
    return;
  }
  loading.value = true;
  try {
    applySearchResp(
      await searchCacheKeys({
        key: currentKeyword,
        page,
        pageSize: searchPageSize.value,
        source: 'template_drawer',
      }),
    );
  } catch (error: any) {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.templateCacheQueryFailed',
      ),
    );
  } finally {
    loading.value = false;
  }
}

// onSearchPageChange 处理模板实例分页变化。
async function onSearchPageChange(page: number, pageSize: number) {
  searchPageSize.value = pageSize;
  await loadSearchResult(page);
}

// onViewKeyInfo 查看模板实例真实缓存值。
async function onViewKeyInfo(key: string) {
  try {
    const info = await fetchSearchCacheKeyInfo(key);
    showCacheInfoModal($t('business.message.cacheDetailTitle', [key]), info);
  } catch (error: any) {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.cacheDetailViewFailed',
      ),
    );
  }
}

// onRenewKey 刷新单个模板实例缓存。
function onRenewKey(key: string) {
  Modal.confirm({
    content: $t('business.message.confirmRenewRealCache', [key]),
    onOk: async () => {
      await renewCache(key);
      message.success(
        $t('business.message.cacheRefreshSucceededWithKey', [key]),
      );
      emit('refreshed');
      await loadSearchResult(searchPage.value);
    },
    title: $t('business.message.refreshCache'),
  });
}

// onBatchRenewKeys 批量刷新当前搜索结果中的全部真实 Key。
function onBatchRenewKeys() {
  const currentItems = refreshableSearchResult.value;
  if (currentItems.length === 0) {
    message.warning($t('business.message.noBuiltInCacheKeysRefresh'));
    return;
  }
  Modal.confirm({
    content: $t('business.message.confirmBatchRenewSearchCaches', [
      currentItems.length,
    ]),
    onOk: async () => {
      batchRefreshing.value = true;
      let successCount = 0;
      const failedKeys: string[] = [];
      try {
        // 批量刷新按顺序执行，避免瞬时并发回源过高影响在线 Redis 与数据库。
        for (const item of currentItems) {
          try {
            await renewCache(item.key);
            successCount += 1;
          } catch {
            failedKeys.push(item.key);
          }
        }
        emit('refreshed');
        await loadSearchResult(searchPage.value);
        if (failedKeys.length > 0) {
          message.warning(
            $t('business.message.batchRefreshPartial', [
              successCount,
              failedKeys.length,
            ]),
          );
          return;
        }
        message.success(
          $t('business.message.batchRefreshSucceeded', [successCount]),
        );
      } finally {
        batchRefreshing.value = false;
      }
    },
    title: $t('business.message.batchRefreshCurrentSearch'),
  });
}

// onCopyFilteredKeys 一键复制当前筛选后的真实缓存 Key 列表。
async function onCopyFilteredKeys() {
  const keys = filteredSearchResult.value
    .map((item) => item.key)
    .filter(Boolean);
  await copyTextToClipboard(
    keys.join('\n'),
    $t('business.message.realCacheKeysCopied', [keys.length]),
    $t('business.message.noRealCacheKeysToCopy'),
  );
}

// onCopySingleKey 复制单个真实缓存 Key，便于到 Redis 客户端或日志系统继续排查。
async function onCopySingleKey(key: string) {
  await copyTextToClipboard(
    key,
    $t('business.message.cacheKeyCopied'),
    $t('business.message.noCacheKeyToCopy'),
  );
}

// onExportFilteredKeys 把当前筛选后的真实缓存 Key 导出为文本文件，便于离线排查。
function onExportFilteredKeys() {
  const keys = filteredSearchResult.value
    .map((item) => item.key)
    .filter(Boolean);
  if (keys.length === 0) {
    message.warning($t('business.message.noRealCacheKeysExport'));
    return;
  }
  const content = `${keys.join('\n')}\n`;
  downloadBlobFile(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
    `cache_keys_${Date.now()}.txt`,
  );
  message.success($t('business.message.realCacheKeysExported', [keys.length]));
}

// loadTTLRows 并发读取当前筛选结果的 TTL，供批量排查缓存实例时序使用。
async function loadTTLRows() {
  const rows = await runWithConcurrencyLimit(
    filteredSearchResult.value.map((item) => async () => {
      try {
        const info = await fetchSearchCacheKeyInfo(item.key);
        return {
          key: item.key,
          ttl: formatTTLValue(info.ttl),
          type: info.type || '-',
        };
      } catch {
        return {
          key: item.key,
          ttl: $t('business.message.readFailed'),
          type: '-',
        };
      }
    }),
  );
  return rows.toSorted((left, right) => left.key.localeCompare(right.key));
}

// onInspectFilteredTTLs 批量查看当前筛选结果的 TTL 和类型，便于发现过期策略异常。
async function onInspectFilteredTTLs() {
  if (filteredSearchResult.value.length === 0) {
    message.warning($t('business.message.noRealCacheKeysTtl'));
    return;
  }
  ttlInspecting.value = true;
  try {
    const rows = await loadTTLRows();
    Modal.info({
      content: h('div', { class: 'space-y-3' }, [
        h(
          'div',
          { class: 'text-xs text-gray-500' },
          $t('business.message.ttlOverviewCount', [rows.length]),
        ),
        h(
          'pre',
          {
            class:
              'max-h-[520px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
          },
          rows.map((row) => `${row.ttl} | ${row.type} | ${row.key}`).join('\n'),
        ),
      ]),
      title: $t('business.message.currentResultTtlOverview'),
      width: 920,
    });
  } finally {
    ttlInspecting.value = false;
  }
}

// clearKeyFilter 清空真实 Key 二次筛选条件。
function clearKeyFilter() {
  keyFilter.value = '';
}

// canUseTemplateModeHint 判断当前是否需要展示模板搜索提示。
const canUseTemplateModeHint = computed(() =>
  isTemplateSearchKeyword(keyword.value),
);

// canWarmupTemplateKey 判断当前是否具备模板预热的上下文。
// 只有来源模板属于后端白名单时，才允许执行“从无到有”的预热。
const canWarmupTemplateKey = computed(
  () => isTemplateCacheKey(sourceKey.value) && warmupSupported.value,
);

// canRefreshItem 判断当前真实缓存实例是否允许执行刷新。
function canRefreshItem(item: SystemCacheApi.SearchItem) {
  return !!item.item?.autoRebuild;
}

// onWarmupTemplateKey 按模板键枚举全部实例并批量预热。
// 预热成功后，会自动刷新当前列表，便于立即看到真实缓存 key。
function onWarmupTemplateKey() {
  const templateKey = sourceKey.value.trim();
  if (!templateKey) {
    message.warning($t('business.message.templateKeyMissingForWarmup'));
    return;
  }
  Modal.confirm({
    content: $t('business.message.confirmWarmupTemplateCache'),
    onOk: async () => {
      warmupLoading.value = true;
      try {
        const limitValue = Number(warmupLimit.value) || 0;
        const resp = await warmupCacheTemplate(
          templateKey,
          limitValue > 0 ? limitValue : undefined,
        );
        if (resp.failed > 0) {
          message.warning(
            $t('business.message.templateWarmupPartial', [
              resp.success,
              resp.failed,
              resp.latencyMs,
            ]),
          );
        } else {
          message.success(
            $t('business.message.templateWarmupSucceeded', [
              resp.success,
              resp.latencyMs,
            ]),
          );
        }
        emit('refreshed');
        await loadSearchResult(1);
      } catch (error: any) {
        message.error(
          resolveBackendMessage(
            error?.message,
            'business.message.templateWarmupFailed',
          ),
        );
      } finally {
        warmupLoading.value = false;
      }
    },
    title: $t('business.message.templateWarmup'),
  });
}
</script>

<template>
  <Drawer class="w-[920px]">
    <div class="space-y-4">
      <div
        class="rounded border border-dashed border-blue-200 bg-blue-50 p-3 text-xs text-gray-600 dark:border-blue-700 dark:bg-blue-950/20"
      >
        <div>{{ summaryText }}</div>
        <div v-if="sourceKey" class="mt-1">
          {{ $t('business.message.sourceTemplateKey', [sourceKey]) }}
        </div>
        <div v-if="canUseTemplateModeHint" class="mt-1">
          {{ $t('business.message.templateKeyDrawerDesc') }}
        </div>
      </div>
      <Space class="w-full" wrap>
        <Input
          v-model:value="keyword"
          class="w-[360px]"
          :placeholder="$t('business.message.templateCacheSearchPlaceholder')"
          @press-enter="() => loadSearchResult(1)"
        />
        <VbenButton
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_SEARCH)
          "
          :loading="loading"
          type="primary"
          @click="() => loadSearchResult(1)"
        >
          {{ $t('business.message.refreshList') }}
        </VbenButton>
        <Input
          v-model:value="keyFilter"
          class="w-[280px]"
          :placeholder="$t('business.message.realKeyFilterPlaceholder')"
        />
        <VbenButton :disabled="!keyFilter.trim()" @click="clearKeyFilter">
          {{ $t('business.message.clearFilter') }}
        </VbenButton>
        <VbenButton
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_RENEW)
          "
          :disabled="refreshableSearchResult.length === 0"
          :loading="batchRefreshing"
          danger
          @click="onBatchRenewKeys"
        >
          {{ $t('business.message.batchRefreshCurrentResult') }}
        </VbenButton>
        <InputNumber
          v-model:value="warmupLimit"
          :min="0"
          class="w-[120px]"
          :placeholder="$t('business.message.warmupLimit')"
          size="small"
        />
        <VbenButton
          v-if="canWarmupTemplateKey"
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_WARMUP)
          "
          :loading="warmupLoading"
          danger
          @click="onWarmupTemplateKey"
        >
          {{ $t('business.message.warmupByTemplate') }}
        </VbenButton>
        <VbenButton
          :disabled="filteredSearchResult.length === 0"
          @click="onCopyFilteredKeys"
        >
          {{ $t('business.message.copyCurrentResultKey') }}
        </VbenButton>
        <VbenButton
          :disabled="filteredSearchResult.length === 0"
          @click="onExportFilteredKeys"
        >
          {{ $t('business.message.exportCurrentResultKey') }}
        </VbenButton>
        <VbenButton
          :disabled="filteredSearchResult.length === 0"
          :loading="ttlInspecting"
          @click="onInspectFilteredTTLs"
        >
          {{ $t('business.message.inspectCurrentResultTtl') }}
        </VbenButton>
      </Space>
      <div
        v-if="filteredSearchResult.length > 0"
        class="max-h-[620px] overflow-auto pr-1"
      >
        <div
          v-for="item in filteredSearchResult"
          :key="item.key"
          class="mb-3 rounded border border-dashed border-gray-200 p-3 dark:border-gray-700"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <Tag
              class="cursor-pointer"
              color="blue"
              @click="onViewKeyInfo(item.key)"
            >
              {{ item.key }}
            </Tag>
            <Tag v-if="item.item?.index" color="processing">
              {{ item.item.index }}
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
          <Space wrap>
            <VbenButton
              v-access="
                asActionPermission(
                  SYSTEM_ACTION_PERMISSION_CODES.CACHE_KEY_INFO,
                )
              "
              @click="onViewKeyInfo(item.key)"
            >
              {{ $t('business.message.viewCacheValue') }}
            </VbenButton>
            <VbenButton @click="onCopySingleKey(item.key)">
              {{ $t('business.message.copyKey') }}
            </VbenButton>
            <Tag v-if="!canRefreshItem(item)" color="error">
              {{ $t('business.message.refreshForbidden') }}
            </Tag>
            <VbenButton
              v-if="canRefreshItem(item)"
              v-access="
                asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_RENEW)
              "
              type="primary"
              @click="onRenewKey(item.key)"
            >
              {{ $t('business.message.refreshCache') }}
            </VbenButton>
          </Space>
        </div>
      </div>
      <div
        v-if="searchTotal > searchPageSize || searchHasMore"
        class="border-t border-gray-100 pt-3 dark:border-gray-800"
      >
        <Pagination
          :current="searchPage"
          :page-size="searchPageSize"
          :page-size-options="['10', '20', '50']"
          :show-total="(total) => $t('business.message.realKeyTotal', [total])"
          :total="searchTotal"
          show-size-changer
          size="small"
          @change="onSearchPageChange"
          @show-size-change="onSearchPageChange"
        />
      </div>
      <div
        v-if="filteredSearchResult.length === 0"
        class="py-10 text-center text-xs text-gray-400"
      >
        {{
          loading
            ? $t('business.message.templateCacheLoading')
            : $t('business.message.noMatchedRealCacheKey')
        }}
      </div>
    </div>
  </Drawer>
</template>
