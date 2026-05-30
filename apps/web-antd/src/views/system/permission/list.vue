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

// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑权限。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
// router 用于跳转缓存管理页定位权限相关全局缓存。
const router = useRouter();

// isEmptyFilter 判断筛选项是否为空，避免状态 0 被误判为空。
function isEmptyFilter(value: any) {
  return value === undefined || value === null || value === '';
}

// countPermissionNodes 统计权限树节点数量，用于列表总数展示。
function countPermissionNodes(items: SystemPermissionApi.Item[]): number {
  return items.reduce(
    (total, item) => total + 1 + countPermissionNodes(item.children || []),
    0,
  );
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
          return { ...item, children };
        }
        return undefined;
      })
      .filter(Boolean) as SystemPermissionApi.Item[];
  return walk(items);
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
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        // 查询权限树，并在前端按条件过滤以保留树形层级。
        query: async (_params: any, formValues: any) => {
          const tree = await fetchPermissionTree();
          const list = filterPermissionTree(tree, formValues || {});
          return {
            list,
            total: countPermissionNodes(list),
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
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: true,
      search: true,
      zoom: true,
    },
    treeConfig: {
      childrenField: 'children',
      expandAll: true,
      indent: 32,
      rowField: 'id',
      showLine: true,
    },
  },
});

// onActionClick 处理权限操作列事件。
function onActionClick(e: OnActionClickParams<SystemPermissionApi.Item>) {
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
async function onStatusChange(
  newStatus: number,
  row: SystemPermissionApi.Item,
) {
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
          <TreeExpandToolbar :grid-api="gridApi" />
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
:deep(.system-tree-grid .vxe-table--header-wrapper .vxe-header--column) {
  font-weight: 600;
  color: #1f2937;
  background: #fafafa;
}

:deep(.system-tree-grid .vxe-body--row) {
  height: 58px;
}

:deep(.system-tree-grid .vxe-cell) {
  font-size: 15px;
}

:deep(.system-tree-grid .vxe-tree--node-btn) {
  color: #374151;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
}
</style>
