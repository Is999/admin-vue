<script lang="ts" setup>
import type { Ref } from 'vue';

import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { UserApi } from '#/api/user';

import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  reactive,
  ref,
} from 'vue';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createUser,
  downloadUserExport,
  fetchUserExportStatus,
  fetchUserDetail,
  fetchUserList,
  resetUserPassword,
  syncUserRuntime,
  triggerUserExport,
  updateUser,
  updateUserStatus,
} from '#/api/user';
import {
  asActionPermission,
  USER_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
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
} from '#/utils/security/password';

import FormTips from '../system/components/form-tips.vue';
import { resolveBackendMessage } from '../system/shared';
import { userStatusOptions, useColumns, useGridFormSchema } from './data';

defineOptions({ name: 'UserListPage' });

// MFA_SCENARIO_USER_MANAGE 表示用户管理二次校验场景。
const MFA_SCENARIO_USER_MANAGE = 13;
// USER_PASSWORD_MIN_LENGTH 表示后台设置用户密码的最小长度。
const USER_PASSWORD_MIN_LENGTH = 8;
// USER_PASSWORD_MAX_LENGTH 表示后台设置用户密码的最大长度。
const USER_PASSWORD_MAX_LENGTH = 64;
// USER_SHARD_NO_MOD 表示用户固定取模分片上限。
const USER_SHARD_NO_MOD = 1024;
// USER_EXPORT_POLL_INTERVAL_MS 表示用户导出状态轮询间隔。
const USER_EXPORT_POLL_INTERVAL_MS = 2000;

// UserExportStatusMap 把导出状态映射成易读文案。
const UserExportStatusMap: Record<UserApi.ExportStatusResp['status'], string> =
  {
    failed: $t('business.message.failed'),
    queued: $t('business.message.queued'),
    running: $t('business.message.exporting'),
    succeeded: $t('business.message.completed'),
  };

// UserFormState 保存新增和编辑抽屉中的表单字段。
interface UserFormState {
  avatar: string;
  email: string;
  nickname: string;
  password: string;
  phone: string;
  status: UserApi.Status;
  username: string;
}

// PasswordEditorState 保存重置密码弹窗中的临时密码。
interface PasswordEditorState {
  value: string;
}

// RuntimeSyncState 保存手动同步 API 运行态时的同步范围。
interface RuntimeSyncState {
  profile: boolean;
  sessions: boolean;
}

// PasswordEditor 用于重置用户密码，并提供随机密码生成和复制能力。
const PasswordEditor = defineComponent({
  name: 'UserPasswordEditor',
  props: {
    onUpdatePassword: {
      required: true,
      type: Function,
    },
    passwordValue: {
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
        $t('business.message.newPasswordCopied'),
        $t('business.message.noPasswordToCopy'),
      );
    };

    return () =>
      h('div', { class: 'space-y-3' }, [
        h(Input.Password, {
          autofocus: true,
          onChange: syncPassword,
          onInput: syncPassword,
          placeholder: $t('business.message.userPasswordPlaceholder'),
          value: props.passwordValue,
        }),
        h(Space, { wrap: true }, () => [
          h(
            Button,
            {
              onClick: onGenerateAndCopy,
              size: 'small',
            },
            () => $t('business.message.generateCopyRandomPassword'),
          ),
        ]),
      ]);
  },
});

// editorMode 标识当前抽屉是新增还是编辑。
const editorMode = ref<'create' | 'edit'>('create');
// editorSubmitting 避免用户重复提交新增或编辑请求。
const editorSubmitting = ref(false);
// currentUser 保存当前正在编辑或操作的用户。
const currentUser = ref<null | UserApi.Item>(null);
// lastUserQuery 保存当前列表筛选条件，供异步导出复用。
const lastUserQuery = ref<UserApi.ExportParams>({});
// exportSubmitting 避免重复提交用户导出任务。
const exportSubmitting = ref(false);
// exportDownloading 标记导出文件下载中。
const exportDownloading = ref(false);
// exportStatus 保存当前用户导出任务轮询状态。
const exportStatus = ref<null | UserApi.ExportStatusResp>(null);
// downloadedUserExportParts 记录当前页面已成功触发下载的文件编号。
const downloadedUserExportParts = ref<Set<number>>(new Set());
// downloadingUserExportParts 记录当前正在下载的文件编号，避免重复请求。
const downloadingUserExportParts = ref<Set<number>>(new Set());
// userExportPoller 统一轮询用户导出任务状态。
const userExportPoller = createAsyncJobPoller<UserApi.ExportStatusResp>({
  fetchStatus: fetchUserExportStatus,
  intervalMs: USER_EXPORT_POLL_INTERVAL_MS,
  onStatusChange: async (status) => {
    exportStatus.value = status;
    await downloadReadyUserExportFiles(status, false);
  },
});
// editorForm 保存新增/编辑抽屉字段。
const editorForm = reactive<UserFormState>({
  avatar: '',
  email: '',
  nickname: '',
  password: '',
  phone: '',
  status: 1,
  username: '',
});

