<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import { InfoCircleOutlined } from '@ant-design/icons-vue';

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

// isTextTip 判断当前说明是否为纯文本条目。
function isTextTip(item: FormTipItem): item is string {
  return typeof item === 'string';
}

// resolveTipKey 生成说明条目的稳定渲染 key。
function resolveTipKey(item: FormTipItem, index: number) {
  return `${index}-${isTextTip(item) ? item : item.title}`;
}

// resolveTipTitle 解析带标题说明条目的标题。
function resolveTipTitle(item: FormTipItem) {
  return isTextTip(item) ? '' : item.title;
}

// resolveTipDescription 解析说明条目正文。
function resolveTipDescription(item: FormTipItem) {
  return isTextTip(item) ? item : item.description;
}
</script>

<template>
  <section class="form-tips mx-4 mt-5">
    <div class="form-tips__head">
      <InfoCircleOutlined class="form-tips__icon" />
      <span class="form-tips__title">
        {{ title || $t('business.message.description') }}
      </span>
    </div>
    <div class="form-tips__list">
      <div
        v-for="(item, index) in tips"
        :key="resolveTipKey(item, index)"
        class="form-tips__item"
      >
        <span class="form-tips__index">{{ index + 1 }}</span>
        <div class="form-tips__content">
          <span v-if="!isTextTip(item)" class="form-tips__item-title">
            {{ resolveTipTitle(item) }}
          </span>
          <span class="form-tips__desc">
            {{ resolveTipDescription(item) }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form-tips {
  padding: 12px 14px;
  background: hsl(var(--accent) / 38%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.form-tips__head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.form-tips__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 2px;
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 48%);
  border-radius: 999px;
}

.form-tips__title {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.form-tips__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px 14px;
}

.form-tips__item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  min-width: 0;
}

.form-tips__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 26%);
  border-radius: 999px;
}

.form-tips__content {
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
  overflow-wrap: anywhere;
}

.form-tips__item-title {
  margin-right: 6px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

@media (max-width: 768px) {
  .form-tips {
    margin-inline: 0;
  }

  .form-tips__list {
    grid-template-columns: 1fr;
  }
}
</style>
