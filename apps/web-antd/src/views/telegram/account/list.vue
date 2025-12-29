<script lang="ts" setup>
// 引入类型定义
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { TgAccountApi } from '#/api/telegram/account';

// 引入Vben Admin通用组件和图标
import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

// 引入Vben Admin表格适配器
import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 引入TG账号相关API
import {
  deleteTgAccount,
  fetchTgAccountList,
  toggleTgAccountStatus,
} from '#/api/telegram/account';

// 引入表格列、搜索表单schema
import { useColumns, useGridFormSchema } from './data';
// 引入抽屉表单组件
import Form from './modules/form.vue';

// 配置抽屉表单，支持新增/编辑账号
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 配置Vben Admin表格，支持分页、搜索、操作等
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(), // 搜索表单schema
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange), // 表格列配置
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 分页查询TG账号列表
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchTgAccountList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
      response: {
        result: 'list', // 数据列表字段
        total: 'total', // 总数字段
      },
    },
    rowConfig: {
      keyField: 'id', // 主键字段
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

// 操作列点击事件（详情、编辑、删除等）
function onActionClick(e: OnActionClickParams<TgAccountApi.TgAccountItem>) {
  switch (e.code) {
    // 删除
    case 'delete': {
      onDelete(e.row);
      break;
    }
    // 编辑
    case 'edit': {
      onEdit(e.row);
      break;
    }
    // 详情（可扩展）
    // case 'detail':
    //   onDetail(e.row);
    //   break;
  }
}
// 编辑账号，弹出抽屉
function onEdit(row: TgAccountApi.TgAccountItem) {
  formDrawerApi.setData(row).open();
}
// 新增账号，弹出抽屉
function onCreate() {
  formDrawerApi.setData({}).open();
}

// 刷新表格数据
function onRefresh() {
  gridApi.query();
}

// 切换账号状态（启用/禁用）
async function onStatusChange(
  newStatus: number,
  row: TgAccountApi.TgAccountItem,
) {
  const status: Record<number, string> = { 0: '禁用', 1: '启用' };
  try {
    await confirm(
      `你要将${row.username}的状态切换为 【${status[newStatus as keyof typeof status]}】 吗？`,
      `切换状态`,
    );
    await toggleTgAccountStatus(row.id, newStatus);
    return true;
  } catch {
    return false;
  }
}

// 通用确认弹窗
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

// 删除账号操作
function onDelete(row: TgAccountApi.TgAccountItem) {
  const hideLoading = message.loading({
    content: `正在删除账号 ${row.username}...`,
    duration: 0,
    key: 'action_process_msg',
  });
  deleteTgAccount(row.id)
    .then(() => {
      message.success({
        content: `账号 ${row.username} 删除成功`,
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
    <Grid table-title="TG账号列表">
      <template #toolbar-tools>
        <VbenButton type="primary" @click="onCreate">
          <Plus class="size-5" /> 新增账号
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
