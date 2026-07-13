<script lang="ts" setup>
import type { RuntimeConfigApi } from '#/api/ops/runtime-config';

import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenDrawer } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress as AProgress,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { fetchRuntimeArchiveProgress } from '#/api/ops/runtime-config';
import {
  hasAnyPermission,
  OPS_ACTION_PERMISSION_CODES,
  OPS_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  currentSessionStateIdentity,
  registerSessionStateCleanup,
} from '#/utils/session-state-gate';

import { formatDurationMs, formatTraceCount } from '../../shared';

type ArchiveProgressDrawerData = {
  // activeTasks 是当前 active release 中的周期任务配置。
  activeTasks?: RuntimeConfigApi.PeriodicTaskItem[];
  // job 是用户当前查看的归档任务草稿。
  job?: RuntimeConfigApi.ArchiveJobItem;
};

// ARCHIVE_PROGRESS_REFRESH_INTERVAL_MS 表示详情抽屉打开时的轻量刷新间隔。
const ARCHIVE_PROGRESS_REFRESH_INTERVAL_MS = 5000;

// archiveProgressLabelKeys 将后端阶段和区间状态映射到当前页面 i18n key。
const archiveProgressLabelKeys: Record<string, string> = {
  caught_up: 'archivePhaseCaughtUp',
  deleted: 'archiveSegmentDeleted',
  deleting: 'archivePhaseDeleting',
  done: 'archiveSegmentDone',
  failed: 'archivePhaseFailed',
  idle: 'archivePhaseIdle',
  inactive: 'archivePhaseInactive',
  lease_expired: 'archivePhaseLeaseExpired',
  not_started: 'archivePhaseNotStarted',
  pending: 'archivePhasePending',
  running: 'archivePhaseRunning',
  waiting_delete: 'archivePhaseWaitingDelete',
};

const rt = (key: string) => $t(`admin.runtimeConfig.${key}`);
const router = useRouter();
const accessStore = useAccessStore();
// archiveProgressJob 保存当前详情抽屉对应的归档任务草稿。
const archiveProgressJob = ref<null | RuntimeConfigApi.ArchiveJobItem>(null);
// activePeriodicTasks 保存当前 active release 中可触发归档工作流的周期任务。
const activePeriodicTasks = ref<RuntimeConfigApi.PeriodicTaskItem[]>([]);
// archiveProgress 保存后端返回的当前运行态详情。
const archiveProgress = ref<null | RuntimeConfigApi.ArchiveProgressResp>(null);
// archiveProgressLoading 控制详情首次加载状态。
const archiveProgressLoading = ref(false);
// archiveProgressLoadFailed 标记详情请求失败，允许用户手动重试。
const archiveProgressLoadFailed = ref(false);
// archiveProgressRefreshing 防止自动刷新请求重叠。
const archiveProgressRefreshing = ref(false);
// archiveProgressOpen 标记详情抽屉是否仍然可见。
const archiveProgressOpen = ref(false);
// archiveProgressFullscreen 控制归档详情抽屉是否占满当前视口。
const archiveProgressFullscreen = ref(false);
// archiveProgressFullscreenLabel 返回当前全屏切换按钮的国际化文案。
const archiveProgressFullscreenLabel = computed(() =>
  rt(
    archiveProgressFullscreen.value
      ? 'detailExitFullscreen'
      : 'detailFullscreen',
  ),
);
// archiveProgressRequestSeq 隔离切换任务或账号前发起的旧请求结果。
const archiveProgressRequestSeq = ref(0);
// archiveProgressTimer 保存当前详情抽屉的自动刷新定时器。
const archiveProgressTimer = ref<null | number>(null);

