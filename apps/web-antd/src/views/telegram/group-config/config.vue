<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { TgGroupConfigApi } from '#/api/telegram/group-config';

import { h, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';

import { Card, message, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  fetchTgGroupConfigByGroup,
  fetchTgGroupConfigDropdown,
  saveTgGroupConfig,
} from '#/api/telegram/group-config';

import { useFormSchema } from './data';

// 默认表单参数，严格对齐 tg_group_config_api_examples.md
const addDefaultFormParams = ref<TgGroupConfigApi.FormParams>({
  group: '__add__',
  groupTitle: '',
  list: [
    {
      title: '群聊高峰时间段（HH:MM）',
      key: 'schedulePeakTime',
      value: [{ start: '18:00', end: '23:00' }],
      id: 0,
    },
    {
      title: '高峰时段调度（1启用，0禁用）',
      key: 'schedulePeakEnabled',
      value: true,
      id: 0,
    },
    {
      title: '关键词触发（1启用，0禁用）',
      key: 'triggerKeywordEnabled',
      value: true,
      id: 0,
    },
    {
      title: '@mention 触发（1启用，0禁用）',
      key: 'triggerMentionEnabled',
      value: true,
      id: 0,
    },
    {
      title: '群沉默检测（1启用，0禁用）',
      key: 'triggerSilenceEnabled',
      value: true,
      id: 0,
    },
    {
      title: '轮询式 AI 发言（1启用，0禁用）',
      key: 'interactionRoundRobinEnabled',
      value: false,
      id: 0,
    },
    {
      title: '自动冷却机制（1启用，0禁用）',
      key: 'cooldownEnabled',
      value: true,
      id: 0,
    },
    {
      title: '单 AI 账号每日最大发言数',
      key: 'limitAccountDailyMessageLimit',
      value: 120,
      id: 0,
    },
    {
      title: '群内所有 AI 每日消息总上限',
      key: 'limitGroupDailyMessageLimit',
      value: 800,
      id: 0,
    },
    {
      title: 'AI 连续两条消息的最小间隔（秒）',
      key: 'limitMessageMinIntervalSec',
      value: 180,
      id: 0,
    },
    {
      title: 'AI 与 AI 之间每小时互动次数上限',
      key: 'interactionAiHourlyLimit',
      value: 20,
      id: 0,
    },
    {
      title: '冷却触发阈值（1 小时内触发次数）',
      key: 'cooldownTriggerThresholdPerHour',
      value: 20,
      id: 0,
    },
    {
      title: '轻度沉默触发阈值（秒）',
      key: 'triggerSilenceLightThresholdSec',
      value: 120,
      id: 0,
    },
    {
      title: '强沉默触发阈值（秒）',
      key: 'triggerSilenceStrongThresholdSec',
      value: 300,
      id: 0,
    },
    {
      title: '主动触发消息占比（百分比 0~100）',
      key: 'triggerActiveMessageRatio',
      value: 80,
      id: 0,
    },
    {
      title: '冷却状态下的降频比例（0~1）',
      key: 'cooldownReductionRatio',
      value: 0.5,
      id: 0,
    },
  ],
});

function buildItemsFromList(
  list: TgGroupConfigApi.Item[],
): Record<string, TgGroupConfigApi.Item> {
  const record: Record<string, TgGroupConfigApi.Item> = {};
  for (const item of list) record[item.key] = item;
  return record;
}

function buildFormDataFromParams(
  params: TgGroupConfigApi.FormParams,
): Record<string, any> {
  const record: Record<string, any> = {
    group: params.group,
    groupTitle: params.groupTitle,
  };
  for (const item of params.list) record[item.key] = item.value;
  return record;
}

const items = ref<Record<string, TgGroupConfigApi.Item>>(
  buildItemsFromList(addDefaultFormParams.value.list),
);
const formData = ref<Record<string, any>>(
  buildFormDataFromParams(addDefaultFormParams.value),
);
const loading = ref(false);
const reloadTimestamp = ref(Date.now());
const timeRangeRef = ref();
const fetching = ref(false);

function useGroupFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      fieldName: 'group',
      label: '选择分组',
      componentProps: {
        params: { _t: reloadTimestamp.value },
        afterFetch: (
          data: {
            id: number | string;
            label: string;
            value: number | string;
          }[],
        ) => [
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
        ],
        api: () => {
          if (fetching.value) return Promise.resolve([]);
          fetching.value = true;
          return new Promise((resolve, reject) =>
            fetchTgGroupConfigDropdown()
              .then(resolve, reject)
              .finally(() => {
                fetching.value = false;
              }),
          );
        },
        optionFilterProp: 'label',
        autoSelect: 'first',
        labelField: 'label',
        valueField: 'value',
        showSearch: true,
        notFoundContent: fetching.value ? undefined : null,
        class: 'w-full',
      },
      renderComponentContent: () => ({
        notFoundContent: fetching.value ? h(Spin) : undefined,
      }),
      rules: 'required',
    },
  ];
}

