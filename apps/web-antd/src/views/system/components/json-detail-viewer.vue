<script lang="ts" setup>
import { computed, nextTick, ref, useId, watch } from 'vue';

import { JsonViewer } from '@vben/common-ui';
import { usePreferences } from '@vben/preferences';

import { Button, Input } from 'ant-design-vue';

import { $t } from '#/locales';

import TreeExpandToolbar from './tree-expand-toolbar.vue';

// JsonDetailViewerProps 定义结构化详情查看器的输入。
interface JsonDetailViewerProps {
  copyLabel?: string; // 复制按钮文案，为空时不显示复制入口
  searchPlaceholder: string; // 搜索框提示文案
  value: unknown; // JSON 对象、JSON 字符串或普通文本
}

// DetailValue 表示解析后的结构化值或普通文本。
interface DetailValue {
  structured: boolean; // 是否使用 JSON 树展示
  text: string; // 普通文本展示内容
  value: unknown; // JSON 树展示值
}

const props = defineProps<JsonDetailViewerProps>();
const emit = defineEmits<{
  copy: []; // 请求调用方复制当前完整内容
}>();
const { isDark } = usePreferences();

// searchInputId 为同页每个详情搜索框提供唯一表单标识。
const searchInputId = `json-detail-search-${useId()}`;
// searchKeyword 记录当前详情内搜索词。
const searchKeyword = ref('');
// activeMatchIndex 记录当前定位的匹配行。
const activeMatchIndex = ref(0);
// matchCount 记录当前可见匹配行数量。
const matchCount = ref(0);
// expandDepth 控制 JSON 树当前展开到的层级，Infinity 表示全部展开。
const expandDepth = ref(Number.POSITIVE_INFINITY);
// viewerVersion 用于重新应用整树展开状态。
const viewerVersion = ref(0);
// rootRef 用于查询当前已渲染的 JSON 或文本行。
const rootRef = ref<HTMLElement | null>(null);
// matchElements 保存当前可见匹配行，不进入响应式渲染。
let matchElements: HTMLElement[] = [];

// detailValue 统一缓存值与日志数据的 JSON/文本展示分支。
const detailValue = computed(() => normalizeDetailValue(props.value));
// expandable 标记当前值是否存在可折叠的 JSON 容器。
const expandable = computed(
  () =>
    detailValue.value.value !== null &&
    typeof detailValue.value.value === 'object',
);
// maxLevel 返回当前 JSON 可展开的最大层级。
const maxLevel = computed(() => resolveMaxLevel(detailValue.value.value));
// plainTextLines 保存非 JSON 文本的逐行展示内容。
const plainTextLines = computed(() => detailValue.value.text.split('\n'));
// normalizedKeyword 用于忽略大小写匹配详情行。
const normalizedKeyword = computed(() =>
  searchKeyword.value.trim().toLowerCase(),
);
// viewerTheme 让 JSON 树主题跟随后台明暗模式。
const viewerTheme = computed(() =>
  isDark.value ? 'dark-json-theme' : 'default-json-theme',
);
// matchResultText 展示当前命中序号或无匹配状态。
const matchResultText = computed(() => {
  if (!normalizedKeyword.value) {
    return '';
  }
  if (matchCount.value === 0) {
    return $t('business.message.detailSearchNoMatch');
  }
  return `${activeMatchIndex.value + 1}/${matchCount.value}`;
});

watch(normalizedKeyword, (keyword, previousKeyword) => {
  activeMatchIndex.value = 0;
  if (keyword && (!previousKeyword || Number.isFinite(expandDepth.value))) {
    setExpandDepth(Number.POSITIVE_INFINITY);
    return;
  }
  void nextTick(() => refreshMatches(true));
});

watch(
  () => props.value,
  () => {
    activeMatchIndex.value = 0;
    viewerVersion.value += 1;
    void nextTick(() => refreshMatches(false));
  },
);

// normalizeDetailValue 优先解析 JSON，非 JSON 字符串按普通文本展示。
function normalizeDetailValue(value: unknown): DetailValue {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return { structured: false, text: '', value: null };
    }
    try {
      return {
        structured: true,
        text,
        value: JSON.parse(text) as unknown,
      };
    } catch {
      return { structured: false, text: value, value: null };
    }
  }
  if (value === undefined || value === null) {
    return { structured: false, text: '', value: null };
  }
  return { structured: true, text: '', value };
}

// resolveMaxLevel 计算 JSON 容器的最大层级，标量值不额外增加层级。
function resolveMaxLevel(value: unknown, level = 1): number {
  if (value === null || typeof value !== 'object') {
    return Math.max(1, level - 1);
  }
  const children = Array.isArray(value) ? value : Object.values(value);
  let maxLevel = level;
  for (const child of children) {
    maxLevel = Math.max(maxLevel, resolveMaxLevel(child, level + 1));
  }
  return maxLevel;
}

