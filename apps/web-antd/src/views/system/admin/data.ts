import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAdminApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import { fetchRoleTreeOptions } from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import { enabledStatusTagMap } from '../table-tags';

// statusOptions 返回后台账号状态选项，避免语言切换后沿用模块初始化时的旧文案。
function statusOptions() {
  return [
    { label: $t('business.message.enabled'), value: 1 },
    { label: $t('business.message.disabled'), value: 0 },
  ];
}

// useFormSchema 返回用户新增与编辑表单配置，账号和 MFA 状态仅在编辑时展示。
export function useFormSchema(isEdit = false): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        disabled: isEdit,
      },
      fieldName: 'username',
      label: $t('business.message.loginUsername'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('business.message.realName'),
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('business.message.email'),
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('business.message.phone'),
    },
    {
      component: 'InputPassword',
      fieldName: 'password',
      help: $t('business.message.adminPasswordHelp'),
      label: $t('business.message.loginPassword'),
      // 新增/编辑统一不在 schema 层挂密码规则，避免抽屉复用时旧必填规则残留。
      // 实际校验统一在提交阶段处理：新增必须填写，编辑留空不改，填写时校验强度。
    },
    {
      component: 'Input',
      fieldName: 'avatar',
      label: $t('business.message.avatarUrl'),
    },
    ...(isEdit
      ? [
          {
            component: 'Select' as const,
            defaultValue: 1,
            fieldName: 'status',
            label: $t('business.message.accountStatus'),
            componentProps: {
              options: statusOptions(),
              style: { width: '100%' },
            },
            formItemClass: 'col-span-1',
          },
          {
            component: 'Select' as const,
            defaultValue: 0,
            fieldName: 'mfaStatus',
            label: $t('business.message.mfaStatus'),
            componentProps: {
              options: [
                { label: $t('business.message.disabled'), value: 0 },
                { label: $t('business.message.enabled'), value: 1 },
              ],
              style: { width: '100%' },
            },
            formItemClass: 'col-span-1',
          },
        ]
      : []),
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('business.message.remarkDescription'),
    },
  ];
}

// useGridFormSchema 返回用户列表搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('business.message.loginUsername'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByLoginUsername'),
      },
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('business.message.realName'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByRealName'),
      },
    },
    {
      component: 'ApiTreeSelect',
      fieldName: 'roleID',
      label: $t('business.message.assignedRole'),
      componentProps: {
        api: fetchRoleTreeOptions,
        allowClear: true,
        fieldNames: {
          children: 'children',
          label: 'title',
          value: 'id',
        },
        placeholder: $t('business.message.filterByAssignedRole'),
        treeDefaultExpandAll: true,
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.accountStatus'),
      componentProps: {
        allowClear: true,
        options: statusOptions(),
        placeholder: $t('business.message.filterByStatus'),
      },
    },
  ];
}

// useColumns 返回用户管理表格列配置。
export function useColumns<T = SystemAdminApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    {
      field: 'username',
      fixed: 'left',
      minWidth: 140,
      title: $t('business.message.loginUsername'),
    },
    {
      field: 'realName',
      minWidth: 120,
      title: $t('business.message.realName'),
    },
    { field: 'email', minWidth: 180, title: $t('business.message.email') },
    { field: 'phone', minWidth: 130, title: $t('business.message.phone') },
    buildClampTextColumn(
      {
        field: 'roles',
        formatter: ({ row }: { row: SystemAdminApi.Item }) =>
          row.roles?.map((item) => item.title).join('、') || '-',
        minWidth: 180,
        title: $t('business.message.role'),
      },
      {
        getText: ({ row }) =>
          (row as SystemAdminApi.Item).roles
            ?.map((item) => item.title)
            .join('、') || '-',
      },
    ),
    {
      cellRender: {
        attrs: {
          auth: asActionPermission(
            SYSTEM_ACTION_PERMISSION_CODES.ADMIN_STATUS_UPDATE,
          ),
          beforeChange: onStatusChange,
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('business.message.accountStatus'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: enabledStatusTagMap() },
        name: 'CellTag',
      },
      field: 'mfaStatus',
      title: 'MFA',
      width: 90,
    },
    {
      field: 'lastLoginIP',
      minWidth: 140,
      title: $t('business.message.lastLoginIp'),
    },
    {
      field: 'lastLoginTime',
      minWidth: 170,
      title: $t('business.message.lastLoginTime'),
    },
    {
      field: 'createdAt',
      minWidth: 170,
      title: $t('business.message.createdAt'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          iconGridColumns: 3,
          nameField: 'username',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
            allAuth: asActionPermission([
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_UPDATE,
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_INFO,
            ]),
          },
          {
            code: 'cache',
            icon: 'search',
            iconOnly: true,
            text: $t('business.message.cacheManagement'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.CACHE_KEY_INFO,
            ),
          },
          {
            code: 'roleConfig',
            iconOnly: true,
            text: $t('business.message.roleConfig'),
            allAuth: asActionPermission([
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_ROLE_UPDATE,
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_ROLE_LIST,
            ]),
          },
          {
            code: 'delete',
            iconOnly: true,
            text: $t('business.message.delete'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_DELETE,
            ),
            danger: true,
          },
          {
            code: 'resetPassword',
            iconOnly: true,
            text: $t('business.message.resetPassword'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_PASSWORD_RESET,
            ),
          },
          {
            code: 'resetUser',
            iconOnly: true,
            text: $t('business.message.resetUser'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.ADMIN_RESET_INITIAL_STATE,
            ),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 104,
    },
  ];
}
