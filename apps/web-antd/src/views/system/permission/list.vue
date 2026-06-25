<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemPermissionApi } from '#/api/system';

import { h } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePermission,
  fetchPermissionTree,
  updatePermissionStatus,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  buildPermissionCacheTargets,
  buildPermissionCacheTemplateKeys,
  openSystemCachePage,
} from '#/utils/cache/navigation';

import TreeExpandToolbar from '../components/tree-expand-toolbar.vue';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// PERMISSION_ROW_HEIGHT 与 VXE 虚拟滚动行高保持一致，避免滚动时相邻行状态和类型串位。
const PERMISSION_ROW_HEIGHT = 58;
// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑权限。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
// router 用于跳转缓存管理页定位权限相关全局缓存。
const router = useRouter();
type PermissionTreeIndex = {
  total: number; // 当前查询树节点总数
  tree: SystemPermissionApi.Item[]; // 补齐 hasChild 后的当前查询树
};

type PermissionTreeRow = {
  expanded: boolean; // 当前节点是否展开
  treeDepth: number; // 当前节点在权限树中的层级，根节点为 1
  treeLast: boolean; // 当前节点是否为同级最后一个节点
  treeLineParts: boolean[]; // 祖先层级是否需要继续绘制竖向连接线
} & SystemPermissionApi.Item;

// permissionCurrentTree 保存当前查询对应的完整树，用于展开全部和按层级展开。
let permissionCurrentTree: SystemPermissionApi.Item[] = [];
// permissionCurrentRows 保存当前可见行，供表格直接渲染。
let permissionCurrentRows: PermissionTreeRow[] = [];
// permissionExpandedIds 保存当前已展开的权限节点 ID。
let permissionExpandedIds = new Set<number>();
// permissionNodeTotal 记录完整权限节点数，用于无筛选时展示总数。
let permissionNodeTotal = 0;
// permissionGridStyle 提供权限列表 CSS 变量，确保表格行高只有一个来源。
const permissionGridStyle = {
  '--permission-row-height': `${PERMISSION_ROW_HEIGHT}px`,
};

// isEmptyFilter 判断筛选项是否为空，避免状态 0 被误判为空。
function isEmptyFilter(value: any) {
  return value === undefined || value === null || value === '';
}

// hasPermissionFilter 判断当前是否存在搜索条件；无条件时只加载顶级节点。
function hasPermissionFilter(formValues: Record<string, any> = {}) {
  return ['module', 'status', 'title', 'type', 'uuid'].some(
    (key) => !isEmptyFilter(formValues?.[key]),
  );
}

// resolvePermissionFilters 统一读取表格 query 已提交的搜索条件，避免组件内部默认值污染筛选。
function resolvePermissionFilters(
  params: Record<string, any> = {},
  formValues: Record<string, any> = {},
) {
  return {
    ...params?.form,
    ...params?.formData,
    ...formValues,
  };
}

// matchPermissionNode 判断权限节点是否命中当前筛选条件。
function matchPermissionNode(
  item: SystemPermissionApi.Item,
  formValues: Record<string, any>,
) {
  const title = String(formValues.title || '')
    .trim()
    .toLowerCase();
  const uuid = String(formValues.uuid || '')
    .trim()
    .toLowerCase();
  const moduleName = String(formValues.module || '')
    .trim()
    .toLowerCase();
  const type = formValues.type;
  const status = formValues.status;
  const matchedTitle =
    title === '' ||
    String(item.title || '')
      .toLowerCase()
      .includes(title);
  const matchedUuid =
    uuid === '' ||
    String(item.uuid || '')
      .toLowerCase()
      .includes(uuid);
  const matchedModule =
    moduleName === '' ||
    String(item.module || '')
      .toLowerCase()
      .includes(moduleName);
  const matchedType = isEmptyFilter(type) || Number(item.type) === Number(type);
  const matchedStatus =
    isEmptyFilter(status) || Number(item.status) === Number(status);

  return (
    matchedTitle && matchedUuid && matchedModule && matchedType && matchedStatus
  );
}

// filterPermissionTree 按筛选条件过滤权限树，并保留命中节点的父级路径。
function filterPermissionTree(
  items: SystemPermissionApi.Item[],
  formValues: Record<string, any>,
) {
  const walk = (
    nodes: SystemPermissionApi.Item[],
  ): SystemPermissionApi.Item[] =>
    nodes
      .map((item) => {
        const children = item.children?.length ? walk(item.children) : [];
        if (matchPermissionNode(item, formValues) || children.length > 0) {
          return { ...item, children, hasChild: children.length > 0 };
        }
        return undefined;
      })
      .filter(Boolean) as SystemPermissionApi.Item[];
  return walk(items);
}

// createPermissionTreeIndex 为权限树补齐 hasChild，并统计当前树节点总数。
function createPermissionTreeIndex(
  items: SystemPermissionApi.Item[],
): PermissionTreeIndex {
  let total = 0;
  const walk = (
    nodes: SystemPermissionApi.Item[],
  ): SystemPermissionApi.Item[] =>
    (nodes || []).map((item) => {
      total += 1;
      const children = walk(item.children || []);
      const nextItem = {
        ...item,
        children,
        hasChild: children.length > 0,
      };
      return nextItem;
    });
  const tree = walk(items);
  return { total, tree };
}