// refreshMatches 重新收集当前树或文本视图中的关键词命中行。
function refreshMatches(scrollActive: boolean) {
  matchElements.forEach((element) => {
    element.classList.remove(
      'json-detail-viewer__match',
      'json-detail-viewer__match--active',
    );
  });
  matchElements = [];

  const keyword = normalizedKeyword.value;
  if (!keyword || !rootRef.value) {
    matchCount.value = 0;
    return;
  }

  const lines = rootRef.value.querySelectorAll<HTMLElement>(
    '.vjs-tree-node, .json-detail-viewer__text-line',
  );
  matchElements = [...lines].filter((line) =>
    String(line.textContent || '')
      .toLowerCase()
      .includes(keyword),
  );
  matchElements.forEach((element) => {
    element.classList.add('json-detail-viewer__match');
  });
  matchCount.value = matchElements.length;
  activeMatchIndex.value = Math.min(
    activeMatchIndex.value,
    Math.max(matchElements.length - 1, 0),
  );
  markActiveMatch(scrollActive);
}

// markActiveMatch 高亮当前匹配行，并按需滚动到视图中央。
function markActiveMatch(scrollActive: boolean) {
  matchElements.forEach((element) => {
    element.classList.remove('json-detail-viewer__match--active');
  });
  const activeElement = matchElements[activeMatchIndex.value];
  if (!activeElement) {
    return;
  }
  activeElement.classList.add('json-detail-viewer__match--active');
  if (scrollActive) {
    activeElement.scrollIntoView({ block: 'center' });
  }
}

// submitSearch 定位到当前首个匹配行。
function submitSearch() {
  activeMatchIndex.value = 0;
  if (normalizedKeyword.value && detailValue.value.structured) {
    setExpandDepth(Number.POSITIVE_INFINITY);
    return;
  }
  refreshMatches(true);
}

// moveMatch 循环定位上一个或下一个匹配行。
function moveMatch(step: number) {
  if (matchElements.length === 0) {
    refreshMatches(false);
  }
  if (matchElements.length === 0) {
    return;
  }
  activeMatchIndex.value =
    (activeMatchIndex.value + step + matchElements.length) %
    matchElements.length;
  markActiveMatch(true);
}

// setExpandDepth 重新渲染 JSON 树并应用指定展开深度。
function setExpandDepth(depth: number) {
  expandDepth.value = Math.max(0, depth);
  viewerVersion.value += 1;
  void nextTick(() => refreshMatches(Boolean(normalizedKeyword.value)));
}

// expandAll 展开 JSON 的全部层级。
function expandAll() {
  setExpandDepth(Number.POSITIVE_INFINITY);
}

// collapseAll 折叠 JSON 的全部层级。
function collapseAll() {
  setExpandDepth(0);
}

// expandLevel 展开到指定层级。
function expandLevel(level: number) {
  setExpandDepth(level);
}

// collapseLevel 从指定层级开始折叠。
function collapseLevel(level: number) {
  setExpandDepth(Math.max(0, level - 1));
}

// copyValue 把复制动作交给调用方，沿用各业务已有的提示文案。
function copyValue() {
  emit('copy');
}

// handleViewerClick 在手动折叠节点后刷新可见匹配行。
function handleViewerClick() {
  void nextTick(() => refreshMatches(false));
}
</script>

