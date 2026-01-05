<script lang="ts" setup>
import type { AccountKeywordConfigRelItem } from '#/api/telegram/account-keyword-config-rel';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  bindAccountKeywordConfigRel,
  fetchAccountKeywordConfigRelDetail,
  updateAccountKeywordConfigRelStatus,
} from '#/api/telegram/account-keyword-config-rel';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<Partial<AccountKeywordConfigRelItem>>({});
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
const userSelect = schema.find((f) => f.fieldName === 'userID');
const keywordSelect = schema.find((f) => f.fieldName === 'keywordID');
function toggleKeyFields(disabled: boolean) {
  formApi.updateSchema([
    {
      ...userSelect,
      componentProps: (prev: Record<string, any> = {}) => ({
        ...userSelect?.componentProps,
        ...prev,
        disabled,
      }),
    },
    {
      ...keywordSelect,
      componentProps: (prev: Record<string, any> = {}) => ({
        ...keywordSelect?.componentProps,
        ...prev,
        disabled,
      }),
    },
  ]);
}

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData<Partial<AccountKeywordConfigRelItem>>();
    if (data?.userID && data.keywordID) {
      loading.value = true;
      isEdit.value = Boolean(data?.userID && data.keywordID);
      toggleKeyFields(isEdit.value);
      fetchAccountKeywordConfigRelDetail(data.userID, data.keywordID)
        .then((res) => {
          if (res) {
            formData.value = res;
            formApi.setValues({
              ...res,
              keywordIDs: [res.keywordID],
            });
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
      toggleKeyFields(isEdit.value);
    }
  },
});

const getDrawerTitle = computed(() =>
  formData.value?.userID && formData.value?.keywordID
    ? '编辑账号与关键词关系'
    : '新增账号与关键词关系',
);

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  drawerApi.lock();
  try {
    const values = await formApi.getValues<{
      actionPayload?: string;
      keywordID: number;
      status: number;
      userID: number;
    }>();
    await (formData.value?.userID && formData.value?.keywordID
      ? updateAccountKeywordConfigRelStatus(
          formData.value.userID,
          formData.value.keywordID,
          { status: values.status as 0 | 1 },
        )
      : bindAccountKeywordConfigRel({
          actionPayload: values.actionPayload,
          keywordID: values.keywordID,
          status: values.status as 0 | 1,
          userID: values.userID,
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
