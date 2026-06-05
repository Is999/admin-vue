<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemPermissionApi, SystemRoleApi } from '#/api/system';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, useVbenModal, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteRole,
  fetchRolePermissionTree,
  fetchRoleTree,
  updateRolePermissions,
  updateRoleStatus,
} from '#/api/system';
import {
  asActionPermission,
  hasAnyPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { refreshAccessState } from '#/utils/access-sync';
import {
  buildRoleCacheTargets,
  buildRoleCacheTemplateKeys,
  openSystemCachePage,
} from '#/utils/cache/navigation';

import TreeExpandToolbar from '../components/tree-expand-toolbar.vue';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import { collectPermissionState } from './modules/permission-tree';
import PermissionTreePanel from './modules/permission-tree-panel.vue';

// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑角色。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 权限配置弹窗 =================
// currentRole 保存当前正在配置权限的角色。
const currentRole = ref<SystemRoleApi.Item>();
// router 用于跳转缓存管理页定位角色权限缓存。
const router = useRouter();
// accessStore 保存当前登录账号的权限码集合。
const accessStore = useAccessStore();
// userStore 保存当前登录账号资料，角色权限变更后用于判断是否需要刷新当前菜单。
const userStore = useUserStore();
// permissionTree 保存角色权限树。
const permissionTree = ref<SystemPermissionApi.Item[]>([]);
// selectedPermissionIds 保存权限树勾选态，保存时再过滤到可编辑权限。
const selectedPermissionIds = ref<number[]>([]);

// canUpdateRoleStatus 控制角色状态列是否允许直接切换。
const canUpdateRoleStatus = computed(() =>
  hasAnyPermission(
    accessStore.accessCodes,
    SYSTEM_ACTION_PERMISSION_CODES.ROLE_STATUS_UPDATE,
  ),
);

// canUpdateRolePermission 控制权限树是否允许保存。
const canUpdateRolePermission = computed(() =>
  hasAnyPermission(
    accessStore.accessCodes,
    SYSTEM_ACTION_PERMISSION_CODES.ROLE_PERMISSION_UPDATE,
  ),
);

// PermissionModal 用于保存角色权限关系。
const [PermissionModal, permissionModalApi] = useVbenModal({
  appendToMain: true,
  class: 'w-[1120px] max-w-[calc(100vw-48px)]',
  destroyOnClose: true,
  draggable: true,
  onConfirm: onSavePermissions,
  title: $t('business.message.permissionConfig'),
});

// isEmptyFilter 判断筛选项是否为空，避免状态 0 被误判为空。
function isEmptyFilter(value: any) {
  return value === undefined || value === null || value === '';
}

// countRoleNodes 统计角色树节点数量，用于列表总数展示。
function countRoleNodes(items: SystemRoleApi.Item[]): number {
  return items.reduce(
    (total, item) => total + 1 + countRoleNodes(item.children || []),
    0,
  );
}

// matchRoleNode 判断角色节点是否命中当前筛选条件。
function matchRoleNode(
  item: SystemRoleApi.Item,
  formValues: Record<string, any>,
) {
  const title = String(formValues.title || '')
    .trim()
    .toLowerCase();
  const pid = formValues.pid;
  const status = formValues.status;
  const pidText = String(pid || '');
  const matchedTitle =
    title === '' ||
    String(item.title || '')
      .toLowerCase()
      .includes(title);
  const matchedPid =
    isEmptyFilter(pid) ||
    Number(item.pid) === Number(pid) ||
    Number(item.id) === Number(pid) ||
    String(item.pids || '')
      .split(',')
      .filter(Boolean)
      .includes(pidText);
  const matchedStatus =
    isEmptyFilter(status) || Number(item.status) === Number(status);

  return matchedTitle && matchedPid && matchedStatus;
}

// filterRoleTree 按筛选条件过滤角色树，并保留命中节点的父级路径。
function filterRoleTree(
  items: SystemRoleApi.Item[],
  formValues: Record<string, any>,
) {
  const walk = (nodes: SystemRoleApi.Item[]): SystemRoleApi.Item[] =>
    nodes
      .map((item) => {
        const children = item.children?.length ? walk(item.children) : [];
        if (matchRoleNode(item, formValues) || children.length > 0) {
          return { ...item, children };
        }
        return undefined;
      })
      .filter(Boolean) as SystemRoleApi.Item[];
  return walk(items);
}

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载角色树列表与操作。
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useColumns(
      onActionClick,
      canUpdateRoleStatus.value ? onStatusChange : undefined,
    ),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        // 查询角色树，并在前端按条件过滤以保留树形层级。
        query: async (_params: any, formValues: any) => {
          const tree = await fetchRoleTree();
          const list = filterRoleTree(tree, formValues || {});
          return {
            list,
            total: countRoleNodes(list),
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

// onActionClick 处理角色操作列事件。
function onActionClick(e: OnActionClickParams<SystemRoleApi.Item>) {
  switch (e.code) {
    case 'addChild': {
      onCreate(e.row);
      break;
    }
    case 'cache': {
      onOpenRoleCache(e.row);
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
    case 'permission': {
      onPermission(e.row);
      break;
    }
  }
}

// onOpenRoleCache 跳转缓存管理页并定位当前角色的权限模板缓存实例。
async function onOpenRoleCache(row: SystemRoleApi.Item) {
  await openSystemCachePage(router, {
    autoViewKey: `role_permission:${row.id}`,
    source: $t('business.message.roleManagementSource', [row.title]),
    templateKeys: buildRoleCacheTemplateKeys(),
    targets: buildRoleCacheTargets(row.id),
  });
}

// onCreate 打开新增角色抽屉，可从列表行直接新增子级。
function onCreate(parent?: SystemRoleApi.Item) {
  formDrawerApi.setData(parent?.id ? { pid: parent.id } : {}).open();
}

// onEdit 打开编辑角色抽屉。
function onEdit(row: SystemRoleApi.Item) {
  formDrawerApi.setData(row).open();
}

// onRefresh 刷新角色列表。
function onRefresh() {
  gridApi.query();
}

// onStatusChange 修改角色状态。
async function onStatusChange(newStatus: number, row: SystemRoleApi.Item) {
  const statusText: Record<number, string> = {
    0: $t('business.message.disable'),
    1: $t('business.message.enable'),
  };
  try {
    await (newStatus === 0
      ? new Promise((resolve, reject) => {
          Modal.confirm({
            content: () =>
              h('div', { class: 'space-y-2' }, [
                h(
                  'div',
                  {},
                  $t('business.message.confirmDisableRole', [row.title]),
                ),
                h(
                  'div',
                  { class: 'text-red-500' },
                  $t('business.message.disableRoleDangerDesc'),
                ),
                h(
                  'div',
                  { class: 'text-gray-500' },
                  $t('business.message.disableRoleRecoverDesc'),
                ),
              ]),
            okType: 'danger',
            onCancel() {
              reject(new Error($t('business.message.cancelled')));
            },
            onOk() {
              resolve(true);
            },
            title: $t('business.message.disableRoleDangerTitle'),
          });
        })
      : confirm(
          $t('business.message.confirmSwitchRoleStatus', [
            row.title,
            statusText[newStatus],
          ]),
          $t('business.message.switchRoleStatus'),
        ));
    await updateRoleStatus(row.id, newStatus as SystemRoleApi.Status);
    return true;
  } catch {
    return false;
  }
}

// onPermission 打开角色权限树弹窗。
async function onPermission(row: SystemRoleApi.Item) {
  currentRole.value = row;
  permissionTree.value = [];
  selectedPermissionIds.value = [];
  permissionModalApi.setState({
    title: $t('business.message.permissionConfigTitle', [row.title]),
  });
  permissionModalApi.open();
  permissionModalApi.setState({ loading: true });
  try {
    const tree = await fetchRolePermissionTree(row.id, false);
    permissionTree.value = tree;
    selectedPermissionIds.value = collectPermissionState(tree).checkedIds;
  } finally {
    permissionModalApi.setState({ loading: false });
  }
}

// onSavePermissions 覆盖保存角色权限。
async function onSavePermissions() {
  if (!currentRole.value) {
    return;
  }
  if (!canUpdateRolePermission.value) {
    message.warning($t('business.message.accountPermissionReadonly'));
    return;
  }
  const enabledIds = collectPermissionState(permissionTree.value).enabledIds;
  const permissionIDs = selectedPermissionIds.value.filter((item) =>
    enabledIds.has(item),
  );
  const savedRoleID = currentRole.value.id;
  permissionModalApi.setState({ loading: true });
  updateRolePermissions(savedRoleID, permissionIDs)
    .then(async () => {
      message.success($t('business.message.rolePermissionsConfigured'));
      await refreshCurrentAccessAfterRolePermissionSave(savedRoleID).catch(
        () => {
          accessStore.setIsAccessChecked(false);
          message.warning(
            $t('business.message.currentMenuPermissionsRefreshFailed'),
          );
        },
      );
      permissionModalApi.close();
      onRefresh();
    })
    .finally(() => {
      permissionModalApi.setState({ loading: false });
    });
}

// refreshCurrentAccessAfterRolePermissionSave 在当前账号所属角色被改动时重建前端菜单，避免保存后侧边栏仍使用旧权限码。
async function refreshCurrentAccessAfterRolePermissionSave(roleID?: number) {
  const currentRoleID = Number(roleID || 0);
  const userInfo = userStore.userInfo as
    | null
    | (Record<string, any> & {
        isSuperAdmin?: boolean;
        roleIds?: number[];
        roles?: string[];
      });
  const currentUserRoleIDs = (userInfo?.roleIds || [])
    .map(Number)
    .filter((item) => item > 0);
  if (
    currentRoleID <= 0 ||
    !userInfo ||
    userInfo.isSuperAdmin ||
    !currentUserRoleIDs.includes(currentRoleID)
  ) {
    return;
  }
  await refreshAccessState(router, {
    force: true,
    reason: 'role-permission-save',
  });
  message.info($t('business.message.currentMenuPermissionsRefreshed'));
}

// onDelete 删除角色。
function onDelete(row: SystemRoleApi.Item) {
  Modal.confirm({
    content: () =>
      h('div', { class: 'space-y-2' }, [
        h('div', {}, $t('business.message.confirmDeleteRole', [row.title])),
        h(
          'div',
          { class: 'text-red-500' },
          $t('business.message.deleteRoleDangerDesc'),
        ),
      ]),
    okType: 'danger',
    onOk: async () => {
      await deleteRole(row.id);
      message.success($t('business.message.roleDeleted'));
      onRefresh();
    },
    title: $t('business.message.deleteRoleDangerTitle'),
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
    <PermissionModal>
      <div class="px-2 py-3">
        <PermissionTreePanel
          v-model="selectedPermissionIds"
          class="role-permission-panel--modal"
          :can-write="canUpdateRolePermission"
          :tree-data="permissionTree"
          :read-only-description="
            $t('business.message.permissionTreeReadOnlyDesc')
          "
        />
      </div>
    </PermissionModal>
    <FormDrawer @success="onRefresh" />
    <Grid
      class="system-tree-grid"
      :table-title="$t('business.message.roleList')"
    >
      <template #toolbar-tools>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <VbenButton
            v-access="
              asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.ROLE_ADD)
            "
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" /> {{ $t('business.message.addRole') }}
          </VbenButton>
          <TreeExpandToolbar :grid-api="gridApi" />
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
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

:deep(.role-permission-panel--modal .role-permission-tree-scroll) {
  max-height: min(62vh, 680px);
}
</style>
