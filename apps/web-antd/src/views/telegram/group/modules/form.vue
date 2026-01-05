<script lang="ts" setup>
// 引入TG群组API类型
import type { TgGroupApi } from '#/api/telegram/group';
import type { BindGroupBotKeywordConfigRelParams } from '#/api/telegram/group-bot-keyword-config-rel';

// Vue响应式工具
import { computed, ref } from 'vue';

// Vben抽屉组件
import { useVbenDrawer } from '@vben/common-ui';

// Ant Design消息提示
import { message } from 'ant-design-vue';

// Vben表单工具
import { useVbenForm } from '#/adapter/form';
// TG群组相关API
import {
  createTgGroup, // 创建群组API
  fetchTgGroupDetail, // 获取群组详情API
  updateTgGroup, // 更新群组API
} from '#/api/telegram/group';
import { bindGroupBotKeywordConfigRel } from '#/api/telegram/group-bot-keyword-config-rel';
import { bindGroupConfigRel } from '#/api/telegram/group-config-rel';

// 表单schema定义
import { useFormSchema } from '../data';

// 定义事件emit类型
const emit = defineEmits<{ success: [] }>();
// 群组表单数据
const formData = ref<Partial<TgGroupApi.Item>>();
// 加载状态
const loading = ref(false);
// 表单schema
const schema = useFormSchema();
// 表单布局（可扩展）
const isHorizontal = ref(true);
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
      // 获取抽屉传入的数据
      const data = drawerApi.getData<Partial<TgGroupApi.Item>>();
      if (data && data.id) {
        // 编辑，回填数据
        loading.value = true;
        // 调用获取群组详情API
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
        // 新增，重置表单
        formData.value = {};
        formApi.resetForm();
      }
    }
  },
});
// 动态抽屉标题
const getDrawerTitle = computed(() =>
  formData.value?.id ? '编辑TG群组' : '新增TG群组',
);
// 表单提交逻辑
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  drawerApi.lock();
  try {
    const values = await formApi.getValues<
      Partial<TgGroupApi.Item> & {
        actionPayload?: string;
        configGroup?: string;
        keywordIDs?: Array<number | string>;
        keywordRelStatus?: number;
      }
    >();

    const submitPromise = formData.value?.id
      ? updateTgGroup(formData.value.id, values as TgGroupApi.FormParams)
      : createTgGroup(values as TgGroupApi.FormParams);
    await submitPromise;

    await saveRelations(values);

    message.success(formData.value?.id ? '群组更新成功' : '群组创建成功');
    drawerApi.close();
    emit('success');
  } catch {
    // 错误提示在 api 拦截器内统一处理
  } finally {
    drawerApi.unlock();
  }
}

async function saveRelations(values: {
  actionPayload?: string;
  chatID?: number;
  configGroup?: string;
  keywordIDs?: Array<number | string>;
  keywordRelStatus?: number;
}) {
  const chatID = Number(values.chatID);
  if (chatID <= 0) return;

  const tasks: Promise<unknown>[] = [];

  if (values.configGroup) {
    tasks.push(
      bindGroupConfigRel({
        chatID,
        configGroup: values.configGroup,
      }),
    );
  }

  if (values.keywordIDs && values.keywordIDs.length > 0) {
    tasks.push(
      bindGroupBotKeywordConfigRel({
        actionPayload: values.actionPayload,
        chatID,
        keywordIDs: values.keywordIDs.map(Number),
        status: (values.keywordRelStatus ??
          1) as BindGroupBotKeywordConfigRelParams['status'],
      }),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
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
