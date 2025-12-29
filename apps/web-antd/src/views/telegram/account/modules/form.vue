<script lang="ts" setup>
import type { TgAccountApi } from '#/api/telegram/account';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createTgAccount,
  fetchTgAccountDetail,
  updateTgAccount,
} from '#/api/telegram/account';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();

const formData = ref<Partial<TgAccountApi.TgAccountItem>>();
const loading = ref(false);

// 响应式表单schema
const schema = useFormSchema();

// 响应式表单布局
const isHorizontal = ref(true); // 可根据breakpoint自适应

// Vben表单实例
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

// Vben抽屉实例
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<Partial<TgAccountApi.TgAccountItem>>();
      if (data && data.id) {
        // 编辑，回填数据
        loading.value = true;
        fetchTgAccountDetail(data.id)
          .then((res) => {
            if (res) {
              formData.value = res;
              formApi.setValues(res);
            } else {
              message.error('获取账号详情失败');
            }
          })
          .finally(() => {
            loading.value = false;
          });
      } else {
        // 新增，重置表单
        formData.value = {};
        formApi.resetForm();
      }
    }
  },
});

// 动态抽屉标题
const getDrawerTitle = computed(() =>
  formData.value?.id ? '编辑TG账号' : '新增TG账号',
);

// 表单提交
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    // 锁定抽屉，防止重复提交
    drawerApi.lock();
    // 获取表单值
    const values =
      await formApi.getValues<Partial<TgAccountApi.TgAccountItem>>();

    // 根据是否有id决定调用创建或更新接口
    (formData.value?.id
      ? updateTgAccount(formData.value.id, { ...values, id: formData.value.id })
      : createTgAccount(values)
    )
      .then(() => {
        message.success(formData.value?.id ? '账号更新成功' : '账号创建成功');
        drawerApi.close();
        emit('success');
      })
      .catch(() => {
        // 丢弃error，错误提示在api中已处理
      })
      .finally(() => {
        // 解锁抽屉
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
