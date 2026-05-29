<script lang="ts" setup>
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemAPIUserApi } from '#/api/system';

import { computed, defineComponent, h, reactive, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';
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
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAPIUser,
  fetchAPIUserDetail,
  fetchAPIUserList,
  resetAPIUserPassword,
  syncAPIUserRuntime,
  updateAPIUser,
  updateAPIUserStatus,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';
import {
  copyTextToClipboard,
  generateRandomPassword,
} from '#/utils/security/password';

import { API_USER_STATUS_OPTIONS, useColumns, useGridFormSchema } from './data';

defineOptions({ name: 'SystemAPIUserListPage' });

// MFA_SCENARIO_API_USER_MANAGE 表示前台用户管理二次校验场景。
const MFA_SCENARIO_API_USER_MANAGE = 13;
// API_USER_PASSWORD_MIN_LENGTH 表示后台设置前台用户密码的最小长度。
const API_USER_PASSWORD_MIN_LENGTH = 8;
// API_USER_PASSWORD_MAX_LENGTH 表示后台设置前台用户密码的最大长度。
const API_USER_PASSWORD_MAX_LENGTH = 64;

// APIUserFormState 保存新增和编辑弹窗中的表单字段。
interface APIUserFormState {
  avatar: string;
  email: string;
  nickname: string;
  password: string;
  phone: string;
  status: SystemAPIUserApi.Status;
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

// PasswordEditor 用于重置前台用户密码，并提供随机密码生成和复制能力。
const PasswordEditor = defineComponent({
  name: 'APIUserPasswordEditor',
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
          placeholder: $t('business.message.apiUserPasswordPlaceholder'),
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

// editorOpen 控制新增/编辑弹窗显示。
const editorOpen = ref(false);
// editorMode 标识当前弹窗是新增还是编辑。
const editorMode = ref<'create' | 'edit'>('create');
// editorSubmitting 避免用户重复提交新增或编辑请求。
const editorSubmitting = ref(false);
// currentUser 保存当前正在编辑或操作的前台用户。
const currentUser = ref<null | SystemAPIUserApi.Item>(null);
// editorForm 保存新增/编辑弹窗字段。
const editorForm = reactive<APIUserFormState>({
  avatar: '',
  email: '',
  nickname: '',
  password: '',
  phone: '',
  status: 1,
  username: '',
});

// editorTitle 返回当前新增或编辑弹窗标题。
const editorTitle = computed(() =>
  editorMode.value === 'create'
    ? $t('business.message.addApiUser')
    : $t('business.message.editApiUser'),
);

// Grid 使用 VbenVxeGrid 承载前台用户分页、筛选和行操作。
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
        // 查询前台用户列表，只传后端支持的索引筛选字段。
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchAPIUserList({
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
  const id = Number(values.id || 0);
  const status =
    values.status === 0 || values.status === 1
      ? (values.status as SystemAPIUserApi.Status)
      : undefined;
  return {
    email: String(values.email || '').trim() || undefined,
    id: id > 0 ? id : undefined,
    phone: String(values.phone || '').trim() || undefined,
    status,
    username: String(values.username || '').trim() || undefined,
  } satisfies SystemAPIUserApi.ListParams;
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

// fillEditorForm 使用现有前台用户资料填充编辑表单。
function fillEditorForm(row: SystemAPIUserApi.Item) {
  editorForm.avatar = row.avatar || '';
  editorForm.email = row.email || '';
  editorForm.nickname = row.nickname || '';
  editorForm.password = '';
  editorForm.phone = row.phone || '';
  editorForm.status = row.status;
  editorForm.username = row.username || '';
}

// validateAPIUserPassword 校验后台录入的前台用户密码。
function validateAPIUserPassword(password: string) {
  const value = String(password || '').trim();
  if (!value) {
    return $t('business.message.passwordRequired');
  }
  if (
    value.length < API_USER_PASSWORD_MIN_LENGTH ||
    value.length > API_USER_PASSWORD_MAX_LENGTH
  ) {
    return $t('business.message.apiUserPasswordLengthHelp');
  }
  if (/[\u4E00-\u9FFF]/.test(value)) {
    return $t('business.message.apiUserPasswordNoChinese');
  }
  return '';
}

// validateEditorForm 校验新增和编辑前台用户表单。
function validateEditorForm() {
  if (editorMode.value === 'create') {
    const username = editorForm.username.trim();
    if (username.length < 3 || username.length > 32) {
      return $t('business.message.apiUsernameLengthHelp');
    }
    const passwordError = validateAPIUserPassword(editorForm.password);
    if (passwordError) {
      return passwordError;
    }
  }
  return '';
}

// buildCreatePayload 构造新增前台用户请求。
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
  } satisfies SystemAPIUserApi.SaveParams;
}

// buildUpdatePayload 构造编辑前台用户请求。
function buildUpdatePayload(ticket?: Parameters<typeof ticketPayload>[0]) {
  return {
    avatar: editorForm.avatar.trim(),
    email: editorForm.email.trim(),
    nickname: editorForm.nickname.trim(),
    phone: editorForm.phone.trim(),
    ...ticketPayload(ticket),
  } satisfies SystemAPIUserApi.SaveParams;
}

// showRuntimeSyncResult 展示 API 运行态同步结果。
function showRuntimeSyncResult(sync?: SystemAPIUserApi.RuntimeSyncResp) {
  if (!sync) {
    return;
  }
  if (sync.success) {
    message.success(sync.message || $t('business.message.apiRuntimeSynced'));
    return;
  }
  message.warning(sync.message || $t('business.message.apiRuntimeSyncSkipped'));
}

// refreshGrid 刷新前台用户列表。
function refreshGrid() {
  gridApi.query();
}

// onActionClick 统一处理行操作。
function onActionClick(e: OnActionClickParams<SystemAPIUserApi.Item>) {
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

// onCreate 打开新增前台用户弹窗。
function onCreate() {
  currentUser.value = null;
  editorMode.value = 'create';
  resetEditorForm();
  editorOpen.value = true;
}

// onEdit 打开编辑前台用户弹窗。
async function onEdit(row: SystemAPIUserApi.Item) {
  currentUser.value = row;
  editorMode.value = 'edit';
  resetEditorForm();
  editorOpen.value = true;
  editorSubmitting.value = true;
  try {
    const detail = await fetchAPIUserDetail(row.id);
    currentUser.value = detail;
    fillEditorForm(detail);
  } finally {
    editorSubmitting.value = false;
  }
}

// submitEditor 提交新增或编辑前台用户。
async function submitEditor() {
  const formError = validateEditorForm();
  if (formError) {
    message.error(formError);
    return;
  }
  editorSubmitting.value = true;
  try {
    const result = await submitWithMfaRetry(
      MFA_SCENARIO_API_USER_MANAGE,
      (ticket) =>
        editorMode.value === 'create'
          ? createAPIUser(buildCreatePayload(ticket))
          : updateAPIUser(currentUser.value!.id, buildUpdatePayload(ticket)),
      editorMode.value === 'create'
        ? $t('business.message.addApiUserMfaTitle')
        : $t('business.message.editApiUserMfaTitle'),
    );
    message.success(
      editorMode.value === 'create'
        ? $t('business.message.apiUserCreated')
        : $t('business.message.apiUserUpdated'),
    );
    showRuntimeSyncResult(result.sync);
    editorOpen.value = false;
    refreshGrid();
  } finally {
    editorSubmitting.value = false;
  }
}

// onStatusChange 修改前台用户启用状态。
async function onStatusChange(newStatus: number, row: SystemAPIUserApi.Item) {
  const statusText: Record<number, string> = {
    0: $t('business.message.disable'),
    1: $t('business.message.enable'),
  };
  try {
    await confirm(
      $t('business.message.confirmSwitchApiUserStatus', [
        row.username,
        statusText[newStatus],
      ]),
      $t('business.message.switchApiUserStatus'),
    );
    const result = await submitWithMfaRetry(
      MFA_SCENARIO_API_USER_MANAGE,
      (ticket) =>
        updateAPIUserStatus(
          row.id,
          newStatus as SystemAPIUserApi.Status,
          ticketPayload(ticket),
        ),
      $t('business.message.switchApiUserStatusMfaTitle'),
    );
    showRuntimeSyncResult(result.sync);
    message.success($t('business.message.apiUserStatusUpdated'));
    return true;
  } catch {
    return false;
  }
}

// onResetPassword 重置前台用户密码，并通知 API 失效登录态。
function onResetPassword(row: SystemAPIUserApi.Item) {
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
      const passwordError = validateAPIUserPassword(password);
      if (passwordError) {
        message.error(passwordError);
        throw new Error(passwordError);
      }
      const result = await submitWithMfaRetry(
        MFA_SCENARIO_API_USER_MANAGE,
        (ticket) =>
          resetAPIUserPassword(row.id, password, ticketPayload(ticket)),
        $t('business.message.resetApiUserPasswordMfaTitle'),
      );
      showRuntimeSyncResult(result.sync);
      message.success($t('business.message.apiUserPasswordReset'));
      refreshGrid();
    },
    title: $t('business.message.resetApiUserPassword'),
  });
}

// onSyncRuntime 手动同步前台用户 API 运行态缓存或登录态。
function onSyncRuntime(row: SystemAPIUserApi.Item) {
  const syncState = reactive<RuntimeSyncState>({
    profile: true,
    sessions: false,
  });
  Modal.confirm({
    content: h('div', { class: 'space-y-3' }, [
      h(Alert, {
        message: $t('business.message.apiUserRuntimeSyncAlert'),
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
        MFA_SCENARIO_API_USER_MANAGE,
        (ticket) =>
          syncAPIUserRuntime(row.id, {
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
    <Grid :table-title="$t('business.message.apiUserManagement')">
      <template #toolbar-tools>
        <VbenButton
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.API_USER_ADD)
          "
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" /> {{ $t('business.message.addApiUser') }}
        </VbenButton>
      </template>
    </Grid>

    <Modal
      v-model:open="editorOpen"
      :confirm-loading="editorSubmitting"
      destroy-on-close
      :title="editorTitle"
      width="720px"
      @ok="submitEditor"
    >
      <Alert
        class="mb-4"
        :message="$t('business.message.apiUserDirectManageAlert')"
        show-icon
        type="info"
      />
      <Form :model="editorForm" layout="vertical">
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            :label="$t('business.message.apiUsername')"
            :required="editorMode === 'create'"
          >
            <Input
              v-model:value="editorForm.username"
              :disabled="editorMode === 'edit'"
              :placeholder="$t('business.message.apiUsernamePlaceholder')"
            />
          </Form.Item>
          <Form.Item
            v-if="editorMode === 'create'"
            :label="$t('business.message.loginPassword')"
            required
          >
            <Input.Password
              v-model:value="editorForm.password"
              :placeholder="$t('business.message.apiUserPasswordPlaceholder')"
            />
          </Form.Item>
          <Form.Item :label="$t('business.message.nickname')">
            <Input
              v-model:value="editorForm.nickname"
              :placeholder="$t('business.message.nicknamePlaceholder')"
            />
          </Form.Item>
          <Form.Item :label="$t('business.message.accountStatus')">
            <Select
              v-model:value="editorForm.status"
              :disabled="editorMode === 'edit'"
              :options="API_USER_STATUS_OPTIONS"
            />
          </Form.Item>
          <Form.Item :label="$t('business.message.email')">
            <Input
              v-model:value="editorForm.email"
              :placeholder="$t('business.message.email')"
            />
          </Form.Item>
          <Form.Item :label="$t('business.message.phone')">
            <Input
              v-model:value="editorForm.phone"
              :placeholder="$t('business.message.phone')"
            />
          </Form.Item>
          <Form.Item
            class="md:col-span-2"
            :label="$t('business.message.avatarUrl')"
          >
            <Input
              v-model:value="editorForm.avatar"
              :placeholder="$t('business.message.avatarUrl')"
            />
          </Form.Item>
          <Form.Item
            class="md:col-span-2"
            :label="$t('business.message.apiUserRuntimeSync')"
          >
            <Switch
              :checked="true"
              disabled
              :checked-children="$t('business.message.enabled')"
              :un-checked-children="$t('business.message.disabled')"
            />
            <span class="ml-2 text-xs text-[var(--ant-color-text-secondary)]">
              {{ $t('business.message.apiUserRuntimeSyncDesc') }}
            </span>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  </Page>
</template>
