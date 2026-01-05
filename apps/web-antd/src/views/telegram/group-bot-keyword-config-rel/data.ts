import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { fetchTgGroupDropdown } from '#/api/telegram/group';
import { fetchTgGroupBotKeywordConfigDropdown } from '#/api/telegram/group-bot-keyword-config';

// 表单schema（新增/编辑绑定关系）
export function useFormSchema(): VbenFormSchema[] {
  return [
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
      formItemClass: 'col-span-1',
    },
    {
      component: 'ApiSelect',
      fieldName: 'keywordID',
      label: '关键词配置',
      rules: 'required',
      componentProps: {
        api: fetchTgGroupBotKeywordConfigDropdown,
        labelField: 'label',
        valueField: 'value',
        // mode: 'multiple',
        showSearch: true,
        allowClear: true,
        style: { width: '100%' },
      },
      formItemClass: 'col-span-2',
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
export function useGridFormSchema(): VbenFormSchema[] {
  return [
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
    { field: 'chatID', title: '群组ID', width: 120 },
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
