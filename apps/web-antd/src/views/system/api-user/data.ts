import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAPIUserApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// API_USER_STATUS_OPTIONS 定义前台用户账号状态选项。
export const API_USER_STATUS_OPTIONS = [
  { label: $t('business.message.enabled'), value: 1 },
  { label: $t('business.message.disabled'), value: 0 },
];

// useGridFormSchema 返回前台用户列表筛选表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      fieldName: 'id',
      label: 'ID',
      componentProps: {
        min: 1,
        placeholder: $t('business.message.filterByUserId'),
        precision: 0,
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('business.message.apiUsername'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByApiUsername'),
      },
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('business.message.email'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByEmail'),
      },
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('business.message.phone'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByPhone'),
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.accountStatus'),
      componentProps: {
        allowClear: true,
        options: API_USER_STATUS_OPTIONS,
        placeholder: $t('business.message.filterByStatus'),
      },
    },
  ];
}

// useColumns 返回前台用户管理表格列配置。
export function useColumns<T = SystemAPIUserApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    buildClampTextColumn({
      field: 'username',
      fixed: 'left',
      minWidth: 150,
      title: $t('business.message.apiUsername'),
    }),
    buildClampTextColumn({
      field: 'nickname',
      minWidth: 140,
      title: $t('business.message.nickname'),
    }),
    buildClampTextColumn({
      field: 'email',
      minWidth: 180,
      title: $t('business.message.email'),
    }),
    buildClampTextColumn({
      field: 'phone',
      minWidth: 140,
      title: $t('business.message.phone'),
    }),
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('business.message.accountStatus'),
      width: 110,
    },
    buildClampTextColumn({
      field: 'lastLoginIP',
      minWidth: 140,
      title: $t('business.message.lastLoginIp'),
    }),
    buildClampTextColumn({
      field: 'lastLoginAt',
      minWidth: 170,
      title: $t('business.message.lastLoginTime'),
    }),
    buildClampTextColumn({
      field: 'createdAt',
      minWidth: 170,
      title: $t('business.message.createdAt'),
    }),
    buildClampTextColumn({
      field: 'updatedAt',
      minWidth: 170,
      title: $t('business.message.updatedAt'),
    }),
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'username',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.API_USER_UPDATE,
            ),
            code: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
          },
          {
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.API_USER_PASSWORD_RESET,
            ),
            code: 'resetPassword',
            iconOnly: true,
            text: $t('business.message.resetPassword'),
          },
          {
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.API_USER_RUNTIME_SYNC,
            ),
            code: 'syncRuntime',
            iconOnly: true,
            text: $t('business.message.syncApiRuntime'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 112,
    },
  ];
}