// editorTitle 返回当前新增或编辑抽屉标题。
const editorTitle = computed(() =>
  editorMode.value === 'create'
    ? $t('business.message.addUser')
    : $t('business.message.editUser'),
);
// editorModeDesc 返回抽屉顶部说明，按新增和编辑区分用户预期。
const editorModeDesc = computed(() =>
  editorMode.value === 'create'
    ? $t('business.message.userListAddModeDesc')
    : $t('business.message.userListEditModeDesc'),
);
// formTips 定义用户抽屉底部注意事项。
const formTips = computed(() => [
  $t('business.message.userNameTip'),
  $t('business.message.userListPasswordTip'),
  $t('business.message.userContactInfoDesc'),
  $t('business.message.userRuntimeSyncDesc'),
  $t('business.message.userManageMfaTip'),
]);
// statusOptions 返回抽屉表单当前语言下的账号状态选项。
const statusOptions = computed(() => userStatusOptions());

// EditorDrawer 承载新增和编辑用户表单。
const [EditorDrawer, editorDrawerApi] = useVbenDrawer({
  onConfirm: submitEditor,
});

// Grid 使用 VbenVxeGrid 承载用户分页、筛选和行操作。
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-x-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询用户列表，只传后端支持的索引筛选字段。
        query: async ({ page }: { page: any }, formValues: any) => {
          lastUserQuery.value = normalizeListParams(formValues);
          return await fetchUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...normalizeListParams(formValues),
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

// normalizeListParams 清洗列表查询参数，避免空字符串落到后端条件中。
function normalizeListParams(values: Record<string, any> = {}) {
  const id = String(values.id || '').trim();
  const shardNo = Number(values.shardNo);
  const status =
    values.status === 0 || values.status === 1
      ? (values.status as UserApi.Status)
      : undefined;
  return {
    email: String(values.email || '').trim() || undefined,
    id: /^[1-9]\d*$/.test(id) ? id : undefined,
    phone: String(values.phone || '').trim() || undefined,
    shardNo: shardNo >= 0 && shardNo < USER_SHARD_NO_MOD ? shardNo : undefined,
    status,
    username: String(values.username || '').trim() || undefined,
  } satisfies UserApi.ListParams;
}

// resetEditorForm 重置新增/编辑表单。
function resetEditorForm() {
  editorForm.avatar = '';
  editorForm.email = '';
  editorForm.nickname = '';
  editorForm.password = '';
  editorForm.phone = '';
  editorForm.status = 1;
  editorForm.username = '';
}

// fillEditorForm 使用现有用户资料填充编辑表单。
function fillEditorForm(row: UserApi.Item) {
  editorForm.avatar = row.avatar || '';
  editorForm.email = '';
  editorForm.nickname = row.nickname || '';
  editorForm.password = '';
  editorForm.phone = '';
  editorForm.status = row.status;
  editorForm.username = row.username || '';
}

// validateUserPassword 校验后台录入的用户密码。
function validateUserPassword(password: string) {
  const value = String(password || '').trim();
  if (!value) {
    return $t('business.message.passwordRequired');
  }
  if (
    value.length < USER_PASSWORD_MIN_LENGTH ||
    value.length > USER_PASSWORD_MAX_LENGTH
  ) {
    return $t('business.message.userPasswordLengthHelp');
  }
  if (/[\u4E00-\u9FFF]/.test(value)) {
    return $t('business.message.userPasswordNoChinese');
  }
  return '';
}

// validateEditorForm 校验新增和编辑用户表单。
function validateEditorForm() {
  if (editorMode.value === 'create') {
    const username = editorForm.username.trim();
    if (username.length < 3 || username.length > 32) {
      return $t('business.message.usernameLengthHelp');
    }
    const passwordError = validateUserPassword(editorForm.password);
    if (passwordError) {
      return passwordError;
    }
  }
  return '';
}

// buildCreatePayload 构造新增用户请求。
function buildCreatePayload(ticket?: Parameters<typeof ticketPayload>[0]) {
  return {
    avatar: editorForm.avatar.trim(),
    email: editorForm.email.trim(),
    nickname: editorForm.nickname.trim(),
    password: editorForm.password.trim(),
    phone: editorForm.phone.trim(),
    status: editorForm.status,
    username: editorForm.username.trim(),
    ...ticketPayload(ticket),
  } satisfies UserApi.SaveParams;
}

// buildUpdatePayload 构造编辑用户请求。
function buildUpdatePayload(ticket?: Parameters<typeof ticketPayload>[0]) {
  const payload: UserApi.SaveParams = {
    avatar: editorForm.avatar.trim(),
    nickname: editorForm.nickname.trim(),
    ...ticketPayload(ticket),
  };
  const email = editorForm.email.trim();
  const phone = editorForm.phone.trim();
  if (email) {
    payload.email = email;
  }
  if (phone) {
    payload.phone = phone;
  }
  return payload;
}

// showRuntimeSyncResult 展示 API 运行态同步结果。
function showRuntimeSyncResult(sync?: UserApi.RuntimeSyncResp) {
  if (!sync) {
    return;
  }
  if (sync.success) {
    message.success(sync.message || $t('business.message.apiRuntimeSynced'));
    return;
  }
  message.warning(sync.message || $t('business.message.apiRuntimeSyncSkipped'));
}

// refreshGrid 刷新用户列表。
function refreshGrid() {
  gridApi.query();
}

// onTriggerExport 提交用户列表异步导出任务，并启动轮询。
async function onTriggerExport() {
  exportSubmitting.value = true;
  stopUserExportPolling();
  resetUserExportDownloadState();
  try {
    const response = await triggerUserExport(lastUserQuery.value);
    exportStatus.value = {
      averageRowsPerSec: 0,
      createdAt: '',
      downloadReady: false,
      downloadUrl: '',
      errorMessage: '',
      estimatedSeconds: 0,
      fileName: '',
      files: [],
      finishedAt: '',
      jobId: response.jobId,
      lastProcessedAt: '',
      partCount: 0,
      processAt: '',
      processed: 0,
      progress: 0,
      queue: response.queue,
      splitRows: 0,
      startedAt: '',
      status: response.status as UserApi.ExportStatusResp['status'],
      taskId: response.taskId,
      total: 0,
      updatedAt: '',
    };
    message.success($t('business.message.userExportSubmitted'));
    await refreshUserExportStatus(false);
  } finally {
    exportSubmitting.value = false;
  }
}

// onDownloadExport 下载已完成但当前页面尚未下载的用户导出文件。
async function onDownloadExport() {
  if (!exportStatus.value?.jobId) {
    message.warning($t('business.message.noExportFile'));
    return;
  }
  await downloadReadyUserExportFiles(exportStatus.value, true);
}

// downloadReadyUserExportFiles 串行下载状态中已生成且当前页面未下载的文件分片。
async function downloadReadyUserExportFiles(
  status: UserApi.ExportStatusResp,
  manual: boolean,
) {
  const files = readyUserExportFiles(status).filter(
    (file) => !downloadedUserExportParts.value.has(file.partNo),
  );
  if (files.length === 0) {
    if (manual) {
      message.warning($t('business.message.noExportFile'));
    }
    return;
  }
  exportDownloading.value = true;
  try {
    for (const file of files) {
      await downloadUserExportFile(status.jobId, file, manual);
    }
  } finally {
    exportDownloading.value = false;
  }
}

// downloadUserExportFile 下载单个用户导出文件分片。
async function downloadUserExportFile(
  jobId: string,
  file: UserApi.ExportFileItem,
  manual: boolean,
) {
  if (
    downloadedUserExportParts.value.has(file.partNo) ||
    downloadingUserExportParts.value.has(file.partNo)
  ) {
    return;
  }
  setUserExportPartSet(downloadingUserExportParts, file.partNo, true);
  try {
    const blob = await ensureDownloadBlobSuccess(
      await downloadUserExport(jobId, file.partNo),
      $t('business.message.userExportDownloadFailed'),
    );
    const fileName = file.fileName || `user_export_part_${file.partNo}.xlsx`;
    downloadBlobFile(blob, fileName);
    setUserExportPartSet(downloadedUserExportParts, file.partNo, true);
    message.success(
      $t('business.message.userExportPartDownloadSucceeded', [fileName]),
    );
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.userExportDownloadApiUnavailable'),
    );
    if (manual) {
      message.error(
        $t('business.message.userExportDownloadFailedWithReason', [
          errorMessage,
        ]),
      );
    }
  } finally {
    setUserExportPartSet(downloadingUserExportParts, file.partNo, false);
  }
}

