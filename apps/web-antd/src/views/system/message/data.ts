import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminMessageApi } from '#/api/message';
import type { SystemAdminApi } from '#/api/system';

import { buildClampTextColumn } from '#/adapter/vxe-table';
import { fetchAdminList } from '#/api/system';
import { $t } from '#/locales';

// MESSAGE_TYPE_OPTIONS 定义常用消息类型选项。
export const MESSAGE_TYPE_OPTIONS = [
  { label: $t('business.message.messageTypeAdminLogin'), value: 'admin_login' },
  {
    label: $t('business.message.messageTypeMemberOnline'),
    value: 'member_online',
  },
  {
    label: $t('business.message.messageTypeMemberOffline'),
    value: 'member_offline',
  },
  {
    label: $t('business.message.messageTypeRechargeLarge'),
    value: 'recharge_large',
  },
  {
    label: $t('business.message.messageTypeWithdrawRiskAudit'),
    value: 'withdraw_risk_audit',
  },
  {
    label: $t('business.message.messageTypeRechargeOrderException'),
    value: 'recharge_order_exception',
  },
  {
    label: $t('business.message.messageTypeWithdrawOrderException'),
    value: 'withdraw_order_exception',
  },
  {
    label: $t('business.message.messageTypeLeaveMessage'),
    value: 'leave_message',
  },
  {
    label: $t('business.message.messageTypeWorkHandover'),
    value: 'work_handover',
  },
];

export const PROCESSABLE_MESSAGE_TYPES = new Set([
  'recharge_order_exception',
  'withdraw_order_exception',
  'withdraw_risk_audit',
]);

export function isProcessableMessageType(type: string) {
  return PROCESSABLE_MESSAGE_TYPES.has(String(type || '').trim());
}

// MESSAGE_LEVEL_OPTIONS 定义消息等级选项。
export const MESSAGE_LEVEL_OPTIONS = [
  { label: $t('business.message.messageLevelInfo'), value: 1 },
  { label: $t('business.message.messageLevelWarning'), value: 2 },
  { label: $t('business.message.messageLevelError'), value: 3 },
];

// READ_STATUS_OPTIONS 定义已读状态筛选选项。
export const READ_STATUS_OPTIONS = [
  { label: $t('business.message.unread'), value: 0 },
  { label: $t('business.message.read'), value: 1 },
];

// fetchAdminReceiverOptions 拉取管理员下拉列表（用于收件人选择）。
export async function fetchAdminReceiverOptions() {
  const resp = await fetchAdminList({ page: 1, pageSize: 200 });
  return (resp?.list || []).map((item: SystemAdminApi.Item) => ({
    label: `${item.realName || item.username}（${item.username}）`,
    value: item.id,
  }));
}

// useSendFormSchema 返回“发送消息”表单 schema。
export function useSendFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      fieldName: 'receiverIDs',
      help: $t('business.message.messageReceiversHelp'),
      label: $t('business.message.messageReceivers'),
      formItemClass: 'col-span-2',
      componentProps: {
        api: fetchAdminReceiverOptions,
        allowClear: true,
        maxTagCount: 3,
        mode: 'multiple',
        showSearch: true,
        style: { width: '100%' },
      },
    },
    {
      component: 'Select',
      defaultValue: 'work_handover',
      fieldName: 'type',
      label: $t('business.message.messageType'),
      rules: 'selectRequired',
      formItemClass: 'col-span-1',
      componentProps: {
        options: MESSAGE_TYPE_OPTIONS,
        placeholder: $t('business.message.selectMessageType'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Select',
      defaultValue: 1,
      fieldName: 'level',
      label: $t('business.message.messageLevel'),
      rules: 'selectRequired',
      formItemClass: 'col-span-1',
      componentProps: {
        options: MESSAGE_LEVEL_OPTIONS,
        placeholder: $t('business.message.selectMessageLevel'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.title'),
      rules: 'required',
      formItemClass: 'col-span-2',
      componentProps: {
        allowClear: true,
        maxLength: 200,
        placeholder: $t('business.message.messageTitlePlaceholder'),
        showCount: true,
      },
    },
    {
      component: 'Textarea',
      fieldName: 'content',
      label: $t('business.message.content'),
      rules: 'required',
      formItemClass: 'col-span-2',
      componentProps: {
        autoSize: { minRows: 4, maxRows: 10 },
        maxLength: 2000,
        placeholder: $t('business.message.messageContentPlaceholder'),
        showCount: true,
      },
    },
    {
      component: 'Input',
      fieldName: 'link',
      label: $t('business.message.messageLink'),
      formItemClass: 'col-span-2',
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.messageLinkPlaceholder'),
      },
    },
    {
      component: 'Textarea',
      fieldName: 'data',
      label: $t('business.message.messageExtraData'),
      formItemClass: 'col-span-2',
      componentProps: {
        autoSize: { minRows: 3, maxRows: 8 },
        class: 'font-mono text-xs',
        placeholder: $t('business.message.messageExtraDataPlaceholder'),
      },
    },
  ];
}

// useGridFormSchema 返回消息收件箱搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'readStatus',
      label: $t('business.message.readStatus'),
      componentProps: {
        allowClear: true,
        options: READ_STATUS_OPTIONS,
        placeholder: $t('business.message.filterByReadStatus'),
      },
    },
    {
      component: 'Select',
      fieldName: 'type',
      label: $t('business.message.messageType'),
      componentProps: {
        allowClear: true,
        options: MESSAGE_TYPE_OPTIONS,
        placeholder: $t('business.message.filterByMessageType'),
      },
    },
    {
      component: 'Select',
      fieldName: 'level',
      label: $t('business.message.messageLevel'),
      componentProps: {
        allowClear: true,
        options: MESSAGE_LEVEL_OPTIONS,
        placeholder: $t('business.message.filterByMessageLevel'),
      },
    },
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('business.message.keyword'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByTitleContent'),
      },
    },
  ];
}