const getFormSchemaWithValidation = (): VbenFormSchema[] => {
  return [...useGroupFormSchema(), ...useFormSchema()].map((item) => {
    if (item.fieldName === 'schedulePeakTime') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          ref: (el: any) => {
            timeRangeRef.value = el;
          },
          maxCount: 8,
        },
        formItemClass: 'col-span-2',
        labelClass: 'w-1/6',
      };
    }
    return item;
  });
};

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  showDefaultActions: false,
  schema: getFormSchemaWithValidation(),
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-4',
  handleValuesChange(values, fieldsChanged) {
    if (
      fieldsChanged.includes('group') &&
      values.group &&
      values.group !== formData.value?.group
    ) {
      loadConfig(values);
    }
  },
  handleSubmit: onSubmit,
});

async function loadConfig(values: Record<string, any>) {
  if (values.group && values.group !== addDefaultFormParams.value.group) {
    loading.value = true;
    await fetchTgGroupConfigByGroup(values.group)
      .then((res) => {
        if (res) {
          formApi.resetForm();
          formData.value = buildFormDataFromParams(res);
          items.value = buildItemsFromList(res.list);
          formApi.setValues(formData.value);
        } else {
          message.error(`获取${values.groupTitle}配置详情失败`);
        }
      })
      .catch(() => {})
      .finally(() => {
        loading.value = false;
      });
  } else {
    await formApi.resetForm();
    formData.value = buildFormDataFromParams(addDefaultFormParams.value);
    items.value = buildItemsFromList(addDefaultFormParams.value.list);
    await formApi.setValues(formData.value);
  }
}

async function onSubmit(values: Record<string, any>) {
  const ok = await validateForm();
  if (!ok) return;

  const peak = values.schedulePeakTime;
  if (!peak || !Array.isArray(peak) || peak.length === 0) {
    message.error('请至少添加一个高峰时间段');
    return;
  }

  loading.value = true;

  const params: TgGroupConfigApi.FormParams = {
    group: values.group,
    groupTitle: values.groupTitle,
    list: Object.keys(values)
      .filter((key) => !['__isReload__', 'group', 'groupTitle'].includes(key))
      .map((key) => ({
        key,
        value: values[key],
        title: items.value[key]?.title || '',
        id: items.value[key]?.id || 0,
      })),
  };

  await saveTgGroupConfig(params)
    .then((res) => {
      const newGroup = res.group;
      const newGroupTitle = res.groupTitle;
      message.success('保存配置成功');
      if (
        values.group === '__add__' ||
        formData.value.groupTitle !== newGroupTitle
      ) {
        reloadTimestamp.value = Date.now();
        formApi.updateSchema(
          useGroupFormSchema().map((item) => {
            if (item.fieldName === 'group') {
              return {
                ...item,
                componentProps: {
                  ...item.componentProps,
                  params: { _t: reloadTimestamp.value },
                },
              };
            }
            return item;
          }),
        );
        formData.value.group = newGroup;
        formData.value.groupTitle = newGroupTitle;
        setTimeout(() => {
          formApi.setValues({ group: newGroup, groupTitle: newGroupTitle });
        }, 500);
      }
    })
    .catch(() => {})
    .finally(() => {
      loading.value = false;
    });
}

const validateForm = async () => {
  if (timeRangeRef.value) {
    const result = timeRangeRef.value.validate();
    if (!result.isValid) {
      message.error(`请先修正时间段错误：${result.errorMessages.join('; ')}`);
      return false;
    }
  }
  return await formApi.validate();
};

const handleReset = () => {
  if (timeRangeRef.value) {
    timeRangeRef.value.resetValidation();
  }
  formApi.resetForm();
  formApi.setValues(formData.value);
};
</script>

<template>
  <Page title="群组配置管理">
    <Spin :spinning="loading">
      <Card>
        <div class="mb-4 mt-0 flex justify-end gap-2">
          <VbenButton @click="handleReset"> 重置 </VbenButton>
          <VbenButton
            type="primary"
            @click="formApi.submitForm"
            :disabled="loading"
          >
            {{ loading ? '提交中...' : '保存配置' }}
          </VbenButton>
        </div>
        <Form />
      </Card>
    </Spin>
  </Page>
</template>
