<script lang="ts" setup>
import type { PropType } from 'vue';

// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemAdminApi, SystemRoleApi } from '#/api/system';

import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  reactive,
  ref,
} from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, useVbenModal, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Space,
  Tag,
  Tree,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAdmin,
  downloadAdminExport,
  fetchAdminExportStatus,
  fetchAdminList,
  fetchAdminRoles,
  fetchRoleTreeOptions,
  resetAdminInitialState,
  resetAdminPassword,
  triggerAdminExport,
  updateAdminRoles,
  updateAdminStatus,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  buildAdminCacheTargets,
  openSystemCachePage,
} from '#/utils/cache/navigation';
import {
  downloadBlobFile,
  ensureDownloadBlobSuccess,
  resolveRequestErrorMessage,
} from '#/utils/file/download';
import { createAsyncJobPoller } from '#/utils/imex/job';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';
import {
  copyTextToClipboard,
  generateRandomPassword,
  validateStrongPassword,
} from '#/utils/security/password';

import { resolveBackendMessage } from '../shared';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import {
  buildAdminRoleRelationMaps,
  buildAdminRoleTreeOptions,
  collectAdminRoleIds,
  collectAdminRoleSubtreeIds,
  collectAllAdminRoleNodeIds,
  isAdminRoleNodeCheckable,
  pruneInheritedAdminRoleIds,
} from './role-tree';

defineOptions({ name: 'SystemAdminListPage' });

// MFA_SCENARIO_RESET_USER_PASSWORD 表示后台重置管理员密码二次校验场景。
const MFA_SCENARIO_RESET_USER_PASSWORD = 7;
// MFA_SCENARIO_RESET_USER_INITIAL_STATE 表示后台重置管理员首次状态二次校验场景。
const MFA_SCENARIO_RESET_USER_INITIAL_STATE = 8;
// MFA_SCENARIO_DELETE_USER 表示后台删除管理员二次校验场景。
const MFA_SCENARIO_DELETE_USER = 9;
// MFA_SCENARIO_USER_STATUS 表示修改管理员状态二次校验场景。
const MFA_SCENARIO_USER_STATUS = 4;
// MFA_SCENARIO_EDIT_USER 表示编辑管理员资料与角色的二次校验场景。
const MFA_SCENARIO_EDIT_USER = 6;
// ADMIN_EXPORT_POLL_INTERVAL_MS 表示管理员导出状态轮询间隔。
const ADMIN_EXPORT_POLL_INTERVAL_MS = 2000;
// router 用于跳转缓存管理页并带入管理员相关缓存 key。
const router = useRouter();

// AdminExportStatusMap 把导出状态映射成易读文案。
const AdminExportStatusMap: Record<
  SystemAdminApi.ExportStatusResp['status'],
  string
> = {
  failed: $t('business.message.failed'),
  queued: $t('business.message.queued'),
  running: $t('business.message.exporting'),
  succeeded: $t('business.message.completed'),
};

// PasswordEditorState 保存弹窗里当前待提交的密码。
interface PasswordEditorState {
  value: string;
}

// PasswordChangeHandler 定义密码编辑器对外回写密码的回调签名。
type PasswordChangeHandler = (value: string) => void;

// PasswordEditor 用于在重置密码相关弹窗中统一提供生成随机密码和复制能力。
const PasswordEditor = defineComponent({
  name: 'PasswordEditor',
  props: {
    alertMessage: {
      default: '',
      type: String,
    },
    buttonText: {
      default: $t('business.message.generateCopyRandomPassword'),
      type: String,
    },
    copySuccessMessage: {
      default: $t('business.message.passwordCopied'),
      type: String,
    },
    onUpdatePassword: {
      required: true,
      type: Function as PropType<PasswordChangeHandler>,
    },
    passwordValue: {
      required: true,
      type: String,
    },
    placeholder: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    const syncPassword = (event: Event) => {
      props.onUpdatePassword((event.target as HTMLInputElement).value);
    };
    const onGenerateAndCopy = async () => {
      const password = generateRandomPassword();
      props.onUpdatePassword(password);
      await copyTextToClipboard(
        password,
        props.copySuccessMessage,
        $t('business.message.noPasswordToCopy'),
      );
    };

    return () =>
      h('div', { class: 'space-y-3' }, [
        props.alertMessage
          ? h(Alert, {
              message: props.alertMessage,
              showIcon: true,
              type: 'warning',
            })
          : null,
        h(Input.Password, {
          autofocus: true,
          onChange: syncPassword,
          onInput: syncPassword,
          placeholder: props.placeholder,
          value: props.passwordValue,
        }),
        h(Space, { wrap: true }, () => [
          h(
            Button,
            {
              onClick: onGenerateAndCopy,
              size: 'small',
            },
            () => props.buttonText,
          ),
        ]),
      ]);
  },
});

// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑用户。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 角色配置弹窗 =================
// currentAdmin 保存当前正在配置角色的管理员。
const currentAdmin = ref<SystemAdminApi.Item>();
// roleOptions 保存角色树配置选项。
const roleOptions = ref<Array<Record<string, any>>>([]);
// selectedRoleIds 保存当前选中的角色 ID。
const selectedRoleIds = ref<number[]>([]);
// expandedRoleIds 保存当前展开的角色节点。
const expandedRoleIds = ref<number[]>([]);
// roleKeyword 保存角色树搜索关键字。
const roleKeyword = ref('');

// RoleModal 用于覆盖保存管理员角色。
const [RoleModal, roleModalApi] = useVbenModal({
  appendToMain: true,
  class: 'w-[560px]',
  destroyOnClose: true,
  draggable: true,
  onConfirm: onSaveRoles,
  title: $t('business.message.roleConfig'),
});

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 统一承载分页、搜索和操作列。
const lastAdminQuery = ref<SystemAdminApi.ExportParams>({});
const exportSubmitting = ref(false);
const exportDownloading = ref(false);
const exportStatus = ref<null | SystemAdminApi.ExportStatusResp>(null);
const adminExportPoller = createAsyncJobPoller<SystemAdminApi.ExportStatusResp>(
  {
    fetchStatus: fetchAdminExportStatus,
    intervalMs: ADMIN_EXPORT_POLL_INTERVAL_MS,
    onStatusChange: (status) => {
      exportStatus.value = status;
    },
  },
);

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
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询用户列表，并对齐后端 page/pageSize 参数。
        query: async ({ page }: { page: any }, formValues: any) => {
          lastAdminQuery.value = normalizeAdminExportParams(formValues);
          return await fetchAdminList({
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
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

// pruneInheritedRoleIDs 过滤已被父角色覆盖的子角色，避免提交冗余关系。
function pruneInheritedRoleIDs(roleIDs: number[]) {
  return pruneInheritedAdminRoleIds(roleIDs, roleOptions.value);
}

// updateCheckedRoleIds 按账号角色分配规则维护角色选中集合。
function updateCheckedRoleIds(
  sourceCheckedIDs: number[],
  nodeID: number,
  nextChecked: boolean,
) {
  const { childrenById, nodeById } = buildAdminRoleRelationMaps(
    roleOptions.value,
  );
  const checkedSet = new Set(sourceCheckedIDs);
  const currentNode = nodeById.get(nodeID);
  if (!isAdminRoleNodeCheckable(currentNode)) {
    return [...checkedSet].toSorted((a, b) => a - b);
  }

  if (nextChecked) {
    checkedSet.add(nodeID);
    const childIDs = childrenById.get(nodeID) || [];
    if (childIDs.length > 0) {
      collectAdminRoleSubtreeIds(nodeID, childrenById, nodeById)
        .filter((item) => item !== nodeID)
        .forEach((item) => checkedSet.delete(item));
    }
  } else {
    checkedSet.delete(nodeID);
  }

  return [...checkedSet].toSorted((a, b) => a - b);
}

// filterRoleOptionTree 按关键字过滤角色树，并保留命中节点的父级路径。
function filterRoleOptionTree(items: Array<Record<string, any>>) {
  const keyword = roleKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return items;
  }
  const walk = (
    nodes: Array<Record<string, any>>,
  ): Array<Record<string, any>> =>
    nodes
      .map((item) => {
        const children = item.children?.length ? walk(item.children) : [];
        const matched = String(item.rawTitle || item.titleText || '')
          .toLowerCase()
          .includes(keyword);
        if (matched || children.length > 0) {
          return { ...item, children };
        }
        return undefined;
      })
      .filter(Boolean) as Array<Record<string, any>>;
  return walk(items);
}

// filteredRoleTree 返回当前角色配置弹窗实际展示的角色树。
const filteredRoleTree = computed<any[]>(() =>
  filterRoleOptionTree(roleOptions.value),
);

// buildRoleTitle 构造角色树节点标题。
function buildRoleTitle(item: SystemRoleApi.Item) {
  return h(
    'div',
    {
      class: 'flex items-center gap-2 py-0.5',
    },
    [
      h(
        'span',
        {
          class: item.disabled
            ? 'text-[var(--ant-color-text-description)]'
            : '',
        },
        item.title,
      ),
      item.disabled
        ? h(
            Tag,
            { bordered: false, color: 'default' },
            { default: () => $t('business.message.notSelectable') },
          )
        : null,
    ],
  );
}

// onActionClick 统一处理表格操作列事件。
function onActionClick(e: OnActionClickParams<SystemAdminApi.Item>) {
  switch (e.code) {
    case 'cache': {
      onOpenAdminCache(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'resetPassword': {
      onResetPassword(e.row);
      break;
    }
    case 'resetUser': {
      onResetInitialState(e.row);
      break;
    }
    case 'roleConfig': {
      onAssignRoles(e.row);
      break;
    }
  }
}

// onOpenAdminCache 跳转缓存管理页并定位当前管理员关联的模板缓存实例。
async function onOpenAdminCache(row: SystemAdminApi.Item) {
  await openSystemCachePage(router, {
    source: $t('business.message.userManagementSource', [row.username]),
    targets: buildAdminCacheTargets(row.id),
  });
}

// onCreate 打开新增用户抽屉。
function onCreate() {
  formDrawerApi.setData({}).open();
}

// onEdit 打开编辑用户抽屉。
function onEdit(row: SystemAdminApi.Item) {
  formDrawerApi.setData(row).open();
}

// onRefresh 刷新用户表格。
function onRefresh() {
  gridApi.query();
}

// onTriggerExport 提交管理员列表异步导出任务，并启动轮询。
async function onTriggerExport() {
  exportSubmitting.value = true;
  stopAdminExportPolling();
  try {
    const response = await triggerAdminExport(lastAdminQuery.value);
    exportStatus.value = {
      averageRowsPerSec: 0,
      createdAt: '',
      downloadReady: false,
      downloadUrl: '',
      errorMessage: '',
      estimatedSeconds: 0,
      fileName: '',
      finishedAt: '',
      jobId: response.jobId,
      lastProcessedAt: '',
      processAt: '',
      processed: 0,
      progress: 0,
      queue: response.queue,
      startedAt: '',
      status: response.status as SystemAdminApi.ExportStatusResp['status'],
      taskId: response.taskId,
      total: 0,
      updatedAt: '',
    };
    message.success($t('business.message.adminExportSubmitted'));
    await refreshAdminExportStatus(false);
  } finally {
    exportSubmitting.value = false;
  }
}

// onDownloadExport 下载已完成的管理员导出文件。
async function onDownloadExport() {
  if (!exportStatus.value?.jobId) {
    message.warning($t('business.message.noExportFile'));
    return;
  }
  exportDownloading.value = true;
  try {
    const blob = await ensureDownloadBlobSuccess(
      await downloadAdminExport(exportStatus.value.jobId),
      $t('business.message.adminExportDownloadFailed'),
    );
    downloadBlobFile(blob, exportStatus.value.fileName || 'admin_export.xlsx');
    message.success($t('business.message.adminExportDownloadSucceeded'));
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.adminExportDownloadApiUnavailable'),
    );
    message.error(
      $t('business.message.adminExportDownloadFailedWithReason', [
        errorMessage,
      ]),
    );
  } finally {
    exportDownloading.value = false;
  }
}

// refreshAdminExportStatus 查询管理员导出进度，并在未完成时继续轮询。
async function refreshAdminExportStatus(manual: boolean) {
  if (!exportStatus.value?.jobId) {
    return;
  }
  try {
    const latestStatus = await adminExportPoller.refresh(
      exportStatus.value.jobId,
    );
    if (latestStatus.status === 'succeeded') {
      message.success($t('business.message.adminExportCompleted'));
      return;
    }
    if (latestStatus.status === 'failed') {
      message.error(
        resolveBackendMessage(
          latestStatus.errorMessage,
          'business.message.adminExportFailed',
        ),
      );
      return;
    }
    if (manual) {
      message.success($t('business.message.adminExportStatusRefreshed'));
    }
  } catch (error) {
    if (manual) {
      const errorMessage = await resolveRequestErrorMessage(
        error,
        $t('business.message.adminExportStatusApiUnavailable'),
      );
      message.error(
        $t('business.message.adminExportStatusRefreshFailed', [errorMessage]),
      );
    }
  }
}

// stopAdminExportPolling 停止管理员导出状态轮询。
function stopAdminExportPolling() {
  adminExportPoller.stop();
}

// normalizeAdminExportParams 把表格搜索条件归一化为导出请求参数。
function normalizeAdminExportParams(formValues: Record<string, any> = {}) {
  const roleID = Number(formValues.roleID || 0);
  const statusValue =
    formValues.status === 0 || formValues.status === 1
      ? (formValues.status as SystemAdminApi.Status)
      : undefined;
  return {
    realName: String(formValues.realName || '').trim() || undefined,
    roleID: roleID > 0 ? roleID : undefined,
    status: statusValue,
    username: String(formValues.username || '').trim() || undefined,
  } satisfies SystemAdminApi.ExportParams;
}

// exportStatusLabel 返回当前管理员导出状态中文文案。
const exportStatusLabel = computed(() => {
  const currentStatus = exportStatus.value?.status;
  if (!currentStatus) {
    return '';
  }
  return AdminExportStatusMap[currentStatus] || currentStatus;
});

// exportProgressSummary 返回当前管理员导出进度摘要。
const exportProgressSummary = computed(() => {
  if (!exportStatus.value) {
    return '';
  }
  const status = exportStatus.value;
  const summaryParts = [
    `${status.progress || 0}%`,
    $t('business.message.processedCount', [
      status.processed || 0,
      status.total || 0,
    ]),
  ];
  if (status.averageRowsPerSec > 0) {
    summaryParts.push(
      $t('business.message.rowsPerSecond', [status.averageRowsPerSec]),
    );
  }
  if (status.estimatedSeconds > 0) {
    summaryParts.push(
      $t('business.message.estimatedSecondsLeft', [status.estimatedSeconds]),
    );
  }
  return summaryParts.join($t('business.message.commaSeparator'));
});

onBeforeUnmount(() => {
  stopAdminExportPolling();
});

// onStatusChange 切换用户状态。
async function onStatusChange(newStatus: number, row: SystemAdminApi.Item) {
  const statusText: Record<number, string> = {
    0: $t('business.message.disable'),
    1: $t('business.message.enable'),
  };
  try {
    await confirm(
      $t('business.message.confirmSwitchUserStatus', [
        row.username,
        statusText[newStatus],
      ]),
      $t('business.message.switchUserStatus'),
    );
    await submitWithMfaRetry(
      MFA_SCENARIO_USER_STATUS,
      (ticket) =>
        updateAdminStatus(
          row.id,
          newStatus as SystemAdminApi.Status,
          ticketPayload(ticket),
        ),
      $t('business.message.switchUserStatusMfaTitle'),
    );
    return true;
  } catch {
    return false;
  }
}

// onAssignRoles 打开角色配置弹窗并加载角色树和当前用户角色。
async function onAssignRoles(row: SystemAdminApi.Item) {
  currentAdmin.value = row;
  roleKeyword.value = '';
  expandedRoleIds.value = [];
  roleModalApi.setState({
    title: $t('business.message.roleConfigTitle', [row.username]),
  });
  roleModalApi.open();
  roleModalApi.setState({ loading: true });
  try {
    const [roles, userRoles] = await Promise.all([
      fetchRoleTreeOptions(),
      fetchAdminRoles(row.id),
    ]);
    roleOptions.value = buildAdminRoleTreeOptions(roles, buildRoleTitle);
    selectedRoleIds.value = userRoles.map((item) => item.id);
    expandedRoleIds.value = collectAllAdminRoleNodeIds(roleOptions.value);
  } finally {
    roleModalApi.setState({ loading: false });
  }
}

// onSaveRoles 覆盖保存用户角色。
async function onSaveRoles() {
  if (!currentAdmin.value) {
    return;
  }
  const finalRoleIDs = pruneInheritedRoleIDs(selectedRoleIds.value);
  if (finalRoleIDs.length === 0) {
    message.error($t('business.message.selectAtLeastOneRole'));
    return;
  }
  roleModalApi.setState({ loading: true });
  submitWithMfaRetry(
    MFA_SCENARIO_EDIT_USER,
    (ticket) =>
      updateAdminRoles(
        currentAdmin.value!.id,
        finalRoleIDs,
        ticketPayload(ticket),
      ),
    $t('business.message.editUserRoleMfaTitle'),
  )
    .then(() => {
      message.success($t('business.message.userRolesConfigured'));
      roleModalApi.close();
      onRefresh();
    })
    .finally(() => {
      roleModalApi.setState({ loading: false });
    });
}

// onResetPassword 打开重置密码确认框。
function onResetPassword(row: SystemAdminApi.Item) {
  const passwordState = reactive<PasswordEditorState>({
    value: generateRandomPassword(),
  });
  Modal.confirm({
    content: h(PasswordEditor, {
      copySuccessMessage: $t('business.message.newPasswordCopied'),
      onUpdatePassword: (value) => {
        passwordState.value = value;
      },
      passwordValue: passwordState.value,
      placeholder: $t('business.message.strongPasswordPlaceholder'),
    }),
    onOk: async () => {
      const password = String(passwordState.value || '').trim();
      const passwordError = validateStrongPassword(
        password,
        $t('business.message.password'),
      );
      if (passwordError) {
        message.error(passwordError);
        throw new Error(passwordError);
      }
      await submitWithMfaRetry(
        MFA_SCENARIO_RESET_USER_PASSWORD,
        (ticket) => resetAdminPassword(row.id, password, ticketPayload(ticket)),
        $t('business.message.resetPasswordMfaTitle'),
      );
      message.success($t('business.message.userPasswordReset'));
    },
    title: $t('business.message.resetUserPassword'),
  });
}

// onResetInitialState 把账号重置到首次登录前状态，并清空 MFA 绑定信息。
function onResetInitialState(row: SystemAdminApi.Item) {
  const passwordState = reactive<PasswordEditorState>({
    value: generateRandomPassword(),
  });
  Modal.confirm({
    content: h(PasswordEditor, {
      alertMessage: $t('business.message.resetInitialStateAlert'),
      buttonText: $t('business.message.generateCopyTemporaryPassword'),
      copySuccessMessage: $t('business.message.temporaryPasswordCopied'),
      onUpdatePassword: (value) => {
        passwordState.value = value;
      },
      passwordValue: passwordState.value,
      placeholder: $t('business.message.temporaryPasswordPlaceholder'),
    }),
    onOk: async () => {
      const password = String(passwordState.value || '').trim();
      const passwordError = validateStrongPassword(
        password,
        $t('business.message.temporaryPassword'),
      );
      if (passwordError) {
        message.error(passwordError);
        throw new Error(passwordError);
      }
      await submitWithMfaRetry(
        MFA_SCENARIO_RESET_USER_INITIAL_STATE,
        (ticket) =>
          resetAdminInitialState(row.id, password, ticketPayload(ticket)),
        $t('business.message.resetInitialStateMfaTitle'),
      );
      message.success($t('business.message.accountResetBeforeFirstLogin'));
      onRefresh();
    },
    title: $t('business.message.resetInitialState'),
  });
}

// onDelete 删除用户。
function onDelete(row: SystemAdminApi.Item) {
  Modal.confirm({
    content: $t('business.message.confirmDeleteUser', [row.username]),
    onOk: async () => {
      await submitWithMfaRetry(
        MFA_SCENARIO_DELETE_USER,
        (ticket) => deleteAdmin(row.id, ticketPayload(ticket)),
        $t('business.message.deleteUserMfaTitle'),
      );
      message.success($t('business.message.userDeleted'));
      onRefresh();
    },
    title: $t('business.message.deleteUser'),
  });
}

// onCheckAllRoles 勾选全部可用角色。
function onCheckAllRoles() {
  selectedRoleIds.value = collectAdminRoleIds(roleOptions.value);
}

// onClearRoles 清空角色勾选。
function onClearRoles() {
  selectedRoleIds.value = [];
}

// onExpandRoleTree 同步角色树展开状态。
function onExpandRoleTree(keys: Array<number | string>) {
  expandedRoleIds.value = keys.map(Number);
}

// onRoleCheck 统一处理角色树勾选，保证与权限配置交互规则一致。
function onRoleCheck(_checkedKeys: unknown, event: any) {
  const nodeID = Number(event?.node?.id ?? event?.node?.key ?? 0);
  if (!nodeID) {
    return;
  }
  selectedRoleIds.value = updateCheckedRoleIds(
    selectedRoleIds.value,
    nodeID,
    Boolean(event?.checked),
  );
}

// confirm 封装通用确认弹窗。
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error($t('business.message.cancelled')));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}
</script>

<template>
  <Page auto-content-height>
    <RoleModal>
      <div class="px-2 py-3">
        <Alert
          class="mb-3"
          :message="$t('business.message.roleAssignIndependentDesc')"
          show-icon
          type="info"
        />
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Input
            v-model:value="roleKeyword"
            allow-clear
            class="w-[240px]"
            :placeholder="$t('business.message.searchRoleName')"
          />
          <Space wrap>
            <Tag color="processing">
              {{
                $t('business.message.selectedCount', [selectedRoleIds.length])
              }}
            </Tag>
            <Tag color="default">
              {{ $t('business.message.disabledRoleNotSelectable') }}
            </Tag>
            <Button size="small" @click="onCheckAllRoles">
              {{ $t('business.message.checkAllEnabled') }}
            </Button>
            <Button size="small" @click="onClearRoles">
              {{ $t('business.message.clear') }}
            </Button>
          </Space>
        </div>
        <div
          class="max-h-[420px] overflow-auto rounded-md border border-[var(--ant-color-border-secondary)] px-2 py-2"
        >
          <Tree
            :checked-keys="selectedRoleIds"
            :expanded-keys="expandedRoleIds"
            checkable
            check-strictly
            block-node
            :field-names="{ children: 'children', key: 'id', title: 'title' }"
            :tree-data="filteredRoleTree"
            @check="onRoleCheck"
            @expand="onExpandRoleTree"
          />
        </div>
      </div>
    </RoleModal>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('business.message.userManagement')">
      <template #toolbar-tools>
        <Space wrap>
          <Tag v-if="exportStatus" color="processing">
            {{ $t('business.message.exportStatusLabel', [exportStatusLabel]) }}
          </Tag>
          <span
            v-if="exportStatus"
            class="text-xs text-[var(--ant-color-text-description)]"
          >
            {{ exportProgressSummary }}
          </span>
          <VbenButton
            v-if="exportStatus?.jobId"
            :disabled="exportSubmitting"
            @click="refreshAdminExportStatus(true)"
          >
            {{ $t('business.message.refreshProgress') }}
          </VbenButton>
          <VbenButton
            v-if="exportStatus?.downloadReady"
            :loading="exportDownloading"
            @click="onDownloadExport"
          >
            {{ $t('business.message.downloadFile') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_EXPORT)
            "
            :loading="exportSubmitting"
            @click="onTriggerExport"
          >
            {{ $t('business.message.asyncExportExcel') }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.ADMIN_ADD)
            "
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" /> {{ $t('business.message.addUser') }}
          </VbenButton>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