// Drawer 承载归档任务当前水位和最近区间详情。
const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    archiveProgressOpen.value = isOpen;
    if (!isOpen) {
      archiveProgressFullscreen.value = false;
      stopArchiveProgressAutoRefresh();
      archiveProgressRequestSeq.value += 1;
      archiveProgressLoading.value = false;
      archiveProgressRefreshing.value = false;
      return;
    }
    const data = drawerApi.getData<ArchiveProgressDrawerData>() || {};
    archiveProgressJob.value = data.job || null;
    activePeriodicTasks.value = data.activeTasks || [];
    archiveProgress.value = null;
    archiveProgressLoadFailed.value = false;
    await loadArchiveProgress();
  },
  showConfirmButton: false,
});

// unregisterArchiveProgressSessionCleanup 在账号切换时清理旧会话的归档详情和轮询。
const unregisterArchiveProgressSessionCleanup = registerSessionStateCleanup(
  resetArchiveProgressState,
);

// archiveProgressAlert 描述草稿和当前运行态的匹配关系。
const archiveProgressAlert = computed(() => {
  const progress = archiveProgress.value;
  if (archiveProgressLoadFailed.value) {
    return {
      description: rt('archiveProgressLoadFailedDesc'),
      message: rt('archiveProgressLoadFailed'),
      type: 'error' as const,
    };
  }
  if (!progress) {
    return {
      description: rt('archiveProgressLoadingDesc'),
      message: rt('archiveProgressLoading'),
      type: 'info' as const,
    };
  }
  if (!progress.runtimeMatched) {
    return {
      description: rt('archiveProgressDraftOnlyDesc'),
      message: rt('archiveProgressDraftOnly'),
      type: 'warning' as const,
    };
  }
  if (!progress.runtimeEnabled) {
    return {
      description: rt('archiveProgressDisabledDesc'),
      message: rt('archiveProgressDisabled'),
      type: 'warning' as const,
    };
  }
  if (!progress.schemaReady) {
    return {
      description: rt('archiveProgressSchemaPendingDesc'),
      message: rt('archiveProgressSchemaPending'),
      type: 'info' as const,
    };
  }
  if (progress.phase === 'lease_expired') {
    return {
      description: rt('archiveProgressLeaseExpiredDesc'),
      message: rt('archiveProgressLeaseExpired'),
      type: 'warning' as const,
    };
  }
  return {
    description: rt('archiveProgressRuntimeDesc'),
    message: rt('archiveProgressRuntime'),
    type: 'success' as const,
  };
});

// archiveCurrentSegmentStatus 在租约过期时覆盖底层 running/deleting 状态，避免误报仍在执行。
const archiveCurrentSegmentStatus = computed(() => {
  const progress = archiveProgress.value;
  if (!progress?.currentSegment) {
    return '';
  }
  return progress.phase === 'lease_expired'
    ? progress.phase
    : progress.currentSegment.status;
});

// archiveProgressCountItems 把固定状态计数整理成紧凑展示项。
const archiveProgressCountItems = computed(() => {
  const counts = archiveProgress.value?.counts;
  return [
    { key: 'pending', value: counts?.pending || 0 },
    { key: 'running', value: counts?.running || 0 },
    { key: 'done', value: counts?.done || 0 },
    { key: 'deleting', value: counts?.deleting || 0 },
    { key: 'deleted', value: counts?.deleted || 0 },
    { key: 'failed', value: counts?.failed || 0 },
  ];
});

// canOpenTaskList 控制关联周期任务的任务列表入口。
const canOpenTaskList = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    OPS_ROUTE_PERMISSION_CODES.TASK_ITEM,
  ]),
);
// canOpenWorkflowStatus 控制当前归档工作流状态入口。
const canOpenWorkflowStatus = computed(
  () =>
    hasAnyPermission(accessStore.accessCodes, [
      OPS_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]) &&
    hasAnyPermission(accessStore.accessCodes, [
      OPS_ACTION_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]),
);

