import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { fetchTgAccountKeywordConfigDropdown } from '#/api/telegram/account-keyword-config';

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
      fieldName: 'keywordID',
      label: '关键词配置',
      rules: 'required',
      componentProps: {
        api: fetchTgAccountKeywordConfigDropdown,
        labelField: 'label',
        valueField: 'value',
        // mode: 'multiple',
        showSearch: true,
        allowClear: true,
        style: { width: '100%' },
      },
      formItemClass: 'col-span-2',
      disabled: isEdit,
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      defaultValue: 1,
      rules: 'required',
      componentProps: {
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
        ],
        style: { width: '100%' },
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Textarea',
      fieldName: 'actionPayload',
      label: '行为参数(JSON字符串)',
      componentProps: {
        autoSize: { minRows: 2, maxRows: 4 },
        placeholder: '{"reply":"自动回复内容"}',
      },
      formItemClass: 'col-span-2',
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
        showSearch: true,
        style: { width: '100%' },
        disabled: Boolean(lockUser && userID),
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      componentProps: {
        allowClear: true,
        placeholder: '全部',
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
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
    { field: 'userID', title: '账号ID', width: 120 },
    { field: 'keywordID', title: '关键词配置ID', width: 140 },
    { field: 'actionPayload', title: '行为参数', minWidth: 200 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'createdAt', title: '创建时间', width: 180 },
    { field: 'updatedAt', title: '更新时间', width: 180 },
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
