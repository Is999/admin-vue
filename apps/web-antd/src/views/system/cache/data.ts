import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemCacheApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// cacheCategoryTextMap 定义缓存分类中文文案。
const cacheCategoryTextMap: Record<string, string> = {
  auth: $t('business.message.cacheCategoryAuth'),
  config: $t('business.message.cacheCategoryConfig'),
  secret: $t('business.message.cacheCategorySecret'),
  session: $t('business.message.cacheCategorySession'),
  system: $t('business.message.cacheCategorySystem'),
};

// refreshScopeTextMap 定义缓存刷新粒度中文文案。
const refreshScopeTextMap: Record<string, string> = {
  all: $t('business.message.refreshScopeAll'),
  prefix: $t('business.message.refreshScopePrefix'),
  single: $t('business.message.refreshScopeSingle'),
};

// formatCacheCategory 把缓存分类编码格式化成中文展示。
function formatCacheCategory(value?: string) {
  return cacheCategoryTextMap[value || ''] || value || '-';
}

// formatRefreshScope 把缓存刷新粒度格式化成中文展示。
function formatRefreshScope(value?: string) {
  return refreshScopeTextMap[value || ''] || value || '-';
}

// useColumns 返回缓存目标表格列配置。
export function useColumns<T = SystemCacheApi.Item>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    buildClampTextColumn({
      field: 'index',
      fixed: 'left',
      minWidth: 160,
      title: $t('business.message.cacheIndex'),
    }),
    buildClampTextColumn({
      field: 'key',
      fixed: 'left',
      minWidth: 240,
      title: $t('business.message.cacheKey'),
    }),
    buildClampTextColumn({
      field: 'keyTitle',
      minWidth: 180,
      title: $t('business.message.cacheTitle'),
    }),
    {
      field: 'category',
      minWidth: 100,
      title: $t('business.message.cacheCategory'),
      formatter: ({ cellValue }: any) => formatCacheCategory(cellValue),
    },
    { field: 'type', title: $t('business.message.redisType'), width: 120 },
    {
      field: 'isTemplate',
      title: $t('business.message.templateKey'),
      width: 100,
      formatter: ({ cellValue }: any) =>
        cellValue ? $t('business.message.yes') : $t('business.message.no'),
    },
    buildClampTextColumn({
      field: 'exampleKey',
      minWidth: 220,
      title: $t('business.message.exampleKey'),
    }),
    {
      field: 'autoRebuild',
      title: $t('business.message.autoRebuild'),
      width: 110,
      formatter: ({ cellValue }: any) =>
        cellValue
          ? $t('business.message.supported')
          : $t('business.message.unsupported'),
    },
    {
      field: 'refreshScope',
      title: $t('business.message.refreshScope'),
      width: 110,
      formatter: ({ cellValue }: any) => formatRefreshScope(cellValue),
    },
    buildClampTextColumn({
      field: 'remark',
      minWidth: 260,
      title: $t('business.message.cacheDescription'),
    }),
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'key',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'viewDetail',
            icon: 'detail',
            iconOnly: true,
            text: $t('business.message.viewDetail'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.CACHE_KEY_INFO,
            ),
          },
          {
            code: 'refreshCache',
            icon: 'reload',
            iconOnly: true,
            text: $t('business.message.refreshCache'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.CACHE_RENEW,
            ),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 96,
    },
  ];
}
