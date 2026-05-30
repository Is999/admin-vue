<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import { NotificationOutlined } from '@ant-design/icons-vue';

import { $t } from '#/locales';

// FormTipItem 定义表单说明条目结构。
type FormTipItem =
  | {
      description: string; // 说明正文
      title: string; // 说明标题
    }
  | string;

// props 定义抽屉表单底部说明区域参数。
defineProps<{
  tips: FormTipItem[]; // 提示内容列表
  title?: string; // 提示标题
}>();

// resolveTipTitle 解析说明条目标题。
function resolveTipTitle(item: FormTipItem, index: number) {
  return typeof item === 'string'
    ? $t('business.message.descriptionWithIndex', [index + 1])
    : item.title;
}

// resolveTipDescription 解析说明条目正文。
function resolveTipDescription(item: FormTipItem) {
  return typeof item === 'string' ? item : item.description;
}
</script>

<template>
  <section class="border-[var(--vben-border-color)]/80 mx-4 mt-8 border-t pt-7">
    <div
      class="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--vben-text-color)]"
    >
      <NotificationOutlined class="form-tips-icon" />
      <span>{{ title || $t('business.message.description') }}</span>
    </div>
    <div
      class="space-y-3 text-[15px] leading-7 text-[color:var(--vben-text-color)]"
    >
      <div v-for="(item, index) in tips" :key="resolveTipTitle(item, index)">
        <div class="font-semibold text-[color:var(--vben-text-color)]">
          {{ index + 1 }}. {{ resolveTipTitle(item, index) }}
        </div>
        <div class="text-[color:var(--vben-text-color-secondary)]">
          {{ resolveTipDescription(item) }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form-tips-icon {
  color: var(--ant-color-warning, #faad14);
}
</style>