// readyUserExportFiles 返回按编号排序的可下载文件。
function readyUserExportFiles(status?: null | UserApi.ExportStatusResp) {
  return [...(status?.files || [])]
    .filter((file) => file.downloadReady)
    .toSorted((left, right) => left.partNo - right.partNo);
}

// setUserExportPartSet 更新分片编号集合并保持 Vue 响应式。
function setUserExportPartSet(
  target: Ref<Set<number>>,
  partNo: number,
  enabled: boolean,
) {
  const next = new Set(target.value);
  if (enabled) {
    next.add(partNo);
  } else {
    next.delete(partNo);
  }
  target.value = next;
}

// resetUserExportDownloadState 重置当前导出任务的本地下载记录。
function resetUserExportDownloadState() {
  downloadedUserExportParts.value = new Set();
  downloadingUserExportParts.value = new Set();
}

// refreshUserExportStatus 查询用户导出进度，并在未完成时继续轮询。
async function refreshUserExportStatus(manual: boolean) {
  if (!exportStatus.value?.jobId) {
    return;
  }
  try {
    const latestStatus = await userExportPoller.refresh(
      exportStatus.value.jobId,
    );
    if (latestStatus.status === 'succeeded') {
      message.success($t('business.message.userExportCompleted'));
      return;
    }
    if (latestStatus.status === 'failed') {
      message.error(
        resolveBackendMessage(
          latestStatus.errorMessage,
          'business.message.userExportFailed',
        ),
      );
      return;
    }
    if (manual) {
      message.success($t('business.message.userExportStatusRefreshed'));
    }
  } catch (error) {
    if (manual) {
      const errorMessage = await resolveRequestErrorMessage(
        error,
        $t('business.message.userExportStatusApiUnavailable'),
      );
      message.error(
        $t('business.message.userExportStatusRefreshFailed', [errorMessage]),
      );
    }
  }
}

