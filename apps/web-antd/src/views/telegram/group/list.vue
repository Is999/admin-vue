<script setup lang="ts">
// ================= 类型与依赖引入 =================
// 表格操作事件类型
import type { OnActionClickParams } from '#/adapter/vxe-table';
// TG群组API类型
import type { TgGroupApi } from '#/api/telegram/group';

// Vben Admin 通用页面、抽屉、按钮组件
import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
// 新增按钮图标
import { Plus } from '@vben/icons';

// Ant Design 消息与弹窗
import { message, Modal } from 'ant-design-vue';

// Vben Admin 表格适配器
import { useVbenVxeGrid } from '#/adapter/vxe-table';
// TG群组相关API
import {
  deleteTgGroup, // 删除群组API
  fetchTgGroupList, // 获取群组列表API
  toggleTgGroupStatus, // 切换群组状态API
} from '#/api/telegram/group';

// 表格列、搜索表单schema
import { useColumns, useGridFormSchema } from './data';
// 抽屉表单组件
import Form from './modules/form.vue';

// ================= 抽屉表单配置 =================
// 配置抽屉表单，支持新增/编辑群组
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 表格配置 =================
// 配置Vben Admin表格，支持分页、搜索、操作等
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(), // 搜索表单schema
    submitOnChange: false, // 搜索表单变更自动提交
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange), // 表格列配置
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 分页查询群组列表
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchTgGroupList({
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

// ================= 操作事件 =================
// 操作列点击事件（编辑、删除等）
function onActionClick(e: OnActionClickParams<TgGroupApi.Item>) {
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

// 编辑群组，弹出抽屉
function onEdit(row: TgGroupApi.Item) {
  formDrawerApi.setData(row).open();
}

// 新增群组，弹出抽屉
function onCreate() {
  formDrawerApi.setData({}).open();
}

// 刷新表格数据
function onRefresh() {
  gridApi.query();
}

// 切换群组状态（启用/禁用）
async function onStatusChange(newStatus: number, row: TgGroupApi.Item) {
  const status: Record<number, string> = { 0: '禁用', 1: '启用' };
  try {
    await confirm(
      `你要将${row.chatTitle}的状态切换为 【${status[newStatus as keyof typeof status]}】 吗？`,
      `切换状态`,
    );
    await toggleTgGroupStatus(row.id, {
      status: newStatus,
    } as TgGroupApi.StatusParams);
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

// 删除群组操作
function onDelete(row: TgGroupApi.Item) {
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
