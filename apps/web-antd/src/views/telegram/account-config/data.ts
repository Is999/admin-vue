import type { VbenFormSchema } from '#/adapter/form';

import { h, markRaw, ref } from 'vue';

import { Spin } from 'ant-design-vue';

import { fetchTgAccountConfigDropdown } from '#/api/telegram/account-config';

import DynamicTimeRangeList from './components/DynamicTimeRangeList.vue';

/**
 * 账号配置表单schema（新增 / 编辑）
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    ...useGroupFormSchema(),
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
const fetching = ref(false);
export function useGroupFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      fieldName: 'group',
      label: '选择分组',
      componentProps: {
        /**
         * 接口转 options（这里只放真实分组）
         */
        afterFetch: (
          data: {
            id: number | string;
            label: string;
            value: number | string;
          }[],
        ) => {
          return [
            {
              label: h(
                'span',
                { style: { color: '#52c41a' } },
                '＋＋ 新增分组 ＋＋',
              ),
              value: '__add__',
            },
            ...data.map((item) => ({
              label: item.label,
              value: item.value,
              id: item.id,
            })),
          ];
        },

        api: () => {
          if (fetching.value === true) {
            return Promise.resolve([]);
          }
          fetching.value = true;
          // 模拟延时
          return new Promise((resolve, reject) => {
            return fetchTgAccountConfigDropdown()
              .then(resolve, reject)
              .finally(() => {
                fetching.value = false;
              });
          });
        },
        optionFilterProp: 'label',
        autoSelect: 'first',
        labelField: 'label',
        valueField: 'value',
        showSearch: true,
        // 如果正在获取数据，使用插槽显示一个loading
        notFoundContent: fetching.value ? undefined : null,
        class: 'w-full',
      },
      renderComponentContent: () => {
        return {
          notFoundContent: fetching.value ? h(Spin) : undefined,
        };
      },
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: '__isReload__',
      componentProps: {
        hidden: true,
      },
      dependencies: {
        // show: false,
        triggerFields: ['group'],
      },
    },
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
