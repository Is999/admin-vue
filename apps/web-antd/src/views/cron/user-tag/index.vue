<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { TaskApi } from '#/api/cron/task';
import type { UserTagApi } from '#/api/cron/user-tag';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, VbenButton } from '@vben/common-ui';

import { Button, message, Modal, Space } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { fetchTaskQueues } from '#/api/cron/task';
import {
  recalculateUserTagByTypes,
  releaseUserTagWorkflowLease,
  triggerUserTagWorkflow,
} from '#/api/cron/user-tag';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';

import {
  getTaskQueueDescription,
  normalizeOptionalNumber,
  safePrettyJson,
  splitTextToNumberItems,
  TASK_QUEUE_OPTIONS,
} from '../shared';
import {
  useUserTagLeaseReleaseSchema,
  useUserTagRecalculateSchema,
  useUserTagWorkflowSchema,
} from './data';

type UserTagModeValue = 'delta' | 'full' | 'recalculate' | 'targeted';

// USER_TAG_LEASE_RELEASE_MFA_SCENARIO 与后端 MFAScenarioUserTagLeaseRelease 保持一致。
const USER_TAG_LEASE_RELEASE_MFA_SCENARIO = 10;

const USER_TAG_MODE_META: Record<
  UserTagModeValue,
  { description: string; hint: string; tone: 'info' | 'success' | 'warning' }
> = {
  delta: {
    description: $t('business.message.userTagModeDeltaDesc'),
    hint: $t('business.message.userTagModeDeltaHint'),
    tone: 'info',
  },
  full: {
    description: $t('business.message.userTagModeFullDesc'),
    hint: $t('business.message.userTagModeFullHint'),
    tone: 'success',
  },
  recalculate: {
    description: $t('business.message.userTagModeRecalculateDesc'),
    hint: $t('business.message.userTagModeRecalculateHint'),
    tone: 'warning',
  },
  targeted: {
    description: $t('business.message.userTagModeTargetedDesc'),
    hint: $t('business.message.userTagModeTargetedHint'),
    tone: 'info',
  },
};

// ================= 表单配置 =================
// 用户标签工作流触发表单。
const router = useRouter();
const queueOptions = ref<Array<{ label: string; value: string }>>(
  TASK_QUEUE_OPTIONS.map((item) => ({ label: item.label, value: item.value })),
);
const selectedMode = ref<UserTagModeValue>('full');
const [WorkflowForm, workflowFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  schema: useUserTagWorkflowSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-4',
});

// 指定标签重算表单。
const [RecalculateForm, recalculateFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  schema: useUserTagRecalculateSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-4',
});

// 释放工作流互斥锁表单。
const [LeaseReleaseForm, leaseReleaseFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  schema: useUserTagLeaseReleaseSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-4',
});

// ================= 页面状态 =================
// submitting 用于统一控制提交按钮状态。
const submitting = ref(false);
// workflowResultText 用于展示工作流触发结果。
const workflowResultText = ref('');
// recalculateResultText 用于展示指定标签重算结果。
const recalculateResultText = ref('');
// leaseReleaseResultText 用于展示互斥锁释放结果。
const leaseReleaseResultText = ref('');
// latestWorkflowTrigger 保存最近一次用户标签工作流回执。
const latestWorkflowTrigger = ref<null | TaskApi.WorkflowTriggerResp>(null);
// latestWorkflowMode 保存最近一次触发时的运行模式，避免释放锁回填时使用后来切换的表单模式。
const latestWorkflowMode = ref<null | UserTagModeValue>(null);
// latestRecalculateResult 保存最近一次指定标签重算回执。
const latestRecalculateResult = ref<null | UserTagApi.RecalculateResp>(null);
// latestLeaseReleaseResult 保存最近一次互斥锁释放回执。
const latestLeaseReleaseResult =
  ref<null | UserTagApi.ReleaseWorkflowLeaseResp>(null);
// showUserTagReference 控制运行模式与操作建议参考区展开。
const showUserTagReference = ref(false);
// showWorkflowRaw 控制工作流原始回执展开。
const showWorkflowRaw = ref(false);
// showRecalculateRaw 控制重算原始回执展开。
const showRecalculateRaw = ref(false);
// showLeaseReleaseRaw 控制互斥锁释放原始回执展开。
const showLeaseReleaseRaw = ref(false);

