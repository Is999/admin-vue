<script lang="ts" setup>
// ================= 类型与依赖引入 =================
// 表格操作事件类型
import type { OnActionClickParams } from '#/adapter/vxe-table';
// TG账号API类型
import type { TgAccountApi } from '#/api/telegram/account';

import { ref } from 'vue';

// Vben Admin 通用页面、抽屉、按钮组件
import { Page, useVbenDrawer, useVbenModal, VbenButton } from '@vben/common-ui';
// 新增按钮图标
import { Plus } from '@vben/icons';

// Ant Design 消息与弹窗
import { message, Modal } from 'ant-design-vue';

// Vben Admin 表格适配器
import { useVbenVxeGrid } from '#/adapter/vxe-table';
// TG账号相关API
import {
  deleteTgAccount, // 删除账号API
  fetchTgAccountList, // 获取账号列表API
  toggleTgAccountStatus, // 切换账号状态API
} from '#/api/telegram/account';

import AccountGroupRelList from '../account-group-rel/list.vue';
import AccountKeywordConfigRelList from '../account-keyword-config-rel/list.vue';
// 表格列、搜索表单schema
import { useColumns, useGridFormSchema } from './data';
// 抽屉表单组件
import Form from './modules/form.vue';

// ================= 抽屉表单配置 =================
// 配置抽屉表单，支持新增/编辑账号
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 表格配置 =================
// 配置Vben Admin表格，支持分页、搜索、操作等
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]], // 时间字段映射
    schema: useGridFormSchema(), // 搜索表单schema
    submitOnChange: false, // 搜索表单变更自动提交
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

// ================= 操作事件 =================
// 操作列点击事件（详情、编辑、删除等）
function onActionClick(e: OnActionClickParams<TgAccountApi.Item>) {
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
    // 关键词配置
    case '关键词配置': {
      onKeyword(e.row);
      break;
    }
    // 群组管理
    case '群组管理': {
      onAccountGroup(e.row);
      break;
    }
  }
}

// ================ 账号关键词配置弹窗 =================
const keywordModalData = ref<{
  lockUser?: boolean;
  userID?: number;
  username?: string;
}>({});

const [KeywordModal, keywordModalApi] = useVbenModal({
  destroyOnClose: true,
  appendToMain: true,
  fullscreenButton: true,
  showConfirmButton: false,
  showCancelButton: false,
  draggable: true,
  footer: false,
  closable: true,
  class: 'w-[1200px]',
  title: '账号关键词配置',
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = keywordModalData.value;
      if (data.userID) {
        keywordModalApi.setState({
          title: `账号 ${data.username ?? ''}【${data.userID}】关键词配置`,
        });
      }
    }
  },
});

// ================ 账号群组关系弹窗 =================
const groupModalData = ref<{
  lockUser?: boolean;
  userID?: number;
  username?: string;
}>({});

const [GroupModal, groupModalApi] = useVbenModal({
  destroyOnClose: true,
  appendToMain: true,
  fullscreenButton: true,
  showConfirmButton: false,
  showCancelButton: false,
  draggable: true,
  footer: false,
  closable: true,
  class: 'w-[1200px]',
  title: '账号群组关系',
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = groupModalData.value;
      if (data.userID) {
        groupModalApi.setState({
          title: `账号 ${data.username ?? ''}【${data.userID}】群组关系`,
        });
      }
    }
  },
});

// 账号关键词配置
function onKeyword(row: TgAccountApi.Item) {
  keywordModalData.value = {
    userID: row.userID,
    username: row.username,
    lockUser: true,
  };
  keywordModalApi.setData(keywordModalData.value).open();
}

// 账号群组管理
function onAccountGroup(row: TgAccountApi.Item) {
  groupModalData.value = {
    userID: row.userID,
    username: row.username,
    lockUser: true,
  };
  groupModalApi.setData(groupModalData.value).open();
}

// 编辑账号，弹出抽屉
function onEdit(row: TgAccountApi.Item) {
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
async function onStatusChange(newStatus: number, row: TgAccountApi.Item) {
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
function onDelete(row: TgAccountApi.Item) {
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
    <KeywordModal>
      <AccountKeywordConfigRelList
        :user-id="keywordModalData.userID"
        :lock-user="keywordModalData.lockUser"
      />
    </KeywordModal>
    <GroupModal>
      <AccountGroupRelList
        :user-id="groupModalData.userID"
        :lock-user="groupModalData.lockUser"
      />
    </GroupModal>
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
