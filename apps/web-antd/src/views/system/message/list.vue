<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { AdminMessageApi } from '#/api/message';

import { computed, h, ref, watch } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';

import {
  Alert,
  Card,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAdminMessage,
  fetchAdminMessageList,
  fetchAdminMessageReceivers,
  fetchAdminMessageSentList,
  handleAdminMessage,
  markAdminMessageRead,
  sendAdminMessage,
} from '#/api/message';
import { $t } from '#/locales';

import {
  isProcessableMessageType,
  MESSAGE_LEVEL_OPTIONS,
  resolveMessageTypeLabel,
  useColumns,
  useGridFormSchema,
  useSendFormSchema,
  useSentColumns,
  useSentGridFormSchema,
} from './data';

defineOptions({ name: 'SystemMessageListPage' });

// ================= 发送消息表单 =================
// sendModalOpen 控制发送消息弹窗开关。
const sendModalOpen = ref(false);
// sending 表示当前是否正在提交发送请求。
const sending = ref(false);
const sendModalOffsetLeft = ref(0);

const sendModalSafeAreaStyle = computed(() => {
  if (!sendModalOffsetLeft.value) {
    return {};
  }
  return {
    left: `${sendModalOffsetLeft.value}px`,
    width: `calc(100% - ${sendModalOffsetLeft.value}px)`,
  };
});

function measureSidebarWidth() {
  const sidebar = document.querySelector(
    'aside.bg-sidebar, aside.bg-sidebar-deep',
  ) as HTMLElement | null;
  if (!sidebar) {
    sendModalOffsetLeft.value = 0;
    return;
  }
  sendModalOffsetLeft.value = Math.max(
    0,
    Math.round(sidebar.getBoundingClientRect().width),
  );
}

watch(
  () => sendModalOpen.value,
  (isOpen) => {
    if (!isOpen) {
      return;
    }
    window.requestAnimationFrame(measureSidebarWidth);
  },
);

const [SendForm, sendFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelClass: 'w-24',
  },
  layout: 'horizontal',
  schema: useSendFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-3',
});

const activeTab = ref<'inbox' | 'sent'>('inbox');

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载消息收件箱列表。
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询消息收件箱，并对齐后端 page/pageSize 参数。
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchAdminMessageList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

const [SentGrid] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useSentGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useSentColumns(onSentActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }: { page: any }, formValues: any) => {
          const { readStatus: _readStatus, ...rest } = formValues || {};
          return await fetchAdminMessageSentList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...rest,
          });
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

// onActionClick 处理表格操作列事件。
function onActionClick(e: OnActionClickParams<AdminMessageApi.Item>) {
  if (e.code === 'detail') {
    onViewDetail(e.row);
    return;
  }
  if (e.code === 'read') {
    onMarkRead(e.row);
    return;
  }
  if (e.code === 'delete') {
    onDeleteMessage(e.row);
  }
}

function onSentActionClick(e: OnActionClickParams<AdminMessageApi.SentItem>) {
  if (e.code === 'detail') {
    onViewSentDetail(e.row);
    return;
  }
  if (e.code === 'receivers') {
    onViewReceivers(e.row);
  }
}

// parsePayloadText 尝试把扩展数据 JSON 文本解析为对象用于展示。
function parsePayloadText(text = '') {
  const rawText = String(text || '').trim();
  if (!rawText) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(rawText), null, 2);
  } catch {
    return rawText;
  }
}

// resolveLevelText 把消息等级转换为中文。
function resolveLevelText(level: number) {
  return (
    MESSAGE_LEVEL_OPTIONS.find((item) => item.value === level)?.label ||
    String(level)
  );
}

// resolveLevelColor 把消息等级映射为 Tag 颜色。
function resolveLevelColor(level: number) {
  if (level === 3) {
    return 'error';
  }
  if (level === 2) {
    return 'warning';
  }
  return 'processing';
}

