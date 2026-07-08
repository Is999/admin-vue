import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemCacheApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  cacheCategoryTagMap,
  redisTypeTagMap,
  refreshScopeTagMap,
  supportTagMap,
  yesNoTagMap,
} from '../table-tags';

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
      align: 'center',
      cellRender: {
        attrs: { tagMap: cacheCategoryTagMap() },
        name: 'CellTag',
      },
      field: 'category',
      minWidth: 100,
      title: $t('business.message.cacheCategory'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: redisTypeTagMap() },
        name: 'CellTag',
      },
      field: 'type',
      title: $t('business.message.redisType'),
      width: 120,
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: yesNoTagMap() },
        name: 'CellTag',
      },
      field: 'isTemplate',
      title: $t('business.message.templateKey'),
      width: 100,
    },
    buildClampTextColumn({
      field: 'exampleKey',
      minWidth: 220,
      title: $t('business.message.exampleKey'),
    }),
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: supportTagMap() },
        name: 'CellTag',
      },
      field: 'autoRebuild',
      title: $t('business.message.autoRebuild'),
      width: 110,
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: refreshScopeTagMap() },
        name: 'CellTag',
      },
      field: 'refreshScope',
      title: $t('business.message.refreshScope'),
      width: 110,
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
          {
            code: 'warmupCache',
            icon: 'templateWarmup',
            iconOnly: true,
            text: $t('business.message.warmupByTemplate'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.CACHE_WARMUP,
            ),
            visible: (row: SystemCacheApi.Item) => row.warmupSupported,
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