// stopUserExportPolling 停止用户导出状态轮询。
function stopUserExportPolling() {
  userExportPoller.stop();
}

// exportStatusLabel 返回当前用户导出状态中文文案。
const exportStatusLabel = computed(() => {
  const currentStatus = exportStatus.value?.status;
  if (!currentStatus) {
    return '';
  }
  return UserExportStatusMap[currentStatus] || currentStatus;
});

// pendingUserExportDownloadCount 返回当前页面尚未下载的已生成文件数。
const pendingUserExportDownloadCount = computed(
  () =>
    readyUserExportFiles(exportStatus.value).filter(
      (file) => !downloadedUserExportParts.value.has(file.partNo),
    ).length,
);

// exportProgressSummary 返回当前用户导出进度摘要。
const exportProgressSummary = computed(() => {
  if (!exportStatus.value) {
    return '';
  }
  const status = exportStatus.value;
  const readyCount = readyUserExportFiles(status).length;
  const downloadedCount = Math.min(
    downloadedUserExportParts.value.size,
    readyCount,
  );
  const summaryParts = [
    `${status.progress || 0}%`,
    status.total > 0
      ? $t('business.message.processedCount', [
          status.processed || 0,
          status.total,
        ])
      : $t('business.message.processedOnly', [status.processed || 0]),
  ];
  if (readyCount > 0) {
    summaryParts.push(
      $t('business.message.exportFileDownloadProgress', [
        downloadedCount,
        readyCount,
      ]),
    );
  }
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
  stopUserExportPolling();
});

// onActionClick 统一处理行操作。
function onActionClick(e: OnActionClickParams<UserApi.Item>) {
  switch (e.code) {
    case 'edit': {
      void onEdit(e.row);
      break;
    }
    case 'resetPassword': {
      onResetPassword(e.row);
      break;
    }
    case 'syncRuntime': {
      onSyncRuntime(e.row);
      break;
    }
  }
}

