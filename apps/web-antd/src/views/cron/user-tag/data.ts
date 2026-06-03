import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '#/locales';

type QueueOption = {
  label: string;
  value: string;
};

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
        min: 1,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Switch',
      fieldName: 'dryRun',
      label: $t('business.message.dryRunOnly'),
      defaultValue: false,
      componentProps: { checkedValue: true, unCheckedValue: false },
    },
    {
      component: 'Switch',
      fieldName: 'syncSnapshotOnly',
      label: $t('business.message.syncSnapshotOnly'),
      defaultValue: false,
      componentProps: { checkedValue: true, unCheckedValue: false },
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
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
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
        min: 1,
        addonAfter: $t('business.message.countUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Switch',
      fieldName: 'dryRun',
      label: $t('business.message.dryRunOnly'),
      defaultValue: false,
      componentProps: { checkedValue: true, unCheckedValue: false },
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
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
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
