import type { VbenFormSchema } from '#/adapter/form';

import { markRaw } from 'vue';

import DynamicTimeRangeList from './components/dynamic-time-range-list.vue';

/**
 * 账号配置表单schema（新增 / 编辑）
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'groupTitle',
      label: '分组名称',
      componentProps: {
        placeholder: '请输入分组名称',
      },
      rules: 'required',
    },

    ...useConfigItemsSchema(),
  ];
}

/**
 * 配置项 schema
 */
export function useConfigItemsSchema(): VbenFormSchema[] {
  return [
    {
      component: markRaw(DynamicTimeRangeList),
      fieldName: 'dailyOnlineTimeRanges',
      label: '每天上线时间段',
    },
    {
      component: 'Switch',
      fieldName: 'keywordTriggersEnabled',
      label: '关键词触发',
      componentProps: {
        checkedValue: 1,
        unCheckedValue: 0,
      },
    },
    {
      component: 'Switch',
      fieldName: 'mentionTriggerEnabled',
      label: '@触发',
      componentProps: {
        checkedValue: 1,
        unCheckedValue: 0,
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'minMessageIntervalSec',
      label: '连续发言最小间隔',
      componentProps: {
        min: 0,
        addonAfter: '秒',
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'maxMessagesPerHour',
      label: '每小时发言上限',
      componentProps: {
        min: 0,
        addonAfter: '条',
      },
    },
  ];
}