// onCreate 打开新增用户抽屉。
function onCreate() {
  currentUser.value = null;
  editorMode.value = 'create';
  resetEditorForm();
  editorDrawerApi.open();
}

// fillRandomEditorPassword 生成随机初始密码并复制，减少新增用户时手动拼复杂密码。
async function fillRandomEditorPassword() {
  const password = generateRandomPassword();
  editorForm.password = password;
  await copyTextToClipboard(
    password,
    $t('business.message.loginPasswordCopied'),
    $t('business.message.noLoginPasswordToCopy'),
  );
}

// onEdit 打开编辑用户抽屉。
async function onEdit(row: UserApi.Item) {
  currentUser.value = row;
  editorMode.value = 'edit';
  resetEditorForm();
  fillEditorForm(row);
  editorDrawerApi.open();
  editorSubmitting.value = true;
  editorDrawerApi.lock();
  try {
    const detail = await fetchUserDetail(row.id);
    currentUser.value = detail;
    fillEditorForm(detail);
  } finally {
    editorSubmitting.value = false;
    editorDrawerApi.unlock();
  }
}

// submitEditor 提交新增或编辑用户。
async function submitEditor() {
  const formError = validateEditorForm();
  if (formError) {
    message.error(formError);
    return;
  }
  editorSubmitting.value = true;
  editorDrawerApi.lock();
  try {
    const result = await submitWithMfaRetry(
      MFA_SCENARIO_USER_MANAGE,
      (ticket) =>
        editorMode.value === 'create'
          ? createUser(buildCreatePayload(ticket))
          : updateUser(currentUser.value!.id, buildUpdatePayload(ticket)),
      editorMode.value === 'create'
        ? $t('business.message.addUserMfaTitle')
        : $t('business.message.editUserMfaTitle'),
    );
    message.success(
      editorMode.value === 'create'
        ? $t('business.message.userCreated')
        : $t('business.message.userUpdated'),
    );
    showRuntimeSyncResult(result.sync);
    editorDrawerApi.close();
    refreshGrid();
  } finally {
    editorSubmitting.value = false;
    editorDrawerApi.unlock();
  }
}

// onStatusChange 修改用户启用状态。
async function onStatusChange(newStatus: number, row: UserApi.Item) {
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
    const result = await submitWithMfaRetry(
      MFA_SCENARIO_USER_MANAGE,
      (ticket) =>
        updateUserStatus(
          row.id,
          newStatus as UserApi.Status,
          ticketPayload(ticket),
        ),
      $t('business.message.switchUserStatusMfaTitle'),
    );
    showRuntimeSyncResult(result.sync);
    message.success($t('business.message.userStatusUpdated'));
    return true;
  } catch {
    return false;
  }
}

// onResetPassword 重置用户密码，并通知 API 失效登录态。
function onResetPassword(row: UserApi.Item) {
  const passwordState = reactive<PasswordEditorState>({
    value: generateRandomPassword(),
  });
  Modal.confirm({
    content: h(PasswordEditor, {
      onUpdatePassword: (value: string) => {
        passwordState.value = value;
      },
      passwordValue: passwordState.value,
    }),
    onOk: async () => {
      const password = String(passwordState.value || '').trim();
      const passwordError = validateUserPassword(password);
      if (passwordError) {
        message.error(passwordError);
        throw new Error(passwordError);
      }
      const result = await submitWithMfaRetry(
        MFA_SCENARIO_USER_MANAGE,
        (ticket) => resetUserPassword(row.id, password, ticketPayload(ticket)),
        $t('business.message.resetUserPasswordMfaTitle'),
      );
      showRuntimeSyncResult(result.sync);
      message.success($t('business.message.userPasswordReset'));
      refreshGrid();
    },
    title: $t('business.message.resetUserPassword'),
  });
}

