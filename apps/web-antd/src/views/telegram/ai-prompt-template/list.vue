<script setup lang="ts">
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { AiPromptTemplateApi } from '#/api/telegram/ai-prompt-template';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAiPromptTemplate,
  fetchAiPromptTemplateList,
  updateAiPromptTemplateStatus,
} from '#/api/telegram/ai-prompt-template';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchAiPromptTemplateList({
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

function onActionClick(e: OnActionClickParams<AiPromptTemplateApi.Item>) {
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

function onEdit(row: AiPromptTemplateApi.Item) {
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
  row: AiPromptTemplateApi.Item,
) {
  const statusLabel: Record<number, string> = { 0: '禁用', 1: '启用' };
  try {
    await confirm(
      `你要将模板【${row.templateName}】状态切换为【${statusLabel[newStatus as keyof typeof statusLabel]}】吗？`,
      '切换状态',
    );
    await updateAiPromptTemplateStatus(row.id, newStatus);
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

function onDelete(row: AiPromptTemplateApi.Item) {
  const hideLoading = message.loading({
    content: `正在删除模板 ${row.templateName}...`,
    duration: 0,
    key: 'action_process_msg',
  });
  deleteAiPromptTemplate(row.id)
    .then(() => {
      message.success({
        content: `模板 ${row.templateName} 删除成功`,
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
    <Grid table-title="AI提示词模板列表">
      <template #toolbar-tools>
        <VbenButton type="primary" @click="onCreate">
          <Plus class="size-5" /> 新增模板
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