<template>
  <div ref="rootRef" class="json-detail-viewer">
    <div class="json-detail-viewer__toolbar">
      <div class="json-detail-viewer__search-group">
        <Input
          v-model:value="searchKeyword"
          allow-clear
          autocomplete="off"
          class="json-detail-viewer__search"
          :id="searchInputId"
          :name="searchInputId"
          :placeholder="searchPlaceholder"
          @press-enter="submitSearch"
        />
        <div class="json-detail-viewer__search-nav">
          <span v-if="matchResultText" class="json-detail-viewer__search-count">
            {{ matchResultText }}
          </span>
          <Button
            :disabled="matchCount === 0"
            type="primary"
            @click="moveMatch(-1)"
          >
            {{ $t('business.message.detailSearchPrevious') }}
          </Button>
          <Button
            :disabled="matchCount === 0"
            type="primary"
            @click="moveMatch(1)"
          >
            {{ $t('business.message.detailSearchNext') }}
          </Button>
        </div>
      </div>
      <div class="json-detail-viewer__actions">
        <Button v-if="copyLabel" type="primary" @click="copyValue">
          {{ copyLabel }}
        </Button>
        <TreeExpandToolbar
          v-if="expandable"
          :collapse-all-handler="collapseAll"
          :collapse-level-handler="collapseLevel"
          :expand-all-handler="expandAll"
          :expand-level-handler="expandLevel"
          :max-level="maxLevel"
        />
      </div>
    </div>
    <div class="json-detail-viewer__body" @click="handleViewerClick">
      <JsonViewer
        v-if="detailValue.structured"
        :key="viewerVersion"
        :expand-depth="expandDepth"
        :expanded="!Number.isFinite(expandDepth)"
        :show-double-quotes="true"
        :theme="viewerTheme"
        :value="detailValue.value"
      />
      <div v-else class="json-detail-viewer__text">
        <span
          v-for="(line, index) in plainTextLines"
          :key="index"
          class="json-detail-viewer__text-line"
        >
          {{ line || ' ' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-detail-viewer {
  --json-detail-border: var(
    --vben-border-color,
    hsl(var(--border, 240 5.9% 90%))
  );
  --json-detail-code-bg: hsl(var(--background, 0 0% 100%));
  --json-detail-code-text: hsl(var(--foreground, 210 6% 21%));
  --json-detail-text-secondary: var(
    --vben-text-color-secondary,
    hsl(var(--muted-foreground, 240 3.8% 46.1%))
  );
  --json-detail-token-boolean: #6d28d9;
  --json-detail-token-key: #0369a1;
  --json-detail-token-null: #dc2626;
  --json-detail-token-number: #b45309;
  --json-detail-token-punctuation: #64748b;
  --json-detail-token-string: #047857;

  display: grid;
  gap: 12px;
}

:global(.dark) .json-detail-viewer {
  --json-detail-code-bg: hsl(var(--background-deep, 220deg 13.06% 9%));
  --json-detail-code-text: hsl(var(--foreground, 0 0% 95%));
  --json-detail-token-boolean: #c4b5fd;
  --json-detail-token-key: #7dd3fc;
  --json-detail-token-null: #fca5a5;
  --json-detail-token-number: #fbbf24;
  --json-detail-token-punctuation: #94a3b8;
  --json-detail-token-string: #a7f3d0;
}

.json-detail-viewer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.json-detail-viewer__search-group {
  display: flex;
  flex: 1 1 360px;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.json-detail-viewer__search-nav {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
}

.json-detail-viewer__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  max-width: 100%;
  margin-left: auto;
  white-space: nowrap;
}

.json-detail-viewer__search {
  flex: 1 1 auto;
  width: 100%;
  min-width: 160px;
}

.json-detail-viewer__search-count {
  min-width: 44px;
  font-size: 12px;
  line-height: 32px;
  color: var(--json-detail-text-secondary);
}

.json-detail-viewer__body {
  min-height: 280px;
  max-height: min(58vh, 640px);
  padding: 10px 12px;
  overflow: auto;
  background: var(--json-detail-code-bg);
  border: 1px solid var(--json-detail-border);
  border-radius: 6px;
}

.json-detail-viewer__body :deep(.vben-json-viewer) {
  font-size: 12px;
  line-height: 1.45;
  color: var(--json-detail-code-text);
  background: transparent;
}

.json-detail-viewer__body :deep(.vjs-tree-node) {
  min-height: 18px;
  padding: 0 6px;
  margin: 0 -6px;
  line-height: 18px;
  border-radius: 4px;
}

.json-detail-viewer__body :deep(.vjs-key) {
  font-weight: 600;
  color: var(--json-detail-token-key);
}

.json-detail-viewer__body :deep(.vjs-colon),
.json-detail-viewer__body :deep(.vjs-tree-brackets) {
  color: var(--json-detail-token-punctuation);
}

.json-detail-viewer__body :deep(.vjs-value-string) {
  color: var(--json-detail-token-string);
}

.json-detail-viewer__body :deep(.vjs-value-number) {
  color: var(--json-detail-token-number);
}

.json-detail-viewer__body :deep(.vjs-value-boolean) {
  color: var(--json-detail-token-boolean);
}

.json-detail-viewer__body :deep(.vjs-value-null),
.json-detail-viewer__body :deep(.vjs-value-undefined) {
  color: var(--json-detail-token-null);
}

.json-detail-viewer__body :deep(.vjs-comment) {
  color: var(--json-detail-text-secondary);
}

.json-detail-viewer__body :deep(.vjs-carets) {
  line-height: 18px;
}

.json-detail-viewer__text-line {
  display: block;
  min-height: 18px;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: 4px;
}

.json-detail-viewer__body :deep(.json-detail-viewer__match),
.json-detail-viewer__text-line.json-detail-viewer__match {
  background: hsl(45deg 93% 47% / 18%);
}

.json-detail-viewer__body :deep(.json-detail-viewer__match--active),
.json-detail-viewer__text-line.json-detail-viewer__match--active {
  outline: 1px solid hsl(45deg 93% 47% / 86%);
  outline-offset: -1px;
  background: hsl(45deg 93% 47% / 28%);
}

.json-detail-viewer__text {
  margin: 0;
  font-family: Consolas, Menlo, Courier, monospace;
  font-size: 12px;
  line-height: 1.45;
  color: var(--json-detail-code-text);
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .json-detail-viewer__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .json-detail-viewer__search-group {
    flex-wrap: wrap;
  }

  .json-detail-viewer__actions {
    flex-wrap: wrap;
  }

  .json-detail-viewer__search {
    width: 100%;
  }
}
</style>
