<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { SystemAdminApi } from '#/api/system';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Image,
  Input,
  message,
  Space,
  Tag,
  Tree,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { requestClient } from '#/api/request';
import {
  createAdmin,
  fetchAdminDetail,
  fetchRoleTreeOptions,
  updateAdmin,
} from '#/api/system';
import { $t } from '#/locales';
import { resolveRequestErrorMessage } from '#/utils/file/download';
import { cropAvatarFile, resolveDisplayFileURL } from '#/utils/file/image';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';
import {
  copyTextToClipboard,
  generateRandomPassword,
  validateStrongPassword,
} from '#/utils/security/password';
import { createResumableUpload } from '#/utils/transfer/resumable-upload';

import FormTips from '../../components/form-tips.vue';
import { useFormSchema } from '../data';
import {
  buildAdminRoleRelationMaps,
  buildAdminRoleTreeOptions,
  collectAdminRoleIds,
  collectAdminRoleSubtreeIds,
  collectAllAdminRoleNodeIds,
  isAdminRoleNodeCheckable,
  pruneInheritedAdminRoleIds,
} from '../role-tree';

// emit 定义表单提交成功事件。
const emit = defineEmits<{ success: [] }>();
// MFA_SCENARIO_ADD_USER 表示新增管理员二次校验场景。
const MFA_SCENARIO_ADD_USER = 5;
// MFA_SCENARIO_EDIT_USER 表示编辑管理员二次校验场景。
const MFA_SCENARIO_EDIT_USER = 6;

// formData 保存当前编辑的用户数据。
const formData = ref<Partial<SystemAdminApi.Item>>({});
// loading 控制抽屉详情加载状态。
const loading = ref(false);
// roleTree 保存用户角色树下拉数据。
const roleTree = ref<Array<Record<string, any>>>([]);
// avatarUploading 控制头像上传按钮状态。
const avatarUploading = ref(false);
// avatarPreviewURL 保存当前头像预览地址。
const avatarPreviewURL = ref('');
// avatarInputRef 绑定头像文件选择器。
const avatarInputRef = ref<HTMLInputElement | null>(null);
// roleKeyword 保存角色树筛选关键字。
const roleKeyword = ref('');
// selectedRoleIds 保存当前表单实际选择的角色集合。
const selectedRoleIds = ref<number[]>([]);
// expandedRoleIds 保存角色树已展开节点。
const expandedRoleIds = ref<number[]>([]);

// [Form, formApi] 创建 Vben 表单实例。
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// pruneInheritedRoleIDs 过滤已被父角色覆盖的子角色，保证表单提交角色关系与角色配置弹窗保持一致。
function pruneInheritedRoleIDs(
  roleIDs: number[],
  nodes: Array<Record<string, any>>,
) {
  return pruneInheritedAdminRoleIds(roleIDs, nodes);
}

// updateCheckedRoleIds 按角色配置页面同款规则维护选中集合。
function updateCheckedRoleIds(
  sourceCheckedIDs: number[],
  nodeID: number,
  nextChecked: boolean,
) {
  const { childrenById, nodeById } = buildAdminRoleRelationMaps(roleTree.value);
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
        const matched = String(item.rawTitle || item.title || '')
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

// filteredRoleTree 返回当前表单里实际展示的角色树。
const filteredRoleTree = computed<any[]>(() =>
  filterRoleOptionTree(roleTree.value),
);

// [Drawer, drawerApi] 创建新增/编辑抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<Partial<SystemAdminApi.Item>>();
    formApi.resetForm();
    formData.value = {};
    roleKeyword.value = '';
    selectedRoleIds.value = [];
    roleTree.value = buildAdminRoleTreeOptions(await fetchRoleTreeOptions());
    expandedRoleIds.value = collectAllAdminRoleNodeIds(roleTree.value);
    formApi.updateSchema(useFormSchema());
    // 从列表页读取当前行数据，存在 ID 时查询详情并回填。
    if (data?.id) {
      loading.value = true;
      fetchAdminDetail(data.id)
        .then(async (res) => {
          formData.value = res;
          selectedRoleIds.value = pruneInheritedRoleIDs(
            res.roleIDs ?? [],
            roleTree.value,
          );
          avatarPreviewURL.value = resolveDisplayFileURL(
            String(res.avatar || ''),
            requestClient.getBaseUrl(),
          );
          // 编辑时不回填密码，避免误提交旧密码。
          formApi.setValues({
            ...res,
            password: '',
          });
          await formApi.resetValidate();
        })
        .finally(() => {
          loading.value = false;
        });
      return;
    }
    formApi.setValues({
      avatar: '',
      description: '',
      email: '',
      mfaStatus: 0,
      password: generateRandomPassword(),
      phone: '',
      realName: '',
      status: 1,
      username: '',
    });
    selectedRoleIds.value = [];
    avatarPreviewURL.value = '';
    await formApi.resetValidate();
  },
});

