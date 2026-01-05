import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { fetchTgGroupBotKeywordConfigDropdown } from '#/api/telegram/group-bot-keyword-config';
import { fetchTgGroupConfigDropdown } from '#/api/telegram/group-config';

// ================= 表单schema（新增/编辑） =================
// 群组管理的表单字段
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber', // 数字输入框组件
      fieldName: 'chatID', // 字段名：群组ID
      label: '群组ID', // 标签
      rules: 'required', // 必填校验
      formItemClass: 'col-span-1',
      componentProps: {
        style: { width: '100%' },
      },
    },
    {
      component: 'Input', // 输入框组件
      fieldName: 'chatTitle', // 字段名：群组名称
      label: '群组名称',
      rules: 'required',
    },
    {
      component: 'Select', // 下拉选择组件
      fieldName: 'status', // 字段名：状态
      label: '状态',
      componentProps: {
        options: [
          { label: '已启用', value: 1 }, // 启用选项
          { label: '已禁用', value: 0 }, // 禁用选项
        ],
        style: { width: '100%' },
      },
      defaultValue: 1, // 默认启用
      rules: 'selectRequired',
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input', // 输入框组件
      fieldName: 'remark', // 字段名：备注
      label: '备注',
    },
    {
      component: 'ApiSelect',
      fieldName: 'configGroup',
      label: '配置组',
      componentProps: {
        api: fetchTgGroupConfigDropdown,
        labelField: 'label',
        valueField: 'value',
        allowClear: true,
        showSearch: true,
        style: { width: '100%' },
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'ApiSelect',
      fieldName: 'keywordIDs',
      label: '关键词配置',
      componentProps: {
        api: fetchTgGroupBotKeywordConfigDropdown,
        labelField: 'label',
        valueField: 'value',
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        style: { width: '100%' },
      },
      formItemClass: 'col-span-2',
    },
    {
      component: 'Select',
      fieldName: 'keywordRelStatus',
      label: '关键词关系状态',
      componentProps: {
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
        ],
        style: { width: '100%' },
      },
      defaultValue: 1,
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

// ================= 搜索表单schema =================
// 群组管理的搜索表单字段
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber', // 数字输入框组件
      fieldName: 'chatID', // 字段名：群组ID
      label: '群组ID',
      componentProps: {
        placeholder: '请输入群组ID', // 占位符
      },
    },
    {
      component: 'Input', // 输入框组件
      fieldName: 'chatTitle', // 字段名：群组名称
      label: '群组名称',
      componentProps: {
        placeholder: '请输入群组名称', // 占位符
        allowClear: true, // 显示清除按钮
      },
    },
    {
      component: 'Select', // 下拉选择组件
      fieldName: 'status', // 字段名：状态
      label: '状态',
      componentProps: {
        allowClear: true, // 显示清除按钮
        placeholder: '全部', // 占位符
        options: [
          { label: '已启用', value: 1 }, // 启用选项
          { label: '已禁用', value: 0 }, // 禁用选项
        ],
      },
    },
  ];
}

// ================= 表格列配置 =================
// 群组管理表格的每一列及其属性
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', title: 'ID', width: 60, fixed: 'left' }, // 主键ID
    { field: 'chatID', title: '群组ID', width: 120 }, // 群组ID
    { field: 'chatTitle', title: '群组名称', width: 160 }, // 群组名称
    { field: 'remark', minWidth: 100, title: '备注' }, // 备注
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange }, // 状态切换事件
        name: onStatusChange ? 'CellSwitch' : 'CellTag', // 支持切换/标签
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'createdAt', title: '创建时间', width: 160 }, // 创建时间
    { field: 'updatedAt', title: '更新时间', width: 160 }, // 更新时间
    {
      align: 'right',
      cellRender: {
        attrs: {
          nameField: 'id', // 主键字段
          onClick: onActionClick, // 操作事件
        },
        name: 'CellOperation', // 操作列
        options: ['edit', 'delete'], // 编辑、删除
      },
      field: 'operation',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 130,
    },
  ];
}
