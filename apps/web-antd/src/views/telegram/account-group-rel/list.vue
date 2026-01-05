<script lang="ts" setup>
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { AccountGroupRelItem } from '#/api/telegram/account-group-rel';

import { computed, onMounted, watch } from 'vue';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchAccountGroupRelList,
  unbindAccountGroupRel,
  updateAccountGroupRelStatus,
} from '#/api/telegram/account-group-rel';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const props = defineProps<{
  lockUser?: boolean;
  userId?: number;
  userID?: number;
}>();
const resolvedUserId = computed(() => props.userID ?? props.userId);

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema({
      userID: resolvedUserId.value,
      lockUser: props.lockUser,
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
          return await fetchAccountGroupRelList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            userID: resolvedUserId.value ?? formValues?.userID,
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

function onActionClick(e: OnActionClickParams<AccountGroupRelItem>) {
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

function onEdit(row: AccountGroupRelItem) {
  formDrawerApi
    .setData({ ...row, lockUser: props.lockUser, isEdit: true })
    .open();
}

function onCreate() {
  formDrawerApi
    .setData({
      userID: resolvedUserId.value,
      lockUser: props.lockUser,
      isEdit: false,
    })
    .open();
}

function onRefresh() {
  gridApi.query();
}

async function onStatusChange(newStatus: number, row: AccountGroupRelItem) {
  const statusLabel: Record<number, string> = { 0: '离线', 1: '在线' };
  try {
    await confirm(
      `你要将账号 ${row.userID} 在群组 ${row.chatID} 的状态切换为【${statusLabel[newStatus as keyof typeof statusLabel]}】吗？`,
      '切换状态',
    );
    await updateAccountGroupRelStatus(row.userID, row.chatID, {
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

function onDelete(row: AccountGroupRelItem) {
  const hide = message.loading({
    content: `正在解绑账号 ${row.userID} 与群组 ${row.chatID}...`,
    duration: 0,
    key: 'action_process_msg',
  });
  unbindAccountGroupRel(row.userID, row.chatID)
    .then(() => {
      message.success({
        content: `账号 ${row.userID} 与群组 ${row.chatID} 解绑成功`,
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => hide());
}

onMounted(() => {
  if (resolvedUserId.value) {
    gridApi.query();
  }
});

watch(resolvedUserId, (val) => {
  if (val) {
    gridApi.query();
  }
});
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid table-title="账号与群组关系">
      <template #toolbar-tools>
        <VbenButton type="primary" @click="onCreate">
          <Plus class="size-5" /> 新增绑定
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
