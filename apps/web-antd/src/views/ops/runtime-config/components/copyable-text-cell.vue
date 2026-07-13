<script lang="ts" setup>
import { computed } from 'vue';

import { CopyOutlined } from '@ant-design/icons-vue';
import { Button, Popover } from 'ant-design-vue';

import { copyTextToClipboard } from '#/utils/security/password';

type CopyableTextCellProps = {
  // copiedMessage 是复制成功后的反馈文案。
  copiedMessage: string;
  // copyLabel 是提示卡中的复制操作文案。
  copyLabel: string;
  // emptyMessage 是无可复制内容时的反馈文案。
  emptyMessage: string;
  // text 是单元格显示和复制的完整文本。
  text?: null | number | string;
};

const props = defineProps<CopyableTextCellProps>();

// textValue 统一清理单元格文本，避免空白值生成无效提示卡。
const textValue = computed(() => String(props.text ?? '').trim());

// copyText 复制完整文本，并阻止表格行点击事件。
function copyText() {
  void copyTextToClipboard(
    textValue.value,
    props.copiedMessage,
    props.emptyMessage,
  );
}
</script>

<template>
  <Popover v-if="textValue" placement="topLeft" trigger="hover">
    <template #content>
      <div class="max-w-[360px] space-y-2">
        <div class="break-all whitespace-normal">{{ textValue }}</div>
        <Button
          class="h-auto! px-0!"
          size="small"
          type="link"
          :aria-label="copyLabel"
          @click.stop="copyText"
        >
          <template #icon><CopyOutlined /></template>
          {{ copyLabel }}
        </Button>
      </div>
    </template>
    <span
      class="block max-w-full cursor-help overflow-hidden text-ellipsis whitespace-nowrap"
    >
      {{ textValue }}
    </span>
  </Popover>
  <span v-else>-</span>
</template>
