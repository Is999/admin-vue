<script lang="ts" setup>
import type { AccountGroupRelItem } from '#/api/telegram/account-group-rel';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  bindAccountGroupRel,
  fetchAccountGroupRelDetail,
  updateAccountGroupRelStatus,
} from '#/api/telegram/account-group-rel';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<Partial<AccountGroupRelItem>>({});
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
    if (!isOpen) return;
    const data = drawerApi.getData<Partial<AccountGroupRelItem>>();
    if (data?.userID && data.chatID) {
      loading.value = true;
      fetchAccountGroupRelDetail(data.userID, data.chatID)
        .then((res) => {
          if (res) {
            formData.value = res;
            formApi.setValues({ ...res, status: res.online });
          } else {
            message.error('获取绑定关系详情失败');
          }
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      formData.value = {};
      formApi.resetForm();
    }
  },
});

const getDrawerTitle = computed(() =>
  formData.value?.userID && formData.value?.chatID
    ? '编辑账号与群组关系'
    : '新增账号与群组关系',
);

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  drawerApi.lock();
  try {
    const values = await formApi.getValues<{
      chatID: number;
      status: number;
      userID: number;
    }>();
    await (formData.value?.userID && formData.value?.chatID
      ? updateAccountGroupRelStatus(values.userID, values.chatID, {
          status: values.status as 0 | 1,
        })
      : bindAccountGroupRel({
          chatID: Number(values.chatID),
          status: values.status as 0 | 1,
          userID: Number(values.userID),
        }));
    message.success(formData.value?.userID ? '关系更新成功' : '关系创建成功');
    drawerApi.close();
    emit('success');
  } catch {
    // 错误提示统一在拦截器处理
  } finally {
    drawerApi.unlock();
  }
}
</script>

<template>
  <Drawer
    class="w-full max-w-[900px]"
    :title="getDrawerTitle"
    :loading="loading"
  >
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