// collectExpandableIds 收集指定层级内可展开节点 ID，用于批量展开和筛选展示。
function collectExpandableIds(
  items: SystemPermissionApi.Item[],
  depth = 1,
  maxExpandDepth = Number.POSITIVE_INFINITY,
  ids = new Set<number>(),
) {
  for (const item of items || []) {
    const children = item.children || [];
    const id = Number(item.id);
    if (children.length > 0 && depth < maxExpandDepth && Number.isFinite(id)) {
      ids.add(id);
      collectExpandableIds(children, depth + 1, maxExpandDepth, ids);
    }
  }
  return ids;
}

// buildVisiblePermissionRows 按展开状态从缓存树生成当前表格可见行。
function buildVisiblePermissionRows(
  items: SystemPermissionApi.Item[],
  depth = 1,
  rows: PermissionTreeRow[] = [],
  lineParts: boolean[] = [],
) {
  const nodes = items || [];
  for (const [index, item] of nodes.entries()) {
    const { children = [], ...rest } = item;
    const id = Number(item.id);
    const expanded = Number.isFinite(id) && permissionExpandedIds.has(id);
    const last = index === nodes.length - 1;
    rows.push({
      ...rest,
      children: undefined,
      expanded,
      hasChild: children.length > 0,
      treeDepth: depth,
      treeLast: last,
      treeLineParts: lineParts,
    });
    if (expanded) {
      buildVisiblePermissionRows(
        children,
        depth + 1,
        rows,
        depth === 1 ? lineParts : [...lineParts, !last],
      );
    }
  }
  return rows;
}