const currentModeMeta = computed(
  () => USER_TAG_MODE_META[selectedMode.value] || USER_TAG_MODE_META.full,
);

const userTagOverviewCards = computed(() => [
  {
    description: $t('business.message.visibleQueuesDesc'),
    label: $t('business.message.visibleQueues'),
    value: String(queueOptions.value.length),
  },
  {
    description: $t('business.message.userTagModeCountDesc'),
    label: $t('business.message.runMode'),
    value: String(Object.keys(USER_TAG_MODE_META).length),
  },
  {
    description: latestWorkflowTrigger.value
      ? $t('business.message.latestWorkflowName', [
          latestWorkflowTrigger.value.workflowName,
        ])
      : $t('business.message.noUserTagWorkflowTriggered'),
    label: $t('business.message.latestWorkflow'),
    value:
      latestWorkflowTrigger.value?.workflowId ||
      $t('business.message.waitTrigger'),
  },
  {
    description: latestRecalculateResult.value
      ? $t('business.message.latestRecalculateQueue', [
          latestRecalculateResult.value.queue,
        ])
      : $t('business.message.noTagRecalculation'),
    label: $t('business.message.latestRecalculate'),
    value:
      latestRecalculateResult.value?.taskId ||
      $t('business.message.waitTrigger'),
  },
  {
    description: latestLeaseReleaseResult.value
      ? $t('business.message.releaseOwnerSummary', [
          latestLeaseReleaseResult.value.owner,
        ])
      : $t('business.message.latestLeaseReleaseEmptyDesc'),
    label: $t('business.message.latestLeaseReleaseLabel'),
    value:
      latestLeaseReleaseResult.value?.workflowId ||
      $t('business.message.latestLeaseReleasePending'),
  },
]);

type FieldGuideRow = {
  description: string;
  label: string;
};

// queueHintText 用于在参考区展示队列用途说明，降低误选队列风险。
const queueHintText = computed(() =>
  queueOptions.value
    .map((item) => `${item.value}: ${getTaskQueueDescription(item.value)}`)
    .join('\n'),
);

// userTagWorkflowFieldGuides 定义“用户标签工作流”常用字段解释与填写建议。
const userTagWorkflowFieldGuides: FieldGuideRow[] = [
  {
    label: $t('business.message.userTagGuideModeLabel'),
    description: $t('business.message.userTagGuideModeDesc'),
  },
  {
    label: $t('business.message.userTagGuideTagTypesLabel'),
    description: $t('business.message.userTagGuideTagTypesDesc'),
  },
  {
    label: $t('business.message.userTagGuideUidsLabel'),
    description: $t('business.message.userTagGuideUidsDesc'),
  },
  {
    label: $t('business.message.userTagGuideScaleLabel'),
    description: $t('business.message.userTagGuideScaleDesc'),
  },
  {
    label: $t('business.message.userTagGuideDryRunLabel'),
    description: $t('business.message.userTagGuideDryRunDesc'),
  },
  {
    label: $t('business.message.userTagGuideSyncSnapshotLabel'),
    description: $t('business.message.userTagGuideSyncSnapshotDesc'),
  },
  {
    label: $t('business.message.guideUniqueLabel'),
    description: $t('business.message.userTagGuideUniqueDesc'),
  },
  {
    label: $t('business.message.userTagGuideTimeoutLabel'),
    description: $t('business.message.userTagGuideTimeoutDesc'),
  },
];

// userTagRecalculateFieldGuides 定义“指定标签重算”常用字段解释与填写建议。
const userTagRecalculateFieldGuides: FieldGuideRow[] = [
  {
    label: $t('business.message.userTagGuideTagTypesLabel'),
    description: $t('business.message.userTagRecalculateTagTypesDesc'),
  },
  {
    label: $t('business.message.userTagRecalculateQueueScaleLabel'),
    description: $t('business.message.userTagRecalculateQueueScaleDesc'),
  },
  {
    label: $t('business.message.userTagGuideDryRunLabel'),
    description: $t('business.message.userTagRecalculateDryRunDesc'),
  },
  {
    label: $t('business.message.userTagRecalculateUniqueTimeoutLabel'),
    description: $t('business.message.userTagRecalculateUniqueTimeoutDesc'),
  },
];

