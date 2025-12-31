<script setup lang="ts">
import type { TgAccountConfigApi } from '#/api/telegram/account-config';

import { ref } from 'vue';

// Vben Admin 通用页面、抽屉、按钮组件
import { Page, VbenButton } from '@vben/common-ui';

import { Card, message, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  fetchTgAccountConfigByGroup,
  saveTgAccountConfig,
} from '#/api/telegram/account-config';

import { useFormSchema } from './data';

const formParams = ref<TgAccountConfigApi.FormParams>({
  group: '__add__',
  groupTitle: '',
  list: [
    {
      title: '每天上线时间段',
      key: 'dailyOnlineTimeRanges',
      value: [
        { start: '09:00', end: '12:00' },
        { start: '15:00', end: '20:00' },
      ],
      id: 0,
    },
    {
      title: '关键词触发',
      key: 'keywordTriggersEnabled',
      value: true,
      id: 0,
    },
    {
      title: '@触发',
      key: 'mentionTriggerEnabled',
      value: true,
      id: 0,
    },
    {
      title: '连续发言最小间隔（秒）',
      key: 'minMessageIntervalSec',
      value: 30,
      id: 0,
    },
    {
      title: '每小时发言上限',
      key: 'maxMessagesPerHour',
      value: 60,
      id: 0,
    },
  ],
});
const items = ref<Record<string, TgAccountConfigApi.Item>>({});
// 账号表单数据
// 允许通过字符串索引动态赋值，扩展类型
const formData = ref<Record<string, any>>({
  group: formParams.value.group,
  dailyOnlineTimeRanges: [], // Ensure this is always an array for v-model
});
const loading = ref(false);

// useVbenForm
const [Form, formApi] = useVbenForm({
  commonConfig: {
    // 在label后显示一个冒号
    colon: true,
    // 所有表单项
    componentProps: {
      class: 'w-full',
    },
    labelClass: 'w-2/6',
  },
  layout: 'horizontal',
  showDefaultActions: false,
  schema: useFormSchema().map((item) => {
    // "每天上线时间段" 占满两列
    if (item.fieldName === 'dailyOnlineTimeRanges') {
      return { ...item, formItemClass: 'col-span-2', labelClass: 'w-1/6' };
    }
    // 关键词触发、@触发并排
    if (
      ['keywordTriggersEnabled', 'mentionTriggerEnabled'].includes(
        item.fieldName,
      )
    ) {
      return { ...item, formItemClass: '' };
    }
    // 连续发言最小间隔、每小时发言上限并排
    if (
      ['maxMessagesPerHour', 'minMessageIntervalSec'].includes(item.fieldName)
    ) {
      return { ...item, formItemClass: '' };
    }
    return item;
  }),
  // 新增自定义布局
  wrapperClass: 'grid grid-cols-2 gap-x-6 gap-y-4',
  handleValuesChange(values, fieldsChanged) {
    // 只要 group 字段变化就同步
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

// 表单提交逻辑
async function onSubmit(values: Record<string, any>) {
  // 防止重复提交
  loading.value = true;

  // 将值进行反向转换，变成接口需要的格式
  const params: TgAccountConfigApi.FormParams = {
    group: values.group,
    groupTitle: values.groupTitle,
    list: Object.keys(values)
      .filter(
        (key) =>
          key !== 'group' && key !== 'groupTitle' && key !== '__isReload__',
      )
      .map((key) => ({
        key,
        value: values[key],
        title: items.value[key]?.title || '',
        id: items.value[key]?.id || 0,
      })),
  };
  await saveTgAccountConfig(params)
    .then((res) => {
      const newGroup = res.group; // 后端返回的新分组 key
      const newGroupTitle = res.groupTitle;
      message.success('保存配置成功');
      formApi.setValues({
        group: newGroup,
        groupTitle: newGroupTitle,
        __isReload__: 1, // 触发表单值变化
      });
    })
    .catch(() => {})
    .finally(() => {
      loading.value = false;
    });
}

// 拉取分组配置并同步到表单
async function loadConfig(values: Record<string, any>) {
  if (values.group && values.group !== formParams.value.group) {
    // 编辑模式，拉取数据
    loading.value = true;
    await fetchTgAccountConfigByGroup(values.group)
      .then((res) => {
        if (res) {
          formApi.resetForm();
          const { group, groupTitle, list } = res;
          for (const item of list) {
            items.value[item.key] = item;
          }
          // 回填数据
          const configValues = Object.fromEntries(
            list.map((item) => [item.key, item.value]),
          );
          formData.value = {
            group,
            groupTitle,
          };
          for (const configValuesKey in configValues) {
            formData.value[configValuesKey] = configValues[configValuesKey];
          }
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
    // 新增模式，清空所有数据
    await formApi.resetForm();

    const { group, groupTitle, list } = formParams.value;

    // 重新构建 items
    for (const item of list) {
      items.value[item.key] = item;
    }
    // 回填数据
    const configValues = Object.fromEntries(
      list.map((item) => [item.key, item.value]),
    );
    formData.value = {
      group,
      groupTitle,
    };
    for (const configValuesKey in configValues) {
      formData.value[configValuesKey] = configValues[configValuesKey];
    }
    await formApi.setValues(formData.value);
  }
}
</script>
<template>
  <Page title="账号配置管理">
    <Spin :spinning="loading">
      <Card>
        <div class="mb-4 mt-0 flex justify-end">
          <VbenButton type="primary" @click="formApi.submitForm">
            保存配置
          </VbenButton>
        </div>
        <Form />
      </Card>
    </Spin>
  </Page>
</template>
