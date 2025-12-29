<script lang="ts" setup>
import type { TgGroupApi } from '#/api/telegram/group';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createTgGroup,
  fetchTgGroupDetail,
  updateTgGroup,
} from '#/api/telegram/group';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<Partial<TgGroupApi.TgGroupDetail>>();
const loading = ref(false);
const schema = useFormSchema();
const isHorizontal = ref(true);
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<Partial<TgGroupApi.TgGroupDetail>>();
      if (data && data.id) {
        loading.value = true;
        fetchTgGroupDetail(data.id)
          .then((res) => {
            if (res) {
              formData.value = res;
              formApi.setValues(res);
            } else {
              message.error('获取群组详情失败');
            }
          })
          .finally(() => {
            loading.value = false;
          });
      } else {
        formData.value = {};
        formApi.resetForm();
      }
    }
  },
});
const getDrawerTitle = computed(() =>
  formData.value?.id ? '编辑TG群组' : '新增TG群组',
);
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    // 锁定抽屉，防止重复提交
    drawerApi.lock();
    // 获取表单值
    const values = await formApi.getValues<Partial<TgGroupApi.TgGroupDetail>>();
    // 根据是否有id决定调用创建或更新接口
    (formData.value?.id
      ? updateTgGroup(formData.value.id, {
          chatID: values.chatID, // 群组ID
          chatTitle: values.chatTitle, // 群组名称
          status: values.status, // 状态 1启用 0禁用，非必填
          remark: values.remark, // 备注
        } as TgGroupApi.TgGroupUpdateParams)
      : createTgGroup({
          chatID: values.chatID, // 群组ID
          chatTitle: values.chatTitle, // 群组名称
          status: values.status, // 状态 1启用 0禁用，非必填
          remark: values.remark, // 备注
        } as TgGroupApi.TgGroupCreateParams)
    )
      .then(() => {
        message.success(formData.value?.id ? '群组更新成功' : '群组创建成功');
        drawerApi.close();
        emit('success');
      })
      .catch(() => {})
      .finally(() => {
        drawerApi.unlock();
      });
  }
}
</script>
<template>
  <Drawer
    class="w-full max-w-[1000px]"
    :title="getDrawerTitle"
    :loading="loading"
  >
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
