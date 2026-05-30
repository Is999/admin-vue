<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { SystemPermissionApi } from '#/api/system';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createPermission,
  fetchPermissionMaxUuid,
  fetchPermissionTree,
  updatePermission,
} from '#/api/system';
import { $t } from '#/locales';

import FormTips from '../../components/form-tips.vue';
import { useFormSchema } from '../data';

// emit 定义权限保存成功事件。
const emit = defineEmits<{ success: [] }>();

// formData 保存当前编辑权限。
const formData = ref<Partial<SystemPermissionApi.Item>>({});
// permissionTree 保存父级权限树下拉数据。
const permissionTree = ref<Array<Record<string, any>>>([]);

// [Form, formApi] 创建 Vben 表单实例。
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(permissionTree.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// buildPermissionTreeOptions 构造权限父级树选择数据，并补一个顶级节点。
function buildPermissionTreeOptions(
  items: SystemPermissionApi.Item[],
  currentID?: number,
): Array<Record<string, any>> {
  const currentIDText = currentID ? `${currentID}` : '';
  const walk = (
    nodes: SystemPermissionApi.Item[],
  ): Array<Record<string, any>> =>
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
  return [
    {
      children: walk(items),
      id: 0,
      title: $t('business.message.topLevelPermission'),
    },
  ];
}

// [Drawer, drawerApi] 创建权限新增/编辑抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<Partial<SystemPermissionApi.Item>>();
    const defaultPid = Number(data?.pid || 0);
    formApi.resetForm();
    formData.value = data?.id ? data : {};
    permissionTree.value = buildPermissionTreeOptions(
      await fetchPermissionTree(),
      data?.id,
    );
    formApi.updateSchema(useFormSchema(permissionTree.value));
    if (data?.id) {
      formApi.setValues({
        description: data.description ?? '',
        module: data.module ?? '',
        pid: data.pid ?? 0,
        status: data.status ?? 1,
        title: data.title ?? '',
        type: data.type ?? 4,
        uuid: data.uuid ?? '',
      });
      return;
    }
    // 新增权限时预取后端建议的 uuid，减少手动录入错误。
    const maxUuid = await fetchPermissionMaxUuid().catch(() => undefined);
    formApi.setValues({
      description: '',
      module: '',
      pid: defaultPid,
      status: 1,
      title: '',
      type: 4,
      uuid: maxUuid?.uuid,
    });
  },
});

// getDrawerTitle 根据是否编辑计算抽屉标题。
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.editPermission')
    : $t('business.message.addPermission'),
);

// formTips 定义权限表单底部参数说明。
const formTips = [
  {
    description: $t('business.message.permissionUuidTipDesc'),
    title: $t('business.message.permissionUuidTipTitle'),
  },
  {
    description: $t('business.message.permissionModelTipDesc'),
    title: $t('business.message.permissionModelTipTitle'),
  },
  {
    description: $t('business.message.permissionTypeTipDesc'),
    title: $t('business.message.permissionTypeTipTitle'),
  },
  {
    description: $t('business.message.permissionParentTipDesc'),
    title: $t('business.message.permissionParentTipTitle'),
  },
];

// onSubmit 校验并提交权限保存请求。
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<SystemPermissionApi.SaveParams>();
  drawerApi.lock();
  const action = formData.value?.id
    ? updatePermission(formData.value.id, values)
    : createPermission(values);
  action
    .then(() => {
      message.success(
        formData.value?.id
          ? $t('business.message.permissionUpdated')
          : $t('business.message.permissionCreated'),
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
  <Drawer class="w-full max-w-[1100px]" :title="getDrawerTitle">
    <Form class="mx-4 mt-4" />
    <FormTips :title="$t('business.message.description')" :tips="formTips" />
  </Drawer>
</template>
