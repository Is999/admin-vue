<script lang="ts" setup>
import type { RuntimeConfigApi } from '#/api/ops/runtime-config';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
} from 'ant-design-vue';

import {
  deleteRuntimeArchiveJob,
  deleteRuntimePeriodicTask,
  fetchRuntimeArchiveJobs,
  fetchRuntimeConfigOverview,
  fetchRuntimeConfigRelease,
  fetchRuntimeConfigReleases,
  fetchRuntimePeriodicTasks,
  importCurrentRuntimeConfig,
  publishRuntimeConfig,
  rollbackRuntimeConfig,
  saveRuntimeArchiveJob,
  saveRuntimePeriodicTask,
  validateRuntimeConfigDraft,
} from '#/api/ops/runtime-config';
import {
  asActionPermission,
  hasAnyPermission,
  OPS_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';

import {
  formatShortChecksum,
  safePrettyJson,
  splitTextToItems,
} from '../shared';
import SnapshotDiffPanel from './components/snapshot-diff-panel.vue';

type TablePage = {
  current?: number;
  pageSize?: number;
};
type RuntimeActionType = 'import' | 'publish' | 'rollback';
type RuntimeEnabledFilter = 'all' | 'disabled' | 'enabled';

// RUNTIME_CONFIG_MFA_SCENARIO 与后端 MFAScenarioRuntimeConfigManage 保持一致。
const RUNTIME_CONFIG_MFA_SCENARIO = 12;
const pageSizeOptions = ['10', '20', '50'];

const accessStore = useAccessStore();
const rt = (key: string) => $t(`admin.runtimeConfig.${key}`);
const overview = ref<null | RuntimeConfigApi.OverviewResp>(null);
const loadingOverview = ref(false);
const submitting = ref(false);
const activeTab = ref('periodic');

const periodicRows = ref<RuntimeConfigApi.PeriodicTaskItem[]>([]);
const periodicLoading = ref(false);
const periodicTotal = ref(0);
const periodicPage = ref(1);
const periodicPageSize = ref(20);
const periodicFilters = reactive({
  enabled: 'all' as RuntimeEnabledFilter,
  keyword: '',
  workflow: '',
});
const periodicForm =
  reactive<RuntimeConfigApi.PeriodicTaskItem>(newPeriodicForm());
const periodicTargetsText = ref('');

const archiveRows = ref<RuntimeConfigApi.ArchiveJobItem[]>([]);
const archiveLoading = ref(false);
const archiveTotal = ref(0);
const archivePage = ref(1);
const archivePageSize = ref(20);
const archiveFilters = reactive({
  database: '',
  enabled: 'all' as RuntimeEnabledFilter,
  keyword: '',
});
const archiveForm = reactive<RuntimeConfigApi.ArchiveJobItem>(newArchiveForm());

const releaseRows = ref<RuntimeConfigApi.ReleaseItem[]>([]);
const releaseLoading = ref(false);
const releaseTotal = ref(0);
const releasePage = ref(1);
const releasePageSize = ref(10);
const selectedRelease = ref<null | RuntimeConfigApi.ReleaseDetailResp>(null);
const releaseDetailLoading = ref(false);

const validateResult = ref<null | RuntimeConfigApi.ValidateResp>(null);
const lastPublishResult = ref<null | RuntimeConfigApi.PublishResp>(null);
const actionModalOpen = ref(false);
const actionType = ref<RuntimeActionType>('publish');
const actionRemark = ref('');
const rollbackRelease = ref<null | RuntimeConfigApi.ReleaseItem>(null);

const canList = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_OVERVIEW,
    OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_LIST,
  ]),
);

const sourceTone = computed(() =>
  overview.value?.source === 'database' ? 'processing' : 'default',
);
const activeState = computed(
  () =>
    overview.value?.state || {
      activeChecksum: '',
      activeReleaseId: 0,
      activeVersion: 0,
      publishedAt: '',
    },
);
const overviewCards = computed(() => [
  {
    key: 'source',
    label: rt('source'),
    value: overview.value?.source || '-',
    description:
      overview.value?.source === 'database'
        ? rt('sourceDatabaseDesc')
        : rt('sourceFileDesc'),
  },
  {
    key: 'pollInterval',
    label: rt('pollInterval'),
    value: `${overview.value?.pollIntervalSeconds || 30} ${rt('seconds')}`,
    description: rt('pollIntervalDesc'),
  },
  {
    key: 'version',
    label: rt('activeVersion'),
    value: String(activeState.value.activeVersion || 0),
    description: activeState.value.publishedAt || rt('unpublished'),
  },
  {
    key: 'draft',
    label: rt('draftCount'),
    value: `${overview.value?.draft?.periodicTasks || 0}/${overview.value?.draft?.archiveJobs || 0}`,
    description: rt('draftCountDesc'),
  },
]);
const periodicPageStats = computed(() => {
  const enabledCount = periodicRows.value.filter((item) => item.enabled).length;
  const cronCount = periodicRows.value.filter((item) =>
    String(item.cron || '').trim(),
  ).length;
  const intervalCount = periodicRows.value.filter(
    (item) => Number(item.everySeconds || 0) > 0,
  ).length;
  return [
    {
      key: 'matched',
      label: rt('matchedDrafts'),
      value: String(periodicTotal.value || 0),
      description: rt('matchedDraftsDesc'),
    },
    {
      key: 'enabled',
      label: rt('enabledDrafts'),
      value: String(enabledCount),
      description: rt('currentPageStatDesc'),
    },
    {
      key: 'disabled',
      label: rt('disabledDrafts'),
      value: String(Math.max(periodicRows.value.length - enabledCount, 0)),
      description: rt('currentPageStatDesc'),
    },
    {
      key: 'schedule',
      label: rt('scheduleMode'),
      value: `${cronCount} / ${intervalCount}`,
      description: rt('scheduleModeDesc'),
    },
  ];
});
const currentSnapshotText = computed(() =>
  safePrettyJson(overview.value?.currentSnapshot || {}),
);
const draftSnapshotText = computed(() =>
  safePrettyJson({
    archiveJobs: archiveRows.value,
    taskPeriodic: periodicRows.value,
  }),
);
const validateChecksumShort = computed(() =>
  formatShortChecksum(validateResult.value?.checksum || ''),
);
const validateMessages = computed(() => validateResult.value?.messages || []);
const selectedReleaseSnapshotText = computed(
  () =>
    selectedRelease.value?.snapshotYaml ||
    selectedRelease.value?.snapshotJson ||
    '',
);