// onSyncRuntime 手动同步用户 API 运行态缓存或登录态。
function onSyncRuntime(row: UserApi.Item) {
  const syncState = reactive<RuntimeSyncState>({
    profile: true,
    sessions: false,
  });
  Modal.confirm({
    content: h('div', { class: 'space-y-3' }, [
      h(Alert, {
        message: $t('business.message.userRuntimeSyncAlert'),
        showIcon: true,
        type: 'info',
      }),
      h(Space, { direction: 'vertical' }, () => [
        h(
          Checkbox,
          {
            checked: syncState.profile,
            onChange: (event: any) => {
              syncState.profile = Boolean(event?.target?.checked);
            },
          },
          () => $t('business.message.syncProfileCache'),
        ),
        h(
          Checkbox,
          {
            checked: syncState.sessions,
            onChange: (event: any) => {
              syncState.sessions = Boolean(event?.target?.checked);
            },
          },
          () => $t('business.message.invalidateLoginSessions'),
        ),
      ]),
    ]),
    onOk: async () => {
      const result = await submitWithMfaRetry(
        MFA_SCENARIO_USER_MANAGE,
        (ticket) =>
          syncUserRuntime(row.id, {
            profile: syncState.profile,
            sessions: syncState.sessions,
            ...ticketPayload(ticket),
          }),
        $t('business.message.syncApiRuntimeMfaTitle'),
      );
      showRuntimeSyncResult(result);
    },
    title: $t('business.message.syncApiRuntime'),
  });
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
    <Grid :table-title="$t('admin.route.userList')">
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
            @click="refreshUserExportStatus(true)"
          >
            {{ $t('business.message.refreshProgress') }}
          </VbenButton>
          <VbenButton
            v-if="pendingUserExportDownloadCount > 0"
            :loading="exportDownloading"
            @click="onDownloadExport"
          >
            {{
              $t('business.message.downloadPendingExportFiles', [
                pendingUserExportDownloadCount,
              ])
            }}
          </VbenButton>
          <VbenButton
            v-access="
              asActionPermission(USER_ACTION_PERMISSION_CODES.USER_EXPORT)
            "
            :loading="exportSubmitting"
            @click="onTriggerExport"
          >
            {{ $t('business.message.asyncExportExcel') }}
          </VbenButton>
          <VbenButton
            v-access="asActionPermission(USER_ACTION_PERMISSION_CODES.USER_ADD)"
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" /> {{ $t('business.message.addUser') }}
          </VbenButton>
        </Space>
      </template>
    </Grid>

    <EditorDrawer
      class="w-full max-w-[900px]"
      :loading="editorSubmitting"
      :title="editorTitle"
    >
      <div class="user-editor">
        <Alert
          class="user-editor__alert"
          :description="editorModeDesc"
          :message="$t('business.message.userDirectManageAlert')"
          show-icon
          type="info"
        />
        <Form :model="editorForm" layout="vertical">
          <div class="user-editor__layout">
            <section
              class="user-editor__section"
              :class="{
                'user-editor__section--edit-account': editorMode === 'edit',
                'user-editor__section--wide': editorMode === 'edit',
              }"
            >
              <div class="user-editor__section-head">
                <div>
                  <div class="user-editor__section-title">
                    {{ $t('business.message.userAccountInfo') }}
                  </div>
                  <div class="user-editor__section-desc">
                    {{ $t('business.message.userNameTip') }}
                  </div>
                </div>
              </div>
              <div class="user-editor__grid">
                <Form.Item
                  :label="$t('business.message.username')"
                  :required="editorMode === 'create'"
                >
                  <Input
                    v-model:value="editorForm.username"
                    :disabled="editorMode === 'edit'"
                    :placeholder="$t('business.message.usernamePlaceholder')"
                  />
                </Form.Item>
                <Form.Item :label="$t('business.message.accountStatus')">
                  <Select
                    v-model:value="editorForm.status"
                    :disabled="editorMode === 'edit'"
                    :options="statusOptions"
                  />
                </Form.Item>
                <Form.Item :label="$t('business.message.nickname')">
                  <Input
                    v-model:value="editorForm.nickname"
                    :placeholder="$t('business.message.nicknamePlaceholder')"
                  />
                </Form.Item>
              </div>
            </section>

            <section
              v-if="editorMode === 'create'"
              class="user-editor__section"
            >
              <div class="user-editor__section-head">
                <div>
                  <div class="user-editor__section-title">
                    {{ $t('business.message.userSecurityInfo') }}
                  </div>
                  <div class="user-editor__section-desc">
                    {{ $t('business.message.userPasswordTip') }}
                  </div>
                </div>
              </div>
              <Form.Item :label="$t('business.message.loginPassword')" required>
                <Input.Password
                  v-model:value="editorForm.password"
                  :placeholder="$t('business.message.userPasswordPlaceholder')"
                >
                  <template #addonAfter>
                    <Button type="link" @click="fillRandomEditorPassword">
                      {{ $t('business.message.generateCopyRandomPassword') }}
                    </Button>
                  </template>
                </Input.Password>
              </Form.Item>
            </section>

            <section class="user-editor__section user-editor__section--wide">
              <div class="user-editor__section-head">
                <div>
                  <div class="user-editor__section-title">
                    {{ $t('business.message.userContactInfo') }}
                  </div>
                  <div class="user-editor__section-desc">
                    {{ $t('business.message.userContactInfoDesc') }}
                  </div>
                </div>
              </div>
              <div class="user-editor__grid">
                <Form.Item :label="$t('business.message.email')">
                  <Input
                    v-model:value="editorForm.email"
                    :placeholder="
                      editorMode === 'edit'
                        ? $t('business.message.userContactEditPlaceholder')
                        : $t('business.message.email')
                    "
                  />
                  <div
                    v-if="editorMode === 'edit' && currentUser?.emailMasked"
                    class="user-editor__masked-value"
                  >
                    {{
                      $t('business.message.currentMaskedContact', [
                        currentUser.emailMasked,
                      ])
                    }}
                  </div>
                </Form.Item>
                <Form.Item :label="$t('business.message.phone')">
                  <Input
                    v-model:value="editorForm.phone"
                    :placeholder="
                      editorMode === 'edit'
                        ? $t('business.message.userContactEditPlaceholder')
                        : $t('business.message.phone')
                    "
                  />
                  <div
                    v-if="editorMode === 'edit' && currentUser?.phoneMasked"
                    class="user-editor__masked-value"
                  >
                    {{
                      $t('business.message.currentMaskedContact', [
                        currentUser.phoneMasked,
                      ])
                    }}
                  </div>
                </Form.Item>
                <Form.Item
                  class="user-editor__field-wide"
                  :label="$t('business.message.avatarUrl')"
                >
                  <Input
                    v-model:value="editorForm.avatar"
                    :placeholder="$t('business.message.avatarUrl')"
                  />
                </Form.Item>
              </div>
            </section>

            <section class="user-editor__sync">
              <div>
                <div class="user-editor__sync-title">
                  {{ $t('business.message.userRuntimeSync') }}
                </div>
                <div class="user-editor__sync-desc">
                  {{ $t('business.message.userRuntimeSyncDesc') }}
                </div>
              </div>
              <Switch
                :checked="true"
                disabled
                :checked-children="$t('business.message.enabled')"
                :un-checked-children="$t('business.message.disabled')"
              />
            </section>
          </div>
        </Form>
      </div>
      <FormTips :title="$t('business.message.userFormTips')" :tips="formTips" />
    </EditorDrawer>
  </Page>