export function useSentGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'type',
      label: $t('business.message.messageType'),
      componentProps: {
        allowClear: true,
        options: MESSAGE_TYPE_OPTIONS,
        placeholder: $t('business.message.filterByMessageType'),
      },
    },
    {
      component: 'Select',
      fieldName: 'level',
      label: $t('business.message.messageLevel'),
      componentProps: {
        allowClear: true,
        options: MESSAGE_LEVEL_OPTIONS,
        placeholder: $t('business.message.filterByMessageLevel'),
      },
    },
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('business.message.keyword'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByTitleContent'),
      },
    },
  ];
}

// resolveMessageTypeLabel 把消息类型编码转换为中文展示文本。
export function resolveMessageTypeLabel(type: string) {
  return (
    MESSAGE_TYPE_OPTIONS.find((item) => item.value === type)?.label ||
    type ||
    '-'
  );
}

// useColumns 返回消息管理表格列配置。
export function useColumns<T = AdminMessageApi.Item>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    {
      field: 'type',
      formatter: ({ row }: { row: AdminMessageApi.Item }) =>
        resolveMessageTypeLabel(row.type),
      minWidth: 150,
      title: $t('business.message.type'),
    },
    {
      field: 'level',
      formatter: ({ row }: { row: AdminMessageApi.Item }) =>
        MESSAGE_LEVEL_OPTIONS.find((item) => item.value === row.level)?.label ||
        row.level,
      title: $t('business.message.messageLevel'),
      width: 90,
    },
    { field: 'title', minWidth: 200, title: $t('business.message.title') },
    buildClampTextColumn(
      {
        field: 'content',
        minWidth: 260,
        title: $t('business.message.content'),
      },
      {
        getText: ({ row }) => (row as AdminMessageApi.Item).content || '-',
      },
    ),
    {
      field: 'isRead',
      formatter: ({ row }: { row: AdminMessageApi.Item }) =>
        row.isRead
          ? $t('business.message.read')
          : $t('business.message.unread'),
      title: $t('business.message.read'),
      width: 90,
    },
    {
      field: 'handledStatus',
      formatter: ({ row }: { row: AdminMessageApi.Item }) => {
        if (!isProcessableMessageType(row.type)) {
          return '-';
        }
        if (Number(row.handledStatus || 0) === 1) {
          return row.handledByAdminName
            ? $t('business.message.messageHandledBy', [row.handledByAdminName])
            : $t('business.message.messageHandled');
        }
        return $t('business.message.messagePendingHandle');
      },
      minWidth: 140,
      title: $t('business.message.handleStatus'),
    },
    {
      field: 'handledAt',
      minWidth: 170,
      title: $t('business.message.handledAt'),
    },
    {
      field: 'senderAdminName',
      minWidth: 120,
      title: $t('business.message.sender'),
    },
    {
      field: 'createdAt',
      minWidth: 170,
      title: $t('business.message.createdAt'),
    },
    { field: 'readAt', minWidth: 170, title: $t('business.message.readAt') },
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
            code: 'detail',
            icon: 'detail',
            iconOnly: true,
            text: $t('business.message.detail'),
          },
          {
            code: 'read',
            icon: 'read',
            iconOnly: true,
            text: $t('business.message.read'),
          },
          {
            code: 'delete',
            icon: 'delete',
            iconOnly: true,
            text: $t('business.message.delete'),
            danger: true,
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 112,
    },
  ];
}

export function useSentColumns<T = AdminMessageApi.SentItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    {
      field: 'type',
      formatter: ({ row }: { row: AdminMessageApi.SentItem }) =>
        resolveMessageTypeLabel(row.type),
      minWidth: 150,
      title: $t('business.message.type'),
    },
    {
      field: 'level',
      formatter: ({ row }: { row: AdminMessageApi.SentItem }) =>
        MESSAGE_LEVEL_OPTIONS.find((item) => item.value === row.level)?.label ||
        row.level,
      title: $t('business.message.messageLevel'),
      width: 90,
    },
    { field: 'title', minWidth: 200, title: $t('business.message.title') },
    {
      field: 'receiverTotal',
      title: $t('business.message.messageReceivers'),
      width: 90,
    },
    {
      field: 'receiverReadTotal',
      title: $t('business.message.read'),
      width: 90,
    },
    {
      field: 'receiverUnreadTotal',
      title: $t('business.message.unread'),
      width: 90,
    },
    {
      field: 'handledStatus',
      formatter: ({ row }: { row: AdminMessageApi.SentItem }) => {
        if (!isProcessableMessageType(row.type)) {
          return '-';
        }
        if (Number(row.handledStatus || 0) === 1) {
          return row.handledByAdminName
            ? $t('business.message.messageHandledBy', [row.handledByAdminName])
            : $t('business.message.messageHandled');
        }
        return $t('business.message.messagePendingHandle');
      },
      minWidth: 140,
      title: $t('business.message.handleStatus'),
    },
    {
      field: 'handledAt',
      minWidth: 170,
      title: $t('business.message.handledAt'),
    },
    {
      field: 'createdAt',
      minWidth: 170,
      title: $t('business.message.createdAt'),
    },
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
            code: 'detail',
            icon: 'detail',
            iconOnly: true,
            text: $t('business.message.detail'),
          },
          {
            code: 'receivers',
            icon: 'receivers',
            iconOnly: true,
            text: $t('business.message.receiverDetails'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 96,
    },
  ];
}
