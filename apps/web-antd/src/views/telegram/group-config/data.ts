import type { VbenFormSchema } from '#/adapter/form';

import { markRaw } from 'vue';

import DynamicTimeRangeList from '../account-config/components/dynamic-time-range-list.vue';

// 群组配置表单 schema（新增 / 编辑）
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

// 配置项 schema，严格对齐 tg_group_config_api_examples.md
export function useConfigItemsSchema(): VbenFormSchema[] {
  return [
    {
      component: markRaw(DynamicTimeRangeList),
      fieldName: 'schedulePeakTime',
      label: '群聊高峰时间段（HH:MM）',
      defaultValue: [{ start: '18:00', end: '23:00' }],
      rules: 'required',
      componentProps: {
        maxCount: 8,
      },
    },
    {
      component: 'Switch',
      fieldName: 'schedulePeakEnabled',
      label: '高峰时段调度',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'Switch',
      fieldName: 'interactionRoundRobinEnabled',
      label: '轮询式AI发言',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: false,
      rules: 'required',
    },
    {
      component: 'Switch',
      fieldName: 'cooldownEnabled',
      label: '自动冷却机制',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'Switch',
      fieldName: 'triggerKeywordEnabled',
      label: '关键词触发',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'Switch',
      fieldName: 'triggerMentionEnabled',
      label: '@mention 触发',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'Switch',
      fieldName: 'triggerSilenceEnabled',
      label: '群沉默检测',
      componentProps: { checkedValue: true, unCheckedValue: false },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'limitAccountDailyMessageLimit',
      label: '单AI账号每日最大发言数',
      componentProps: { min: 0 },
      defaultValue: 120,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'limitMessageMinIntervalSec',
      label: 'AI连续两条消息的最小间隔（秒）',
      componentProps: { min: 0, addonAfter: '秒' },
      defaultValue: 180,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'interactionAiHourlyLimit',
      label: 'AI与AI之间每小时互动次数上限',
      componentProps: { min: 0 },
      defaultValue: 20,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'limitGroupDailyMessageLimit',
      label: '群内所有AI每日消息总上限',
      componentProps: { min: 0 },
      defaultValue: 800,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'triggerSilenceLightThresholdSec',
      label: '轻度沉默触发阈值（秒）',
      componentProps: { min: 0, addonAfter: '秒' },
      defaultValue: 120,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'triggerSilenceStrongThresholdSec',
      label: '强沉默触发阈值（秒）',
      componentProps: { min: 0, addonAfter: '秒' },
      defaultValue: 300,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'cooldownTriggerThresholdPerHour',
      label: '冷却触发阈值（1小时内触发次数）',
      componentProps: { min: 0 },
      defaultValue: 20,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'cooldownReductionRatio',
      label: '冷却状态下的降频比例（0~1）',
      componentProps: { min: 0, max: 1, step: 0.1 },
      defaultValue: 0.5,
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'triggerActiveMessageRatio',
      label: '主动触发消息占比（百分比 0~100）',
      componentProps: { min: 0, max: 100, addonAfter: '%' },
      defaultValue: 80,
      rules: 'required',
    },
  ];
}
