import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { UserApi } from '#/api/user';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  USER_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// userStatusOptions 返回用户账号状态选项，避免语言切换后沿用模块初始化时的旧文案。
export function userStatusOptions() {
  return [
    { label: $t('business.message.enabled'), value: 1 },
    { label: $t('business.message.disabled'), value: 0 },
  ];
}

// USER_SHARD_NO_MAX 表示用户分片号最大值。
const USER_SHARD_NO_MAX = 1023;

// useGridFormSchema 返回用户列表筛选表单配置。
export function useGridFormSchema(
  statusFilterSupported = true,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'id',
      label: 'ID',
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByUserId'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'shardNo',
      label: $t('business.message.shardNo'),
      componentProps: {
        max: USER_SHARD_NO_MAX,
        min: 0,
        placeholder: $t('business.message.filterByShardNo'),
        precision: 0,
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('business.message.username'),
      componentProps: {
        allowClear: true,
        autocomplete: 'off',
        placeholder: $t('business.message.filterByUsername'),
      },
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('business.message.email'),
      componentProps: {
        allowClear: true,
        autocomplete: 'off',
        placeholder: $t('business.message.filterByEmailExact'),
      },
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('business.message.phone'),
      componentProps: {
        allowClear: true,
        autocomplete: 'off',
        placeholder: $t('business.message.filterByPhoneExact'),
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.accountStatus'),
      componentProps: {
        allowClear: true,
        disabled: !statusFilterSupported,
        options: userStatusOptions(),
        placeholder: statusFilterSupported
          ? $t('business.message.filterByStatus')
          : $t('business.message.userStatusFilterUnavailableInShardMode'),
      },
    },
  ];
}

// useColumns 返回用户管理表格列配置。
export function useColumns<T = UserApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', minWidth: 180, title: 'ID' },
    {
      field: 'shardNo',
      title: $t('business.message.shardNo'),
      width: 100,
    },
    buildClampTextColumn({
      field: 'username',
      fixed: 'left',
      minWidth: 150,
      title: $t('business.message.username'),
    }),
    buildClampTextColumn({
      field: 'nickname',
      minWidth: 140,
      title: $t('business.message.nickname'),
    }),
    // field 保持稳定列标识，实际展示只读取后端脱敏字段。
    buildClampTextColumn(
      {
        field: 'email',
        minWidth: 180,
        title: $t('business.message.email'),
      },
      {
        getText: ({ row }) => row.emailMasked,
      },
    ),
    buildClampTextColumn(
      {
        field: 'phone',
        minWidth: 140,
        title: $t('business.message.phone'),
      },
      {
        getText: ({ row }) => row.phoneMasked,
      },
    ),
    {
      cellRender: {
        attrs: {
          auth: asActionPermission(
            USER_ACTION_PERMISSION_CODES.USER_STATUS_UPDATE,
          ),
          beforeChange: onStatusChange,
        },
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
            allAuth: asActionPermission([
              USER_ACTION_PERMISSION_CODES.USER_UPDATE,
              USER_ACTION_PERMISSION_CODES.USER_INFO,
            ]),
            code: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
          },
          {
            auth: asActionPermission(
              USER_ACTION_PERMISSION_CODES.USER_PASSWORD_RESET,
            ),
            code: 'resetPassword',
            iconOnly: true,
            text: $t('business.message.resetPassword'),
          },
          {
            auth: asActionPermission(
              USER_ACTION_PERMISSION_CODES.USER_RUNTIME_SYNC,
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
