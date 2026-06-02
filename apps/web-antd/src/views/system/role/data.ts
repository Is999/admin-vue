import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import { fetchRoleTreeOptions } from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// statusOptions 返回角色状态选项，避免语言切换后沿用模块初始化时的旧文案。
function statusOptions() {
  return [
    { label: $t('business.message.enable'), value: 1 },
    { label: $t('business.message.disable'), value: 0 },
  ];
}

// useFormSchema 返回角色新增与编辑表单配置。
export function useFormSchema(
  roleTree: Array<Record<string, any>> = [],
  onPidChange?: (value: number) => Promise<void> | void,
  disableStatusEdit = false,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.roleName'),
      rules: 'required',
    },
    {
      component: 'TreeSelect',
      fieldName: 'pid',
      help: $t('business.message.parentRoleHelp'),
      label: $t('business.message.parentRole'),
      componentProps: {
        allowClear: false,
        fieldNames: {
          children: 'children',
          label: 'title',
          value: 'id',
        },
        onChange: onPidChange,
        placeholder: $t('business.message.selectParentRole'),
        style: { width: '100%' },
        treeData: roleTree,
        treeDefaultExpandAll: true,
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'RadioGroup',
      defaultValue: 1,
      fieldName: 'status',
      label: $t('business.message.roleStatus'),
      componentProps: {
        buttonStyle: 'solid',
        disabled: disableStatusEdit,
        options: statusOptions(),
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('business.message.roleDescription'),
      componentProps: {
        autoSize: { minRows: 3, maxRows: 5 },
        maxlength: 255,
        showCount: true,
      },
      formItemClass: 'col-span-2',
    },
  ];
}

// useGridFormSchema 返回角色列表搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.roleName'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByRoleName'),
      },
    },
    {
      component: 'ApiTreeSelect',
      fieldName: 'pid',
      label: $t('business.message.parentRole'),
      componentProps: {
        api: fetchRoleTreeOptions,
        allowClear: true,
        fieldNames: {
          children: 'children',
          label: 'title',
          value: 'id',
        },
        placeholder: $t('business.message.filterByParentRole'),
        treeDefaultExpandAll: true,
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.roleStatus'),
      componentProps: {
        allowClear: true,
        options: statusOptions(),
        placeholder: $t('business.message.filterByStatus'),
      },
    },
  ];
}

// useColumns 返回角色管理表格列配置。
export function useColumns<T = SystemRoleApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'title',
      fixed: 'left',
      minWidth: 240,
      title: $t('business.message.roleName'),
      treeNode: true,
    },
    {
      align: 'center',
      field: 'id',
      title: $t('business.message.roleId'),
      width: 110,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          auth: asActionPermission(
            SYSTEM_ACTION_PERMISSION_CODES.ROLE_STATUS_UPDATE,
          ),
          beforeChange: onStatusChange,
          disabled: (row: SystemRoleApi.Item) => Number(row.id) === 1,
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('business.message.status'),
      width: 140,
    },
    buildClampTextColumn({
      field: 'description',
      minWidth: 260,
      title: $t('business.message.remark'),
    }),
    buildClampTextColumn({
      field: 'pids',
      minWidth: 160,
      title: $t('business.message.levelPath'),
    }),
    {
      field: 'createdAt',
      minWidth: 170,
      title: $t('business.message.createdAt'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'title',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'addChild',
            icon: 'plus',
            iconOnly: true,
            text: $t('business.message.addChild'),
            auth: asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.ROLE_ADD),
          },
          {
            code: 'edit',
            icon: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.ROLE_UPDATE,
            ),
          },
          {
            code: 'permission',
            icon: 'setting',
            iconOnly: true,
            text: $t('business.message.permissionConfig'),
            auth: asActionPermission([
              SYSTEM_ACTION_PERMISSION_CODES.ROLE_PERMISSION_TREE,
              SYSTEM_ACTION_PERMISSION_CODES.ROLE_PERMISSION_UPDATE,
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
            code: 'delete',
            danger: true,
            icon: 'delete',
            iconOnly: true,
            text: $t('business.message.delete'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.ROLE_DELETE,
            ),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 120,
    },
  ];
}
