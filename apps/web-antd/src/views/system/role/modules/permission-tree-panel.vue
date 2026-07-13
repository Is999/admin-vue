<script lang="ts" setup>
import type { SystemPermissionApi } from '#/api/system';

import { computed, h, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  Select,
  Space,
  Tag,
  Tree,
} from 'ant-design-vue';

import { $t, $te } from '#/locales';

import TreeExpandToolbar from '../../components/tree-expand-toolbar.vue';
import { typeOptions, typeTagMeta } from '../../permission/data';
import {
  buildDisplayedPermissionCheckedIds,
  buildPermissionRelationMaps,
  buildPermissionViewTree,
  collectAllPermissionIds,
  collectPermissionIdsByDepth,
  collectPermissionState,
  isPermissionNodeCheckable,
  updateSelectedPermissionIds,
} from './permission-tree';

interface Props {
  canWrite: boolean;
  readOnlyDescription?: string;
  treeData: SystemPermissionApi.Item[];
  modelValue: number[];
}

const props = withDefaults(defineProps<Props>(), {
  readOnlyDescription: $t('business.message.permissionTreeReadOnlyDesc'),
});

const emit = defineEmits<{
  'update:modelValue': [value: number[]];
}>();

// PERMISSION_KIND_I18N_KEY_MAP 定义权限类型到多语言 key 的映射，避免新增筛选文案只支持中文。
const PERMISSION_KIND_I18N_KEY_MAP: Record<number, string> = {
  0: 'business.permissionType.read',
  1: 'business.permissionType.create',
  2: 'business.permissionType.update',
  3: 'business.permissionType.delete',
  4: 'business.permissionType.directory',
  5: 'business.permissionType.menu',
  6: 'business.permissionType.page',
  7: 'business.permissionType.button',
  8: 'business.permissionType.other',
};

// expandedPermissionIds 保存当前展开的权限节点。
const expandedPermissionIds = ref<number[]>([]);
// permissionKeyword 保存权限树关键字搜索内容。
const permissionKeyword = ref('');
// permissionTypeFilter 保存权限类型筛选值；为空时展示全部类型。
const permissionTypeFilter = ref<number>();
// onlyShowChecked 控制是否只显示已选权限节点。
const onlyShowChecked = ref(false);

// selectedPermissionIds 统一代理 v-model，保存权限树当前勾选态。
const selectedPermissionIds = computed({
  get: () => props.modelValue || [],
  set: (value: number[]) => emit('update:modelValue', value),
});

// permissionState 缓存权限树勾选与可编辑范围，避免展示态误覆盖只读授权。
const permissionState = computed(() => collectPermissionState(props.treeData));

// translateOptionLabel 优先翻译已登记 key，未登记时保留后端或枚举原文。
function translateOptionLabel(key: string, fallback: string) {
  return key && $te(key) ? $t(key) : fallback;
}

// resolvePermissionKindLabel 把模块/类型中的数值映射成更直观的多语言名称。
function resolvePermissionKindLabel(value?: number | string) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return '';
  }
  const numericValue = Number(text);
  const i18nKey = PERMISSION_KIND_I18N_KEY_MAP[numericValue];
  const fallback = Number.isFinite(numericValue)
    ? String(typeTagMeta(numericValue).text)
    : text;
  return translateOptionLabel(i18nKey || '', fallback || text);
}

// permissionTypeOptions 返回角色权限树的类型筛选选项，直接复用权限管理页维护的类型枚举。
const permissionTypeOptions = computed(() =>
  typeOptions().map((item) => ({
    label: translateOptionLabel(
      PERMISSION_KIND_I18N_KEY_MAP[item.value] || '',
      item.label,
    ),
    value: item.value,
  })),
);

// resolvePermissionStateHints 计算权限节点当前不可操作的具体原因，直接用节点标签内展示。
function resolvePermissionStateHints(item: SystemPermissionApi.Item) {
  const tags: Array<{ color: string; text: string }> = [];
  if (item.status !== 1) {
    tags.push({ color: 'error', text: $t('business.message.disabledStatus') });
  }
  if (item.disabled) {
    if (item.checked && item.status === 1) {
      tags.push({
        color: 'gold',
        text: $t('business.message.operatorPermissionInsufficient'),
      });
    } else if (item.status === 1) {
      tags.push({
        color: 'default',
        text: $t('business.message.operatorNotAuthorized'),
      });
    }
  }
  return tags;
}

