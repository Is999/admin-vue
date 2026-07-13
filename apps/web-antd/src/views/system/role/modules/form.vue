<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { SystemPermissionApi, SystemRoleApi } from '#/api/system';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { useVbenForm } from '#/adapter/form';
import {
  createRole,
  fetchPermissionTree,
  fetchRolePermissionTree,
  fetchRoleParentTreeOptions,
  updateRole,
} from '#/api/system';
import {
  hasAnyPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { showCacheSyncResult } from '#/utils/cache/sync';

import FormTips from '../../components/form-tips.vue';
import { useFormSchema } from '../data';
import { collectPermissionState } from './permission-tree';
import PermissionTreePanel from './permission-tree-panel.vue';

// emit 定义角色保存成功事件。
const emit = defineEmits<{ success: [] }>();

// formData 保存当前编辑的角色数据。
const formData = ref<Partial<SystemRoleApi.Item>>({});
// roleTree 保存父级角色树下拉数据。
const roleTree = ref<Array<Record<string, any>>>([]);
// permissionTree 保存角色表单中可直接勾选的权限树。
const permissionTree = ref<SystemPermissionApi.Item[]>([]);
// selectedPermissionIds 保存权限树勾选态，提交时再过滤到可编辑权限。
const selectedPermissionIds = ref<number[]>([]);
// accessStore 保存当前登录管理员权限码集合，用于控制“直接保存角色权限”能力。
const accessStore = useAccessStore();

// canWriteRolePermissions 标记当前账号是否拥有角色权限保存权限。
const canWriteRolePermissions = computed(() =>
  hasAnyPermission(
    accessStore.accessCodes,
    SYSTEM_ACTION_PERMISSION_CODES.ROLE_PERMISSION_UPDATE,
  ),
);
// isSuperRoleEdit 标记当前抽屉是否正在编辑超级管理员角色。
const isSuperRoleEdit = computed(() => Number(formData.value?.id || 0) === 1);

// [Form, formApi] 创建 Vben 表单实例。
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(roleTree.value, onPidChange, isSuperRoleEdit.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// buildRoleTreeOptions 构造角色父级树选择数据，直接使用真实角色树，不额外虚拟顶级节点。
function buildRoleTreeOptions(
  items: SystemRoleApi.Item[],
  currentID?: number,
): Array<Record<string, any>> {
  const currentIDText = currentID ? `${currentID}` : '';
  const walk = (nodes: SystemRoleApi.Item[]): Array<Record<string, any>> =>
    nodes.map((item) => {
      const isCurrent = currentID === item.id;
      const isChild =
        currentIDText !== '' &&
        item.pids.split(',').filter(Boolean).includes(currentIDText);
      const disabled = item.disabled || isCurrent || isChild;
      return {
        children: item.children?.length ? walk(item.children) : [],
        disableCheckbox: disabled || item.disableCheckbox,
        disabled,
        id: item.id,
        selectable: !disabled && item.selectable !== false,
        title: item.title,
      };
    });
  return walk(items);
}

// findDefaultParentRoleID 返回新增角色时默认选中的父级角色。
function findDefaultParentRoleID(items: Array<Record<string, any>>): number {
  for (const item of items) {
    if (!item.disabled && item.selectable !== false) {
      return Number(item.id || 0);
    }
  }
  return 0;
}

// loadPermissionSchema 按当前父级角色刷新角色表单中的权限可分配范围。
async function loadPermissionSchema(
  pid: number,
  currentID?: number,
  selectedIDs: number[] = [],
  useCurrentRoleScope = false,
) {
  if (!canWriteRolePermissions.value) {
    permissionTree.value = [];
    selectedPermissionIds.value = [];
    formApi.updateSchema(
      useFormSchema(roleTree.value, onPidChange, isSuperRoleEdit.value),
    );
    return;
  }
  const scopeRoleID = useCurrentRoleScope && currentID ? currentID : pid;
  if (!scopeRoleID) {
    const tree = await fetchPermissionTree();
    permissionTree.value = tree;
    selectedPermissionIds.value = selectedIDs.filter((item) =>
      collectPermissionState(tree).enabledIds.has(item),
    );
    formApi.updateSchema(
      useFormSchema(roleTree.value, onPidChange, isSuperRoleEdit.value),
    );
    return;
  }
  const permissionItems = await fetchRolePermissionTree(
    scopeRoleID,
    !(useCurrentRoleScope && currentID),
  );
  permissionTree.value = permissionItems;
  const permissionState = collectPermissionState(permissionItems);
  selectedPermissionIds.value =
    useCurrentRoleScope && currentID
      ? permissionState.checkedIds
      : selectedIDs.filter((item) => permissionState.enabledIds.has(item));
  formApi.updateSchema(
    useFormSchema(roleTree.value, onPidChange, isSuperRoleEdit.value),
  );
}

// onPidChange 在新增角色或切换父级时联动刷新可分配权限范围。
async function onPidChange(value: number) {
  await loadPermissionSchema(
    Number(value || 0),
    undefined,
    selectedPermissionIds.value,
    false,
  );
}

// [Drawer, drawerApi] 创建角色新增/编辑抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<Partial<SystemRoleApi.Item>>();
    formApi.resetForm();
    formData.value = data?.id ? data : {};
    roleTree.value = buildRoleTreeOptions(
      await fetchRoleParentTreeOptions(),
      data?.id,
    );
    const defaultPid = Number(
      data?.pid || findDefaultParentRoleID(roleTree.value),
    );
    permissionTree.value = [];
    selectedPermissionIds.value = [];
    formApi.updateSchema(
      useFormSchema(roleTree.value, onPidChange, isSuperRoleEdit.value),
    );
    const defaultPermissions = Array.isArray(data?.permissions)
      ? data.permissions
      : [];
    await loadPermissionSchema(
      defaultPid,
      data?.id,
      defaultPermissions,
      Boolean(data?.id),
    );
    // 角色列表行已包含编辑所需字段，直接回填。
    formApi.setValues(
      data?.id
        ? {
            description: data.description ?? '',
            pid: data.pid ?? 0,
            status: data.status ?? 1,
            title: data.title ?? '',
          }
        : {
            description: '',
            pid: defaultPid,
            status: 1,
            title: '',
          },
    );
  },
});

