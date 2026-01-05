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
const schema = useFormSchema();
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

// 根据是否编辑状态，切换主键字段的禁用状态
const chatSelect = schema.find((f) => f.fieldName === 'chatID');
const keywordSelect = schema.find((f) => f.fieldName === 'keywordID');
function toggleKeyFields(chatDisabled: boolean, keywordDisabled?: boolean) {
  formApi.updateSchema([
    {
      ...chatSelect,
      componentProps: (prev: Record<string, any> = {}) => ({
        ...chatSelect?.componentProps,
        ...prev,
        disabled: chatDisabled,
      }),
    },
    {
      ...keywordSelect,
      componentProps: (prev: Record<string, any> = {}) => ({
        ...keywordSelect?.componentProps,
        ...prev,
        disabled: keywordDisabled,
      }),
    },
  ]);
}

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData<
      Partial<GroupBotKeywordConfigRelItem> & { lockChat?: boolean }
    >();
    isEdit.value = Boolean(data?.chatID && data.keywordID);
    if (isEdit.value) {
      toggleKeyFields(true, true);
    } else if (data?.lockChat) {
      toggleKeyFields(true, false);
    } else {
      toggleKeyFields(false, false);
    }
    if (data?.chatID && !isEdit.value) {
      formApi.setValues({ chatID: data.chatID });
    }
    if (isEdit.value && data?.chatID && data.keywordID) {
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
    } else if (data?.lockChat && data?.chatID) {
      formApi.setValues({ chatID: data.chatID });
    } else {
      formData.value = {};
      formApi.resetForm();
    }
  },
});

const getDrawerTitle = computed(() =>
  formData.value?.chatID && formData.value?.keywordID
    ? '编辑群组与关键词配置关系'
    : '新增群组与关键词配置关系',
);

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
