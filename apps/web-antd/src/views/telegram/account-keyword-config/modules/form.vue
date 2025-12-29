<script lang="ts" setup>
// 引入类型定义
import type { TgAccountKeywordConfigApi } from '#/api/telegram/account-keyword-config';

// 引入Vue相关API
import { computed, ref } from 'vue';

// 引入Vben抽屉组件相关hook
import { useVbenDrawer } from '@vben/common-ui';

// 引入Ant Design Vue的消息提示
import { message } from 'ant-design-vue';

// 引入Vben表单相关hook
import { useVbenForm } from '#/adapter/form';
// 引入API方法
import {
  createTgAccountKeywordConfig, // 创建关键词配置
  fetchTgAccountKeywordConfigDetail, // 获取关键词配置详情
  updateTgAccountKeywordConfig, // 更新关键词配置
} from '#/api/telegram/account-keyword-config';

// 引入表单schema
import { useFormSchema } from '../data';

// 定义事件，用于向父组件发送成功事件
const emit = defineEmits<{ success: [] }>();
// 响应式表单数据
const formData = ref<Partial<TgAccountKeywordConfigApi.Item>>();
// 加载状态
const loading = ref(false);

// 响应式表单schema
const schema = useFormSchema();

// 响应式表单布局，支持横向/纵向
const isHorizontal = ref(true); // 可根据breakpoint自适应

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
      const data = drawerApi.getData<Partial<TgAccountKeywordConfigApi.Item>>();
      if (data && data.id) {
        // 编辑，回填数据
        loading.value = true;
        fetchTgAccountKeywordConfigDetail(data.id)
          .then((res) => {
            if (res) {
              formData.value = res;
              formApi.setValues(res);
            } else {
              message.error('获取配置详情失败');
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

// 动态抽屉标题，根据是否有id判断是编辑还是新增
const getDrawerTitle = computed(() =>
  formData.value?.id ? '编辑关键词配置' : '新增关键词配置',
);

// 表单提交方法
async function onSubmit() {
  const { valid } = await formApi.validate(); // 校验表单
  if (valid) {
    // 锁定抽屉，防止重复提交
    drawerApi.lock();
    // 获取表单值
    const values =
      await formApi.getValues<Partial<TgAccountKeywordConfigApi.Item>>();

    // 根据是否有id决定调用创建或更新接口
    (formData.value?.id
      ? updateTgAccountKeywordConfig(
          formData.value.id,
          values as TgAccountKeywordConfigApi.FormParams,
        )
      : createTgAccountKeywordConfig(
          values as TgAccountKeywordConfigApi.FormParams,
        )
    )
      .then(() => {
        message.success(formData.value?.id ? '配置更新成功' : '配置创建成功');
        drawerApi.close();
        emit('success'); // 通知父组件操作成功
      })
      .catch(() => {
        // 错误提示已在API中处理
      })
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
