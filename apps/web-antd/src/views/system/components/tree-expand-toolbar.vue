<script setup lang="ts">
import { computed, ref } from 'vue';

import { VbenButton } from '@vben/common-ui';

import { InputNumber } from 'ant-design-vue';

import { $t } from '#/locales';

type TreeExpandGridApi = {
  grid?: any;
};

const props = withDefaults(
  defineProps<{
    childrenField?: string;
    gridApi: TreeExpandGridApi;
    maxLevel?: number;
    minLevel?: number;
  }>(),
  {
    childrenField: 'children',
    maxLevel: 10,
    minLevel: 1,
  },
);

const level = ref(2);
// operating 表示当前是否正在执行树展开/折叠批量操作，避免重复点击叠加渲染任务。
const operating = ref(false);

const safeLevel = computed(() => {
  const min = Math.max(1, Number(props.minLevel) || 1);
  const max = Math.max(min, Number(props.maxLevel) || min);
  const value = Number(level.value) || min;
  return Math.min(max, Math.max(min, value));
});

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
  await runTreeOperation(() => setAllTreeExpand(true));
}

async function collapseAll() {
  await runTreeOperation(() => setAllTreeExpand(false));
}

async function expandN() {
  await runTreeOperation(async () => {
    const grid = resolveGrid();
    if (!grid || typeof grid.setTreeExpand !== 'function') {
      return;
    }

    const data = await resolveTreeData();
    const items: Array<{ depth: number; row: any }> = [];
    collectExpandableNodes(data, 1, items);
    await applyTreeExpandBatch(
      items
        .filter((item) => item.depth < safeLevel.value)
        .map((item) => item.row),
      true,
    );
  });
}

async function collapseN() {
  await runTreeOperation(async () => {
    const grid = resolveGrid();
    if (!grid || typeof grid.setTreeExpand !== 'function') {
      return;
    }

    const data = await resolveTreeData();
    const items: Array<{ depth: number; row: any }> = [];
    collectExpandableNodes(data, 1, items);
    await applyTreeExpandBatch(
      items
        .filter((item) => item.depth >= safeLevel.value)
        .map((item) => item.row),
      false,
    );
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
