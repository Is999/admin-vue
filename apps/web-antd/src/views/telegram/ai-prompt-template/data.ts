import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

// 表单schema（新增/编辑）
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'scene',
      label: '场景',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'templateName',
      label: '模板名称',
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'promptContent',
      label: '提示词内容',
      rules: 'required',
      componentProps: {
        autoSize: { minRows: 4, maxRows: 8 },
      },
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
    },
  ];
}

// 搜索表单schema
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'scene',
      label: '场景',
      componentProps: {
        placeholder: '请输入场景',
        allowClear: true,
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
    { field: 'id', title: 'ID', width: 80, fixed: 'left' },
    { field: 'scene', title: '场景', width: 140 },
    { field: 'templateName', title: '模板名称', minWidth: 180 },
    { field: 'promptContent', title: '提示词内容', minWidth: 240 },
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
