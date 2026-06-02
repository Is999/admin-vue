import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAdminLogApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import { $t } from '#/locales';

import { bizCodeTagMeta } from '../table-tags';

// SUCCESS_TAG_MAP 定义日志执行结果标签样式。
const SUCCESS_TAG_MAP = {
  false: { color: 'error', text: $t('business.message.failed') },
  true: { color: 'success', text: $t('business.message.success') },
};

// httpStatusTagMeta 根据 HTTP 状态码区间返回标签样式。
function httpStatusTagMeta(value: any) {
  const status = Number(value);
  if (!status) {
    return { color: 'default', text: '-' };
  }
  if (status >= 500) {
    return { color: 'error', text: status };
  }
  if (status >= 400) {
    return { color: 'warning', text: status };
  }
  if (status >= 300) {
    return { color: 'processing', text: status };
  }
  return { color: 'success', text: status };
}

// latencyTagMeta 按接口耗时突出慢请求。
function latencyTagMeta(value: any) {
  const latency = Number(value);
  if (!latency) {
    return { color: 'default', text: value ?? '-' };
  }
  if (latency >= 1000) {
    return { color: 'error', text: latency };
  }
  if (latency >= 300) {
    return { color: 'warning', text: latency };
  }
  return { color: 'success', text: latency };
}

// useGridFormSchema 返回后台日志列表搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'traceID',
      label: 'Trace ID',
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByTraceId'),
      },
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('business.message.username'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByUsername'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'userID',
      label: $t('business.message.userId'),
      componentProps: {
        min: 1,
        placeholder: $t('business.message.filterByUserId'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'action',
      label: $t('business.message.operationAction'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByAction'),
      },
    },
  ];
}

// useColumns 返回后台日志表格列配置。
export function useColumns<T = SystemAdminLogApi.Item>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    {
      field: 'username',
      fixed: 'left',
      minWidth: 120,
      title: $t('business.message.username'),
    },
    { field: 'userID', title: $t('business.message.userId'), width: 90 },
    {
      field: 'action',
      minWidth: 150,
      title: $t('business.message.operationAction'),
    },
    buildClampTextColumn({
      field: 'describe',
      minWidth: 180,
      title: $t('business.message.operationDescription'),
    }),
    buildClampTextColumn({
      field: 'route',
      minWidth: 180,
      title: $t('business.message.routeAlias'),
    }),
    buildClampTextColumn({
      field: 'method',
      minWidth: 170,
      title: $t('business.message.methodName'),
    }),
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: SUCCESS_TAG_MAP },
        name: 'CellTag',
      },
      field: 'success',
      title: $t('business.message.result'),
      width: 90,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: any }) => httpStatusTagMeta(value),
        },
        name: 'CellTag',
      },
      field: 'httpStatus',
      title: 'HTTP',
      width: 90,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: any }) => bizCodeTagMeta(value),
        },
        name: 'CellTag',
      },
      field: 'bizCode',
      title: $t('business.message.bizCode'),
      width: 90,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: any }) => latencyTagMeta(value),
        },
        name: 'CellTag',
      },
      field: 'latencyMs',
      title: $t('business.message.latencyMs'),
      width: 100,
    },
    { field: 'ip', minWidth: 140, title: $t('business.message.ipAddress') },
    {
      field: 'ipaddr',
      minWidth: 150,
      title: $t('business.message.ipLocation'),
    },
    { field: 'traceId', minWidth: 220, title: 'Trace ID' },
    buildClampTextColumn({
      field: 'errorMessage',
      minWidth: 220,
      title: $t('business.message.errorMessage'),
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
          nameField: 'action',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            icon: 'detail',
            iconOnly: true,
            text: $t('business.message.viewDetail'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 72,
    },
  ];
}
