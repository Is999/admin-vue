<script lang="ts" setup>
import type { RuntimeConfigApi } from '#/api/ops/runtime-config';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
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

import { safePrettyJson, splitTextToItems } from '../shared';

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
const periodicModalOpen = ref(false);
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
const archiveModalOpen = ref(false);
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
  hasAnyPermission(
    accessStore.accessCodes,
    OPS_ACTION_PERMISSION_CODES.RUNTIME_CONFIG_LIST,
  ),
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
    key: 'env',
    label: rt('env'),
    value: overview.value?.env || '-',
    description: `${rt('pollEvery')} ${overview.value?.pollIntervalSeconds || 30} ${rt('seconds')}`,
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
const snapshotChanged = computed(
  () => currentSnapshotText.value !== draftSnapshotText.value,
);
const activeChecksumShort = computed(() =>
  shortChecksum(activeState.value.activeChecksum),
);
const validateChecksumShort = computed(() =>
  shortChecksum(validateResult.value?.checksum || ''),
);
const selectedReleaseSnapshotText = computed(
  () =>
    selectedRelease.value?.snapshotYaml ||
    selectedRelease.value?.snapshotJson ||
    '',
);

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
    width: 100,
  },
  { title: rt('releaseId'), dataIndex: 'id', key: 'id', width: 110 },
  { title: 'Checksum', dataIndex: 'checksum', key: 'checksum', width: 170 },
  {
    title: rt('publisher'),
    dataIndex: 'publishedByName',
    key: 'publishedByName',
    width: 140,
  },
  {
    title: rt('publishedAt'),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    width: 180,
  },
  { title: rt('remark'), dataIndex: 'remark', key: 'remark' },
  { title: rt('action'), key: 'action', width: 132 },
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
  Object.keys(target).forEach((key) => delete (target as any)[key]);
  Object.assign(target, source);
}

function shortChecksum(value: string) {
  return value ? `${value.slice(0, 10)}...${value.slice(-8)}` : '-';
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

function openPeriodicModal(row?: Record<string, any>) {
  assignForm(
    periodicForm,
    row
      ? ({ ...newPeriodicForm(), ...row } as RuntimeConfigApi.PeriodicTaskItem)
      : newPeriodicForm(),
  );
  periodicTargetsText.value = (periodicForm.targets || []).join('\n');
  periodicModalOpen.value = true;
}

function openArchiveModal(row?: Record<string, any>) {
  assignForm(
    archiveForm,
    row
      ? ({ ...newArchiveForm(), ...row } as RuntimeConfigApi.ArchiveJobItem)
      : newArchiveForm(),
  );
  archiveModalOpen.value = true;
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
  try {
    await saveRuntimePeriodicTask({
      ...periodicForm,
      cron: periodicForm.cron?.trim() || undefined,
      everySeconds: Number(periodicForm.everySeconds || 0) || undefined,
      targets: splitTextToItems(periodicTargetsText.value),
    });
    periodicModalOpen.value = false;
    message.success(rt('periodicSaved'));
    await Promise.all([loadPeriodicTasks(), loadOverview()]);
  } finally {
    submitting.value = false;
  }
}

async function submitArchive() {
  if (!archiveForm.name.trim() || !archiveForm.tableName.trim()) {
    message.warning(rt('fillArchiveRequired'));
    return;
  }
  submitting.value = true;
  try {
    await saveRuntimeArchiveJob({
      ...archiveForm,
      database: archiveForm.database?.trim() || 'main',
    });
    archiveModalOpen.value = false;
    message.success(rt('archiveSaved'));
    await Promise.all([loadArchiveJobs(), loadOverview()]);
  } finally {
    submitting.value = false;
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
      message.success(rt('archiveDeleted'));
      await Promise.all([loadArchiveJobs(), loadOverview()]);
    },
  });
}