// onViewDetail 展示单条消息详情。
function onViewDetail(row: AdminMessageApi.Item) {
  const processable = isProcessableMessageType(row.type);
  const handled = Number(row.handledStatus || 0) === 1;
  Modal.info({
    content: h('div', { class: 'space-y-4' }, [
      h(Alert, {
        message: row.isRead
          ? $t('business.message.messageAlreadyReadStatus')
          : $t('business.message.messageUnreadStatus'),
        showIcon: true,
        type: row.isRead ? 'info' : 'warning',
      }),
      h(
        Descriptions,
        {
          bordered: true,
          column: 1,
          size: 'small',
        },
        {
          default: () => [
            h(
              DescriptionsItem,
              { label: $t('business.message.messageType') },
              () => resolveMessageTypeLabel(row.type),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.messageLevel') },
              () =>
                h(Tag, { color: resolveLevelColor(row.level) }, () =>
                  resolveLevelText(row.level),
                ),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.handleStatus') },
              () => {
                if (!processable) {
                  return '-';
                }
                if (handled) {
                  return row.handledByAdminName
                    ? $t('business.message.messageHandledBy', [
                        row.handledByAdminName,
                      ])
                    : $t('business.message.messageHandled');
                }
                return $t('business.message.messagePendingHandle');
              },
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.handledAt') },
              () => row.handledAt || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.sender') },
              () => row.senderAdminName || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.createdAt') },
              () => row.createdAt || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.readAt') },
              () => row.readAt || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.messageLink') },
              () => row.link || '-',
            ),
          ],
        },
      ),
      h(
        'pre',
        {
          class:
            'max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
        },
        parsePayloadText(row.content),
      ),
      row.data
        ? h(
            'pre',
            {
              class:
                'max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
            },
            parsePayloadText(row.data),
          )
        : null,
    ]),
    title: row.title || $t('business.message.messageDetailTitle', [row.id]),
    width: 820,
    okText:
      processable && !handled
        ? $t('business.message.markHandled')
        : $t('business.message.close'),
    async onOk() {
      if (!processable || handled) {
        return;
      }
      const resp: any = await handleAdminMessage({ id: row.id });
      if (resp?.alreadyHandled) {
        message.info(
          resp?.handledByAdminName
            ? $t('business.message.messageHandledByOperator', [
                resp.handledByAdminName,
              ])
            : $t('business.message.messageHandledByOther'),
        );
      } else {
        message.success($t('business.message.messageMarkedProcessed'));
      }
      await gridApi.reload();
    },
  });
}

function onViewSentDetail(row: AdminMessageApi.SentItem) {
  const processable = isProcessableMessageType(row.type);
  const handled = Number(row.handledStatus || 0) === 1;
  Modal.info({
    content: h('div', { class: 'space-y-4' }, [
      h(
        Descriptions,
        {
          bordered: true,
          column: 1,
          size: 'small',
        },
        {
          default: () => [
            h(
              DescriptionsItem,
              { label: $t('business.message.messageType') },
              () => resolveMessageTypeLabel(row.type),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.messageLevel') },
              () =>
                h(Tag, { color: resolveLevelColor(row.level) }, () =>
                  resolveLevelText(row.level),
                ),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.receiverStats') },
              () =>
                $t('business.message.receiverReadStats', [
                  row.receiverReadTotal,
                  row.receiverTotal,
                ]),
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.handleStatus') },
              () => {
                if (!processable) {
                  return '-';
                }
                if (handled) {
                  return row.handledByAdminName
                    ? $t('business.message.messageHandledBy', [
                        row.handledByAdminName,
                      ])
                    : $t('business.message.messageHandled');
                }
                return $t('business.message.messagePendingHandle');
              },
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.handledAt') },
              () => row.handledAt || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.createdAt') },
              () => row.createdAt || '-',
            ),
            h(
              DescriptionsItem,
              { label: $t('business.message.messageLink') },
              () => row.link || '-',
            ),
          ],
        },
      ),
      h(
        'pre',
        {
          class:
            'max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
        },
        parsePayloadText(row.content),
      ),
      row.data
        ? h(
            'pre',
            {
              class:
                'max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900',
            },
            parsePayloadText(row.data),
          )
        : null,
    ]),
    title: row.title || $t('business.message.sentMessageDetailTitle', [row.id]),
    width: 820,
  });
}

