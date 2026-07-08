<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemAdminLogApi } from '#/api/system';

import { h } from 'vue';

import { Page } from '@vben/common-ui';

import { Descriptions, DescriptionsItem, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { fetchAdminLogList } from '#/api/system';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import JsonDetailViewer from '../components/json-detail-viewer.vue';
import { useColumns, useGridFormSchema } from './data';

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载后台操作日志分页列表。
const [Grid] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询后台操作日志，并对齐后端 page/pageSize 参数。
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchAdminLogList({
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

// onActionClick 处理日志操作列事件。
function onActionClick(e: OnActionClickParams<SystemAdminLogApi.Item>) {
  if (e.code === 'detail') {
    onViewDetail(e.row);
  }
}

// parseLogData 尝试把日志请求快照转成 JSON 展示。
function parseLogData(data = '') {
  if (!data) {
    return {};
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// onViewDetail 展示单条操作日志详情。
function onViewDetail(row: SystemAdminLogApi.Item) {
  const detailValue = parseLogData(row.data);
  const detailText = JSON.stringify(detailValue, null, 2);
  Modal.info({
    closable: true,
    content: h('div', { style: { display: 'grid', gap: '16px' } }, [
      h(
        Descriptions,
        {
          bordered: true,
          column: 1,
          size: 'small',
        },
        {
          default: () => [
            h(
              DescriptionsItem,
              { label: $t('business.message.operationAction') },
              () => row.action,
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.routeAlias') },
              () => row.route,
            ),
            h(
              DescriptionsItem,
              { label: 'Trace ID' },
              () => row.traceId || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.requestIp') },
              () => row.ip || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.executionResult') },
              () =>
                h(Tag, { color: row.success ? 'success' : 'error' }, () =>
                  row.success
                    ? $t('business.message.success')
                    : $t('business.message.failed'),
                ),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.errorMessage') },
              () => row.errorMessage || '-',
            ),
          ],
        },
      ),
      h(JsonDetailViewer, {
        copyLabel: $t('business.message.copy'),
        onCopy: () =>
          copyTextToClipboard(
            detailText,
            $t('business.message.contentCopied'),
            $t('business.message.emptyCopyContent'),
          ),
        searchPlaceholder: $t('business.message.logDataSearchPlaceholder'),
        value: detailValue,
      }),
    ]),
    maskClosable: true,
    title: $t('business.message.logDetailTitle', [row.id]),
    width: 1040,
  });
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('business.message.backendLog')" />
  </Page>
</template>