// PeriodicDrawer 承载周期任务新增和编辑表单。
const [PeriodicDrawer, periodicDrawerApi] = useVbenDrawer({
  onConfirm: submitPeriodic,
});

// ArchiveDrawer 承载归档任务新增和编辑表单。
const [ArchiveDrawer, archiveDrawerApi] = useVbenDrawer({
  onConfirm: submitArchive,
});

const enabledOptions = computed(() => [
  { label: rt('allStatus'), value: 'all' },
  { label: rt('enabled'), value: 'enabled' },
  { label: rt('disabled'), value: 'disabled' },
]);

const periodicColumns = computed(() => [
  { title: rt('name'), dataIndex: 'name', key: 'name', width: 220 },
  { title: rt('workflow'), dataIndex: 'workflow', key: 'workflow', width: 240 },
  { title: rt('queue'), dataIndex: 'queue', key: 'queue', width: 120 },
  { title: rt('schedule'), key: 'schedule', width: 220 },
  { title: rt('status'), dataIndex: 'enabled', key: 'enabled', width: 90 },
  {
    title: rt('sortOrder'),
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 90,
  },
  {
    title: rt('updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 180,
  },
  { title: rt('action'), key: 'action', width: 112 },
]);
const archiveColumns = computed(() => [
  { title: rt('name'), dataIndex: 'name', key: 'name', width: 220 },
  { title: rt('database'), dataIndex: 'database', key: 'database', width: 120 },
  {
    title: rt('hotTable'),
    dataIndex: 'tableName',
    key: 'tableName',
    width: 220,
  },
  { title: rt('keepDelay'), key: 'keepDays', width: 140 },
  { title: rt('batch'), key: 'batch', width: 140 },
  { title: rt('status'), dataIndex: 'enabled', key: 'enabled', width: 90 },
  {
    title: rt('sortOrder'),
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 90,
  },
  {
    title: rt('updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 180,
  },
  { title: rt('action'), key: 'action', width: 112 },
]);
const releaseColumns = computed(() => [
  {
    title: rt('version'),
    dataIndex: 'versionNo',
    key: 'versionNo',
    width: 90,
  },
  { title: rt('releaseId'), dataIndex: 'id', key: 'id', width: 110 },
  {
    title: 'Checksum',
    dataIndex: 'checksum',
    ellipsis: true,
    key: 'checksum',
    width: 190,
  },
  {
    title: rt('publisher'),
    dataIndex: 'publishedByName',
    ellipsis: true,
    key: 'publishedByName',
    width: 140,
  },
  {
    title: rt('publishedAt'),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    width: 180,
  },
  {
    title: rt('remark'),
    dataIndex: 'remark',
    ellipsis: true,
    key: 'remark',
    width: 260,
  },
  { title: rt('action'), key: 'action', width: 96 },
]);

onMounted(async () => {
  if (!canList.value) {
    return;
  }
  await refreshAll();
});

function newPeriodicForm(): RuntimeConfigApi.PeriodicTaskItem {
  return {
    cron: '',
    enabled: true,
    everySeconds: undefined,
    grayPercent: 100,
    name: '',
    queue: 'default',
    remark: '',
    retry: undefined,
    shardTotal: undefined,
    sortOrder: 0,
    targets: [],
    timeoutSeconds: undefined,
    uniqueKey: '',
    uniqueTtlSeconds: undefined,
    workflow: '',
  };
}

function newArchiveForm(): RuntimeConfigApi.ArchiveJobItem {
  return {
    archiveDelayDays: 0,
    archiveWindowMode: 'auto',
    archiveWindowSeconds: 3600,
    batchSize: 1000,
    database: 'main',
    deleteBatchSize: 1000,
    deleteDisabled: false,
    enabled: true,
    historyTableNameRule: '',
    historyTablePrefix: '',
    hotKeepDays: 90,
    name: '',
    primaryKey: 'id',
    queryWriteDb: false,
    remark: '',
    sortOrder: 0,
    splitUnit: 'month',
    tableName: '',
    timeColumn: '',
  };
}

function assignForm<T extends object>(target: T, source: T) {
  const mutableTarget = target as Record<string, unknown>;
  Object.keys(mutableTarget).forEach((key) => delete mutableTarget[key]);
  Object.assign(target, source);
}

function enabledParam(value: RuntimeEnabledFilter) {
  if (value === 'enabled') {
    return true;
  }
  if (value === 'disabled') {
    return false;
  }
  return undefined;
}

function enabledText(enabled: boolean) {
  return enabled ? rt('enabled') : rt('disabled');
}

function clearDraftFeedback() {
  validateResult.value = null;
  lastPublishResult.value = null;
}

async function refreshAll() {
  await Promise.all([
    loadOverview(),
    loadPeriodicTasks(),
    loadArchiveJobs(),
    loadReleases(),
  ]);
}

async function loadOverview() {
  loadingOverview.value = true;
  try {
    overview.value = await fetchRuntimeConfigOverview();
  } finally {
    loadingOverview.value = false;
  }
}

async function loadPeriodicTasks() {
  periodicLoading.value = true;
  try {
    const resp = await fetchRuntimePeriodicTasks({
      enabled: enabledParam(periodicFilters.enabled),
      keyword: periodicFilters.keyword || undefined,
      page: periodicPage.value,
      pageSize: periodicPageSize.value,
      workflow: periodicFilters.workflow || undefined,
    });
    periodicRows.value = resp.list || [];
    periodicTotal.value = Number(resp.total || 0);
  } finally {
    periodicLoading.value = false;
  }
}

async function loadArchiveJobs() {
  archiveLoading.value = true;
  try {
    const resp = await fetchRuntimeArchiveJobs({
      database: archiveFilters.database || undefined,
      enabled: enabledParam(archiveFilters.enabled),
      keyword: archiveFilters.keyword || undefined,
      page: archivePage.value,
      pageSize: archivePageSize.value,
    });
    archiveRows.value = resp.list || [];
    archiveTotal.value = Number(resp.total || 0);
  } finally {
    archiveLoading.value = false;
  }
}

async function loadReleases() {
  releaseLoading.value = true;
  try {
    const resp = await fetchRuntimeConfigReleases({
      page: releasePage.value,
      pageSize: releasePageSize.value,
    });
    releaseRows.value = resp.list || [];
    releaseTotal.value = Number(resp.total || 0);
  } finally {
    releaseLoading.value = false;
  }
}

async function handlePeriodicTableChange(page: TablePage) {
  periodicPage.value = page.current || 1;
  periodicPageSize.value = page.pageSize || 20;
  await loadPeriodicTasks();
}

async function handleArchiveTableChange(page: TablePage) {
  archivePage.value = page.current || 1;
  archivePageSize.value = page.pageSize || 20;
  await loadArchiveJobs();
}

async function handleReleaseTableChange(page: TablePage) {
  releasePage.value = page.current || 1;
  releasePageSize.value = page.pageSize || 10;
  await loadReleases();
}

function resetPeriodicFilters() {
  periodicFilters.enabled = 'all';
  periodicFilters.keyword = '';
  periodicFilters.workflow = '';
  periodicPage.value = 1;
  void loadPeriodicTasks();
}

function resetArchiveFilters() {
  archiveFilters.database = '';
  archiveFilters.enabled = 'all';
  archiveFilters.keyword = '';
  archivePage.value = 1;
  void loadArchiveJobs();
}

function openPeriodicDrawer(row?: Record<string, any>) {
  assignForm(
    periodicForm,
    row
      ? ({ ...newPeriodicForm(), ...row } as RuntimeConfigApi.PeriodicTaskItem)
      : newPeriodicForm(),
  );
  periodicTargetsText.value = (periodicForm.targets || []).join('\n');
  periodicDrawerApi.open();
}

function openArchiveDrawer(row?: Record<string, any>) {
  assignForm(
    archiveForm,
    row
      ? ({ ...newArchiveForm(), ...row } as RuntimeConfigApi.ArchiveJobItem)
      : newArchiveForm(),
  );
  archiveDrawerApi.open();
}

async function submitPeriodic() {
  if (!periodicForm.name.trim() || !periodicForm.workflow.trim()) {
    message.warning(rt('fillPeriodicRequired'));
    return;
  }
  if (!periodicForm.cron?.trim() && !Number(periodicForm.everySeconds || 0)) {
    message.warning(rt('periodicScheduleRequired'));
    return;
  }
  submitting.value = true;
  periodicDrawerApi.lock();
  try {
    await saveRuntimePeriodicTask({
      ...periodicForm,
      cron: periodicForm.cron?.trim() || undefined,
      everySeconds: Number(periodicForm.everySeconds || 0) || undefined,
      targets: splitTextToItems(periodicTargetsText.value),
    });
    periodicDrawerApi.close();
    clearDraftFeedback();
    message.success(rt('periodicSaved'));
    await Promise.all([loadPeriodicTasks(), loadOverview()]);
  } finally {
    submitting.value = false;
    periodicDrawerApi.unlock();
  }
}

async function submitArchive() {
  if (!archiveForm.name.trim() || !archiveForm.tableName.trim()) {
    message.warning(rt('fillArchiveRequired'));
    return;
  }
  submitting.value = true;
  archiveDrawerApi.lock();
  try {
    await saveRuntimeArchiveJob({
      ...archiveForm,
      database: archiveForm.database?.trim() || 'main',
    });
    archiveDrawerApi.close();
    clearDraftFeedback();
    message.success(rt('archiveSaved'));
    await Promise.all([loadArchiveJobs(), loadOverview()]);
  } finally {
    submitting.value = false;
    archiveDrawerApi.unlock();
  }
}

function confirmDeletePeriodic(row: Record<string, any>) {
  Modal.confirm({
    content: `${rt('deletePeriodicConfirm')}「${row.name}」？`,
    okText: rt('delete'),
    okType: 'danger',
    title: rt('deletePeriodicTitle'),
    async onOk() {
      await deleteRuntimePeriodicTask(Number(row.id));
      clearDraftFeedback();
      message.success(rt('periodicDeleted'));
      await Promise.all([loadPeriodicTasks(), loadOverview()]);
    },
  });
}

function confirmDeleteArchive(row: Record<string, any>) {
  Modal.confirm({
    content: `${rt('deleteArchiveConfirm')}「${row.name}」？`,
    okText: rt('delete'),
    okType: 'danger',
    title: rt('deleteArchiveTitle'),
    async onOk() {
      await deleteRuntimeArchiveJob(Number(row.id));
      clearDraftFeedback();
      message.success(rt('archiveDeleted'));
      await Promise.all([loadArchiveJobs(), loadOverview()]);
    },
  });
}

async function runValidate() {
  submitting.value = true;
  try {
    lastPublishResult.value = null;
    validateResult.value = await validateRuntimeConfigDraft();
    message.success(
      validateResult.value.valid ? rt('validatePassed') : rt('validateDone'),
    );
  } finally {
    submitting.value = false;
  }
}

function openRuntimeAction(
  type: RuntimeActionType,
  release?: Record<string, any>,
) {
  actionType.value = type;
  rollbackRelease.value = (release as RuntimeConfigApi.ReleaseItem) || null;
  actionRemark.value =
    type === 'rollback' && release
      ? `${rt('rollbackRemarkPrefix')} ${release.versionNo}`
      : '';
  actionModalOpen.value = true;
}

async function submitRuntimeAction() {
  submitting.value = true;
  try {
    const result = await submitWithMfaRetry(
      RUNTIME_CONFIG_MFA_SCENARIO,
      (ticket) => {
        const twoStep = ticketPayload(ticket);
        if (actionType.value === 'publish') {
          return publishRuntimeConfig({
            remark: actionRemark.value,
            ...twoStep,
          });
        }
        if (actionType.value === 'import') {
          return importCurrentRuntimeConfig({
            remark: actionRemark.value,
            ...twoStep,
          });
        }
        return rollbackRuntimeConfig({
          releaseId: Number(rollbackRelease.value?.id || 0),
          remark: actionRemark.value,
          ...twoStep,
        });
      },
      runtimeActionTitle(actionType.value),
      {
        headerDescription: runtimeActionDescription(actionType.value),
        loadProfileContext: true,
      },
    );
    lastPublishResult.value = result;
    validateResult.value = null;
    actionModalOpen.value = false;
    message.success(runtimeActionSuccess(actionType.value));
    await refreshAll();
  } finally {
    submitting.value = false;
  }
}

async function viewRelease(row: Record<string, any>) {
  releaseDetailLoading.value = true;
  activeTab.value = 'snapshot';
  try {
    selectedRelease.value = await fetchRuntimeConfigRelease(row.id);
  } finally {
    releaseDetailLoading.value = false;
  }
}

function runtimeActionTitle(type: RuntimeActionType) {
  if (type === 'import') {
    return rt('importCurrentConfig');
  }
  if (type === 'rollback') {
    return rt('rollbackConfig');
  }
  return rt('publishConfig');
}

function runtimeActionDescription(type: RuntimeActionType) {
  if (type === 'import') {
    return rt('importDescription');
  }
  if (type === 'rollback') {
    return rt('rollbackDescription');
  }
  return rt('publishDescription');
}

function runtimeActionSuccess(type: RuntimeActionType) {
  if (type === 'import') {
    return rt('importSuccess');
  }
  if (type === 'rollback') {
    return rt('rollbackSuccess');
  }
  return rt('publishSuccess');
}
</script>

<template>
  <Page auto-content-height :title="rt('pageTitle')">
    <div class="runtime-config-page">
      <Alert
        class="runtime-intro-alert"
        show-icon
        type="info"
        :message="rt('introTitle')"
        :description="rt('introDescription')"
      />

      <div class="runtime-overview">
        <Card
          v-for="item in overviewCards"
          :key="item.key"
          :loading="loadingOverview"
          size="small"
        >
          <div class="runtime-overview-label">{{ item.label }}</div>
          <div class="runtime-overview-value">
            <Tag v-if="item.key === 'source'" :color="sourceTone">
              {{ item.value }}
            </Tag>
            <span v-else>{{ item.value }}</span>
          </div>
          <div class="runtime-overview-desc">{{ item.description }}</div>
        </Card>
      </div>

      <Tabs v-model:active-key="activeTab" class="runtime-tabs">
        <Tabs.TabPane key="periodic" :tab="rt('periodicTab')">
          <div class="runtime-periodic-page">
            <div class="runtime-periodic-summary">
              <div
                v-for="item in periodicPageStats"
                :key="item.key"
                class="runtime-periodic-stat"
              >
                <div class="runtime-periodic-stat-label">{{ item.label }}</div>
                <div class="runtime-periodic-stat-value">{{ item.value }}</div>
                <div class="runtime-periodic-stat-desc">
                  {{ item.description }}
                </div>
              </div>
            </div>

            <Card class="runtime-list-card runtime-periodic-card" size="small">
              <div class="runtime-periodic-header">
                <div class="runtime-periodic-title">
                  <div class="runtime-periodic-heading">
                    {{ rt('periodicWorkbenchTitle') }}
                  </div>
                  <div class="runtime-periodic-subtitle">
                    {{ rt('periodicWorkbenchDesc') }}
                  </div>
                </div>
                <VbenButton
                  v-access="
                    asActionPermission(
                      OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                    )
                  "
                  type="primary"
                  @click="openPeriodicDrawer()"
                >
                  <template #icon><PlusOutlined /></template>
                  {{ rt('addPeriodic') }}
                </VbenButton>
              </div>

              <div class="runtime-filter-panel">
                <Input
                  v-model:value="periodicFilters.keyword"
                  allow-clear
                  class="runtime-filter-input"
                  :placeholder="rt('periodicKeywordPlaceholder')"
                  @press-enter="loadPeriodicTasks"
                />
                <Input
                  v-model:value="periodicFilters.workflow"
                  allow-clear
                  class="runtime-filter-input"
                  :placeholder="rt('workflow')"
                  @press-enter="loadPeriodicTasks"
                />
                <Select
                  v-model:value="periodicFilters.enabled"
                  class="runtime-filter-select"
                  :options="enabledOptions"
                />
                <div class="runtime-filter-actions">
                  <Button @click="resetPeriodicFilters">
                    {{ rt('reset') }}
                  </Button>
                  <Button type="primary" @click="loadPeriodicTasks">
                    <template #icon><ReloadOutlined /></template>
                    {{ rt('search') }}
                  </Button>
                </div>
              </div>

              <Table
                :columns="periodicColumns"
                :data-source="periodicRows"
                :loading="periodicLoading"
                :pagination="{
                  current: periodicPage,
                  pageSize: periodicPageSize,
                  pageSizeOptions,
                  showSizeChanger: true,
                  total: periodicTotal,
                }"
                row-key="id"
                :scroll="{ x: 960 }"
                size="small"
                @change="handlePeriodicTableChange"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'schedule'">
                    <Tag v-if="record.cron" color="blue">cron</Tag>
                    <Tag v-else color="green">every</Tag>
                    {{ record.cron || `${record.everySeconds || 0}s` }}
                  </template>
                  <template v-else-if="column.key === 'enabled'">
                    <Tag :color="record.enabled ? 'success' : 'default'">
                      {{ enabledText(record.enabled) }}
                    </Tag>
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <Space>
                      <Tooltip :title="rt('edit')">
                        <Button
                          v-access="
                            asActionPermission(
                              OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                            )
                          "
                          size="small"
                          type="text"
                          @click="openPeriodicDrawer(record)"
                        >
                          <EditOutlined />
                        </Button>
                      </Tooltip>
                      <Tooltip :title="rt('delete')">
                        <Button
                          v-access="
                            asActionPermission(
                              OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                            )
                          "
                          danger
                          size="small"
                          type="text"
                          @click="confirmDeletePeriodic(record)"
                        >
                          <DeleteOutlined />
                        </Button>
                      </Tooltip>
                    </Space>
                  </template>
                </template>
              </Table>
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane key="archive" :tab="rt('archiveTab')">
          <Card class="runtime-list-card" size="small">
            <div class="runtime-toolbar">
              <Space wrap>
                <Input
                  v-model:value="archiveFilters.keyword"
                  allow-clear
                  class="runtime-filter-input"
                  :placeholder="rt('archiveKeywordPlaceholder')"
                  @press-enter="loadArchiveJobs"
                />
                <Input
                  v-model:value="archiveFilters.database"
                  allow-clear
                  class="runtime-filter-input"
                  :placeholder="rt('database')"
                  @press-enter="loadArchiveJobs"
                />
                <Select
                  v-model:value="archiveFilters.enabled"
                  class="runtime-filter-select"
                  :options="enabledOptions"
                />
                <Button @click="resetArchiveFilters">{{ rt('reset') }}</Button>
                <Button type="primary" @click="loadArchiveJobs">
                  <template #icon><ReloadOutlined /></template>
                  {{ rt('search') }}
                </Button>
              </Space>
              <VbenButton
                v-access="
                  asActionPermission(
                    OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                  )
                "
                type="primary"
                @click="openArchiveDrawer()"
              >
                <template #icon><PlusOutlined /></template>
                {{ rt('addArchive') }}
              </VbenButton>
            </div>
            <Table
              :columns="archiveColumns"
              :data-source="archiveRows"
              :loading="archiveLoading"
              :pagination="{
                current: archivePage,
                pageSize: archivePageSize,
                pageSizeOptions,
                showSizeChanger: true,
                total: archiveTotal,
              }"
              row-key="id"
              :scroll="{ x: 960 }"
              size="small"
              @change="handleArchiveTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'keepDays'">
                  {{ record.hotKeepDays || 0 }}d /
                  {{ record.archiveDelayDays || 0 }}d
                </template>
                <template v-else-if="column.key === 'batch'">
                  {{ record.batchSize || 0 }} /
                  {{ record.deleteBatchSize || 0 }}
                </template>
                <template v-else-if="column.key === 'enabled'">
                  <Tag :color="record.enabled ? 'success' : 'default'">
                    {{ enabledText(record.enabled) }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space>
                    <Tooltip :title="rt('edit')">
                      <Button
                        v-access="
                          asActionPermission(
                            OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                          )
                        "
                        size="small"
                        type="text"
                        @click="openArchiveDrawer(record)"
                      >
                        <EditOutlined />
                      </Button>
                    </Tooltip>
                    <Tooltip :title="rt('delete')">
                      <Button
                        v-access="
                          asActionPermission(
                            OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_SAVE,
                          )
                        "
                        danger
                        size="small"
                        type="text"
                        @click="confirmDeleteArchive(record)"
                      >
                        <DeleteOutlined />
                      </Button>
                    </Tooltip>
                  </Space>
                </template>
              </template>
            </Table>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane key="release" :tab="rt('releaseTab')">
          <div class="runtime-release-layout">
            <Card
              class="runtime-list-card runtime-release-card"
              size="small"
              :title="rt('releaseHistory')"
            >
              <template #extra>
                <Space class="runtime-release-actions" wrap>
                  <VbenButton
                    v-access="
                      asActionPermission(
                        OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_VALIDATE,
                      )
                    "
                    :loading="submitting"
                    @click="runValidate"
                  >
                    <template #icon><CheckCircleOutlined /></template>
                    {{ rt('validateDraft') }}
                  </VbenButton>
                  <VbenButton
                    v-access="
                      asActionPermission(
                        OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_PUBLISH,
                      )
                    "
                    type="primary"
                    @click="openRuntimeAction('publish')"
                  >
                    <template #icon><CloudUploadOutlined /></template>
                    {{ rt('publishDraft') }}
                  </VbenButton>
                  <VbenButton
                    v-access="
                      asActionPermission(
                        OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_IMPORT,
                      )
                    "
                    @click="openRuntimeAction('import')"
                  >
                    <template #icon><ImportOutlined /></template>
                    {{ rt('importCurrent') }}
                  </VbenButton>
                </Space>
              </template>
              <div class="runtime-action-result">
                <Alert
                  v-if="validateResult"
                  :type="validateResult.valid ? 'success' : 'warning'"
                  show-icon
                  :message="
                    validateResult.valid
                      ? rt('draftValidatePassed')
                      : rt('draftValidateFailed')
                  "
                >
                  <template #description>
                    <div
                      v-if="
                        !validateResult.valid && validateMessages.length > 0
                      "
                      class="runtime-validate-messages"
                    >
                      <div v-for="item in validateMessages" :key="item">
                        {{ item }}
                      </div>
                    </div>
                    <span v-else-if="validateResult.checksum">
                      checksum: {{ validateChecksumShort }}
                    </span>
                  </template>
                </Alert>
                <Alert
                  v-if="lastPublishResult"
                  :type="
                    lastPublishResult.restartRequired ? 'warning' : 'success'
                  "
                  show-icon
                  :message="`${rt('version')} ${lastPublishResult.versionNo} ${rt('created')}`"
                  :description="
                    lastPublishResult.restartRequired
                      ? `${rt('restartRequired')}: ${lastPublishResult.restartReason}`
                      : `release_id=${lastPublishResult.releaseId} checksum=${formatShortChecksum(lastPublishResult.checksum)}`
                  "
                />
              </div>
              <Table
                :columns="releaseColumns"
                :data-source="releaseRows"
                :loading="releaseLoading"
                :pagination="{
                  current: releasePage,
                  pageSize: releasePageSize,
                  pageSizeOptions,
                  showSizeChanger: true,
                  total: releaseTotal,
                }"
                row-key="id"
                :scroll="{ x: 1066 }"
                size="small"
                @change="handleReleaseTableChange"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'checksum'">
                    <Tooltip :title="record.checksum">
                      <span class="runtime-table-ellipsis">
                        {{ formatShortChecksum(record.checksum) }}
                      </span>
                    </Tooltip>
                  </template>
                  <template v-else-if="column.key === 'remark'">
                    <Tooltip v-if="record.remark" :title="record.remark">
                      <span class="runtime-table-ellipsis">
                        {{ record.remark }}
                      </span>
                    </Tooltip>
                    <span v-else class="runtime-table-empty">-</span>
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <Space>
                      <Tooltip :title="rt('viewSnapshot')">
                        <Button
                          size="small"
                          type="text"
                          @click="viewRelease(record)"
                        >
                          <EyeOutlined />
                        </Button>
                      </Tooltip>
                      <Tooltip :title="rt('rollback')">
                        <Button
                          v-access="
                            asActionPermission(
                              OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_ROLLBACK,
                            )
                          "
                          size="small"
                          type="text"
                          @click="openRuntimeAction('rollback', record)"
                        >
                          <RollbackOutlined />
                        </Button>
                      </Tooltip>
                    </Space>
                  </template>
                </template>
              </Table>
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane key="snapshot" :tab="rt('snapshotTab')">
          <SnapshotDiffPanel
            :active-checksum="activeState.activeChecksum"
            :active-version="activeState.activeVersion || 0"
            :current-snapshot-text="currentSnapshotText"
            :draft-snapshot-text="draftSnapshotText"
            :release-checksum="selectedRelease?.checksum || ''"
            :release-loading="releaseDetailLoading"
            :release-selected="Boolean(selectedRelease)"
            :release-snapshot-text="selectedReleaseSnapshotText"
            :release-version="selectedRelease?.versionNo || 0"
            :source="overview?.source || '-'"
          />
        </Tabs.TabPane>
      </Tabs>

      <PeriodicDrawer
        class="w-full max-w-[940px]"
        :loading="submitting"
        :title="rt('periodicDraft')"
      >
        <div class="runtime-editor">
          <div class="runtime-editor-guide">
            <div class="runtime-editor-guide__summary">
              <InfoCircleOutlined class="runtime-editor-guide__icon" />
              <div class="runtime-editor-guide__copy">
                <span class="runtime-editor-guide__title">
                  {{ rt('periodicFormGuide') }}
                </span>
                <span class="runtime-editor-guide__desc">
                  {{ rt('periodicFormGuideDesc') }}
                </span>
              </div>
            </div>
            <div class="runtime-editor-guide__meta">
              <span class="runtime-editor-guide__label">
                {{ rt('runtimeGuideKeyPoints') }}
              </span>
              <Tag color="processing">
                {{ rt('runtimeGuideDraftOnly') }}
              </Tag>
              <Tag color="warning">
                {{ rt('runtimeGuidePublishRequired') }}
              </Tag>
              <span class="runtime-editor-guide__extra">
                {{ rt('periodicFormGuideExtra') }}
              </span>
            </div>
          </div>
          <Form :model="periodicForm" layout="vertical">
            <div class="runtime-editor__layout">
              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormBasic') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormBasicDesc') }}
                    </div>
                  </div>
                  <div class="runtime-editor__section-toggle">
                    <div class="runtime-editor__section-toggle-main">
                      <span>{{ rt('enabled') }}</span>
                      <Switch v-model:checked="periodicForm.enabled" />
                    </div>
                    <span class="runtime-editor__section-toggle-desc">
                      {{ rt('periodicEnabledHelp') }}
                    </span>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    required
                    :extra="rt('periodicNameHelp')"
                    :label="rt('name')"
                  >
                    <Input v-model:value="periodicForm.name" />
                  </Form.Item>
                  <Form.Item
                    required
                    :extra="rt('periodicWorkflowHelp')"
                    :label="rt('workflow')"
                  >
                    <Input v-model:value="periodicForm.workflow" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicQueueHelp')"
                    :label="rt('queue')"
                  >
                    <Input v-model:value="periodicForm.queue" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicSortOrderHelp')"
                    :label="rt('sortOrder')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.sortOrder"
                      class="w-full"
                    />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormSchedule') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormScheduleDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item :extra="rt('periodicCronHelp')" label="Cron">
                    <Input
                      v-model:value="periodicForm.cron"
                      placeholder="0 */5 * * * *"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicEverySecondsHelp')"
                    :label="rt('everySeconds')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.everySeconds"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicDeadlineHelp')"
                    :label="rt('deadline')"
                  >
                    <Input
                      v-model:value="periodicForm.deadline"
                      placeholder="RFC3339"
                    />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormExecution') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormExecutionDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    :extra="rt('periodicShardTotalHelp')"
                    :label="rt('shardTotal')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.shardTotal"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicGrayPercentHelp')"
                    :label="rt('grayPercent')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.grayPercent"
                      class="w-full"
                      :max="100"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicRetryHelp')"
                    :label="rt('retry')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.retry"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicTimeoutSecondsHelp')"
                    :label="rt('timeoutSeconds')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.timeoutSeconds"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormDedupe') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormDedupeDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    :extra="rt('periodicUniqueKeyHelp')"
                    :label="rt('uniqueKey')"
                  >
                    <Input v-model:value="periodicForm.uniqueKey" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicUniqueTtlSecondsHelp')"
                    :label="rt('uniqueTtlSeconds')"
                  >
                    <InputNumber
                      v-model:value="periodicForm.uniqueTtlSeconds"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                </div>
              </section>

              <section
                class="runtime-editor__section runtime-editor__section--wide"
              >
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormPayload') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormPayloadDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__stack">
                  <Form.Item
                    :extra="rt('periodicTargetsHelp')"
                    :label="rt('targets')"
                  >
                    <Textarea
                      v-model:value="periodicTargetsText"
                      :rows="3"
                      :placeholder="rt('targetsPlaceholder')"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('periodicRemarkHelp')"
                    :label="rt('remark')"
                  >
                    <Textarea v-model:value="periodicForm.remark" :rows="2" />
                  </Form.Item>
                </div>
              </section>
            </div>
          </Form>
        </div>
      </PeriodicDrawer>

      <ArchiveDrawer
        class="w-full max-w-[980px]"
        :loading="submitting"
        :title="rt('archiveDraft')"
      >
        <div class="runtime-editor">
          <div class="runtime-editor-guide">
            <div class="runtime-editor-guide__summary">
              <InfoCircleOutlined class="runtime-editor-guide__icon" />
              <div class="runtime-editor-guide__copy">
                <span class="runtime-editor-guide__title">
                  {{ rt('archiveFormGuide') }}
                </span>
                <span class="runtime-editor-guide__desc">
                  {{ rt('archiveFormGuideDesc') }}
                </span>
              </div>
            </div>
            <div class="runtime-editor-guide__meta">
              <span class="runtime-editor-guide__label">
                {{ rt('runtimeGuideKeyPoints') }}
              </span>
              <Tag color="processing">
                {{ rt('runtimeGuideDraftOnly') }}
              </Tag>
              <Tag color="warning">
                {{ rt('runtimeGuidePublishRequired') }}
              </Tag>
              <span class="runtime-editor-guide__extra">
                {{ rt('archiveFormGuideExtra') }}
              </span>
            </div>
          </div>
          <Form :model="archiveForm" layout="vertical">
            <div class="runtime-editor__layout">
              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormBasic') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormArchiveBasicDesc') }}
                    </div>
                  </div>
                  <div class="runtime-editor__section-toggle">
                    <div class="runtime-editor__section-toggle-main">
                      <span>{{ rt('enabled') }}</span>
                      <Switch v-model:checked="archiveForm.enabled" />
                    </div>
                    <span class="runtime-editor__section-toggle-desc">
                      {{ rt('archiveEnabledHelp') }}
                    </span>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    required
                    :extra="rt('archiveNameHelp')"
                    :label="rt('name')"
                  >
                    <Input v-model:value="archiveForm.name" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveDatabaseHelp')"
                    :label="rt('database')"
                  >
                    <Input v-model:value="archiveForm.database" />
                  </Form.Item>
                  <Form.Item
                    required
                    :extra="rt('archiveTableNameHelp')"
                    :label="rt('hotTableName')"
                  >
                    <Input v-model:value="archiveForm.tableName" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveSortOrderHelp')"
                    :label="rt('sortOrder')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.sortOrder"
                      class="w-full"
                    />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormArchiveWindow') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormArchiveWindowDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    :extra="rt('archiveTimeColumnHelp')"
                    :label="rt('timeColumn')"
                  >
                    <Input v-model:value="archiveForm.timeColumn" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archivePrimaryKeyHelp')"
                    :label="rt('primaryKey')"
                  >
                    <Input v-model:value="archiveForm.primaryKey" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveSplitUnitHelp')"
                    :label="rt('splitUnit')"
                  >
                    <Input v-model:value="archiveForm.splitUnit" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveHotKeepDaysHelp')"
                    :label="rt('hotKeepDays')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.hotKeepDays"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveDelayDaysHelp')"
                    :label="rt('archiveDelayDays')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.archiveDelayDays"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveWindowSecondsHelp')"
                    :label="rt('archiveWindowSeconds')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.archiveWindowSeconds"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveStartAtHelp')"
                    :label="rt('startAt')"
                  >
                    <Input
                      v-model:value="archiveForm.startAt"
                      placeholder="RFC3339"
                    />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormBatchDelete') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormBatchDeleteDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__grid">
                  <Form.Item
                    :extra="rt('archiveBatchHelp')"
                    :label="rt('archiveBatch')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.batchSize"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveDeleteBatchHelp')"
                    :label="rt('deleteBatch')"
                  >
                    <InputNumber
                      v-model:value="archiveForm.deleteBatchSize"
                      class="w-full"
                      :min="0"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveDeleteDisabledHelp')"
                    :label="rt('deleteDisabled')"
                  >
                    <Switch v-model:checked="archiveForm.deleteDisabled" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveQueryWriteDbHelp')"
                    :label="rt('queryWriteDb')"
                  >
                    <Switch v-model:checked="archiveForm.queryWriteDb" />
                  </Form.Item>
                </div>
              </section>

              <section class="runtime-editor__section">
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormHistoryTable') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormHistoryTableDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__stack">
                  <Form.Item
                    :extra="rt('archiveHistoryTablePrefixHelp')"
                    :label="rt('historyTablePrefix')"
                  >
                    <Input v-model:value="archiveForm.historyTablePrefix" />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveHistoryTableNameRuleHelp')"
                    :label="rt('historyTableNameRule')"
                  >
                    <Input v-model:value="archiveForm.historyTableNameRule" />
                  </Form.Item>
                </div>
              </section>

              <section
                class="runtime-editor__section runtime-editor__section--wide"
              >
                <div class="runtime-editor__section-head">
                  <div>
                    <div class="runtime-editor__section-title">
                      {{ rt('runtimeFormConditions') }}
                    </div>
                    <div class="runtime-editor__section-desc">
                      {{ rt('runtimeFormConditionsDesc') }}
                    </div>
                  </div>
                </div>
                <div class="runtime-editor__stack">
                  <Form.Item
                    :extra="rt('archiveConditionHelp')"
                    :label="rt('archiveCondition')"
                  >
                    <Textarea
                      v-model:value="archiveForm.archiveCondition"
                      :rows="2"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveDeleteConditionHelp')"
                    :label="rt('deleteCondition')"
                  >
                    <Textarea
                      v-model:value="archiveForm.deleteCondition"
                      :rows="2"
                    />
                  </Form.Item>
                  <Form.Item
                    :extra="rt('archiveRemarkHelp')"
                    :label="rt('remark')"
                  >
                    <Textarea v-model:value="archiveForm.remark" :rows="2" />
                  </Form.Item>
                </div>
              </section>
            </div>
          </Form>
        </div>
      </ArchiveDrawer>

      <Modal
        v-model:open="actionModalOpen"
        :confirm-loading="submitting"
        width="560px"
        :title="runtimeActionTitle(actionType)"
        @ok="submitRuntimeAction"
      >
        <Alert
          class="mb-4"
          show-icon
          type="warning"
          :message="runtimeActionTitle(actionType)"
          :description="runtimeActionDescription(actionType)"
        />
        <div v-if="actionType === 'rollback'" class="runtime-action-target">
          <Tag color="warning">
            {{ rt('targetVersion') }} {{ rollbackRelease?.versionNo }}
          </Tag>
          <span>release_id={{ rollbackRelease?.id }}</span>
        </div>
        <Form layout="vertical">
          <Form.Item :label="rt('remark')">
            <Textarea v-model:value="actionRemark" :rows="3" />
          </Form.Item>
        </Form>
        <div class="runtime-mfa-hint">
          <SafetyCertificateOutlined />
          {{ rt('mfaHint') }}
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.runtime-config-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  min-height: 100%;
  color: var(--vben-text-color);
}

