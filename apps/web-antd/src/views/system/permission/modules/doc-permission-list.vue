<script lang="ts" setup>
import type { SystemDocPermissionApi } from '#/api/system';

import { Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchDocPermissionList,
  updateDocPermissionStatus,
} from '#/api/system';
import { $t } from '#/locales';
import { showCacheSyncResult } from '#/utils/cache/sync';

import {
  useDocPermissionColumns,
  useDocPermissionGridFormSchema,
} from './doc-permission-data';

// Grid 使用有界分页展示独立文档权限定义。
const [Grid] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useDocPermissionGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useDocPermissionColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询参数与后端文档权限分页契约保持一致。
        query: async ({ page }: { page: any }, formValues: any) =>
          fetchDocPermissionList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
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

// onStatusChange 确认并修改文档权限全局状态。
async function onStatusChange(
  newStatus: number,
  row: SystemDocPermissionApi.Item,
) {
  const statusText =
    newStatus === 1
      ? $t('business.message.enable')
      : $t('business.message.disable');
  try {
    await new Promise((resolve, reject) => {
      Modal.confirm({
        content: $t('business.message.confirmSwitchDocPermissionStatus', [
          row.title,
          statusText,
        ]),
        onCancel() {
          reject(new Error($t('business.message.cancelled')));
        },
        onOk() {
          resolve(true);
        },
        title: $t('business.message.switchDocPermissionStatus'),
      });
    });
    const cacheSyncResult = await updateDocPermissionStatus(
      row.id,
      newStatus as SystemDocPermissionApi.Status,
    );
    showCacheSyncResult(
      cacheSyncResult,
      $t('business.message.docPermissionStatusUpdated'),
    );
    return true;
  } catch {
    return false;
  }
}
</script>

<template>
  <Grid :table-title="$t('business.message.docPermissionList')" />
</template>