function rebuildUserTagSchemas() {
  workflowFormApi.updateSchema(
    useUserTagWorkflowSchema(queueOptions.value, (value?: string) => {
      selectedMode.value = (String(value || 'full').trim() ||
        'full') as UserTagModeValue;
    }),
  );
  recalculateFormApi.updateSchema(
    useUserTagRecalculateSchema(queueOptions.value),
  );
}

async function loadQueueOptions() {
  try {
    const responseData = await fetchTaskQueues();
    const options = (responseData.queues || [])
      .map((item: TaskApi.TaskQueueItem) => String(item.name || '').trim())
      .filter(Boolean)
      .map((item: string) => ({
        label: item,
        value: item,
      }));
    if (options.length > 0) {
      queueOptions.value = options;
      rebuildUserTagSchemas();
    }
  } catch {
    // 读取失败时保留兜底队列选项，避免页面不可用。
  }
}

async function fillWorkflowTagTypesExample() {
  await workflowFormApi.setFieldValue('tagTypesText', '1,2,3', false);
  message.success($t('business.message.tagTypeExampleFilled'));
}

async function fillWorkflowTargetedUIDsExample() {
  await workflowFormApi.setFieldValue('uidsText', '10001,10002', false);
  message.success($t('business.message.targetUidExampleFilled'));
}

async function fillWorkflowDefaultQueue() {
  await workflowFormApi.setFieldValue('queue', 'maintenance', false);
  message.success($t('business.message.maintenanceQueueFilled'));
}

async function fillRecalculateTagTypesExample() {
  await recalculateFormApi.setFieldValue('tagTypesText', '1,2,3', false);
  message.success($t('business.message.recalculateTagTypeExampleFilled'));
}

async function fillRecalculateDefaultQueue() {
  await recalculateFormApi.setFieldValue('queue', 'maintenance', false);
  message.success($t('business.message.maintenanceQueueFilled'));
}

async function fillLatestWorkflowForLeaseRelease() {
  const currentWorkflow = latestWorkflowTrigger.value;
  if (!currentWorkflow) {
    message.warning($t('business.message.taskWorkflowIdMissing'));
    return;
  }
  await leaseReleaseFormApi.setFieldValue(
    'workflowId',
    currentWorkflow.workflowId,
    false,
  );
  await leaseReleaseFormApi.setFieldValue(
    'mode',
    latestWorkflowMode.value || selectedMode.value,
    false,
  );
  message.success($t('business.message.latestWorkflowIdFilled'));
}

async function handleOpenWorkflowTask() {
  const currentWorkflow = latestWorkflowTrigger.value;
  if (!currentWorkflow) {
    return;
  }
  await router.push({
    name: 'CronTaskItem',
    query: {
      queue: currentWorkflow.queue,
      source: $t('business.message.userTagWorkflowSource', [
        currentWorkflow.workflowName,
      ]),
      taskId: currentWorkflow.taskId,
    },
  });
}

async function handleOpenWorkflowStatus() {
  const currentWorkflow = latestWorkflowTrigger.value;
  if (!currentWorkflow) {
    return;
  }
  await router.push({
    name: 'CronTaskWorkflowStatus',
    query: {
      source: $t('business.message.userTagWorkflowSource', [
        currentWorkflow.workflowName,
      ]),
      workflowId: currentWorkflow.workflowId,
    },
  });
}

async function handleOpenRecalculateTask() {
  const currentTask = latestRecalculateResult.value;
  if (!currentTask) {
    return;
  }
  await router.push({
    name: 'CronTaskItem',
    query: {
      queue: currentTask.queue,
      source: $t('business.message.userTagRecalculateSource', [
        currentTask.workflowName,
      ]),
      taskId: currentTask.taskId,
    },
  });
}

