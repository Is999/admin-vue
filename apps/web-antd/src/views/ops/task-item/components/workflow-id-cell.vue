<script lang="ts" setup>
import { computed } from 'vue';

import { CopyOutlined, LinkOutlined } from '@ant-design/icons-vue';
import { Button, Tooltip } from 'ant-design-vue';

import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

type WorkflowIdCellProps = {
  // text 是用于展示、跳转和复制的完整工作流 ID。
  text?: null | number | string;
};

const props = defineProps<WorkflowIdCellProps>();
const emit = defineEmits<{
  // open 在用户点击工作流链接时通知列表执行路由跳转。
  open: [workflowID: string];
}>();

// workflowID 清理空白值，空工作流保持表格统一的占位展示。
const workflowID = computed(() => String(props.text ?? '').trim());

// copyWorkflowID 复制完整工作流 ID，并沿用任务模块统一反馈文案。
function copyWorkflowID() {
  void copyTextToClipboard(
    workflowID.value,
    $t('business.message.workflowIdCopied'),
    $t('business.message.noWorkflowIdToCopy'),
  );
}
</script>

<template>
  <div v-if="workflowID" class="workflow-id-cell">
    <Tooltip placement="topLeft" :title="workflowID">
      <Button
        class="workflow-id-link"
        size="small"
        type="link"
        :aria-label="$t('business.message.viewWorkflowStatus')"
        @click.stop="emit('open', workflowID)"
      >
        <template #icon><LinkOutlined /></template>
        <span class="workflow-id-text">{{ workflowID }}</span>
      </Button>
    </Tooltip>
    <Tooltip :title="$t('business.message.copyWorkflowId')">
      <Button
        class="workflow-id-copy"
        size="small"
        type="link"
        :aria-label="$t('business.message.copyWorkflowId')"
        @click.stop="copyWorkflowID"
      >
        <template #icon><CopyOutlined /></template>
      </Button>
    </Tooltip>
  </div>
  <span v-else class="workflow-id-empty">-</span>
</template>

<style scoped>
.workflow-id-cell {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  height: 32px;
}

.workflow-id-link {
  display: inline-flex;
  flex: 1 1 auto;
  gap: 4px;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  height: 32px;
  padding: 0;
  line-height: 32px;
}

.workflow-id-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-id-copy {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  padding: 0;
  line-height: 32px;
}

.workflow-id-empty {
  display: inline-flex;
  align-items: center;
  height: 32px;
}
</style>
