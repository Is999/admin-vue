<script setup lang="ts">
import { computed, ref } from 'vue';

import { VbenButton } from '@vben/common-ui';

import { InputNumber } from 'ant-design-vue';

import { $t } from '#/locales';

type TreeExpandGridApi = {
  grid?: any;
};

type TreeExpandHandler = () => Promise<void> | void;
type TreeExpandLevelHandler = (level: number) => Promise<void> | void;

const props = withDefaults(
  defineProps<{
    childrenField?: string;
    collapseAllHandler?: TreeExpandHandler;
    collapseLevelHandler?: TreeExpandLevelHandler;
    expandAllHandler?: TreeExpandHandler;
    expandLevelHandler?: TreeExpandLevelHandler;
    gridApi?: TreeExpandGridApi;
    maxLevel?: number;
    minLevel?: number;
  }>(),
  {
    childrenField: 'children',
    collapseAllHandler: undefined,
    collapseLevelHandler: undefined,
    expandAllHandler: undefined,
    expandLevelHandler: undefined,
    gridApi: undefined,
    maxLevel: 10,
    minLevel: 1,
  },
);

const level = ref<number | undefined>(2);
// operating 表示当前是否正在执行树展开/折叠批量操作，避免重复点击叠加渲染任务。
const operating = ref(false);

// clampLevel 统一限制输入层级边界，避免按钮联动后越过可配置范围。
function clampLevel(value: null | number | undefined) {
  const min = Math.max(1, Number(props.minLevel) || 1);
  const max = Math.max(min, Number(props.maxLevel) || min);
  const current = Math.trunc(Number(value) || min);
  return Math.min(max, Math.max(min, current));
}

const safeLevel = computed(() => clampLevel(level.value));

// stepLevel 在 N 层操作成功后联动输入框，并复用同一套边界限制。
function stepLevel(delta: number) {
  level.value = clampLevel(safeLevel.value + delta);
}

function resolveGrid() {
  return props.gridApi?.grid;
}

async function resolveTreeData() {
  const grid = resolveGrid();
  if (!grid) {
    return [];
  }

  const tableData =
    typeof grid.getTableData === 'function'
      ? await grid.getTableData()
      : undefined;
  const data =
    tableData?.fullData ??
    tableData?.tableData ??
    (typeof grid.getData === 'function' ? grid.getData() : []);
  return Array.isArray(data) ? data : [];
}

function collectExpandableNodes(
  nodes: any[],
  depth: number,
  items: Array<{ depth: number; row: any }>,
) {
  for (const node of nodes) {
    const children = node?.[props.childrenField];
    if (Array.isArray(children) && children.length > 0) {
      items.push({ row: node, depth });
      collectExpandableNodes(children, depth + 1, items);
    }
  }
}

// runTreeOperation 串行执行树操作，保证一次操作完成后再允许下一次触发。
async function runTreeOperation(handler: () => Promise<void>) {
  if (operating.value) {
    return;
  }
  operating.value = true;
  try {
    await handler();
  } finally {
    operating.value = false;
  }
}

// applyTreeExpandBatch 批量设置树节点展开状态，避免逐节点 setTreeExpand 造成多次重算和重绘。
async function applyTreeExpandBatch(rows: any[], expanded: boolean) {
  const grid = resolveGrid();
  if (!grid || rows.length === 0) {
    return;
  }
  if (typeof grid.setTreeExpand === 'function') {
    await grid.setTreeExpand(rows, expanded);
    return;
  }
  if (typeof grid.setAllTreeExpand === 'function') {
    await grid.setAllTreeExpand(expanded);
  }
}

async function setAllTreeExpand(expanded: boolean) {
  const grid = resolveGrid();
  if (!grid) {
    return;
  }

  if (typeof grid.setAllTreeExpand === 'function') {
    await grid.setAllTreeExpand(expanded);
    return;
  }

  const data = await resolveTreeData();
  const items: Array<{ depth: number; row: any }> = [];
  collectExpandableNodes(data, 1, items);
  await applyTreeExpandBatch(
    items.map((item) => item.row),
    expanded,
  );
}

async function expandAll() {
  await runTreeOperation(async () => {
    if (props.expandAllHandler) {
      await props.expandAllHandler();
      return;
    }
    await setAllTreeExpand(true);
  });
}

async function collapseAll() {
  await runTreeOperation(async () => {
    if (props.collapseAllHandler) {
      await props.collapseAllHandler();
      return;
    }
    await setAllTreeExpand(false);
  });
}

async function expandN() {
  await runTreeOperation(async () => {
    const currentLevel = safeLevel.value;
    if (props.expandLevelHandler) {
      await props.expandLevelHandler(currentLevel);
      stepLevel(1);
      return;
    }
    const grid = resolveGrid();
    if (!grid || typeof grid.setTreeExpand !== 'function') {
      stepLevel(1);
      return;
    }

    const data = await resolveTreeData();
    const items: Array<{ depth: number; row: any }> = [];
    collectExpandableNodes(data, 1, items);
    await applyTreeExpandBatch(
      items.filter((item) => item.depth < currentLevel).map((item) => item.row),
      true,
    );
    stepLevel(1);
  });
}

async function collapseN() {
  await runTreeOperation(async () => {
    const currentLevel = safeLevel.value;
    if (props.collapseLevelHandler) {
      await props.collapseLevelHandler(currentLevel);
      stepLevel(-1);
      return;
    }
    const grid = resolveGrid();
    if (!grid || typeof grid.setTreeExpand !== 'function') {
      stepLevel(-1);
      return;
    }

    const data = await resolveTreeData();
    const items: Array<{ depth: number; row: any }> = [];
    collectExpandableNodes(data, 1, items);
    await applyTreeExpandBatch(
      items
        .filter((item) => item.depth >= currentLevel)
        .map((item) => item.row),
      false,
    );
    stepLevel(-1);
  });
}
</script>

<template>
  <div class="inline-flex flex-wrap items-center justify-end gap-2">
    <VbenButton :disabled="operating" size="sm" @click="expandAll">
      {{ $t('business.message.treeExpandAll') }}
    </VbenButton>
    <VbenButton :disabled="operating" size="sm" @click="collapseAll">
      {{ $t('business.message.treeCollapseAll') }}
    </VbenButton>
    <InputNumber
      v-model:value="level"
      :max="maxLevel"
      :min="minLevel"
      :precision="0"
      :step="1"
      class="w-[86px]"
      :disabled="operating"
      size="small"
    />
    <VbenButton :disabled="operating" size="sm" @click="expandN">
      {{ $t('business.message.treeExpandLevel') }}
    </VbenButton>
    <VbenButton :disabled="operating" size="sm" @click="collapseN">
      {{ $t('business.message.treeCollapseLevel') }}
    </VbenButton>
  </div>
</template>
