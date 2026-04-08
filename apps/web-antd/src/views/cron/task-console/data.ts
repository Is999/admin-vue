import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '#/locales';

type QueueOption = {
  label: string;
  value: string;
};

// useTriggerWorkflowSchema 返回“手动触发工作流”表单配置。
export function useTriggerWorkflowSchema(
  queueOptions: QueueOption[] = [],
  workflowOptions: QueueOption[] = [],
  onWorkflowChange?: (value?: string) => void,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'name',
      label: $t('business.message.workflowName'),
      rules: 'required',
      componentProps: {
        allowClear: true,
        onChange: onWorkflowChange,
        options: workflowOptions,
        placeholder: $t('business.message.selectRegisteredWorkflow'),
        showSearch: true,
      },
    },
    {
      component: 'Textarea',
      fieldName: 'targetsText',
      label: $t('business.message.executionTargets'),
      componentProps: {
        autoSize: { minRows: 4, maxRows: 8 },
        placeholder: $t('business.message.executionTargetsPlaceholder'),
      },
    },
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.taskQueue'),
      componentProps: {
        allowClear: true,
        options: queueOptions,
        placeholder: $t('business.message.workflowDefaultQueuePlaceholder'),
        showSearch: true,
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'shardTotal',
      label: $t('business.message.shardTotal'),
      componentProps: { min: 1, style: { width: '100%' } },
    },
    {
      component: 'InputNumber',
      fieldName: 'grayPercent',
      label: $t('business.message.grayPercent'),
      defaultValue: 100,
      componentProps: {
        min: 1,
        max: 100,
        addonAfter: '%',
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'uniqueKey',
      label: $t('business.message.uniqueKey'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.uniqueKeyPlaceholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'uniqueTTLSeconds',
      label: $t('business.message.uniqueTTLSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'retry',
      label: $t('business.message.retryCount'),
      componentProps: {
        min: 0,
        addonAfter: $t('business.message.timesUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'processAt',
      label: $t('business.message.absoluteRunTime'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.rfc3339Placeholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'processInSeconds',
      label: $t('business.message.delayRunSeconds'),
      componentProps: {
        min: 0,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'deadline',
      label: $t('business.message.deadline'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.rfc3339DeadlinePlaceholder'),
      },
    },
  ];
}

// useEnqueueTaskSchema 返回“手动投递通用任务”表单配置。
export function useEnqueueTaskSchema(
  queueOptions: QueueOption[] = [],
  taskTypeOptions: QueueOption[] = [],
  onTaskTypeChange?: (value?: string) => void,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      fieldName: 'taskType',
      label: $t('business.message.taskType'),
      rules: 'required',
      componentProps: {
        allowClear: true,
        onChange: onTaskTypeChange,
        options: taskTypeOptions,
        placeholder: $t('business.message.selectRegisteredTaskType'),
        showSearch: true,
      },
    },
    {
      component: 'Textarea',
      fieldName: 'payloadText',
      label: $t('business.message.taskPayload'),
      rules: 'required',
      componentProps: {
        autoSize: { minRows: 6, maxRows: 10 },
        placeholder: '{\n  "appId": "203"\n}',
      },
    },
    {
      component: 'Select',
      fieldName: 'queue',
      label: $t('business.message.taskQueue'),
      componentProps: {
        allowClear: true,
        options: queueOptions,
        placeholder: $t('business.message.taskDefaultQueuePlaceholder'),
        showSearch: true,
      },
    },
    {
      component: 'Input',
      fieldName: 'group',
      label: $t('business.message.aggregateGroup'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.aggregateGroupTaskPlaceholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'retry',
      label: $t('business.message.retryCount'),
      componentProps: {
        min: 0,
        addonAfter: $t('business.message.timesUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'timeoutSeconds',
      label: $t('business.message.timeoutSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'processAt',
      label: $t('business.message.absoluteRunTime'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.rfc3339Placeholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'processInSeconds',
      label: $t('business.message.delayRunSeconds'),
      componentProps: {
        min: 0,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'deadline',
      label: $t('business.message.deadline'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.rfc3339DeadlinePlaceholder'),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'uniqueTTLSeconds',
      label: $t('business.message.uniqueTTLSeconds'),
      componentProps: {
        min: 1,
        addonAfter: $t('business.message.secondsUnit'),
        style: { width: '100%' },
      },
    },
  ];
}

// useWorkflowQuerySchema 返回“查询工作流实例状态”表单配置。
export function useWorkflowQuerySchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'workflowId',
      label: $t('business.message.workflowInstanceId'),
      rules: 'required',
      componentProps: {
        placeholder: $t('business.message.workflowIdPlaceholder'),
      },
    },
  ];
}
