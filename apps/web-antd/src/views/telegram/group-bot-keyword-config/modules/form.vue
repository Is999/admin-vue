<script lang="ts" setup>
// ================= 类型与依赖引入 =================
// 引入API类型定义
import type { TgGroupBotKeywordConfigApi } from '#/api/telegram/group-bot-keyword-config';

// Vue响应式API
import { computed, ref } from 'vue';

// Vben抽屉组件hook
import { useVbenDrawer } from '@vben/common-ui';

// Ant Design Vue消息提示
import { message } from 'ant-design-vue';

// Vben表单相关hook
import { useVbenForm } from '#/adapter/form';
// 群组机器人关键词配置相关API
import {
  createTgGroupBotKeywordConfig, // 新增关键词配置API
  fetchTgGroupBotKeywordConfigDetail, // 获取关键词配置详情API
  updateTgGroupBotKeywordConfig, // 更新关键词配置API
} from '#/api/telegram/group-bot-keyword-config';

// 表单schema
import { useFormSchema } from '../data';

// ================= 事件与响应式数据 =================
// 定义事件，用于向父组件发送成功事件
const emit = defineEmits<{ success: [] }>();
// 响应式表单数据
const formData = ref<Partial<TgGroupBotKeywordConfigApi.Item>>();
// 加载状态
const loading = ref(false);
// 表单schema
const schema = useFormSchema();
// 表单布局（横向/纵向）
const isHorizontal = ref(true);

// ================= Vben表单与抽屉实例 =================
// Vben表单实例，包含表单组件和API
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

// Vben抽屉实例，包含抽屉组件和API
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit, // 抽屉确认时触发表单提交
  onOpenChange(isOpen) {
    if (isOpen) {
      // 获取抽屉传递的数据
      const data =
        drawerApi.getData<Partial<TgGroupBotKeywordConfigApi.Item>>();
      if (data && data.id) {
        // 编辑，回填数据
        loading.value = true;
        fetchTgGroupBotKeywordConfigDetail(data.id)
          .then((res) => {
            formData.value = res;
            formApi.setValues(res);
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

// 动态抽屉标题，根据是否有id判断是编辑还是新增
const getDrawerTitle = computed(() =>
  formData.value?.id ? '编辑关键词配置' : '新增关键词配置',
);

// ================= 表单提交方法 =================
// 提交表单，自动区分新增/编辑
async function onSubmit() {
  const { valid } = await formApi.validate(); // 校验表单
  if (valid) {
    drawerApi.lock(); // 锁定抽屉，防止重复提交
    const values =
      await formApi.getValues<Partial<TgGroupBotKeywordConfigApi.Item>>();
    (formData.value?.id
      ? updateTgGroupBotKeywordConfig(
          formData.value.id,
          values as TgGroupBotKeywordConfigApi.FormParams,
        )
      : createTgGroupBotKeywordConfig(
          values as TgGroupBotKeywordConfigApi.FormParams,
        )
    )
      .then(() => {
        message.success(formData.value?.id ? '配置更新成功' : '配置创建成功');
        drawerApi.close();
        emit('success'); // 通知父组件操作成功
      })
      .catch(() => {})
      .finally(() => {
        drawerApi.unlock(); // 解锁抽屉
      });
  }
}
</script>
<template>
  <!-- 抽屉组件，包含表单 -->
  <Drawer
    class="w-full max-w-[1000px]"
    :title="getDrawerTitle"
    :loading="loading"
  >
    <!-- 表单组件 -->
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