async function handleOpenRecalculateWorkflow() {
  const currentTask = latestRecalculateResult.value;
  if (!currentTask) {
    return;
  }
  await router.push({
    name: 'CronTaskWorkflowStatus',
    query: {
      source: $t('business.message.userTagRecalculateSource', [
        currentTask.workflowName,
      ]),
      workflowId: currentTask.workflowId,
    },
  });
}

// ================= 业务方法 =================
// handleTriggerUserTagWorkflow 提交用户标签工作流触发表单。
async function handleTriggerUserTagWorkflow() {
  const { valid } = await workflowFormApi.validate();
  if (!valid) {
    return;
  }
  submitting.value = true;
  try {
    const values = await workflowFormApi.getValues<Record<string, any>>();
    const requestPayload: UserTagApi.TriggerWorkflowReq = {
      mode: values.mode,
      tagTypes: splitTextToNumberItems(values.tagTypesText || ''),
      uids: splitTextToNumberItems(values.uidsText || ''),
      queue: values.queue || undefined,
      shardTotal: normalizeOptionalNumber(values.shardTotal),
      batchSize: normalizeOptionalNumber(values.batchSize),
      workerCount: normalizeOptionalNumber(values.workerCount),
      dryRun: !!values.dryRun,
      syncSnapshotOnly: !!values.syncSnapshotOnly,
      uniqueKey: values.uniqueKey || undefined,
      uniqueTTLSeconds: normalizeOptionalNumber(values.uniqueTTLSeconds),
      timeoutSeconds: normalizeOptionalNumber(values.timeoutSeconds),
    };
    const responseData = await triggerUserTagWorkflow(requestPayload);
    latestWorkflowTrigger.value = responseData;
    latestWorkflowMode.value = (requestPayload.mode ||
      'full') as UserTagModeValue;
    workflowResultText.value = safePrettyJson(responseData);
    message.success($t('business.message.userTagWorkflowTriggered'));
  } catch (error) {
    latestWorkflowTrigger.value = null;
    latestWorkflowMode.value = null;
    workflowResultText.value = $t('business.message.triggerFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

// handleRecalculateUserTag 提交指定标签重算表单。
async function handleRecalculateUserTag() {
  const { valid } = await recalculateFormApi.validate();
  if (!valid) {
    return;
  }
  submitting.value = true;
  try {
    const values = await recalculateFormApi.getValues<Record<string, any>>();
    const requestPayload: UserTagApi.RecalculateReq = {
      tag_types: splitTextToNumberItems(values.tagTypesText || ''),
      queue: values.queue || undefined,
      shard_total: normalizeOptionalNumber(values.shardTotal),
      batch_size: normalizeOptionalNumber(values.batchSize),
      worker_count: normalizeOptionalNumber(values.workerCount),
      dry_run: !!values.dryRun,
      unique_ttl_seconds: normalizeOptionalNumber(values.uniqueTTLSeconds),
      timeout_seconds: normalizeOptionalNumber(values.timeoutSeconds),
    };
    const responseData = await recalculateUserTagByTypes(requestPayload);
    latestRecalculateResult.value = responseData;
    recalculateResultText.value = safePrettyJson(responseData);
    message.success($t('business.message.tagRecalculationTriggered'));
  } catch (error) {
    latestRecalculateResult.value = null;
    recalculateResultText.value = $t('business.message.triggerFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

// doReleaseWorkflowLease 执行用户标签工作流互斥锁释放。
async function doReleaseWorkflowLease(
  requestPayload: UserTagApi.ReleaseWorkflowLeaseReq,
) {
  submitting.value = true;
  try {
    const responseData = await submitWithMfaRetry(
      USER_TAG_LEASE_RELEASE_MFA_SCENARIO,
      (ticket) =>
        releaseUserTagWorkflowLease({
          ...requestPayload,
          ...ticketPayload(ticket),
        }),
      $t('business.message.userTagLeaseReleaseMfaTitle'),
      {
        headerDescription: $t(
          'business.message.userTagLeaseReleaseMfaDescription',
        ),
        loadProfileContext: true,
      },
    );
    latestLeaseReleaseResult.value = responseData;
    leaseReleaseResultText.value = safePrettyJson(responseData);
    message.success($t('business.message.userTagLeaseReleased'));
  } catch (error) {
    latestLeaseReleaseResult.value = null;
    leaseReleaseResultText.value = $t(
      'business.message.userTagLeaseReleaseFailed',
      [String(error)],
    );
  } finally {
    submitting.value = false;
  }
}

// handleReleaseWorkflowLease 提交释放用户标签工作流互斥锁表单。
async function handleReleaseWorkflowLease() {
  const { valid } = await leaseReleaseFormApi.validate();
  if (!valid) {
    return;
  }
  const values = await leaseReleaseFormApi.getValues<Record<string, any>>();
  const requestPayload: UserTagApi.ReleaseWorkflowLeaseReq = {
    workflowId: String(values.workflowId || '').trim(),
    mode: (String(values.mode || 'full').trim() || 'full') as UserTagModeValue,
    reason: String(values.reason || '').trim(),
  };
  Modal.confirm({
    centered: true,
    content: $t('business.message.userTagLeaseReleaseConfirmContent'),
    okText: $t('business.message.releaseLeaseConfirmOk'),
    okType: 'danger',
    onOk: () => doReleaseWorkflowLease(requestPayload),
    title: $t('business.message.userTagLeaseReleaseConfirmTitle'),
  });
}

onMounted(() => {
  rebuildUserTagSchemas();
  void loadQueueOptions();
});
</script>

<template>
  <Page :title="$t('business.message.userTagOps')">
    <div class="space-y-4">
      <section
        class="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] px-5 py-4 text-slate-100 shadow-[0_16px_44px_rgba(15,23,42,0.3)]"
      >
        <div
          class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start"
        >
          <div>
            <div
              class="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80"
            >
              User Tag Ops
            </div>
            <div class="mt-2 text-2xl font-semibold tracking-tight text-white">
              {{ $t('business.message.userTagOpsTitle') }}
            </div>
            <div class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {{ $t('business.message.userTagOpsDesc') }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 xl:grid-cols-2">
            <div
              v-for="item in userTagOverviewCards"
              :key="item.label"
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
            >
              <div
                class="truncate text-[11px] uppercase tracking-[0.18em] text-slate-400"
              >
                {{ item.label }}
              </div>
              <div class="mt-1 break-all text-lg font-semibold text-white">
                {{ item.value }}
              </div>
              <div
                class="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-400"
              >
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="space-y-5">
        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.triggerUserTagWorkflow')"
        >
          <div
            class="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div
                class="text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                {{
                  $t('business.message.currentModeSummary', [
                    selectedMode,
                    currentModeMeta.description,
                  ])
                }}
              </div>
              <Button
                size="small"
                type="link"
                @click="showUserTagReference = !showUserTagReference"
              >
                {{
                  showUserTagReference
                    ? $t('business.message.collapseReference')
                    : $t('business.message.expandReference')
                }}
              </Button>
            </div>
            <div
              class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300"
            >
              {{ currentModeMeta.hint }}
            </div>
          </div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Space :size="8" wrap>
              <Button
                size="small"
                type="primary"
                @click="fillWorkflowTagTypesExample"
              >
                {{ $t('business.message.fillTagExample') }}
              </Button>
              <Button size="small" @click="fillWorkflowTargetedUIDsExample">
                {{ $t('business.message.fillUidExample') }}
              </Button>
              <Button size="small" @click="fillWorkflowDefaultQueue">
                {{ $t('business.message.fillSuggestedQueue') }}
              </Button>
            </Space>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.USER_TAG_WORKFLOW_TRIGGER,
                )
              "
              type="primary"
              :disabled="submitting"
              @click="handleTriggerUserTagWorkflow"
            >
              {{
                submitting
                  ? $t('business.message.submitting')
                  : $t('business.message.triggerWorkflow')
              }}
            </VbenButton>
          </div>
          <WorkflowForm />
          <div
            v-if="latestWorkflowTrigger"
            class="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4"
          >
            <div
              class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.latestWorkflowReceipt') }}
            </div>
            <div class="grid gap-3 text-sm md:grid-cols-3">
              <div>
                {{ $t('business.message.workflow') }}:
                {{ latestWorkflowTrigger.workflowName }}
              </div>
              <div>
                {{ $t('business.message.queue') }}:
                {{ latestWorkflowTrigger.queue }}
              </div>
              <div>
                {{ $t('business.message.entryTask') }}:
                {{ latestWorkflowTrigger.taskId }}
              </div>
            </div>
            <Space class="mt-3" :size="8" wrap>
              <Button
                size="small"
                type="primary"
                @click="handleOpenWorkflowTask"
              >
                {{ $t('business.message.viewEntryTask') }}
              </Button>
              <Button size="small" @click="handleOpenWorkflowStatus">
                {{ $t('business.message.viewWorkflowStatus') }}
              </Button>
              <Button size="small" @click="showWorkflowRaw = !showWorkflowRaw">
                {{
                  showWorkflowRaw
                    ? $t('business.message.closeRawReceipt')
                    : $t('business.message.viewRawReceipt')
                }}
              </Button>
            </Space>
          </div>
          <pre
            v-if="showWorkflowRaw && workflowResultText"
            class="mt-4 overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950 px-4 py-4 text-sm text-cyan-100 shadow-inner"
            v-text="workflowResultText"
          ></pre>
        </Card>

        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.userTagRecalculate')"
        >
          <div
            class="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-sm"
          >
            <div class="font-medium text-slate-900 dark:text-slate-100">
              {{ $t('business.message.userTagRecalculateAdvice') }}
            </div>
            <div
              class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300"
            >
              {{ $t('business.message.userTagRecalculateAdviceDesc') }}
            </div>
          </div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Space :size="8" wrap>
              <Button
                size="small"
                type="primary"
                @click="fillRecalculateTagTypesExample"
              >
                {{ $t('business.message.fillTagExample') }}
              </Button>
              <Button size="small" @click="fillRecalculateDefaultQueue">
                {{ $t('business.message.fillSuggestedQueue') }}
              </Button>
            </Space>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.USER_TAG_RECALCULATE,
                )
              "
              type="primary"
              :disabled="submitting"
              @click="handleRecalculateUserTag"
            >
              {{
                submitting
                  ? $t('business.message.submitting')
                  : $t('business.message.triggerRecalculate')
              }}
            </VbenButton>
          </div>
          <RecalculateForm />
          <div
            v-if="latestRecalculateResult"
            class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4"
          >
            <div
              class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.latestRecalculateReceipt') }}
            </div>
            <div class="grid gap-3 text-sm md:grid-cols-4">
              <div>
                {{ $t('business.message.workflow') }}:
                {{ latestRecalculateResult.workflowName }}
              </div>
              <div>
                {{ $t('business.message.queue') }}:
                {{ latestRecalculateResult.queue }}
              </div>
              <div>
                {{ $t('business.message.taskId') }}:
                {{ latestRecalculateResult.taskId }}
              </div>
              <div>
                {{ $t('business.message.tagCount') }}:
                {{ latestRecalculateResult.tag_count }}
              </div>
            </div>
            <Space class="mt-3" :size="8" wrap>
              <Button
                size="small"
                type="primary"
                @click="handleOpenRecalculateTask"
              >
                {{ $t('business.message.viewTask') }}
              </Button>
              <Button size="small" @click="handleOpenRecalculateWorkflow">
                {{ $t('business.message.viewWorkflowStatus') }}
              </Button>
              <Button
                size="small"
                @click="showRecalculateRaw = !showRecalculateRaw"
              >
                {{
                  showRecalculateRaw
                    ? $t('business.message.closeRawReceipt')
                    : $t('business.message.viewRawReceipt')
                }}
              </Button>
            </Space>
          </div>
          <pre
            v-if="showRecalculateRaw && recalculateResultText"
            class="mt-4 overflow-auto rounded-2xl border border-amber-500/20 bg-slate-950 px-4 py-4 text-sm text-amber-100 shadow-inner"
            v-text="recalculateResultText"
          ></pre>
        </Card>

        <Card
          class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          :title="$t('business.message.userTagLeaseReleaseCardTitle')"
        >
          <div
            class="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-sm"
          >
            <div class="font-medium text-slate-900 dark:text-slate-100">
              {{ $t('business.message.userTagLeaseReleaseRiskTitle') }}
            </div>
            <div
              class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300"
            >
              {{ $t('business.message.userTagLeaseReleaseRiskDesc') }}
            </div>
          </div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Space :size="8" wrap>
              <Button size="small" @click="fillLatestWorkflowForLeaseRelease">
                {{ $t('business.message.fillLatestWorkflow') }}
              </Button>
            </Space>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.USER_TAG_WORKFLOW_LEASE_RELEASE,
                )
              "
              danger
              type="primary"
              :disabled="submitting"
              @click="handleReleaseWorkflowLease"
            >
              {{
                submitting
                  ? $t('business.message.submitting')
                  : $t('business.message.releaseWorkflowLease')
              }}
            </VbenButton>
          </div>
          <LeaseReleaseForm />
          <div
            v-if="latestLeaseReleaseResult"
            class="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-4"
          >
            <div
              class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {{ $t('business.message.latestLeaseReleaseReceipt') }}
            </div>
            <div class="grid gap-3 text-sm md:grid-cols-3">
              <div>
                {{ $t('business.message.releaseOwnerLabel') }}:
                {{ latestLeaseReleaseResult.owner }}
              </div>
              <div>
                {{ $t('business.message.ttlSecondsLabel') }}:
                {{ latestLeaseReleaseResult.ttlSeconds }}
              </div>
              <div>
                {{ $t('business.message.releaseTimeLabel') }}:
                {{ latestLeaseReleaseResult.releasedAt }}
              </div>
            </div>
            <Space class="mt-3" :size="8" wrap>
              <Button
                size="small"
                @click="showLeaseReleaseRaw = !showLeaseReleaseRaw"
              >
                {{
                  showLeaseReleaseRaw
                    ? $t('business.message.closeRawReceipt')
                    : $t('business.message.viewRawReceipt')
                }}
              </Button>
            </Space>
          </div>
          <pre
            v-if="showLeaseReleaseRaw && leaseReleaseResultText"
            class="mt-4 overflow-auto rounded-2xl border border-rose-500/20 bg-slate-950 px-4 py-4 text-sm text-rose-100 shadow-inner"
            v-text="leaseReleaseResultText"
          ></pre>
        </Card>
      </div>

      <Card
        v-if="showUserTagReference"
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.runModeProductionAdvice')"
      >
        <div class="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="(meta, key) in USER_TAG_MODE_META"
              :key="key"
              class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ key }}
              </div>
              <div
                class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300"
              >
                {{ meta.description }}
              </div>
              <div class="mt-2 text-xs leading-5 text-slate-500">
                {{ meta.hint }}
              </div>
            </div>
          </div>
          <div
            class="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
          >
            <div
              class="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3"
            >
              {{ $t('business.message.userTagProductionAdviceScale') }}
            </div>
            <div
              class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3"
            >
              {{ $t('business.message.userTagProductionAdviceTargeted') }}
            </div>
            <div
              class="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3"
            >
              {{ $t('business.message.userTagProductionAdviceUnique') }}
            </div>

            <div
              class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ $t('business.message.workflowFieldGuide') }}
              </div>
              <ul
                class="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                <li
                  v-for="item in userTagWorkflowFieldGuides"
                  :key="item.label"
                >
                  <span class="font-medium text-slate-700 dark:text-slate-200">
                    {{ item.label }}:
                  </span>
                  <span>{{ item.description }}</span>
                </li>
              </ul>
            </div>

            <div
              class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ $t('business.message.recalculateFieldGuide') }}
              </div>
              <ul
                class="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                <li
                  v-for="item in userTagRecalculateFieldGuides"
                  :key="item.label"
                >
                  <span class="font-medium text-slate-700 dark:text-slate-200">
                    {{ item.label }}:
                  </span>
                  <span>{{ item.description }}</span>
                </li>
              </ul>
            </div>

            <pre
              v-if="queueHintText"
              class="overflow-auto rounded-xl border border-slate-200/70 bg-slate-950/90 px-3 py-2 text-[11px] leading-5 text-slate-100 dark:border-slate-700/60"
              v-text="queueHintText"
            ></pre>
          </div>
        </div>
      </Card>
    </div>
  </Page>
</template>