const receiversModalOpen = ref(false);
const receiversLoading = ref(false);
const receiversRows = ref<AdminMessageApi.ReceiverItem[]>([]);
const receiversMessageTitle = ref('');
const receiversKeyword = ref('');
const receiversReadFilter = ref<'all' | 'read' | 'unread'>('all');
const receiversOnlyDeleted = ref(false);

watch(
  () => receiversModalOpen.value,
  (isOpen) => {
    if (!isOpen) {
      return;
    }
    window.requestAnimationFrame(measureSidebarWidth);
    receiversKeyword.value = '';
    receiversReadFilter.value = 'all';
    receiversOnlyDeleted.value = false;
  },
);

const receiversStats = computed(() => {
  const rows = receiversRows.value || [];
  const total = rows.length;
  const readTotal = rows.filter(
    (item) => Number(item.readStatus || 0) === 1,
  ).length;
  const deletedTotal = rows.filter(
    (item) => Number(item.deleteStatus || 0) === 1,
  ).length;
  return {
    total,
    readTotal,
    unreadTotal: Math.max(0, total - readTotal),
    deletedTotal,
  };
});

const receiversFilteredRows = computed(() => {
  const keyword = String(receiversKeyword.value || '')
    .trim()
    .toLowerCase();
  const readFilter = receiversReadFilter.value;
  const onlyDeleted = Boolean(receiversOnlyDeleted.value);
  return (receiversRows.value || []).filter((item) => {
    const isRead = Number(item.readStatus || 0) === 1;
    const isDeleted = Number(item.deleteStatus || 0) === 1;
    if (onlyDeleted && !isDeleted) {
      return false;
    }
    if (readFilter === 'read' && !isRead) {
      return false;
    }
    if (readFilter === 'unread' && isRead) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const name =
      `${item.receiverAdminName || ''} ${item.receiverRealName || ''}`.toLowerCase();
    return name.includes(keyword);
  });
});
const receiversColumns = [
  {
    title: 'ID',
    dataIndex: 'receiverAdminId',
    key: 'receiverAdminId',
    width: 80,
  },
  {
    title: $t('business.message.account'),
    dataIndex: 'receiverAdminName',
    key: 'receiverAdminName',
  },
  {
    title: $t('business.message.realName'),
    dataIndex: 'receiverRealName',
    key: 'receiverRealName',
  },
  {
    title: $t('business.message.read'),
    dataIndex: 'readStatus',
    key: 'readStatus',
    width: 90,
    customRender: ({ text }: any) =>
      h(
        Tag,
        { color: Number(text || 0) === 1 ? 'processing' : 'default' },
        () =>
          Number(text || 0) === 1
            ? $t('business.message.read')
            : $t('business.message.unread'),
      ),
  },
  {
    title: $t('business.message.readAt'),
    dataIndex: 'readAt',
    key: 'readAt',
    width: 170,
  },
  {
    title: $t('business.message.deleted'),
    dataIndex: 'deleteStatus',
    key: 'deleteStatus',
    width: 90,
    customRender: ({ text }: any) =>
      h(Tag, { color: Number(text || 0) === 1 ? 'warning' : 'default' }, () =>
        Number(text || 0) === 1
          ? $t('business.message.yes')
          : $t('business.message.no'),
      ),
  },
];