// getDrawerTitle 根据是否编辑计算抽屉标题。
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.editRole')
    : $t('business.message.addRole'),
);

// formTips 定义角色表单底部参数说明。
const formTips = [
  {
    description: $t('business.message.roleNameTipDesc'),
    title: $t('business.message.roleName'),
  },
  {
    description: $t('business.message.roleParentTipDesc'),
    title: $t('business.message.parentRole'),
  },
  {
    description: $t('business.message.roleStatusTipDesc'),
    title: $t('business.message.roleStatus'),
  },
  {
    description: $t('business.message.rolePermissionTipDesc'),
    title: $t('business.message.rolePermission'),
  },
  {
    description: $t('business.message.roleDescriptionTipDesc'),
    title: $t('business.message.roleDescription'),
  },
];

// onSubmit 校验表单并提交角色保存请求。
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<SystemRoleApi.SaveParams>();
  if (isSuperRoleEdit.value) {
    values.status = 1;
  }
  if (canWriteRolePermissions.value) {
    const enabledIds = collectPermissionState(permissionTree.value).enabledIds;
    values.permissions = selectedPermissionIds.value.filter((item) =>
      enabledIds.has(item),
    );
  } else {
    values.permissions = undefined;
  }
  drawerApi.lock();
  const action = formData.value?.id
    ? updateRole(formData.value.id, values)
    : createRole(values);
  action
    .then((cacheSyncResult) => {
      showCacheSyncResult(
        cacheSyncResult,
        formData.value?.id
          ? $t('business.message.roleUpdated')
          : $t('business.message.roleCreated'),
      );
      drawerApi.close();
      emit('success');
    })
    .finally(() => {
      drawerApi.unlock();
    });
}
</script>

<template>
  <Drawer class="w-full max-w-[980px]" :title="getDrawerTitle">
    <Form class="mx-4 mt-4" />
    <div v-if="canWriteRolePermissions" class="mx-4 mt-2">
      <PermissionTreePanel
        v-model="selectedPermissionIds"
        :can-write="canWriteRolePermissions"
        :tree-data="permissionTree"
      />
    </div>
    <FormTips :title="$t('business.message.description')" :tips="formTips" />
  </Drawer>
</template>