</template>

<style scoped>
.user-editor {
  padding: 18px 22px 20px;
}

.user-editor__alert {
  margin-bottom: 16px;
}

.user-editor__layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.user-editor__section {
  padding: 14px;
  background: hsl(var(--accent) / 32%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.user-editor__section--wide,
.user-editor__sync {
  grid-column: 1 / -1;
}

.user-editor__section-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.user-editor__section-title,
.user-editor__sync-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--foreground));
}

.user-editor__section-desc,
.user-editor__sync-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
}

.user-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

.user-editor__section--edit-account .user-editor__grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.user-editor__field-wide {
  grid-column: 1 / -1;
}

.user-editor__masked-value {
  min-height: 18px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vben-text-color-secondary);
}

.user-editor :deep(.ant-form-item) {
  margin-bottom: 0;
}

.user-editor :deep(.ant-form-item-label > label) {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.user-editor :deep(.ant-input),
.user-editor :deep(.ant-input-affix-wrapper),
.user-editor :deep(.ant-select-selector) {
  border-radius: 6px;
}

.user-editor :deep(.ant-input-group-addon) {
  padding: 0;
  background: hsl(var(--accent) / 48%);
  border-color: hsl(var(--border));
}

.user-editor :deep(.ant-input-group-addon .ant-btn) {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.user-editor__sync {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 26%);
  border-radius: 8px;
}

@media (max-width: 768px) {
  .user-editor {
    padding: 14px;
  }

  .user-editor__layout,
  .user-editor__grid,
  .user-editor__section--edit-account .user-editor__grid {
    grid-template-columns: 1fr;
  }

  .user-editor__sync {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
