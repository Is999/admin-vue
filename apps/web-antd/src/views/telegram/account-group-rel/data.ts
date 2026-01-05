import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { fetchTgGroupDropdown } from '#/api/telegram/group';

// 表单schema（新增/编辑绑定关系）
export function useFormSchema(options?: {
  isEdit?: boolean;
  lockUser?: boolean;
  userID?: number;
}): VbenFormSchema[] {
  const { userID, lockUser, isEdit } = options || {};
  return [
    {
      component: 'InputNumber',
      fieldName: 'userID',
      label: '账号',
      rules: 'required',
      defaultValue: userID,
      componentProps: {
        allowClear: true,
        style: { width: '100%' },
        disabled: Boolean(lockUser || isEdit),
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'ApiSelect',
      fieldName: 'chatID',
      label: '群组',
      rules: 'required',
      componentProps: {
        api: fetchTgGroupDropdown,
        labelField: 'label',
        valueField: 'value',
        showSearch: true,
        allowClear: true,
        style: { width: '100%' },
      },
      disabled: isEdit,
      formItemClass: 'col-span-1',
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      rules: 'required',
      defaultValue: 1,
      componentProps: {
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
        ],
        style: { width: '100%' },
      },
      formItemClass: 'col-span-1',
    },
  ];
}

// 搜索表单schema
export function useGridFormSchema(options?: {
  lockUser?: boolean;
  userID?: number;
}): VbenFormSchema[] {
  const { userID, lockUser } = options || {};
  return [
    {
      component: 'InputNumber',
      fieldName: 'userID',
      label: '账号',
      defaultValue: userID,
      componentProps: {
        allowClear: true,
        style: { width: '100%' },
        disabled: Boolean(lockUser && userID),
      },
    },
    {
      component: 'ApiSelect',
      fieldName: 'chatID',
      label: '群组',
      componentProps: {
        api: fetchTgGroupDropdown,
        labelField: 'label',
        valueField: 'value',
        allowClear: true,
        showSearch: true,
        style: { width: '100%' },
      },
    },
    {
      component: 'Select',
      fieldName: 'online',
      label: '在线状态',
      componentProps: {
        allowClear: true,
        placeholder: '全部',
        options: [
          { label: '在线', value: 1 },
          { label: '离线', value: 0 },
        ],
        style: { width: '100%' },
      },
    },
  ];
}

// 表格列配置
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'userID', title: '账号ID', width: 120, fixed: 'left' },
    { field: 'chatID', title: '群组ID', width: 120 },
    { field: 'onlineAt', title: '上线时间', width: 180 },
    { field: 'offlineAt', title: '下线时间', width: 180 },
    { field: 'createdAt', title: '创建时间', width: 180 },
    { field: 'updatedAt', title: '更新时间', width: 180 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'online',
      title: '在线状态',
      width: 120,
    },
    {
      align: 'right',
      cellRender: {
        attrs: {
          nameField: 'id',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 130,
    },
  ];
}
