<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { TgAccountConfigApi } from '#/api/telegram/account-config';

import { h, ref } from 'vue';

// Vben Admin 通用页面、抽屉、按钮组件
import { Page, VbenButton } from '@vben/common-ui';

import { Card, message, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  fetchTgAccountConfigByGroup,
  fetchTgAccountConfigDropdown,
  saveTgAccountConfig,
} from '#/api/telegram/account-config';

import { useFormSchema } from './data';

// 添加默认表单参数
const addDefaultFormParams = ref<TgAccountConfigApi.FormParams>({
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

// 存储配置项详情，方便提交时使用
function buildDefaultItems(): Record<string, TgAccountConfigApi.Item> {
  const record: Record<string, TgAccountConfigApi.Item> = {};
  for (const item of addDefaultFormParams.value.list) {
    record[item.key] = item;
  }
  return record;
}
const items = ref<Record<string, TgAccountConfigApi.Item>>(buildDefaultItems());
// 账号表单数据
const formData = ref<Record<string, any>>({
  group: addDefaultFormParams.value.group,
  dailyOnlineTimeRanges: [], // Ensure this is always an array for v-model
});
const loading = ref(false);
// 时间戳用于强制刷新
const reloadTimestamp = ref(Date.now());
// 添加 ref 引用时间范围组件
const timeRangeRef = ref();
// 控制是否正在获取分组列表
const fetching = ref(false);
function useGroupFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      fieldName: 'group',
      label: '选择分组',
      componentProps: {
        // 动态控制是否立即加载
        // immediate: true,
        params: {
          // type: 'user',
          _t: reloadTimestamp.value, // 添加时间戳参数
        },
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
  ];
}

// 修改表单 schema，添加验证相关配置
const getFormSchemaWithValidation = (): VbenFormSchema[] => {
  const schemas = [...useGroupFormSchema(), ...useFormSchema()].map((item) => {
    // "每天上线时间段" 占满两列
    if (item.fieldName === 'dailyOnlineTimeRanges') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          ref: (el: any) => {
            timeRangeRef.value = el;
          },
          // onValidate: (isValid: boolean, errorMessages: string[]) => {
          //   // console.log('时间范围验证状态:', isValid, errorMessages);
          // },
          maxCount: 8, // 设置最大时间段数量
        },
        formItemClass: 'col-span-2',
        labelClass: 'w-1/6',
      };
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
  });

  return schemas.map((schema) => {
    return schema;
  });
};
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
  schema: getFormSchemaWithValidation(),
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

// 拉取分组配置并同步到表单
async function loadConfig(values: Record<string, any>) {
  if (values.group && values.group !== addDefaultFormParams.value.group) {
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

    const { group, groupTitle, list } = addDefaultFormParams.value;

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

// 表单提交逻辑
async function onSubmit(values: Record<string, any>) {
  // 验证表单
  const isValid = await validateForm();
  if (!isValid) return;

  // 校验时间范围
  const timeRanges = values.dailyOnlineTimeRanges;
  if (!timeRanges || !Array.isArray(timeRanges) || timeRanges.length === 0) {
    message.error('请至少添加一个上线时间段');
    return;
  }

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

  // 提交保存
  await saveTgAccountConfig(params)
    .then((res) => {
      const newGroup = res.group; // 后端返回的新分组 key
      const newGroupTitle = res.groupTitle;
      message.success('保存配置成功');
      //  如果是新增分组或者分组标题修改，更新下拉框
      if (
        values.group === '__add__' ||
        formData.value.groupTitle !== newGroupTitle
      ) {
        //  提交成功后重新加载下拉框
        reloadTimestamp.value = Date.now();
        // 更新 schema 触发重新加载
        formApi.updateSchema(
          useGroupFormSchema().map((item) => {
            if (item.fieldName === 'group') {
              return {
                ...item,
                componentProps: {
                  ...item.componentProps,
                  params: {
                    // type: 'user',
                    _t: reloadTimestamp.value, // 添加时间戳参数
                  },
                },
              };
            }
            return item;
          }),
        );
        // 更新本地 formData
        formData.value.group = newGroup;
        formData.value.groupTitle = newGroupTitle;
        // 延迟后 更新表单中的 group 和 groupTitle
        setTimeout(() => {
          formApi.setValues({
            group: newGroup,
            groupTitle: newGroupTitle,
          });
        }, 500);
      }
    })
    .catch(() => {})
    .finally(() => {
      loading.value = false;
    });
}

// 在提交前验证时间范围
const validateForm = async () => {
  // 1. 先验证时间范围组件
  if (timeRangeRef.value) {
    const result = timeRangeRef.value.validate();
    if (!result.isValid) {
      message.error(`请先修正时间段错误：${result.errorMessages.join('; ')}`);
      return false;
    }
  }

  // 2. 进行表单验证
  return await formApi.validate();
};

// 重置表单时也重置时间范围验证
const handleReset = () => {
  if (timeRangeRef.value) {
    timeRangeRef.value.resetValidation();
  }
  formApi.resetForm();
};
</script>
<template>
  <Page title="账号配置管理">
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