.runtime-intro-alert {
  margin-bottom: 0;
}

.runtime-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  margin-bottom: 0;
}

.runtime-overview :deep(.ant-card) {
  min-width: 0;
}

.runtime-overview :deep(.ant-card-body) {
  min-height: auto;
  padding: 12px;
}

.runtime-overview-label,
.runtime-overview-desc {
  font-size: 12px;
  color: var(--vben-text-color-secondary);
}

.runtime-overview-value {
  min-height: 26px;
  margin: 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.runtime-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.runtime-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.runtime-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.runtime-periodic-page {
  display: grid;
  gap: 8px;
}

.runtime-periodic-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.runtime-periodic-stat {
  min-width: 0;
  padding: 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.runtime-periodic-stat-label,
.runtime-periodic-stat-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--vben-text-color-secondary);
  white-space: nowrap;
}

.runtime-periodic-stat-value {
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.25;
  color: var(--vben-text-color);
  white-space: nowrap;
}

.runtime-periodic-card :deep(.ant-card-body) {
  display: grid;
  gap: 12px;
}

.runtime-periodic-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.runtime-periodic-title {
  min-width: 0;
}

.runtime-periodic-heading {
  font-size: 15px;
  font-weight: 650;
  color: var(--vben-text-color);
}

.runtime-periodic-subtitle {
  max-width: 760px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
}