// buildPermissionTitle 构造权限树节点标题，直接内联展示关键信息，避免悬浮提示遮挡界面。
function buildPermissionTitle(item: SystemPermissionApi.Item) {
  const typeLabel = resolvePermissionKindLabel(item.type);
  const moduleLabel = resolvePermissionKindLabel(item.module);
  const stateTags = resolvePermissionStateHints(item);
  return h(
    'div',
    {
      class: 'flex flex-wrap items-center gap-2 py-0.5',
      onDblclick: (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onPermissionNodeDoubleClick(item.id);
      },
    },
    [
      h(
        Tag,
        { bordered: false, color: 'default' },
        { default: () => `ID:${item.id}` },
      ),
      h(
        'span',
        {
          class: item.disabled
            ? 'text-[var(--ant-color-text-description)]'
            : '',
        },
        item.title,
      ),
      item.uuid
        ? h(
            Tag,
            { bordered: false, color: 'processing' },
            { default: () => item.uuid },
          )
        : null,
      typeLabel
        ? h(
            Tag,
            {
              bordered: false,
              color: typeTagMeta(Number(item.type)).color || 'purple',
            },
            { default: () => typeLabel },
          )
        : null,
      moduleLabel && moduleLabel !== typeLabel
        ? h(
            Tag,
            { bordered: false, color: 'geekblue' },
            { default: () => moduleLabel },
          )
        : null,
      ...stateTags.map((tag) =>
        h(
          Tag,
          { bordered: false, color: tag.color },
          { default: () => tag.text },
        ),
      ),
      item.disabled
        ? h(
            'span',
            { class: 'text-xs text-[var(--ant-color-text-description)]' },
            item.checked && item.status === 1
              ? $t('business.message.displayOnly')
              : $t('business.message.notAssignable'),
          )
        : null,
    ],
  );
}

// displayedPermissionIds 返回权限树当前应展示为勾选的节点集合。
const displayedPermissionIds = computed(() =>
  buildDisplayedPermissionCheckedIds(
    props.treeData,
    selectedPermissionIds.value,
  ),
);

// filteredPermissionTree 返回当前界面需要展示的权限树。
const filteredPermissionTree = computed(() =>
  buildPermissionViewTree(props.treeData, {
    displayedPermissionIds: displayedPermissionIds.value,
    keyword: permissionKeyword.value,
    onlyShowChecked: onlyShowChecked.value,
    permissionType: permissionTypeFilter.value,
    readOnly: !props.canWrite,
    renderTitle: buildPermissionTitle,
  }),
);

// selectedPermissionCount 返回当前可提交的权限数，不统计只读保留项。
const selectedPermissionCount = computed(
  () =>
    selectedPermissionIds.value.filter((item) =>
      permissionState.value.enabledIds.has(item),
    ).length,
);

// onExpandAll 展开整棵权限树。
function onExpandAll() {
  expandedPermissionIds.value = collectAllPermissionIds(
    filteredPermissionTree.value,
  );
}

// onCollapseAll 收起整棵权限树。
function onCollapseAll() {
  expandedPermissionIds.value = [];
}

// onExpandLevel 补充展开前 N 层节点，同时保留用户已手动展开的更深层节点。
function onExpandLevel(level: number) {
  const targetIds = collectPermissionIdsByDepth(
    filteredPermissionTree.value,
    1,
    level - 1,
  );
  expandedPermissionIds.value = [
    ...new Set([...expandedPermissionIds.value, ...targetIds]),
  ];
}

// onCollapseLevel 从第 N 层开始折叠节点及后代，保留更高层级的展开状态。
function onCollapseLevel(level: number) {
  const collapsedIds = new Set(
    collectPermissionIdsByDepth(filteredPermissionTree.value, level),
  );
  expandedPermissionIds.value = expandedPermissionIds.value.filter(
    (item) => !collapsedIds.has(item),
  );
}

// onCheckAllEnabled 勾选全部可用权限。
function onCheckAllEnabled() {
  const walk = (items: SystemPermissionApi.Item[]): number[] =>
    items.flatMap((item) => {
      const current = isPermissionNodeCheckable(item) ? [item.id] : [];
      return [...current, ...walk(item.children || [])];
    });
  const enabledIds = walk(props.treeData);
  selectedPermissionIds.value = [
    ...new Set([...permissionState.value.readonlyCheckedIds, ...enabledIds]),
  ].toSorted((a, b) => a - b);
}

// onClearChecked 清空当前已选权限。
function onClearChecked() {
  selectedPermissionIds.value = [...permissionState.value.readonlyCheckedIds];
}

// onExpandChange 同步树组件展开状态。
function onExpandChange(keys: Array<number | string>) {
  expandedPermissionIds.value = keys.map(Number);
}

// onPermissionCheck 统一接管权限树勾选，按项目自定义规则维护选中集合。
function onPermissionCheck(_checkedKeys: unknown, event: any) {
  if (!props.canWrite) {
    return;
  }
  const nodeID = Number(event?.node?.id ?? event?.node?.key ?? 0);
  if (!nodeID) {
    return;
  }
  selectedPermissionIds.value = updateSelectedPermissionIds(
    props.treeData,
    selectedPermissionIds.value,
    nodeID,
    Boolean(event?.checked),
    false,
  );
}

