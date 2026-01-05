<script lang="ts" setup>
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { GroupBotKeywordConfigRelItem } from '#/api/telegram/group-bot-keyword-config-rel';

import { onMounted, ref, watch } from 'vue';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchGroupBotKeywordConfigRelList,
  unbindGroupBotKeywordConfigRel,
  updateGroupBotKeywordConfigRelStatus,
} from '#/api/telegram/group-bot-keyword-config-rel';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const props = defineProps<{
  chatId?: number;
  chatID?: number;
  lockChat?: boolean;
}>();

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const resolvedChatId = ref(props.chatID ?? props.chatId);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema({
      chatID: resolvedChatId.value,
      lockChat: props.lockChat,
    }),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchGroupBotKeywordConfigRelList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            chatID: resolvedChatId.value ?? formValues?.chatID,
          });
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

function onActionClick(e: OnActionClickParams<GroupBotKeywordConfigRelItem>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function onEdit(row: GroupBotKeywordConfigRelItem) {
  formDrawerApi.setData({ ...row, lockChat: props.lockChat }).open();
}

function onCreate() {
  formDrawerApi
    .setData({ chatID: resolvedChatId.value, lockChat: props.lockChat })
    .open();
}

function onRefresh() {
  gridApi.query();
}

async function onStatusChange(
  newStatus: number,
  row: GroupBotKeywordConfigRelItem,
) {
  const statusLabel: Record<number, string> = { 0: '禁用', 1: '启用' };
  try {
    await confirm(
      `你要将群组 ${row.chatID} 的关键词配置 ${row.keywordID} 状态切换为【${statusLabel[newStatus as keyof typeof statusLabel]}】吗？`,
      '切换状态',
    );
    await updateGroupBotKeywordConfigRelStatus(row.chatID, row.keywordID, {
      status: newStatus as 0 | 1,
    });
    return true;
  } catch {
    return false;
  }
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

function onDelete(row: GroupBotKeywordConfigRelItem) {
  const hide = message.loading({
    content: `正在解绑群组 ${row.chatID} 与关键词配置 ${row.keywordID}...`,
    duration: 0,
    key: 'action_process_msg',
  });
  unbindGroupBotKeywordConfigRel(row.chatID, { keywordIDs: [row.keywordID] })
    .then(() => {
      message.success({
        content: `群组 ${row.chatID} 与关键词配置 ${row.keywordID} 解绑成功`,
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => hide());
}

// auto query when chatID is preset
onMounted(() => {
  if (resolvedChatId.value) {
    gridApi.query();
  }
});

watch(resolvedChatId, (val) => {
  if (val) {
    gridApi.query();
  }
});
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid table-title="群组与关键词配置关系">
      <template #toolbar-tools>
        <VbenButton type="primary" @click="onCreate">
          <Plus class="size-5" /> 新增绑定
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