.runtime-filter-panel {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 140px auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: hsl(var(--accent) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.runtime-filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.runtime-list-card :deep(.ant-card-body) {
  min-width: 0;
  padding: 12px;
}

.runtime-list-card {
  min-width: 0;
}

.runtime-list-card :deep(.ant-table) {
  color: var(--vben-text-color);
  background: transparent;
}

.runtime-list-card :deep(.ant-table-wrapper) {
  min-width: 0;
}

.runtime-list-card :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-bottom-color: hsl(var(--border));
}

.runtime-list-card :deep(.ant-table-thead > tr > th::before) {
  background-color: hsl(var(--heavy));
}

.runtime-list-card :deep(.ant-table-tbody > tr > td) {
  color: var(--vben-text-color);
  border-bottom-color: hsl(var(--border));
}

.runtime-list-card :deep(.ant-table-cell) {
  vertical-align: middle;
}

.runtime-list-card :deep(.ant-empty-description) {
  color: var(--vben-text-color-secondary);
}

.runtime-editor {
  --runtime-editor-help-color: hsl(var(--foreground) / 52%);
  --runtime-editor-section-help-color: hsl(var(--foreground) / 56%);

  padding: 16px 18px 18px;
}

.runtime-editor-guide {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  padding: 10px 12px;
  margin-bottom: 14px;
  background: hsl(var(--accent) / 38%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.runtime-editor-guide__summary,
.runtime-editor-guide__meta {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}

.runtime-editor-guide__summary {
  flex: 1 1 520px;
}

.runtime-editor-guide__meta {
  flex: 1 1 360px;
  flex-wrap: wrap;
}

.runtime-editor-guide__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 2px;
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 48%);
  border-radius: 999px;
}

.runtime-editor-guide__copy {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
}

.runtime-editor-guide__title {
  flex: none;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.runtime-editor-guide__desc,
.runtime-editor-guide__extra {
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--runtime-editor-section-help-color);
}

.runtime-editor-guide__extra {
  flex: 1 1 260px;
}

.runtime-editor-guide__label {
  flex: none;
  font-size: 12px;
  line-height: 22px;
  color: var(--runtime-editor-help-color);
}

.runtime-editor__layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.runtime-editor__section {
  min-width: 0;
  padding: 14px;
  background: hsl(var(--accent) / 32%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.runtime-editor__section--wide {
  grid-column: 1 / -1;
}

.runtime-editor__section-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.runtime-editor__section-toggle {
  display: grid;
  flex: 0 0 150px;
  gap: 4px;
  justify-items: end;
  min-width: 0;
}

.runtime-editor__section-toggle-main {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.runtime-editor__section-toggle-desc {
  max-width: 150px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--runtime-editor-help-color);
  text-align: right;
}

.runtime-editor__section-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.runtime-editor__section-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--runtime-editor-section-help-color);
}

.runtime-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.runtime-editor__stack {
  display: grid;
  gap: 12px;
}

.runtime-editor :deep(.ant-form-item) {
  margin-bottom: 0;
}

.runtime-editor :deep(.ant-form-item-label > label) {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.runtime-editor :deep(.ant-form-item-extra) {
  max-width: 100%;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--runtime-editor-help-color);
  overflow-wrap: anywhere;
}

.runtime-editor :deep(.ant-input),
.runtime-editor :deep(.ant-input-number),
.runtime-editor :deep(.ant-input-number-input),
.runtime-editor :deep(.ant-input-affix-wrapper),
.runtime-editor :deep(.ant-select-selector),
.runtime-editor :deep(textarea.ant-input) {
  border-radius: 6px;
}

.runtime-filter-input {
  width: 180px;
}

.runtime-filter-select {
  width: 120px;
}

.runtime-release-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  align-items: start;
}