// onPermissionNodeDoubleClick 双击父级节点时联动当前节点及全部子级。
function onPermissionNodeDoubleClick(nodeID: number) {
  if (!props.canWrite) {
    return;
  }
  const { childrenById, nodeById } = buildPermissionRelationMaps(
    props.treeData,
  );
  const currentNode = nodeById.get(nodeID);
  if (!currentNode || (childrenById.get(nodeID) || []).length === 0) {
    return;
  }
  if (!isPermissionNodeCheckable(currentNode)) {
    return;
  }
  selectedPermissionIds.value = updateSelectedPermissionIds(
    props.treeData,
    selectedPermissionIds.value,
    nodeID,
    !displayedPermissionIds.value.includes(nodeID),
    true,
  );
}

// 当树数据变化时默认展开全部，避免切换父级后保留上一次展开状态。
watch(
  () => props.treeData,
  (value) => {
    permissionKeyword.value = '';
    permissionTypeFilter.value = undefined;
    onlyShowChecked.value = false;
    expandedPermissionIds.value = collectAllPermissionIds(value || []);
  },
  { deep: true, immediate: true },
);
/** 为权限树内置的键盘焦点输入补齐浏览器表单标识。 */
function bindPermissionTreeFocusInput(element: unknown) {
  if (!(element instanceof HTMLElement)) return;

  const input = element.querySelector<HTMLInputElement>(
    'input[aria-label="for screen reader"]',
  );
  if (!input) return;

  input.id = 'role-permission-tree-focus';
  input.name = 'role-permission-tree-focus';
  input.autocomplete = 'off';
}
</script>

<template>
  <div
    class="role-permission-panel rounded-lg border border-[var(--ant-color-border-secondary)] p-4"
  >
    <div class="mb-3 flex items-center gap-2">
      <span class="text-sm font-medium text-[var(--ant-color-text)]">
        {{ $t('business.message.rolePermissions') }}
      </span>
      <Tag v-if="canWrite" color="processing">
        {{ $t('business.message.pendingSaveCount', [selectedPermissionCount]) }}
      </Tag>
    </div>
    <Alert
      class="mb-2"
      :description="canWrite ? undefined : readOnlyDescription"
      show-icon
      type="info"
    >
      <template #message>
        <span class="leading-6">
          {{ $t('business.message.permissionTreeUsageSearch') }}
          <span
            class="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-semibold text-primary"
          >
            {{ $t('business.message.permissionTreeSingleClickAction') }}
          </span>
          {{ $t('business.message.permissionTreeSingleClickDesc') }}
          <span
            class="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-semibold text-primary"
          >
            {{ $t('business.message.permissionTreeDoubleClickAction') }}
          </span>
          {{ $t('business.message.permissionTreeDoubleClickDesc') }}
        </span>
      </template>
    </Alert>
    <div class="permission-tree-toolbar mb-3 flex flex-wrap items-center gap-2">
      <Space class="permission-tree-toolbar__filters" wrap>
        <Input
          id="role-permission-search"
          name="role-permission-search"
          autocomplete="off"
          v-model:value="permissionKeyword"
          allow-clear
          class="w-[240px]"
          :placeholder="$t('business.message.searchPermissionKeyword')"
        />
        <Select
          v-model:value="permissionTypeFilter"
          allow-clear
          class="w-[150px]"
          option-filter-prop="label"
          :options="permissionTypeOptions"
          :placeholder="$t('business.permissionFilter.typePlaceholder')"
        />
        <Checkbox v-model:checked="onlyShowChecked">
          {{ $t('business.message.onlyChecked') }}
        </Checkbox>
      </Space>
      <Space class="permission-tree-toolbar__actions" wrap>
        <TreeExpandToolbar
          :collapse-all-handler="onCollapseAll"
          :collapse-level-handler="onCollapseLevel"
          :expand-all-handler="onExpandAll"
          :expand-level-handler="onExpandLevel"
        />
        <Button v-if="canWrite" size="small" @click="onCheckAllEnabled">
          {{ $t('business.message.checkAllEnabled') }}
        </Button>
        <Button v-if="canWrite" size="small" @click="onClearChecked">
          {{ $t('business.message.clear') }}
        </Button>
      </Space>
    </div>
    <div
      :ref="bindPermissionTreeFocusInput"
      class="role-permission-tree-scroll max-h-[420px] overflow-auto pr-1"
    >
      <Tree
        :checked-keys="displayedPermissionIds"
        :expanded-keys="expandedPermissionIds"
        checkable
        block-node
        check-strictly
        :field-names="{ title: 'title', key: 'id', children: 'children' }"
        :tree-data="filteredPermissionTree"
        @check="onPermissionCheck"
        @expand="onExpandChange"
      />
    </div>
  </div>
</template>

<style scoped>
.role-permission-panel {
  container: role-permission-panel / inline-size;
}

.permission-tree-toolbar__filters,
.permission-tree-toolbar__actions {
  min-width: 0;
  max-width: 100%;
}

.permission-tree-toolbar__filters {
  flex: 1 1 450px;
}

.permission-tree-toolbar__actions {
  flex: 1 1 508px;
  justify-content: flex-end;
}

@container role-permission-panel (max-width: 980px) {
  .permission-tree-toolbar__filters,
  .permission-tree-toolbar__actions {
    flex-basis: 100%;
    width: 100%;
  }

  .permission-tree-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
