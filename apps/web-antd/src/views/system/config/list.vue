<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemConfigApi } from '#/api/system';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  downloadConfigExcel,
  fetchBoundedConfigItems,
  fetchConfigCache,
  importConfigExcel,
  renewConfigCache,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  buildConfigCacheTargets,
  openSystemCachePage,
} from '#/utils/cache/navigation';
import { showCacheSyncResult } from '#/utils/cache/sync';
import {
  downloadBlobFile,
  ensureDownloadBlobSuccess,
  resolveRequestErrorMessage,
} from '#/utils/file/download';
import { createResumableUpload } from '#/utils/transfer/resumable-upload';

import { showStructuredValueModal } from '../cache/helper';
import TreeExpandToolbar from '../components/tree-expand-toolbar.vue';
import { resolveBackendMessage } from '../shared';
import { useColumns, useGridFormSchema } from './data';
import { resolveConfigHiddenEditor } from './editors/registry';
import Form from './modules/form.vue';

type SystemConfigTreeItem = SystemConfigApi.Item & {
  children?: SystemConfigTreeItem[];
  groupPath?: string;
  levelText?: string;
  pageLink?: string;
  pageLinkLabel?: string;
  parentTitle?: string;
};

// lastConfigQuery 保存当前列表筛选条件，供 Excel 导出复用。
const lastConfigQuery: SystemConfigApi.ListParams = {};
// router 用于跳转缓存管理页定位字典缓存实例。
const router = useRouter();
// configImportInputRef 绑定导入文件选择器。
const configImportInputRef = ref<HTMLInputElement | null>(null);
// configExporting 控制导出按钮状态。
const configExporting = ref(false);
// configImporting 控制导入按钮状态。
const configImporting = ref(false);

// countConfigNodes 统计配置树节点数量，用于表格总数展示。
function countConfigNodes(items: SystemConfigTreeItem[]): number {
  return items.reduce(
    (total, item) => total + 1 + countConfigNodes(item.children || []),
    0,
  );
}

// matchConfigNode 判断当前配置节点是否命中筛选条件。
function matchConfigNode(
  item: SystemConfigTreeItem,
  formValues: Record<string, any>,
) {
  const uuid = String(formValues.uuid || '')
    .trim()
    .toLowerCase();
  const title = String(formValues.title || '')
    .trim()
    .toLowerCase();
  const pagePath = String(formValues.pagePath || '')
    .trim()
    .toLowerCase();

  const matchedUUID =
    uuid === '' ||
    String(item.uuid || '')
      .toLowerCase()
      .includes(uuid);
  const matchedTitle =
    title === '' ||
    String(item.title || '')
      .toLowerCase()
      .includes(title);
  const matchedPage =
    pagePath === '' ||
    String(item.pageLink || item.page || '')
      .toLowerCase()
      .includes(pagePath);

  return matchedUUID && matchedTitle && matchedPage;
}

// buildConfigTree 把平铺配置列表转换成树表数据，并补齐层级与路径展示字段。
function buildConfigTree(
  items: SystemConfigApi.Item[],
): SystemConfigTreeItem[] {
  const childrenMap = new Map<number, SystemConfigApi.Item[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.pid) || [];
    siblings.push(item);
    childrenMap.set(item.pid, siblings);
  }
  const walk = (
    pid: number,
    ancestors: SystemConfigApi.Item[] = [],
    parentTitle = $t('business.message.topLevelConfig'),
  ): SystemConfigTreeItem[] =>
    (childrenMap.get(pid) || [])
      .toSorted((left, right) => left.id - right.id)
      .map((item) => {
        const nextAncestors = [...ancestors, item];
        const hiddenEditor = resolveConfigHiddenEditor(item.uuid);
        const pageLink = item.page || hiddenEditor?.path || '';
        return {
          ...item,
          children: walk(item.id, nextAncestors, item.title),
          groupPath: nextAncestors.map((node) => node.title).join(' / '),
          levelText: `L${ancestors.length + 1}`,
          pageLink,
          pageLinkLabel: hiddenEditor
            ? $t('business.message.configEditorPageEntry')
            : '',
          parentTitle,
        };
      });
  return walk(0);
}

// filterConfigTree 按筛选条件过滤配置树，同时保留命中节点的父级路径。
function filterConfigTree(
  items: SystemConfigTreeItem[],
  formValues: Record<string, any>,
): SystemConfigTreeItem[] {
  const walk = (nodes: SystemConfigTreeItem[]): SystemConfigTreeItem[] =>
    nodes
      .map((item) => {
        const children = item.children?.length ? walk(item.children) : [];
        if (matchConfigNode(item, formValues) || children.length > 0) {
          return {
            ...item,
            children,
          };
        }
        return undefined;
      })
      .filter(Boolean) as SystemConfigTreeItem[];
  return walk(items);
}

// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑字典配置。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载字典列表和缓存操作。
const [Grid, gridApi] = useVbenVxeGrid({
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
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        // 查询完整配置列表，并在前端按 pid 组装成树形结构。
        query: async (_params: any, formValues: any) => {
          Object.assign(lastConfigQuery, formValues || {});
          const items = await fetchBoundedConfigItems();
          const tree = buildConfigTree(items);
          const list = filterConfigTree(tree, formValues || {});
          return {
            list,
            total: countConfigNodes(list),
          };
        },
      },
      response: {
        list: 'list',
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
    treeConfig: {
      childrenField: 'children',
      expandAll: true,
      indent: 32,
      rowField: 'id',
      showLine: true,
    },
  },
});

// onActionClick 处理配置操作列事件。
function onActionClick(e: OnActionClickParams<SystemConfigApi.Item>) {
  switch (e.code) {
    case 'cache': {
      onOpenConfigCache(rowToTreeItem(e.row));
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'refreshCache': {
      onRenew(e.row);
      break;
    }
    case 'viewCache': {
      onViewCache(e.row);
      break;
    }
  }
}

// rowToTreeItem 统一把表格行转换成字典树节点结构，便于复用同一套跳转逻辑。
function rowToTreeItem(row: SystemConfigApi.Item) {
  return row as SystemConfigTreeItem;
}

// onCreate 打开新增配置抽屉。
function onCreate() {
  formDrawerApi.setData({}).open();
}

// onEdit 打开编辑配置抽屉。
function onEdit(row: SystemConfigApi.Item) {
  formDrawerApi.setData(row).open();
}

// onRefresh 刷新配置列表。
function onRefresh() {
  gridApi.query();
}

// onOpenConfigCache 跳转缓存管理页并定位当前字典配置的模板缓存实例。
async function onOpenConfigCache(row: SystemConfigTreeItem) {
  await openSystemCachePage(router, {
    autoViewKey: `config_uuid:${row.uuid}`,
    source: $t('business.message.dictionaryManagementSource', [row.uuid]),
    targets: buildConfigCacheTargets(row.uuid),
  });
}

// onExportExcel 按当前筛选条件导出字典配置 Excel。
async function onExportExcel() {
  configExporting.value = true;
  try {
    const blob = await ensureDownloadBlobSuccess(
      await downloadConfigExcel(lastConfigQuery),
      $t('business.message.dictionaryExportFailed'),
    );
    downloadBlobFile(blob, 'sys_config.xlsx');
    message.success($t('business.message.dictionaryConfigExported'));
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.dictionaryExportApiUnavailable'),
    );
    message.error(
      $t('business.message.dictionaryExportFailedWithReason', [errorMessage]),
    );
  } finally {
    configExporting.value = false;
  }
}

// onChooseImportFile 打开 Excel 导入文件选择器。
function onChooseImportFile() {
  configImportInputRef.value?.click();
}

// onImportFileChange 上传并导入字典配置 Excel。
async function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  configImporting.value = true;
  try {
    const session = await createResumableUpload({
      bizType: 'sys-config-excel-import',
      concurrency: 2,
      file,
    });
    const result = await importConfigExcel(session.uploadId);
    showCacheSyncResult(
      result,
      $t('business.message.dictionaryImportCompleted', [
        result.created,
        result.updated,
        result.skipped,
      ]),
    );
    onRefresh();
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.dictionaryImportApiUnavailable'),
    );
    message.error(
      $t('business.message.dictionaryImportFailed', [errorMessage]),
    );
  } finally {
    configImporting.value = false;
    if (input) {
      input.value = '';
    }
  }
}

// onViewCache 查看字典缓存值。
async function onViewCache(row: SystemConfigApi.Item) {
  const cache = await fetchConfigCache(row.uuid).catch((error) => {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.dictionaryCacheViewFailed',
      ),
    );
    throw error;
  });
  showStructuredValueModal(
    $t('business.message.dictionaryCacheTitle', [row.uuid]),
    cache,
    $t('business.message.cacheValue'),
  );
}

// onRenew 刷新指定字典缓存。
function onRenew(row: SystemConfigApi.Item) {
  Modal.confirm({
    content: $t('business.message.confirmRenewDictionaryCache', [row.uuid]),
    onOk: async () => {
      await renewConfigCache(row.uuid);
      message.success($t('business.message.dictionaryCacheRefreshed'));
      onRefresh();
    },
    title: $t('business.message.renewDictionaryCache'),
  });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('business.message.dictionaryManagement')">
      <template #toolbar-tools>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <input
            ref="configImportInputRef"
            accept=".xlsx"
            class="hidden"
            type="file"
            @change="onImportFileChange"
          />
          <VbenButton
            v-access="
              asActionPermission(
                SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_IMPORT,
              )
            "
            :loading="configImporting"
            @click="onChooseImportFile"
          >
            {{ $t('business.message.importExcel') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(
                SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_EXPORT,
              )
            "
            :loading="configExporting"
            @click="onExportExcel"
          >
            {{ $t('business.message.exportExcel') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(
                SYSTEM_ACTION_PERMISSION_CODES.SYSTEM_CONFIG_ADD,
              )
            "
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" />
            {{ $t('business.message.addDictionaryConfig') }}
          </VbenButton>
          <TreeExpandToolbar :grid-api="gridApi" />
        </div>
      </template>
    </Grid>
  </Page>
</template>