.runtime-action-result {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.runtime-validate-messages {
  display: grid;
  gap: 4px;
  line-height: 1.6;
}

.runtime-release-card :deep(.ant-card-head) {
  align-items: center;
}

.runtime-release-card :deep(.ant-card-head-title),
.runtime-release-card :deep(.ant-card-head-wrapper) {
  min-width: 0;
}

.runtime-release-card :deep(.ant-card-extra) {
  min-width: 0;
  padding: 8px 0;
}

.runtime-release-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.runtime-table-ellipsis {
  display: inline-block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  vertical-align: middle;
  white-space: nowrap;
}

.runtime-table-empty {
  color: var(--vben-text-color-secondary);
}

.runtime-action-target {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.runtime-mfa-hint {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
}

@media (max-width: 1200px) {
  .runtime-overview,
  .runtime-periodic-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .runtime-filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .runtime-editor__layout,
  .runtime-editor__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .runtime-overview,
  .runtime-periodic-summary,
  .runtime-release-layout,
  .runtime-editor__layout,
  .runtime-editor__grid {
    grid-template-columns: 1fr;
  }

  .runtime-periodic-header,
  .runtime-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .runtime-filter-panel {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .runtime-filter-input,
  .runtime-filter-select {
    width: 100%;
  }

  .runtime-filter-actions {
    justify-content: stretch;
  }

  .runtime-filter-actions :deep(.ant-btn) {
    flex: 1;
  }

  .runtime-release-card :deep(.ant-card-head) {
    align-items: stretch;
  }

  .runtime-release-card :deep(.ant-card-head-wrapper) {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .runtime-release-card :deep(.ant-card-extra) {
    width: 100%;
    padding-top: 0;
  }

  .runtime-release-actions,
  .runtime-release-actions :deep(.ant-space-item) {
    width: 100%;
  }

  .runtime-release-actions :deep(.ant-btn) {
    width: 100%;
  }
}
</style>
