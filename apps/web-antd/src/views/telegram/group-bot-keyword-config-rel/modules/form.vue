<script lang="ts" setup>
import type { GroupBotKeywordConfigRelItem } from '#/api/telegram/group-bot-keyword-config-rel';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  bindGroupBotKeywordConfigRel,
  fetchGroupBotKeywordConfigRelDetail,
  updateGroupBotKeywordConfigRelStatus,
} from '#/api/telegram/group-bot-keyword-config-rel';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<Partial<GroupBotKeywordConfigRelItem>>({});
const loading = ref(false);
const schema = useFormSchema({});
const isHorizontal = ref(true);
const isEdit = ref(false);

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
    const data = drawerApi.getData<
      Partial<GroupBotKeywordConfigRelItem> & {
        isEdit?: boolean;
        lockChat?: boolean;
      }
    >();
    isEdit.value = !!data.isEdit;
    const schema = useFormSchema(data);
    formApi.updateSchema(schema); // 或在创建 form 时就传 schema: useFormSchema(...)

    // 其余逻辑...
    if (data?.chatID) {
      formApi.setValues({ chatID: data.chatID });
      formData.value = { chatID: data.chatID };
    }

    if (isEdit.value && data?.chatID && data?.keywordID) {
      loading.value = true;
      fetchGroupBotKeywordConfigRelDetail(data.chatID, data.keywordID)
        .then((res) => {
          if (res) {
            formData.value = res;
            formApi.setValues({
              ...res,
              actionPayload: res.actionPayload,
              keywordID: res.keywordID,
              status: res.status,
            });
          } else {
            message.error('获取绑定关系详情失败');
          }
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      formApi.resetForm();
    }
  },
});

// 抽屉标题
const getDrawerTitle = computed(() =>
  isEdit.value ? '编辑群组与关键词配置关系' : '新增群组与关键词配置关系',
);

// 提交表单
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  drawerApi.lock();
  try {
    const values = await formApi.getValues<{
      actionPayload?: string;
      chatID: number;
      keywordID: number;
      status: number;
    }>();
    await (formData.value?.chatID && formData.value?.keywordID
      ? updateGroupBotKeywordConfigRelStatus(
          formData.value.chatID,
          formData.value.keywordID,
          { status: values.status as 0 | 1 },
        )
      : bindGroupBotKeywordConfigRel({
          actionPayload: values.actionPayload,
          chatID: values.chatID,
          keywordID: values.keywordID,
          status: values.status as 0 | 1,
        }));
    message.success(formData.value?.chatID ? '关系更新成功' : '关系创建成功');
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