// getDrawerTitle 根据是否存在 ID 计算抽屉标题。
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.editUser')
    : $t('business.message.addUser'),
);

// drawerIntroTitle 返回抽屉顶部操作模式标题。
const drawerIntroTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.currentEditMode')
    : $t('business.message.currentAddMode'),
);

// drawerIntroDescription 返回抽屉顶部操作模式说明。
const drawerIntroDescription = computed(() =>
  formData.value?.id
    ? $t('business.message.userEditModeDesc')
    : $t('business.message.userAddModeDesc'),
);

// formTips 定义用户表单底部参数说明。
const formTips = [
  $t('business.message.userNameTip'),
  $t('business.message.userPasswordTip'),
  $t('business.message.userMfaTip'),
  $t('business.message.userRemarkTip'),
];

// fillRandomPassword 生成随机密码并回填到表单，新增用户时默认使用复杂密码更贴近 vben-admin 交互。
async function fillRandomPassword(copyAfterFill = false) {
  const password = generateRandomPassword();
  await formApi.setFieldValue('password', password, false);
  if (copyAfterFill) {
    await copyTextToClipboard(
      password,
      $t('business.message.loginPasswordCopied'),
      $t('business.message.noLoginPasswordToCopy'),
    );
  }
}

// copyCurrentPassword 复制当前表单里的登录密码，方便创建后通过安全渠道发给用户。
async function copyCurrentPassword() {
  const values = await formApi.getValues<{ password?: string }>();
  await copyTextToClipboard(
    values.password || '',
    $t('business.message.loginPasswordCopied'),
    $t('business.message.noLoginPasswordToCopy'),
  );
}

// onChooseAvatarFile 打开头像文件选择器。
function onChooseAvatarFile() {
  avatarInputRef.value?.click();
}

// onAvatarFileChange 上传头像并回填表单。
async function onAvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const originalFile = input?.files?.[0];
  const file = originalFile ? await cropAvatarFile(originalFile, '1:1') : null;
  if (!file) {
    if (input) {
      input.value = '';
    }
    return;
  }
  avatarUploading.value = true;
  try {
    const session = await createResumableUpload({
      bizType: 'admin-avatar',
      concurrency: 2,
      file,
    });
    const avatarURL = session.accessUrl || session.downloadUrl || '';
    if (!avatarURL) {
      throw new Error($t('business.message.avatarUploadNoAccessUrl'));
    }
    avatarPreviewURL.value = resolveDisplayFileURL(
      avatarURL,
      requestClient.getBaseUrl(),
    );
    await formApi.setFieldValue('avatar', avatarURL, false);
    message.success($t('business.message.avatarUploadedSaveToApply'));
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      $t('business.message.avatarUploadApiUnavailable'),
    );
    message.error($t('business.message.avatarUploadFailed', [errorMessage]));
  } finally {
    avatarUploading.value = false;
    if (input) {
      input.value = '';
    }
  }
}

