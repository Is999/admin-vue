<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  createRole,
  fetchRoleParentTreeOptions,
  updateRole,
} from '#/api/system';
import { SUPER_ADMIN_ROLE_ID } from '#/constants/permission-codes';
import { $t } from '#/locales';
import { showCacheSyncResult } from '#/utils/cache/sync';

import FormTips from '../../components/form-tips.vue';
import { findDefaultParentRoleID, useFormSchema } from '../data';

// emit 定义角色保存成功事件。
const emit = defineEmits<{ success: [] }>();

// formData 保存当前编辑的角色数据。
const formData = ref<Partial<SystemRoleApi.Item>>({});
// roleTree 保存父级角色树下拉数据。
const roleTree = ref<Array<Record<string, any>>>([]);
// drawerSessionID 标识当前抽屉会话，避免旧请求覆盖新状态。
let drawerSessionID = 0;

// isSuperRoleEdit 标记当前抽屉是否正在编辑超级管理员角色。
const isSuperRoleEdit = computed(
  () => Number(formData.value?.id || 0) === SUPER_ADMIN_ROLE_ID,
);

// [Form, formApi] 创建角色基础资料表单。
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(roleTree.value, isSuperRoleEdit.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// buildRoleTreeOptions 构造角色父级树，并禁用当前角色及其子孙节点。
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

// [Drawer, drawerApi] 创建角色新增与编辑抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    const sessionID = ++drawerSessionID;
    if (!isOpen) {
      drawerApi.unlock();
      return;
    }
    drawerApi.lock();
    try {
      const data = drawerApi.getData<Partial<SystemRoleApi.Item>>();
      formApi.resetForm();
      formData.value = data?.id ? data : {};
      const parentRoles = await fetchRoleParentTreeOptions();
      if (sessionID !== drawerSessionID) {
        return;
      }
      roleTree.value = buildRoleTreeOptions(parentRoles, data?.id);
      const defaultPid = Number(
        data?.pid || findDefaultParentRoleID(roleTree.value),
      );
      formApi.updateSchema(
        useFormSchema(roleTree.value, isSuperRoleEdit.value, Boolean(data?.id)),
      );
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
    } finally {
      if (sessionID === drawerSessionID) {
        drawerApi.unlock();
      }
    }
  },
});

// getDrawerTitle 根据是否编辑计算抽屉标题。
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.editRole')
    : $t('business.message.addRole'),
);

// formTips 定义角色基础资料表单说明；权限统一在角色列表的权限配置弹窗维护。
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
    description: $t('business.message.roleDescriptionTipDesc'),
    title: $t('business.message.roleDescription'),
  },
];

// onSubmit 校验并保存角色基础资料。
async function onSubmit() {
  const sessionID = drawerSessionID;
  const { valid } = await formApi.validate();
  if (!valid || sessionID !== drawerSessionID) {
    return;
  }
  const values = await formApi.getValues<SystemRoleApi.CreateParams>();
  drawerApi.lock();
  const roleID = Number(formData.value?.id || 0);
  const action = roleID
    ? updateRole(roleID, {
        description: values.description ?? '',
        pid: Number(values.pid ?? 0),
        title: values.title ?? '',
      })
    : createRole(values);
  try {
    const cacheSyncResult = await action;
    if (sessionID !== drawerSessionID) {
      emit('success');
      return;
    }
    showCacheSyncResult(
      cacheSyncResult,
      roleID
        ? $t('business.message.roleUpdated')
        : $t('business.message.roleCreated'),
    );
    drawerApi.close();
    emit('success');
  } finally {
    if (sessionID === drawerSessionID) {
      drawerApi.unlock();
    }
  }
}
</script>

<template>
  <Drawer class="w-full max-w-[760px]" :title="getDrawerTitle">
    <Form class="mx-4 mt-4" />
    <FormTips :title="$t('business.message.description')" :tips="formTips" />
  </Drawer>
</template>