async function onViewReceivers(row: AdminMessageApi.SentItem) {
  receiversMessageTitle.value =
    row.title || $t('business.message.messageTitleWithId', [row.id]);
  receiversModalOpen.value = true;
  receiversLoading.value = true;
  try {
    receiversRows.value = await fetchAdminMessageReceivers(row.id);
  } finally {
    receiversLoading.value = false;
  }
}

// onMarkRead 标记单条消息已读并刷新列表。
async function onMarkRead(row: AdminMessageApi.Item) {
  if (row.isRead) {
    message.info($t('business.message.messageAlreadyRead'));
    return;
  }
  await markAdminMessageRead({ ids: [row.id] });
  message.success($t('business.message.messageMarkedRead'));
  await gridApi.reload();
}

// onDeleteMessage 删除单条消息并刷新列表。
function onDeleteMessage(row: AdminMessageApi.Item) {
  Modal.confirm({
    content: $t('business.message.confirmDeleteMessage', [row.title || row.id]),
    okText: $t('business.message.delete'),
    okType: 'danger',
    onOk: async () => {
      await deleteAdminMessage({ ids: [row.id] });
      message.success($t('business.message.deleteSucceeded'));
      await gridApi.reload();
    },
    title: $t('business.message.deleteConfirmTitle'),
  });
}

// openSendModal 打开发送消息弹窗。
function openSendModal() {
  sendFormApi.resetForm();
  sendFormApi.setValues({
    level: 1,
    type: 'work_handover',
  });
  sendModalOpen.value = true;
  measureSidebarWidth();
}

// onSendConfirm 提交发送消息。
async function onSendConfirm() {
  if (sending.value) {
    return;
  }
  sending.value = true;
  try {
    const { valid } = await sendFormApi.validate();
    if (!valid) {
      return;
    }
    const values = await sendFormApi.getValues<AdminMessageApi.SendReq>();
    await sendAdminMessage(values);
    message.success($t('business.message.sendSucceeded'));
    sendModalOpen.value = false;
    await gridApi.reload();
  } finally {
    sending.value = false;
  }
}

// onMarkAllRead 把当前收件箱全部未读消息标记为已读。
async function onMarkAllRead() {
  await markAdminMessageRead({ all: true });
  message.success($t('business.message.allMessagesMarkedRead'));
  await gridApi.reload();
}

// onClearRead 清空当前收件箱全部已读消息。
function onClearRead() {
  Modal.confirm({
    content: $t('business.message.confirmClearReadMessages'),
    okText: $t('business.message.clear'),
    okType: 'danger',
    onOk: async () => {
      await deleteAdminMessage({ allRead: true });
      message.success($t('business.message.clearSucceeded'));
      await gridApi.reload();
    },
    title: $t('business.message.clearConfirmTitle'),
  });
}
</script>

