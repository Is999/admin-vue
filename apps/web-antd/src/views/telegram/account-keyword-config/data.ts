import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

// ================= 表单schema（新增/编辑） =================
// 关键词配置的表单字段
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input', // 输入框组件
      fieldName: 'keyword', // 字段名：关键词
      label: '关键词', // 标签
      rules: 'required', // 必填校验
    },
    {
      component: 'Input', // 输入框组件
      fieldName: 'actionType', // 字段名：行为类型
      label: '行为类型',
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
      formItemClass: 'col-span-1',
    },
  ];
}

// ================= 表格列配置 =================
// 表格的每一列及其属性
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', title: 'ID', width: 60 }, // 配置ID
    { field: 'keyword', title: '关键词', minWidth: 120 }, // 关键词
    { field: 'actionType', title: '行为类型', minWidth: 120 }, // 行为类型
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange }, // 状态切换事件
        name: onStatusChange ? 'CellSwitch' : 'CellTag', // 支持切换/标签
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'createdAt', title: '创建时间', minWidth: 160 }, // 创建时间
    { field: 'updatedAt', title: '更新时间', minWidth: 160 }, // 更新时间
    {
      align: 'right',
      cellRender: {
        attrs: {
          nameField: 'id', // 主键字段
          onClick: onActionClick, // 操作事件
        },
        name: 'CellOperation', // 操作列
        options: [
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
        ],
      },
      field: 'operation',
      // fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 130,
    },
  ];
}

// ================= 搜索表单schema =================
// 搜索表单的字段和属性
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input', // 输入框组件
      fieldName: 'keyword', // 字段名：关键词
      label: '关键词',
      componentProps: {
        placeholder: '请输入关键词', // 占位符
        allowClear: true, // 显示清除按钮
      },
    },
    {
      component: 'Input', // 输入框组件
      fieldName: 'actionType', // 字段名：行为类型
      label: '行为类型',
      componentProps: {
        placeholder: '请输入行为类型', // 占位符
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
        style: { width: '100%' },
      },
    },
  ];
}
