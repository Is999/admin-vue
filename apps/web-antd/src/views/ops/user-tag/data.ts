import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '#/locales';

type QueueOption = {
  label: string;
  value: string;
};

// USER_TAG_FORM_LIMITS 与后端 usertag options 硬上限保持一致，避免无效任务进入队列。
export const USER_TAG_FORM_LIMITS = {
  batchSize: 10_000,
  retry: 25,
  shardTotal: 128,
  tagTypes: 500,
  timeoutSeconds: 86_400,
  uids: 10_000,
  workerCount: 64,
} as const;

// useUserTagWorkflowSchema 返回“用户标签工作流触发”表单配置。
export function useUserTagWorkflowSchema(
  queueOptions: QueueOption[] = [],
  onModeChange?: (value?: string) => void,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'mode',
      label: $t('business.message.userTagModeLabel'),
      defaultValue: 'full',
      componentProps: {
        allowClear: false,
        onChange: onModeChange,
        options: [
          {
            label: $t('business.message.userTagModeFullOption'),
            value: 'full',
          },
          {
            label: $t('business.message.userTagModeDeltaOption'),
            value: 'delta',
          },
          {
            label: $t('business.message.userTagModeTargetedOption'),
            value: 'targeted',
          },
          {
            label: $t('business.message.userTagModeRecalculateOption'),
            value: 'recalculate',
          },
        ],
      },
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'tagTypesText',
      label: $t('business.message.userTagTagTypesLabel'),
      componentProps: {
        autoSize: { minRows: 3, maxRows: 6 },
        placeholder: $t('business.message.userTagTagTypesPlaceholder'),
      },
    },
    {
      component: 'Textarea',
      fieldName: 'uidsText',
      label: $t('business.message.userTagUidsLabel'),
      componentProps: {
        autoSize: { minRows: 3, maxRows: 6 },
        placeholder: $t('business.message.userTagUidsPlaceholder'),
      },
    },
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.taskQueue'),
      componentProps: {
        allowClear: true,
        options: queueOptions,
        placeholder: $t('business.message.userTagDefaultQueuePlaceholder'),
        showSearch: true,
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'shardTotal',
      label: $t('business.message.shardTotal'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.shardTotal,
        min: 1,
        addonAfter: $t('business.message.shardUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'batchSize',
      label: $t('business.message.batchSize'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.batchSize,
        min: 1,
        addonAfter: $t('business.message.itemUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'workerCount',
      label: $t('business.message.workerCount'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.workerCount,
        min: 1,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Switch',
      fieldName: 'dryRun',
      label: $t('business.message.dryRunOnly'),
      defaultValue: true,
      componentProps: {
        checkedValue: true,
        disabled: true,
        unCheckedValue: false,
      },
    },
    {
      component: 'Input',
      fieldName: 'uniqueKey',
      label: $t('business.message.uniqueKey'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.userTagUniqueKeyPlaceholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'uniqueTTLSeconds',
      label: $t('business.message.uniqueTtlSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'retry',
      label: $t('business.message.retryCount'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.retry,
        min: 0,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.timeoutSeconds,
        min: 1,
        addonAfter: $t('business.message.secondUnit'),
        style: { width: '100%' },
      },
    },
  ];
}

// useUserTagRecalculateSchema 返回“指定标签重算”表单配置。
export function useUserTagRecalculateSchema(
  queueOptions: QueueOption[] = [],
): VbenFormSchema[] {
  return [
    {
      component: 'Textarea',
      fieldName: 'tagTypesText',
      label: $t('business.message.userTagTagTypesLabel'),
      rules: 'required',
      componentProps: {
        autoSize: { minRows: 4, maxRows: 8 },
        placeholder: $t('business.message.userTagTagTypesSimplePlaceholder'),
      },
    },
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.taskQueue'),
      componentProps: {
        allowClear: true,
        options: queueOptions,
        placeholder: $t('business.message.userTagDefaultQueuePlaceholder'),
        showSearch: true,
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'shardTotal',
      label: $t('business.message.shardTotal'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.shardTotal,
        min: 1,
        addonAfter: $t('business.message.shardUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'batchSize',
      label: $t('business.message.batchSize'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.batchSize,
        min: 1,
        addonAfter: $t('business.message.itemUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'workerCount',
      label: $t('business.message.workerCount'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.workerCount,
        min: 1,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Switch',
      fieldName: 'dryRun',
      label: $t('business.message.dryRunOnly'),
      defaultValue: true,
      componentProps: {
        checkedValue: true,
        disabled: true,
        unCheckedValue: false,
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'uniqueTTLSeconds',
      label: $t('business.message.uniqueTtlSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'retry',
      label: $t('business.message.retryCount'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.retry,
        min: 0,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
        max: USER_TAG_FORM_LIMITS.timeoutSeconds,
        min: 1,
        addonAfter: $t('business.message.secondUnit'),
        style: { width: '100%' },
      },
    },
  ];
}

// useUserTagLeaseReleaseSchema 返回“释放工作流互斥锁”表单配置。
export function useUserTagLeaseReleaseSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'workflowId',
      label: $t('business.message.userTagWorkflowIdLabel'),
      rules: 'required',
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.userTagWorkflowIdPlaceholder'),
      },
    },
    {
      component: 'Select',
      fieldName: 'mode',
      label: $t('business.message.userTagModeLabel'),
      defaultValue: 'full',
      componentProps: {
        allowClear: false,
        options: [
          {
            label: $t('business.message.userTagModeFullOption'),
            value: 'full',
          },
          {
            label: $t('business.message.userTagModeDeltaOption'),
            value: 'delta',
          },
          {
            label: $t('business.message.userTagModeTargetedOption'),
            value: 'targeted',
          },
          {
            label: $t('business.message.userTagModeRecalculateOption'),
            value: 'recalculate',
          },
        ],
      },
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'reason',
      label: $t('business.message.userTagLeaseReleaseReasonLabel'),
      rules: 'required',
      componentProps: {
        autoSize: { minRows: 3, maxRows: 6 },
        maxlength: 500,
        placeholder: $t(
          'business.message.userTagLeaseReleaseReasonPlaceholder',
        ),
        showCount: true,
      },
    },
  ];
}
