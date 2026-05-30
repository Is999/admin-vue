import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemPermissionApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// STATUS_OPTIONS 定义权限状态选项。
export const STATUS_OPTIONS = [
  { label: $t('business.message.enable'), value: 1 },
  { label: $t('business.message.disable'), value: 0 },
];

// TYPE_OPTIONS 定义权限类型选项，按 laravel-admin 的 0-8 类型含义展示。
export const TYPE_OPTIONS = [
  {
    color: 'green',
    label: $t('business.message.permissionTypeDirectory'),
    value: 4,
  },
  {
    color: 'green',
    label: $t('business.message.permissionTypeMenu'),
    value: 5,
  },
  {
    color: 'blue',
    label: $t('business.message.permissionTypeButton'),
    value: 7,
  },
  { color: 'gold', label: $t('business.message.permissionTypeAdd'), value: 1 },
  {
    color: 'orange',
    label: $t('business.message.permissionTypeUpdate'),
    value: 2,
  },
  {
    color: 'red',
    label: $t('business.message.permissionTypeDelete'),
    value: 3,
  },
  { color: 'cyan', label: $t('business.message.permissionTypeView'), value: 0 },
  {
    color: 'purple',
    label: $t('business.message.permissionTypePage'),
    value: 6,
  },
  {
    color: 'default',
    label: $t('business.message.permissionTypeOther'),
    value: 8,
  },
];

// TYPE_TAG_MAP 定义权限类型在列表中的标签颜色。
export const TYPE_TAG_MAP: Record<number, any> = {};
for (const item of TYPE_OPTIONS) {
  TYPE_TAG_MAP[item.value] = { color: item.color, text: item.label };
}

// ROOT_PERMISSION_OPTION 定义权限树顶级节点选项。
const ROOT_PERMISSION_OPTION: Array<Record<string, any>> = [
  {
    children: [] as Array<Record<string, any>>,
    id: 0,
    title: $t('business.message.rootPermission'),
  },
];

// useFormSchema 返回权限新增与编辑表单配置。
export function useFormSchema(
  permissionTree: Array<Record<string, any>> = ROOT_PERMISSION_OPTION,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'uuid',
      help: $t('business.message.permissionUuidHelp'),
      label: $t('business.message.permissionUuid'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.permissionName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'module',
      label: $t('business.message.permissionModule'),
    },
    {
      component: 'TreeSelect',
      defaultValue: 0,
      fieldName: 'pid',
      help: $t('business.message.parentPermissionHelp'),
      label: $t('business.message.parentPermission'),
      componentProps: {
        allowClear: false,
        fieldNames: {
          children: 'children',
          label: 'title',
          value: 'id',
        },
        style: { width: '100%' },
        treeData: permissionTree,
        treeDefaultExpandAll: true,
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'RadioGroup',
      defaultValue: 4,
      fieldName: 'type',
      label: $t('business.message.permissionType'),
      rules: 'required',
      componentProps: {
        buttonStyle: 'solid',
        options: TYPE_OPTIONS,
        optionType: 'button',
      },
      formItemClass: 'col-span-2',
    },
    {
      component: 'RadioGroup',
      defaultValue: 1,
      fieldName: 'status',
      label: $t('business.message.permissionStatus'),
      componentProps: {
        buttonStyle: 'solid',
        options: STATUS_OPTIONS,
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('business.message.permissionDescription'),
      componentProps: {
        autoSize: { minRows: 3, maxRows: 5 },
        maxlength: 255,
        showCount: true,
      },
      formItemClass: 'col-span-2',
    },
  ];
}

// useGridFormSchema 返回权限列表搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'uuid',
      label: $t('business.message.permissionUuid'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByPermissionUuid'),
      },
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.permissionName'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByPermissionName'),
      },
    },
    {
      component: 'Input',
      fieldName: 'module',
      label: $t('business.message.permissionModule'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByPermissionModule'),
      },
    },
    {
      component: 'Select',
      fieldName: 'type',
      label: $t('business.message.permissionType'),
      componentProps: {
        allowClear: true,
        options: TYPE_OPTIONS,
        placeholder: $t('business.message.filterByType'),
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.permissionStatus'),
      componentProps: {
        allowClear: true,
        options: STATUS_OPTIONS,
        placeholder: $t('business.message.filterByStatus'),
      },
    },
  ];
}

// useColumns 返回权限管理表格列配置。
export function useColumns<T = SystemPermissionApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'title',
      fixed: 'left',
      minWidth: 240,
      title: $t('business.message.permissionName'),
      treeNode: true,
    },
    {
      align: 'center',
      field: 'uuid',
      minWidth: 160,
      title: $t('business.message.permissionUuid'),
    },
    buildClampTextColumn({
      field: 'module',
      minWidth: 200,
      title: $t('business.message.permissionModule'),
    }),
    {
      align: 'center',
      field: 'type',
      formatter: ({ row }: { row: SystemPermissionApi.Item }) =>
        TYPE_OPTIONS.find((item) => item.value === row.type)?.label ?? row.type,
      cellRender: {
        attrs: { tagMap: TYPE_TAG_MAP },
        name: 'CellTag',
      },
      title: $t('business.message.type'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: { beforeChange: onStatusChange },
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
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.PERMISSION_ADD,
            ),
          },
          {
            code: 'edit',
            icon: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.PERMISSION_UPDATE,
            ),
          },
          {
            code: 'delete',
            danger: true,
            icon: 'delete',
            iconOnly: true,
            text: $t('business.message.delete'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.PERMISSION_DELETE,
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