async function runValidate() {
  submitting.value = true;
  try {
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
                  @click="openPeriodicModal()"
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
                          @click="openPeriodicModal(record)"
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
                @click="openArchiveModal()"
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
                        @click="openArchiveModal(record)"
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
            <Card size="small" :title="rt('releaseActions')">
              <Space wrap>
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
                  :description="`checksum: ${validateChecksumShort}`"
                />
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
                      : `release_id=${lastPublishResult.releaseId} checksum=${shortChecksum(lastPublishResult.checksum)}`
                  "
                />
              </div>
            </Card>
            <Card
              class="runtime-list-card"
              size="small"
              :title="rt('releaseHistory')"
            >
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
                :scroll="{ x: 920 }"
                size="small"
                @change="handleReleaseTableChange"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'checksum'">
                    {{ shortChecksum(record.checksum) }}
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
          <div class="runtime-snapshot-layout">
            <Card size="small" :title="rt('currentSnapshot')">
              <div class="runtime-snapshot-meta">
                <Tag :color="sourceTone">{{ overview?.source || '-' }}</Tag>
                <Tag>
                  {{ rt('version') }} {{ activeState.activeVersion || 0 }}
                </Tag>
                <Tag>{{ activeChecksumShort }}</Tag>
              </div>
              <pre class="runtime-code">{{ currentSnapshotText }}</pre>
            </Card>
            <Card size="small" :title="rt('draftDiffPreview')">
              <Alert
                :type="snapshotChanged ? 'warning' : 'success'"
                show-icon
                :message="
                  snapshotChanged ? rt('snapshotChanged') : rt('snapshotSame')
                "
                :description="rt('snapshotPreviewDescription')"
              />
              <pre class="runtime-code">{{ draftSnapshotText }}</pre>
            </Card>
            <Card size="small" :title="rt('releaseSnapshotDetail')">
              <div class="runtime-snapshot-meta">
                <Tag v-if="selectedRelease">
                  {{ rt('version') }} {{ selectedRelease.versionNo }}
                </Tag>
                <Tag v-if="selectedRelease">
                  {{ shortChecksum(selectedRelease.checksum) }}
                </Tag>
              </div>
              <pre
                class="runtime-code"
                :class="{ loading: releaseDetailLoading }"
                >{{ selectedReleaseSnapshotText || rt('selectReleaseHint') }}
              </pre>
            </Card>
          </div>
        </Tabs.TabPane>
      </Tabs>

      <Modal
        v-model:open="periodicModalOpen"
        :confirm-loading="submitting"
        destroy-on-close
        width="820px"
        :title="rt('periodicDraft')"
        @ok="submitPeriodic"
      >
        <Form :model="periodicForm" layout="vertical">
          <div class="runtime-form-grid">
            <Form.Item :label="rt('enabled')">
              <Switch v-model:checked="periodicForm.enabled" />
            </Form.Item>
            <Form.Item required :label="rt('name')">
              <Input v-model:value="periodicForm.name" />
            </Form.Item>
            <Form.Item required :label="rt('workflow')">
              <Input v-model:value="periodicForm.workflow" />
            </Form.Item>
            <Form.Item :label="rt('queue')">
              <Input v-model:value="periodicForm.queue" />
            </Form.Item>
            <Form.Item label="Cron">
              <Input
                v-model:value="periodicForm.cron"
                placeholder="0 */5 * * * *"
              />
            </Form.Item>
            <Form.Item :label="rt('everySeconds')">
              <InputNumber
                v-model:value="periodicForm.everySeconds"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('shardTotal')">
              <InputNumber
                v-model:value="periodicForm.shardTotal"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('grayPercent')">
              <InputNumber
                v-model:value="periodicForm.grayPercent"
                class="w-full"
                :max="100"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('retry')">
              <InputNumber
                v-model:value="periodicForm.retry"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('timeoutSeconds')">
              <InputNumber
                v-model:value="periodicForm.timeoutSeconds"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('uniqueKey')">
              <Input v-model:value="periodicForm.uniqueKey" />
            </Form.Item>
            <Form.Item :label="rt('uniqueTtlSeconds')">
              <InputNumber
                v-model:value="periodicForm.uniqueTtlSeconds"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('sortOrder')">
              <InputNumber
                v-model:value="periodicForm.sortOrder"
                class="w-full"
              />
            </Form.Item>
            <Form.Item :label="rt('deadline')">
              <Input
                v-model:value="periodicForm.deadline"
                placeholder="RFC3339"
              />
            </Form.Item>
          </div>
          <Form.Item :label="rt('targets')">
            <Textarea
              v-model:value="periodicTargetsText"
              :rows="3"
              :placeholder="rt('targetsPlaceholder')"
            />
          </Form.Item>
          <Form.Item :label="rt('remark')">
            <Textarea v-model:value="periodicForm.remark" :rows="2" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        v-model:open="archiveModalOpen"
        :confirm-loading="submitting"
        destroy-on-close
        width="920px"
        :title="rt('archiveDraft')"
        @ok="submitArchive"
      >
        <Form :model="archiveForm" layout="vertical">
          <div class="runtime-form-grid">
            <Form.Item :label="rt('enabled')">
              <Switch v-model:checked="archiveForm.enabled" />
            </Form.Item>
            <Form.Item required :label="rt('name')">
              <Input v-model:value="archiveForm.name" />
            </Form.Item>
            <Form.Item :label="rt('database')">
              <Input v-model:value="archiveForm.database" />
            </Form.Item>
            <Form.Item required :label="rt('hotTableName')">
              <Input v-model:value="archiveForm.tableName" />
            </Form.Item>
            <Form.Item :label="rt('timeColumn')">
              <Input v-model:value="archiveForm.timeColumn" />
            </Form.Item>
            <Form.Item :label="rt('primaryKey')">
              <Input v-model:value="archiveForm.primaryKey" />
            </Form.Item>
            <Form.Item :label="rt('splitUnit')">
              <Input v-model:value="archiveForm.splitUnit" />
            </Form.Item>
            <Form.Item :label="rt('hotKeepDays')">
              <InputNumber
                v-model:value="archiveForm.hotKeepDays"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('archiveDelayDays')">
              <InputNumber
                v-model:value="archiveForm.archiveDelayDays"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('archiveWindowSeconds')">
              <InputNumber
                v-model:value="archiveForm.archiveWindowSeconds"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('archiveBatch')">
              <InputNumber
                v-model:value="archiveForm.batchSize"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('deleteBatch')">
              <InputNumber
                v-model:value="archiveForm.deleteBatchSize"
                class="w-full"
                :min="0"
              />
            </Form.Item>
            <Form.Item :label="rt('deleteDisabled')">
              <Switch v-model:checked="archiveForm.deleteDisabled" />
            </Form.Item>
            <Form.Item :label="rt('queryWriteDb')">
              <Switch v-model:checked="archiveForm.queryWriteDb" />
            </Form.Item>
            <Form.Item :label="rt('sortOrder')">
              <InputNumber
                v-model:value="archiveForm.sortOrder"
                class="w-full"
              />
            </Form.Item>
            <Form.Item :label="rt('startAt')">
              <Input
                v-model:value="archiveForm.startAt"
                placeholder="RFC3339"
              />
            </Form.Item>
          </div>
          <Form.Item :label="rt('historyTablePrefix')">
            <Input v-model:value="archiveForm.historyTablePrefix" />
          </Form.Item>
          <Form.Item :label="rt('historyTableNameRule')">
            <Input v-model:value="archiveForm.historyTableNameRule" />
          </Form.Item>
          <Form.Item :label="rt('archiveCondition')">
            <Textarea v-model:value="archiveForm.archiveCondition" :rows="2" />
          </Form.Item>
          <Form.Item :label="rt('deleteCondition')">
            <Textarea v-model:value="archiveForm.deleteCondition" :rows="2" />
          </Form.Item>
          <Form.Item :label="rt('remark')">
            <Textarea v-model:value="archiveForm.remark" :rows="2" />
          </Form.Item>
        </Form>
      </Modal>

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
  padding: 12px;
}

.runtime-list-card :deep(.ant-table) {
  color: var(--vben-text-color);
  background: transparent;
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

.runtime-list-card :deep(.ant-empty-description) {
  color: var(--vben-text-color-secondary);
}

.runtime-filter-input {
  width: 180px;
}

.runtime-filter-select {
  width: 120px;
}

.runtime-release-layout,
.runtime-snapshot-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.6fr) minmax(0, 1.4fr);
  gap: 8px;
}

.runtime-snapshot-layout {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.runtime-action-result {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.runtime-snapshot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.runtime-code {
  min-height: 240px;
  max-height: 560px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vben-text-color);
  white-space: pre-wrap;
  background: var(--vben-background-soft);
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

.runtime-code.loading {
  opacity: 0.65;
}

.runtime-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
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
  .runtime-periodic-summary,
  .runtime-release-layout,
  .runtime-snapshot-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .runtime-filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .runtime-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .runtime-overview,
  .runtime-periodic-summary,
  .runtime-release-layout,
  .runtime-snapshot-layout,
  .runtime-form-grid {
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
}
</style>