// updatePermissionStatusCache 同步当前缓存树与可见行，避免状态变更后展开/折叠回到旧值。
function updatePermissionStatusCache(
  id: number,
  status: SystemPermissionApi.Status,
) {
  const walk = (items: SystemPermissionApi.Item[]) => {
    for (const item of items || []) {
      if (Number(item.id) === id) {
        item.status = status;
      }
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(permissionCurrentTree);
  for (const row of permissionCurrentRows) {
    if (Number(row.id) === id) {
      row.status = status;
    }
  }
}

// syncPermissionRows 把当前展开状态同步到表格。
async function syncPermissionRows() {
  permissionCurrentRows = buildVisiblePermissionRows(permissionCurrentTree);
  const grid = gridApi?.grid;
  if (grid && typeof grid.loadData === 'function') {
    await grid.loadData(permissionCurrentRows);
  }
}

// togglePermissionRow 切换单个权限节点展开状态。
async function togglePermissionRow(row: PermissionTreeRow) {
  const id = Number(row.id);
  if (!row.hasChild || !Number.isFinite(id)) {
    return;
  }
  if (permissionExpandedIds.has(id)) {
    permissionExpandedIds.delete(id);
  } else {
    permissionExpandedIds.add(id);
  }
  await syncPermissionRows();
}

// expandPermissionAll 完整展开当前查询结果。
async function expandPermissionAll() {
  permissionExpandedIds = collectExpandableIds(permissionCurrentTree);
  await syncPermissionRows();
}

// collapsePermissionAll 折叠当前查询结果。
async function collapsePermissionAll() {
  permissionExpandedIds.clear();
  await syncPermissionRows();
}

// expandPermissionLevel 展开当前查询结果到指定层级。
async function expandPermissionLevel(level: number) {
  permissionExpandedIds = collectExpandableIds(
    permissionCurrentTree,
    1,
    Math.max(1, Number(level) || 1),
  );
  await syncPermissionRows();
}

// collapsePermissionLevel 折叠到指定层级。
async function collapsePermissionLevel(level: number) {
  await expandPermissionLevel(level);
}

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载权限树列表与操作。
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-x-4',
  },
  gridOptions: {
    cellConfig: {
      height: PERMISSION_ROW_HEIGHT,
    },
    columns: useColumns<PermissionTreeRow>(onActionClick, onStatusChange, {
      onToggle: (row) => {
        void togglePermissionRow(row);
      },
    }),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        // 查询后端缓存树；无筛选时只渲染顶级节点，避免首屏渲染完整权限树。
        query: async (params: any, formValues: any) => {
          const filters = resolvePermissionFilters(params, formValues);
          const fullIndex = createPermissionTreeIndex(
            await fetchPermissionTree(),
          );
          const hasFilter = hasPermissionFilter(filters);
          const currentIndex = createPermissionTreeIndex(
            hasFilter
              ? filterPermissionTree(fullIndex.tree, filters)
              : fullIndex.tree,
          );
          permissionCurrentTree = currentIndex.tree;
          permissionNodeTotal = fullIndex.total;
          permissionExpandedIds = hasFilter
            ? collectExpandableIds(permissionCurrentTree)
            : new Set<number>();
          permissionCurrentRows = buildVisiblePermissionRows(
            permissionCurrentTree,
          );
          return {
            list: permissionCurrentRows,
            total: hasFilter ? currentIndex.total : permissionNodeTotal,
          };
        },
      },
      response: {
        list: 'list',
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
      useKey: true,
    },
    scrollY: {
      enabled: true,
      gt: 60,
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

// onActionClick 处理权限操作列事件。
function onActionClick(e: OnActionClickParams<PermissionTreeRow>) {
  switch (e.code) {
    case 'addChild': {
      onCreate(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

// onCreate 打开新增权限抽屉，可从列表行直接新增子级。
function onCreate(parent?: SystemPermissionApi.Item) {
  formDrawerApi.setData(parent?.id ? { pid: parent.id } : {}).open();
}

// onEdit 打开编辑权限抽屉。
function onEdit(row: SystemPermissionApi.Item) {
  formDrawerApi.setData(row).open();
}

// onRefresh 刷新权限列表。
function onRefresh() {
  gridApi.query();
}

// onOpenPermissionCache 跳转缓存管理页查看权限树与权限映射全局缓存。
async function onOpenPermissionCache() {
  await openSystemCachePage(router, {
    source: $t('business.message.permissionManagement'),
    templateKeys: buildPermissionCacheTemplateKeys(),
    targets: buildPermissionCacheTargets(),
  });
}

// onStatusChange 修改权限状态。
async function onStatusChange(newStatus: number, row: PermissionTreeRow) {
  const statusText: Record<number, string> = {
    0: $t('business.message.disable'),
    1: $t('business.message.enable'),
  };
  try {
    await confirm(
      $t('business.message.confirmSwitchPermissionStatus', [
        row.title,
        statusText[newStatus],
      ]),
      $t('business.message.switchPermissionStatus'),
    );
    await updatePermissionStatus(
      row.id,
      newStatus as SystemPermissionApi.Status,
    );
    updatePermissionStatusCache(
      Number(row.id),
      newStatus as SystemPermissionApi.Status,
    );
    return true;
  } catch {
    return false;
  }
}

// onDelete 删除权限。
function onDelete(row: SystemPermissionApi.Item) {
  Modal.confirm({
    content: () =>
      h('div', { class: 'space-y-2' }, [
        h(
          'div',
          {},
          $t('business.message.confirmDeletePermission', [row.title]),
        ),
        h(
          'div',
          { class: 'text-red-500' },
          $t('business.message.deletePermissionDangerDesc'),
        ),
      ]),
    okType: 'danger',
    onOk: async () => {
      await deletePermission(row.id);
      message.success($t('business.message.permissionDeleted'));
      onRefresh();
    },
    title: $t('business.message.deletePermissionDangerTitle'),
  });
}

// confirm 封装通用确认弹窗。
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error($t('business.message.cancelled')));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid
      class="system-tree-grid"
      :style="permissionGridStyle"
      :table-title="$t('business.message.permissionList')"
    >
      <template #toolbar-tools>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <VbenButton
            v-access="
              asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.PERMISSION_ADD)
            "
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" /> {{ $t('business.message.addPermission') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.CACHE_SEARCH)
            "
            @click="onOpenPermissionCache"
          >
            {{ $t('business.message.permissionCache') }}
          </VbenButton>
          <TreeExpandToolbar
            :collapse-all-handler="collapsePermissionAll"
            :collapse-level-handler="collapsePermissionLevel"
            :expand-all-handler="expandPermissionAll"
            :expand-level-handler="expandPermissionLevel"
            :grid-api="gridApi"
          />
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
:deep(.system-tree-grid .vxe-body--row) {
  height: var(--permission-row-height);
}

:deep(.system-tree-grid .vxe-cell) {
  font-size: 15px;
}

:deep(.permission-title-cell) {
  --permission-tree-line-color: hsl(var(--muted-foreground));

  display: flex;
  align-items: center;
  min-width: 0;
  height: var(--permission-row-height);
}

:deep(.permission-tree-lines) {
  display: inline-flex;
  flex: 0 0 auto;
  align-self: stretch;
  height: 100%;
}

:deep(.permission-tree-line),
:deep(.permission-tree-branch) {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 100%;
}

:deep(.permission-tree-line--through::before),
:deep(.permission-tree-branch::before) {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 14px;
  content: '';
  border-left: 1px dotted var(--permission-tree-line-color);
  opacity: 0.78;
}

:deep(.permission-tree-branch--last::before) {
  bottom: 50%;
}

:deep(.permission-tree-branch::after) {
  position: absolute;
  top: 50%;
  left: 14px;
  width: 14px;
  content: '';
  border-top: 1px dotted var(--permission-tree-line-color);
  opacity: 0.78;
}

:deep(.permission-title-toggle) {
  display: inline-flex;
  flex: 0 0 22px;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin-right: 8px;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 0;
  border-radius: 4px;
}

:deep(.permission-title-toggle--enabled) {
  cursor: pointer;
}

:deep(.permission-title-toggle--enabled:hover) {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

:deep(.permission-title-toggle--expanded) {
  color: hsl(var(--foreground));
}

:deep(.permission-title-toggle:disabled) {
  cursor: default;
  opacity: 0;
}

:deep(.permission-title-text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