// relatedArchivePeriodicTasks 返回当前 active release 中会触发该归档任务的周期配置。
const relatedArchivePeriodicTasks = computed(() => {
  const job = archiveProgressJob.value;
  if (!job) {
    return [];
  }
  const targetNames = new Set(
    [job.name, job.tableName]
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  );
  return activePeriodicTasks.value.filter((task) => {
    if (String(task.workflow || '').trim() !== 'archive.run') {
      return false;
    }
    const targets = (task.targets || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (targets.length === 0) {
      return true;
    }
    return targets.some((item) => targetNames.has(item.split('#')[0] || ''));
  });
});

// archiveCurrentWorkflowId 从当前 worker 标识中提取归档工作流实例 ID。
const archiveCurrentWorkflowId = computed(() => {
  const workerId = String(
    archiveProgress.value?.currentSegment?.workerId || '',
  ).trim();
  const marker = ':archive.execute:';
  const markerIndex = workerId.indexOf(marker);
  return markerIndex > 0 ? workerId.slice(0, markerIndex) : '';
});

// archiveProgressColumns 定义最近归档区间的只读详情列。
const archiveProgressColumns = computed(() => [
  { title: rt('archiveRange'), key: 'range', width: 300 },
  { title: rt('status'), dataIndex: 'status', key: 'status', width: 110 },
  {
    title: rt('archiveCheckpoint'),
    dataIndex: 'lastArchivedTime',
    key: 'checkpoint',
    width: 180,
  },
  {
    title: rt('archiveRows'),
    dataIndex: 'rowsArchived',
    key: 'rowsArchived',
    width: 120,
  },
  {
    title: rt('archiveAttempts'),
    dataIndex: 'attemptCount',
    key: 'attemptCount',
    width: 90,
  },
  {
    title: rt('updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 180,
  },
]);

// archiveSegmentScroll 仅在有区间记录时启用横向滚动，避免空表撑大抽屉。
const archiveSegmentScroll = computed(() =>
  (archiveProgress.value?.recentSegments?.length || 0) > 0
    ? { x: 980 }
    : undefined,
);

// loadArchiveProgress 查询当前任务详情，并拒绝旧账号或旧任务的异步结果。
async function loadArchiveProgress(silent = false) {
  const jobId = Number(archiveProgressJob.value?.id || 0);
  if (!jobId || archiveProgressRefreshing.value) {
    return;
  }
  const sourceSessionIdentity = currentSessionStateIdentity();
  const requestSeq = archiveProgressRequestSeq.value + 1;
  archiveProgressRequestSeq.value = requestSeq;
  archiveProgressRefreshing.value = true;
  if (!silent) {
    archiveProgressLoading.value = true;
    archiveProgressLoadFailed.value = false;
  }
  try {
    const result = await fetchRuntimeArchiveProgress(jobId);
    if (
      requestSeq !== archiveProgressRequestSeq.value ||
      sourceSessionIdentity !== currentSessionStateIdentity() ||
      Number(archiveProgressJob.value?.id || 0) !== jobId
    ) {
      return;
    }
    archiveProgress.value = result;
    archiveProgressLoadFailed.value = false;
    startArchiveProgressAutoRefresh();
  } catch {
    if (
      requestSeq === archiveProgressRequestSeq.value &&
      sourceSessionIdentity === currentSessionStateIdentity()
    ) {
      archiveProgressLoadFailed.value = true;
      stopArchiveProgressAutoRefresh();
    }
  } finally {
    if (requestSeq === archiveProgressRequestSeq.value) {
      archiveProgressLoading.value = false;
      archiveProgressRefreshing.value = false;
    }
  }
}

// startArchiveProgressAutoRefresh 启动详情抽屉五秒轮询。
function startArchiveProgressAutoRefresh() {
  if (archiveProgressTimer.value !== null || !archiveProgressOpen.value) {
    return;
  }
  archiveProgressTimer.value = window.setInterval(() => {
    void loadArchiveProgress(true);
  }, ARCHIVE_PROGRESS_REFRESH_INTERVAL_MS);
}

// stopArchiveProgressAutoRefresh 停止详情抽屉轮询。
function stopArchiveProgressAutoRefresh() {
  if (archiveProgressTimer.value === null) {
    return;
  }
  window.clearInterval(archiveProgressTimer.value);
  archiveProgressTimer.value = null;
}

// resetArchiveProgressState 清理旧账号或已关闭页面遗留的归档运行态。
function resetArchiveProgressState() {
  archiveProgressRequestSeq.value += 1;
  archiveProgressOpen.value = false;
  archiveProgressFullscreen.value = false;
  archiveProgressLoading.value = false;
  archiveProgressRefreshing.value = false;
  archiveProgressLoadFailed.value = false;
  archiveProgress.value = null;
  archiveProgressJob.value = null;
  activePeriodicTasks.value = [];
  stopArchiveProgressAutoRefresh();
  drawerApi.close();
}

// toggleArchiveProgressFullscreen 切换归档详情的默认宽度和全屏宽度。
function toggleArchiveProgressFullscreen() {
  archiveProgressFullscreen.value = !archiveProgressFullscreen.value;
}

// archiveProgressText 返回阶段或区间状态的国际化文案。
function archiveProgressText(status?: string) {
  return rt(
    archiveProgressLabelKeys[String(status || '')] || 'archivePhaseUnknown',
  );
}

// archiveProgressColor 返回阶段或区间状态的语义颜色。
function archiveProgressColor(status?: string) {
  switch (status) {
    case 'caught_up':
    case 'deleted':
    case 'done': {
      return 'success';
    }
    case 'deleting':
    case 'pending':
    case 'running':
    case 'waiting_delete': {
      return 'processing';
    }
    case 'failed': {
      return 'error';
    }
    case 'inactive':
    case 'lease_expired': {
      return 'warning';
    }
    default: {
      return 'default';
    }
  }
}

// formatArchiveLag 把滞后秒数转换为运维页面通用短时长。
function formatArchiveLag(seconds?: null | number) {
  if (seconds === undefined || seconds === null) {
    return '-';
  }
  if (seconds <= 0) {
    return '0s';
  }
  return formatDurationMs(seconds * 1000);
}

// archiveCheckpointText 优先展示真实时间游标；空区间完成后以区间终点表示有效完成水位。
function archiveCheckpointText(
  segment: Partial<RuntimeConfigApi.ArchiveSegmentItem>,
) {
  if (segment.lastArchivedTime) {
    return segment.lastArchivedTime;
  }
  return ['deleted', 'deleting', 'done'].includes(String(segment.status || ''))
    ? segment.rangeEnd || '-'
    : '-';
}

// archiveCheckpointUsesRangeEnd 标记当前展示值是否来自已完成区间终点。
function archiveCheckpointUsesRangeEnd(
  segment: Partial<RuntimeConfigApi.ArchiveSegmentItem>,
) {
  return (
    !segment.lastArchivedTime &&
    ['deleted', 'deleting', 'done'].includes(String(segment.status || '')) &&
    Boolean(segment.rangeEnd)
  );
}

// openPeriodicTaskList 跳转任务列表并按归档周期任务定位执行记录。
async function openPeriodicTaskList(task: RuntimeConfigApi.PeriodicTaskItem) {
  if (!canOpenTaskList.value) {
    return;
  }
  const query: Record<string, string> = {
    source: rt('archiveProgressTaskSource'),
    taskName: task.name,
  };
  const queue = String(task.queue || '').trim();
  if (queue) {
    query.queue = queue;
  }
  drawerApi.close();
  await router.push({ name: 'OpsTaskItem', query });
}

// openArchiveWorkflowStatus 跳转当前运行中归档工作流状态页。
async function openArchiveWorkflowStatus() {
  if (!archiveCurrentWorkflowId.value || !canOpenWorkflowStatus.value) {
    return;
  }
  drawerApi.close();
  await router.push({
    name: 'OpsWorkflowStatus',
    query: {
      source: rt('archiveProgressTaskSource'),
      workflowId: archiveCurrentWorkflowId.value,
    },
  });
}

onBeforeUnmount(() => {
  unregisterArchiveProgressSessionCleanup();
  resetArchiveProgressState();
});
</script>

<template>
  <Drawer
    class="max-w-none! max-md:w-full!"
    :class="
      archiveProgressFullscreen
        ? 'w-screen!'
        : 'w-[min(1280px,calc(100vw-280px))]!'
    "
    :title="`${rt('archiveProgressTitle')} · ${archiveProgressJob?.name || '-'}`"
  >
    <template #extra>
      <Button
        size="small"
        type="text"
        :aria-label="archiveProgressFullscreenLabel"
        :title="archiveProgressFullscreenLabel"
        @click.stop="toggleArchiveProgressFullscreen"
      >
        <template #icon>
          <FullscreenExitOutlined v-if="archiveProgressFullscreen" />
          <FullscreenOutlined v-else />
        </template>
        {{ archiveProgressFullscreenLabel }}
      </Button>
    </template>

    <Spin :spinning="archiveProgressLoading">
      <div class="runtime-archive-progress">
        <Alert
          show-icon
          :description="archiveProgressAlert.description"
          :message="archiveProgressAlert.message"
          :type="archiveProgressAlert.type"
        />

        <Card size="small" :title="rt('archiveRelatedPeriodicTasks')">
          <Space v-if="relatedArchivePeriodicTasks.length > 0" wrap>
            <Tag
              v-for="task in relatedArchivePeriodicTasks"
              :key="task.name"
              :color="task.enabled ? 'processing' : 'default'"
            >
              {{ task.name }} ·
              {{ task.enabled ? rt('enabled') : rt('disabled') }}
            </Tag>
            <Button
              v-for="task in relatedArchivePeriodicTasks"
              :key="`open-${task.name}`"
              v-show="canOpenTaskList"
              size="small"
              @click="openPeriodicTaskList(task)"
            >
              <template #icon><LinkOutlined /></template>
              {{ rt('openTaskList') }} · {{ task.name }}
            </Button>
          </Space>
          <Alert
            v-else
            show-icon
            type="info"
            :message="rt('archiveRelatedPeriodicEmpty')"
            :description="rt('archiveRelatedPeriodicEmptyDesc')"
          />
        </Card>

        <div
          v-if="archiveProgressLoadFailed && !archiveProgress"
          class="runtime-archive-progress__footer"
        >
          <span>{{ rt('archiveProgressRetryDesc') }}</span>
          <Button
            :loading="archiveProgressRefreshing"
            size="small"
            @click="loadArchiveProgress()"
          >
            <template #icon><ReloadOutlined /></template>
            {{ rt('archiveProgressRetry') }}
          </Button>
        </div>

        <template v-if="archiveProgress">
          <div class="runtime-archive-progress__summary">
            <Card size="small">
              <div class="runtime-archive-progress__label">
                {{ rt('archiveCurrentPhase') }}
              </div>
              <div class="runtime-archive-progress__value">
                <Tag :color="archiveProgressColor(archiveProgress.phase)">
                  {{ archiveProgressText(archiveProgress.phase) }}
                </Tag>
              </div>
              <div class="runtime-archive-progress__desc">
                {{ rt('archiveFetchedAt') }}
                {{ archiveProgress.fetchedAt || '-' }}
              </div>
            </Card>
            <Card size="small">
              <div class="runtime-archive-progress__label">
                {{ rt('archiveWatermark') }}
              </div>
              <div class="runtime-archive-progress__value">
                {{ archiveProgress.watermarkTime || '-' }}
              </div>
              <div class="runtime-archive-progress__desc">
                {{ rt('archiveWatermarkUpdatedAt') }}
                {{ archiveProgress.watermarkUpdatedAt || '-' }}
              </div>
            </Card>
            <Card size="small">
              <div class="runtime-archive-progress__label">
                {{ rt('archiveEligibleUntil') }}
              </div>
              <div class="runtime-archive-progress__value">
                {{ archiveProgress.eligibleUntil || '-' }}
              </div>
              <div class="runtime-archive-progress__desc">
                {{ rt('archivePlannedUntil') }}
                {{ archiveProgress.plannedUntil || '-' }}
              </div>
            </Card>
            <Card size="small">
              <div class="runtime-archive-progress__label">
                {{ rt('archiveLag') }}
              </div>
              <div class="runtime-archive-progress__value">
                {{ formatArchiveLag(archiveProgress.lagSeconds) }}
              </div>
              <div class="runtime-archive-progress__desc">
                {{ rt('archiveLagHelp') }}
              </div>
            </Card>
          </div>

          <Card size="small" :title="rt('archiveSegmentCounts')">
            <Space wrap>
              <Tag
                v-for="item in archiveProgressCountItems"
                :key="item.key"
                :color="archiveProgressColor(item.key)"
              >
                {{ archiveProgressText(item.key) }}
                {{ formatTraceCount(item.value) }}
              </Tag>
              <Tag>
                {{ rt('archiveSegmentsTotal') }}
                {{ formatTraceCount(archiveProgress.counts.total) }}
              </Tag>
            </Space>
          </Card>

          <Card
            v-if="archiveProgress.currentSegment"
            size="small"
            :title="rt('archiveCurrentSegment')"
          >
            <Descriptions bordered :column="2" size="small">
              <Descriptions.Item :label="rt('status')">
                <Tag :color="archiveProgressColor(archiveCurrentSegmentStatus)">
                  {{ archiveProgressText(archiveCurrentSegmentStatus) }}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveRange')">
                {{ archiveProgress.currentSegment.rangeStart }} →
                {{ archiveProgress.currentSegment.rangeEnd }}
              </Descriptions.Item>
              <Descriptions.Item :label="rt('historyTableName')">
                {{ archiveProgress.currentSegment.historyTableName || '-' }}
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveCheckpoint')">
                {{ archiveCheckpointText(archiveProgress.currentSegment) }}
                <Tag
                  v-if="
                    archiveCheckpointUsesRangeEnd(
                      archiveProgress.currentSegment,
                    )
                  "
                  color="blue"
                >
                  {{ rt('archiveRangeEndCheckpoint') }}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveRows')">
                {{
                  formatTraceCount(archiveProgress.currentSegment.rowsArchived)
                }}
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveAttempts')">
                {{ archiveProgress.currentSegment.attemptCount }}
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveWorker')">
                {{ archiveProgress.currentSegment.workerId || '-' }}
              </Descriptions.Item>
              <Descriptions.Item :label="rt('archiveLeaseExpiresAt')">
                {{ archiveProgress.currentSegment.leaseExpiresAt || '-' }}
              </Descriptions.Item>
              <Descriptions.Item
                v-if="archiveCurrentWorkflowId"
                :span="2"
                :label="rt('workflowId')"
              >
                <Space wrap>
                  <span>{{ archiveCurrentWorkflowId }}</span>
                  <Button
                    v-if="canOpenWorkflowStatus"
                    size="small"
                    type="link"
                    @click="openArchiveWorkflowStatus"
                  >
                    {{ rt('workflowStatus') }}
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <div
              v-if="
                archiveProgress.currentSegment.estimatedProgressPercent !== null
              "
              class="runtime-archive-progress__estimate"
            >
              <div class="runtime-archive-progress__estimate-head">
                <span>{{ rt('archiveSegmentEstimate') }}</span>
                <span>{{ rt('archiveSegmentEstimateHelp') }}</span>
              </div>
              <AProgress
                :percent="
                  archiveProgress.currentSegment.estimatedProgressPercent
                "
                status="active"
              />
            </div>
            <Alert
              v-else-if="archiveProgress.currentSegment.status === 'deleting'"
              class="runtime-archive-progress__delete-hint"
              show-icon
              type="info"
              :message="rt('archiveDeleteProgressUnavailable')"
              :description="rt('archiveDeleteProgressUnavailableDesc')"
            />
          </Card>

          <Card size="small" :title="rt('archiveRecentSegments')">
            <Table
              class="runtime-detail-table"
              :columns="archiveProgressColumns"
              :data-source="archiveProgress.recentSegments"
              :pagination="false"
              row-key="id"
              :scroll="archiveSegmentScroll"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'range'">
                  <div>{{ record.rangeStart }}</div>
                  <div class="runtime-archive-progress__range-end">
                    → {{ record.rangeEnd }}
                  </div>
                </template>
                <template v-else-if="column.key === 'status'">
                  <Tag :color="archiveProgressColor(record.status)">
                    {{ archiveProgressText(record.status) }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'checkpoint'">
                  <div>{{ archiveCheckpointText(record) }}</div>
                  <div
                    v-if="archiveCheckpointUsesRangeEnd(record)"
                    class="runtime-archive-progress__checkpoint-note"
                  >
                    {{ rt('archiveRangeEndCheckpoint') }}
                  </div>
                </template>
                <template v-else-if="column.key === 'rowsArchived'">
                  {{ formatTraceCount(record.rowsArchived) }}
                </template>
              </template>
            </Table>
          </Card>

          <div class="runtime-archive-progress__footer">
            <span>{{ rt('archiveProgressAutoRefresh') }}</span>
            <Button
              :loading="archiveProgressRefreshing"
              size="small"
              @click="loadArchiveProgress()"
            >
              <template #icon><ReloadOutlined /></template>
              {{ rt('refresh') }}
            </Button>
          </div>
        </template>
      </div>
    </Spin>
  </Drawer>
</template>

<style scoped>
.runtime-archive-progress {
  display: grid;
  gap: 12px;
  min-width: 0;
  min-height: 220px;
}

.runtime-archive-progress :deep(.ant-card) {
  min-width: 0;
}

.runtime-detail-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.runtime-detail-table :deep(.ant-table) {
  color: hsl(var(--foreground));
  background: transparent;
}

.runtime-detail-table :deep(.ant-table-container) {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.runtime-detail-table :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-bottom-color: hsl(var(--border));
}

.runtime-detail-table :deep(.ant-table-thead > tr > th::before) {
  background-color: hsl(var(--heavy));
}

.runtime-detail-table :deep(.ant-table-tbody > tr > td) {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border-bottom-color: hsl(var(--border));
}

.runtime-detail-table :deep(.ant-table-tbody > tr:hover > td) {
  background: hsl(var(--accent-hover));
}

.runtime-archive-progress__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.runtime-archive-progress__label,
.runtime-archive-progress__desc,
.runtime-archive-progress__checkpoint-note,
.runtime-archive-progress__range-end,
.runtime-archive-progress__estimate-head {
  font-size: 12px;
  color: var(--vben-text-color-secondary);
}

.runtime-archive-progress__value {
  min-height: 28px;
  margin: 6px 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.runtime-archive-progress__estimate {
  margin-top: 12px;
}

.runtime-archive-progress__estimate-head,
.runtime-archive-progress__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.runtime-archive-progress__delete-hint {
  margin-top: 12px;
}

.runtime-archive-progress__range-end {
  margin-top: 2px;
}

.runtime-archive-progress__footer {
  flex-wrap: wrap;
}

@media (max-width: 1200px) {
  .runtime-archive-progress__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .runtime-archive-progress__summary {
    grid-template-columns: 1fr;
  }
}
</style>
