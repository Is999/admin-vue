<script lang="ts" setup>
import type { AiPromptTemplateApi } from '#/api/telegram/ai-prompt-template';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAiPromptTemplate,
  fetchAiPromptTemplateDetail,
  updateAiPromptTemplate,
} from '#/api/telegram/ai-prompt-template';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<Partial<AiPromptTemplateApi.Item>>({});
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
    const data = drawerApi.getData<Partial<AiPromptTemplateApi.Item>>();
    if (data && data.id) {
      loading.value = true;
      fetchAiPromptTemplateDetail(data.id)
        .then((res) => {
          if (res) {
            formData.value = res;
            formApi.setValues(res);
          } else {
            message.error('获取模板详情失败');
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
  formData.value?.id ? '编辑AI提示词模板' : '新增AI提示词模板',
);

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  drawerApi.lock();
  try {
    const values = await formApi.getValues<AiPromptTemplateApi.FormParams>();
    const submitPromise = formData.value?.id
      ? updateAiPromptTemplate(formData.value.id, values)
      : createAiPromptTemplate(values);
    await submitPromise;
    message.success(formData.value?.id ? '模板更新成功' : '模板创建成功');
    drawerApi.close();
    emit('success');
  } catch {
    // 错误提示由拦截器处理
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
