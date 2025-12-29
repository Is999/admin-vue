<script setup lang="ts">
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { TgGroupApi } from '#/api/telegram/group';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteTgGroup,
  fetchTgGroupList,
  toggleTgGroupStatus,
} from '#/api/telegram/group';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchTgGroupList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
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

function onActionClick(e: OnActionClickParams<TgGroupApi.TgGroupListItem>) {
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
function onEdit(row: TgGroupApi.TgGroupListItem) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onRefresh() {
  gridApi.query();
}
async function onStatusChange(
  newStatus: number,
  row: TgGroupApi.TgGroupListItem,
) {
  const status: Record<number, string> = { 0: '禁用', 1: '启用' };
  try {
    await confirm(
      `你要将${row.chatTitle}的状态切换为 【${status[newStatus as keyof typeof status]}】 吗？`,
      `切换状态`,
    );
    await toggleTgGroupStatus(row.id, {
      status: newStatus,
    } as TgGroupApi.TgGroupStatusParams);
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
function onDelete(row: TgGroupApi.TgGroupListItem) {
  const hideLoading = message.loading({
    content: `正在删除群组 ${row.chatTitle}...`,
    duration: 0,
    key: 'action_process_msg',
  });
  deleteTgGroup(row.id)
    .then(() => {
      message.success({
        content: `群组 ${row.chatTitle} 删除成功`,
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid table-title="TG群组列表">
      <template #toolbar-tools>
        <VbenButton type="primary" @click="onCreate">
          <Plus class="size-5" /> 新增群组
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