// onSubmit 校验表单并提交新增或编辑请求。
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<SystemAdminApi.SaveParams>();
  values.roleIDs = pruneInheritedRoleIDs(selectedRoleIds.value, roleTree.value);
  // 新增用户必须填写初始密码，编辑用户密码留空时不传给后端。
  if (!formData.value?.id && !String(values.password || '').trim()) {
    message.error($t('business.message.newUserPasswordRequired'));
    return;
  }
  const passwordError = values.password
    ? validateStrongPassword(
        values.password,
        $t('business.message.loginPassword'),
      )
    : '';
  if (passwordError) {
    message.error(passwordError);
    return;
  }
  if (formData.value?.id && !String(values.password || '').trim()) {
    delete values.password;
  }

  drawerApi.lock();
  try {
    const isEdit = Boolean(formData.value?.id);
    const payloadBase = {
      ...values,
      isUpdateRoles: isEdit,
    };
    await submitWithMfaRetry(
      isEdit ? MFA_SCENARIO_EDIT_USER : MFA_SCENARIO_ADD_USER,
      (ticket) => {
        const payload = { ...payloadBase, ...ticketPayload(ticket) };
        return isEdit
          ? updateAdmin(formData.value.id!, payload)
          : createAdmin(payload);
      },
      isEdit
        ? $t('business.message.editUserMfaTitle')
        : $t('business.message.addUserMfaTitle'),
    );
    message.success(
      isEdit
        ? $t('business.message.userUpdated')
        : $t('business.message.userCreated'),
    );
    drawerApi.close();
    emit('success');
  } finally {
    drawerApi.unlock();
  }
}

// onCheckAllRoles 勾选全部可用角色。
function onCheckAllRoles() {
  selectedRoleIds.value = collectAdminRoleIds(roleTree.value);
}

// onClearRoles 清空角色勾选。
function onClearRoles() {
  selectedRoleIds.value = [];
}

// onExpandRoleTree 同步树展开状态。
function onExpandRoleTree(keys: Array<number | string>) {
  expandedRoleIds.value = keys.map(Number);
}

// onRoleCheck 统一处理角色勾选，保持与角色配置页面一致。
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
</script>

<template>
  <Drawer
    class="w-full max-w-[900px]"
    :loading="loading"
    :title="getDrawerTitle"
  >
    <Alert
      class="mx-4 mt-4"
      :description="drawerIntroDescription"
      :message="drawerIntroTitle"
      show-icon
      type="info"
    />
    <div class="mx-4 mt-4 flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-4">
        <div
          v-if="avatarPreviewURL"
          class="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border border-[var(--ant-color-border-secondary)]"
        >
          <Image
            :preview="false"
            :src="avatarPreviewURL"
            width="88"
            height="88"
            class="h-full w-full object-cover"
          />
        </div>
        <div
          v-else
          class="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs text-gray-400"
        >
          暂无头像
        </div>
      </div>
      <Space>
        <input
          ref="avatarInputRef"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          class="hidden"
          type="file"
          @change="onAvatarFileChange"
        />
        <Button
          :loading="avatarUploading"
          type="primary"
          @click="onChooseAvatarFile"
        >
          {{ $t('business.message.uploadAvatar') }}
        </Button>
      </Space>
    </div>
    <Form class="mx-4 mt-4" />
    <div class="mx-4 mt-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Input
          v-model:value="roleKeyword"
          allow-clear
          class="w-[240px]"
          :placeholder="$t('business.message.searchRoleName')"
        />
        <Space wrap>
          <Tag color="processing">
            {{ $t('business.message.selectedCount', [selectedRoleIds.length]) }}
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
        class="mt-3 max-h-[320px] overflow-auto rounded-md border border-[var(--ant-color-border-secondary)] px-2 py-2"
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
    <div class="mx-4 mt-3">
      <Space wrap>
        <Button type="primary" @click="fillRandomPassword()">
          {{
            formData?.id
              ? $t('business.message.generateNewPassword')
              : $t('business.message.regeneratePassword')
          }}
        </Button>
        <Button @click="fillRandomPassword(true)">
          {{ $t('business.message.generateAndCopy') }}
        </Button>
        <Button @click="copyCurrentPassword">
          {{ $t('business.message.copyCurrentPassword') }}
        </Button>
      </Space>
    </div>
    <FormTips :title="$t('business.message.userFormTips')" :tips="formTips" />
  </Drawer>
</template>
