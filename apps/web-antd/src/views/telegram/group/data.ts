import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

// 表单schema（新增/编辑）
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      fieldName: 'chatID',
      label: '群组ID',
      rules: 'required',
      formItemClass: 'col-span-1',
      componentProps: {
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'chatTitle',
      label: '群组名称',
      rules: 'required',
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
      rules: 'selectRequired',
      formItemClass: 'col-span-1',
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
      component: 'InputNumber',
      fieldName: 'chatTitle',
      label: '群组ID',
    },
    {
      component: 'Input',
      fieldName: 'chatTitle',
      label: '群组名称',
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      componentProps: {
        allowClear: true,
        options: [
          { label: '已启用', value: 1 },
          { label: '已禁用', value: 0 },
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
    { field: 'id', title: 'ID', width: 60, fixed: 'left' },
    { field: 'chatID', title: '群组ID', width: 120 },
    { field: 'chatTitle', title: '群组名称', width: 160 },
    { field: 'remark', minWidth: 100, title: '备注' },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'createdAt', title: '创建时间', width: 160 },
    { field: 'updatedAt', title: '更新时间', width: 160 },
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
