import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { fetchAiPromptTemplateDropdown } from '#/api/telegram';
import { fetchTgAccountConfigDropdown } from '#/api/telegram/account-config';

// 表单schema（新增/编辑）
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      fieldName: 'userID',
      label: '用户ID',
      rules: 'required',
      formItemClass: 'col-span-1',
      componentProps: { style: { width: '100%' } },
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: '手机号',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: '用户名',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'firstName',
      label: '名',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'lastName',
      label: '姓',
    },
    {
      component: 'Input',
      fieldName: 'languageCode',
      label: '语言代码',
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      componentProps: {
        options: [
          { label: '已启用', value: 1 },
          { label: '已禁用', value: 0 },
        ],
        style: { width: '100%' },
      },
      defaultValue: 1,
      rules: 'required',
      formItemClass: 'col-span-1',
    },
    {
      component: 'InputNumber',
      fieldName: 'screenIndex',
      label: '屏幕序号',
      formItemClass: 'col-span-1',
      componentProps: { style: { width: '100%' } },
    },
    {
      component: 'InputNumber',
      fieldName: 'screenX',
      label: '屏幕X',
      formItemClass: 'col-span-1',
      componentProps: { style: { width: '100%' } },
    },
    {
      component: 'InputNumber',
      fieldName: 'screenY',
      label: '屏幕Y',
      formItemClass: 'col-span-1',
      componentProps: { style: { width: '100%' } },
    },
    {
      component: 'InputNumber',
      fieldName: 'apiID',
      label: 'API ID',
      formItemClass: 'col-span-1',
      componentProps: { style: { width: '100%' } },
    },
    {
      component: 'Input',
      fieldName: 'apiHash',
      label: 'API Hash',
    },
    {
      component: 'ApiSelect',
      fieldName: 'configGroup',
      label: '配置组',
      componentProps: {
        api: fetchTgAccountConfigDropdown,
        labelField: 'label',
        valueField: 'value',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        style: { width: '100%' },
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input',
      fieldName: 'webhook',
      label: 'Webhook',
    },
    {
      component: 'ApiSelect',
      fieldName: 'promptTemplateID',
      label: 'AI提示词模板',
      componentProps: {
        api: fetchAiPromptTemplateDropdown,
        labelField: 'label',
        valueField: 'value',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        style: { width: '100%' },
        onChange: (value: any, option: { meta: any }) => {
          if (value && option && option.meta) {
            option.meta;
          }
        },
        afterFetch: (
          data: {
            id: number | string;
            label: string;
            meta: any;
            value: number | string;
          }[],
        ) =>
          data.map((item) => ({
            label: item.label,
            value: item.value,
            id: item.id,
            meta: item.meta,
          })),
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Textarea',
      fieldName: 'promptTemplateContent',
      label: '模板内容',
    },
    {
      component: 'Switch',
      fieldName: 'isAbnormal',
      label: '是否异常',
      componentProps: {
        checkedChildren: '异常',
        unCheckedChildren: '正常',
      },
      dependencies: {
        show: (values) => {
          return values.isAbnormal; // 仅当isAbnormal为true时显示
        },
        triggerFields: ['isAbnormal'],
      },
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: '备注',
    },
  ];
}

// 搜索表单schema
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'userID',
      label: '用户ID',
      componentProps: {
        placeholder: '请输入用户ID',
        allowClear: true, // 显示清除按钮
      },
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: '用户名',
      componentProps: {
        placeholder: '请输入用户名',
        allowClear: true, // 显示清除按钮
      },
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: '手机号',
      componentProps: {
        placeholder: '请输入手机号',
        allowClear: true, // 显示清除按钮
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
          { label: '已启用', value: 1 },
          { label: '已禁用', value: 0 },
        ],
      },
    },
    {
      component: 'Input',
      fieldName: 'webhook',
      label: 'Webhook',
      componentProps: {
        placeholder: '请输入Webhook',
        allowClear: true, // 显示清除按钮
      },
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: '时间范围',
    },
  ];
}

// 表格列配置
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', title: 'ID', width: 60, fixed: 'left' },
    { field: 'userID', title: '用户ID', width: 120, fixed: 'left' },
    { field: 'username', title: '用户名', width: 120 },
    { field: 'firstName', title: '名', width: 100 },
    { field: 'lastName', title: '姓', width: 100 },
    { field: 'phoneNumber', title: '手机号', width: 140 },
    { field: 'languageCode', title: '语言', width: 100 },
    { field: 'prompt', title: '提示词', minWidth: 180 },
    { field: 'webhook', title: 'Webhook', minWidth: 180 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'screenX', title: '屏幕X', width: 80 },
    { field: 'screenY', title: '屏幕Y', width: 80 },
    { field: 'screenIndex', title: '屏幕序号', width: 80 },
    { field: 'apiID', title: 'API ID', width: 120 },
    { field: 'apiHash', title: 'API Hash', minWidth: 160 },
    {
      field: 'isAbnormal',
      title: '异常',
      width: 80,
      cellRender: { name: 'CellTag' },
    },
    { field: 'remark', minWidth: 100, title: '备注' },
    { field: 'createdAt', title: '创建时间', width: 160 },
    { field: 'updatedAt', title: '更新时间', width: 160 },
    { field: 'promptTemplateID', title: '模板ID', width: 100 },
    { field: 'promptTemplateContent', title: '模板内容', minWidth: 160 },
    {
      align: 'right',
      cellRender: {
        attrs: {
          nameField: 'id',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
          '群组管理',
          '关键词配置',
        ],
      },
      field: 'operation',
      // fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 260,
    },
  ];
}