<template>
  <Page auto-content-height>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <Space wrap>
        <VbenButton
          :type="activeTab === 'inbox' ? 'primary' : 'default'"
          @click="activeTab = 'inbox'"
        >
          {{ $t('business.message.inbox') }}
        </VbenButton>
        <VbenButton
          :type="activeTab === 'sent' ? 'primary' : 'default'"
          @click="activeTab = 'sent'"
        >
          {{ $t('business.message.sentMessages') }}
        </VbenButton>
      </Space>
      <Space v-if="activeTab === 'inbox'" wrap>
        <VbenButton type="primary" @click="openSendModal">
          {{ $t('business.message.sendMessage') }}
        </VbenButton>
        <VbenButton @click="onMarkAllRead">
          {{ $t('business.message.markAllRead') }}
        </VbenButton>
        <VbenButton danger @click="onClearRead">
          {{ $t('business.message.clearRead') }}
        </VbenButton>
      </Space>
    </div>
    <Grid
      v-if="activeTab === 'inbox'"
      :table-title="$t('business.message.messageInbox')"
    />
    <SentGrid v-else :table-title="$t('business.message.mySentMessages')" />

    <Modal
      v-model:open="sendModalOpen"
      :confirm-loading="sending"
      :body-style="{ padding: '16px 20px' }"
      :mask-style="sendModalSafeAreaStyle"
      :mask-closable="false"
      :wrap-style="sendModalSafeAreaStyle"
      width="980"
      :title="$t('business.message.sendMessage')"
      @cancel="() => (sendModalOpen = false)"
      @ok="onSendConfirm"
    >
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 lg:col-span-8">
          <Alert
            class="mb-3"
            :description="$t('business.message.sendMessageDesc')"
            :message="$t('business.message.sendMessageGuide')"
            show-icon
            type="info"
          />
          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-900/40">
            <SendForm />
          </div>
        </div>
        <div class="col-span-12 lg:col-span-4">
          <Card :bordered="false" class="h-full">
            <div class="space-y-3">
              <Alert
                :description="$t('business.message.messageSpecDesc')"
                :message="$t('business.message.specSuggestion')"
                show-icon
                type="warning"
              />
              <div
                class="rounded-md bg-gray-50 p-3 text-sm leading-6 dark:bg-gray-900/40"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-gray-500">
                    {{ $t('business.message.messageLevel') }}：
                  </span>
                  <Tag color="processing">
                    {{ $t('business.message.messageLevelInfo') }}
                  </Tag>
                  <Tag color="warning">
                    {{ $t('business.message.messageLevelWarning') }}
                  </Tag>
                  <Tag color="error">
                    {{ $t('business.message.messageLevelError') }}
                  </Tag>
                </div>
                <div class="mt-2 text-gray-500">
                  {{ $t('business.message.messageExtraDataSuggestion') }}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="receiversModalOpen"
      :body-style="{ padding: '16px 20px' }"
      :footer="null"
      :mask-closable="true"
      :mask-style="sendModalSafeAreaStyle"
      :wrap-style="sendModalSafeAreaStyle"
      :title="$t('business.message.receiverReadDetails')"
      width="920"
    >
      <div class="space-y-3">
        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-900/40">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-gray-500">
                {{ $t('business.message.message') }}
              </div>
              <div class="truncate text-base font-medium leading-6">
                {{ receiversMessageTitle }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Tag>
                {{ $t('business.message.totalCount', [receiversStats.total]) }}
              </Tag>
              <Tag color="processing">
                {{
                  $t('business.message.readCount', [receiversStats.readTotal])
                }}
              </Tag>
              <Tag color="default">
                {{
                  $t('business.message.unreadCount', [
                    receiversStats.unreadTotal,
                  ])
                }}
              </Tag>
              <Tag color="warning">
                {{
                  $t('business.message.deletedCount', [
                    receiversStats.deletedTotal,
                  ])
                }}
              </Tag>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
            <Input
              v-model:value="receiversKeyword"
              allow-clear
              class="w-72"
              :placeholder="$t('business.message.searchAccountName')"
            />
            <Space wrap>
              <Radio.Group
                v-model:value="receiversReadFilter"
                button-style="solid"
              >
                <Radio.Button value="all">
                  {{ $t('business.message.all') }}
                </Radio.Button>
                <Radio.Button value="unread">
                  {{ $t('business.message.unread') }}
                </Radio.Button>
                <Radio.Button value="read">
                  {{ $t('business.message.read') }}
                </Radio.Button>
              </Radio.Group>
              <Switch
                v-model:checked="receiversOnlyDeleted"
                :checked-children="$t('business.message.onlyDeleted')"
                :un-checked-children="$t('business.message.all')"
              />
            </Space>
          </div>
        </div>

        <Table
          :columns="receiversColumns"
          :data-source="receiversFilteredRows"
          :loading="receiversLoading"
          :pagination="false"
          :scroll="{ y: 420 }"
          row-key="receiverAdminId"
          size="small"
        />
      </div>
    </Modal>
  </Page>
</template>
