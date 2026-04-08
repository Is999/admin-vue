<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { SystemConfigApi } from '#/api/system';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createConfig, fetchConfigList, updateConfig } from '#/api/system';
import { $t } from '#/locales';
import { resolveRequestErrorMessage } from '#/utils/file/download';

import FormTips from '../../components/form-tips.vue';
import { useFormSchema } from '../data';

// emit 定义配置保存成功事件。
const emit = defineEmits<{ success: [] }>();

// formData 保存当前编辑配置。
const formData = ref<Partial<SystemConfigApi.Item>>({});
// configTree 保存上级配置树下拉数据。
const configTree = ref<Array<Record<string, any>>>([]);

// [Form, formApi] 创建 Vben 表单实例。
const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema: useFormSchema(configTree.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

// stringifyJsonField 将后端 JSON 字段转换成表单文本。
function stringifyJsonField(value: any) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

// parseJsonField 将表单文本转换成 JSON 字面量，非法 JSON 按字符串保存。
function parseJsonField(value: any) {
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  if (text === '') {
    return '';
  }
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

// buildConfigTreeOptions 把平铺配置列表转换成树形选择结构。
function buildConfigTreeOptions(
  items: SystemConfigApi.Item[],
  currentID?: number,
): Array<Record<string, any>> {
  const currentIDText = currentID ? `${currentID}` : '';
  const childrenMap = new Map<number, SystemConfigApi.Item[]>();
  for (const item of items) {
    const list = childrenMap.get(item.pid) || [];
    list.push(item);
    childrenMap.set(item.pid, list);
  }
  const walk = (pid: number): Array<Record<string, any>> =>
    (childrenMap.get(pid) || []).map((item) => {
      const isCurrent = currentID === item.id;
      const isChild =
        currentIDText !== '' &&
        item.pids.split(',').filter(Boolean).includes(currentIDText);
      return {
        children: walk(item.id),
        disabled: isCurrent || isChild,
        id: item.id,
        title: item.title,
      };
    });
  return [
    {
      children: walk(0),
      id: 0,
      title: $t('business.message.topLevelConfig'),
    },
  ];
}

// [Drawer, drawerApi] 创建字典配置新增/编辑抽屉。
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData<Partial<SystemConfigApi.Item>>();
    formApi.resetForm();
    formData.value = data?.id ? data : {};
    const configList = await fetchConfigList({ page: 1, pageSize: 1000 }).catch(
      () => ({
        list: [],
        total: 0,
      }),
    );
    configTree.value = buildConfigTreeOptions(configList.list || [], data?.id);
    formApi.updateSchema(useFormSchema(configTree.value));
    formApi.setValues(
      data?.id
        ? {
            ...data,
            example: stringifyJsonField(data.example),
            value: stringifyJsonField(data.value),
          }
        : { pid: 0, type: 3 },
    );
  },
});

// getDrawerTitle 根据是否编辑计算抽屉标题。
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.editDictionaryConfig')
    : $t('business.message.addDictionaryConfig'),
);

// drawerIntroTitle 返回抽屉顶部操作模式标题。
const drawerIntroTitle = computed(() =>
  formData.value?.id
    ? $t('business.message.currentEditMode')
    : $t('business.message.currentAddMode'),
);

// drawerIntroDescription 返回抽屉顶部操作模式说明。
const drawerIntroDescription = computed(() =>
  formData.value?.id
    ? $t('business.message.dictionaryEditModeDesc')
    : $t('business.message.dictionaryAddModeDesc'),
);

// formTips 定义字典管理表单底部参数说明。
const formTips = [
  $t('business.message.dictionaryKeyTip'),
  $t('business.message.dictionaryValueTip'),
  $t('business.message.dictionaryJsonEditorTip'),
  $t('business.message.dictionaryExampleTip'),
  $t('business.message.dictionarySensitiveTip'),
];

// onSubmit 校验并提交配置保存请求。
async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<SystemConfigApi.SaveParams>();
  const payload = {
    ...values,
    example: parseJsonField(values.example),
    value: parseJsonField(values.value),
    version: formData.value?.id
      ? Number(formData.value.version || 0)
      : undefined,
  };
  drawerApi.lock();
  try {
    await (formData.value?.id
      ? updateConfig(formData.value.id, payload)
      : createConfig(payload));
    message.success(
      formData.value?.id
        ? $t('business.message.dictionaryUpdated')
        : $t('business.message.dictionaryCreated'),
    );
    drawerApi.close();
    emit('success');
  } catch (error) {
    const errorMessage = await resolveRequestErrorMessage(
      error,
      formData.value?.id
        ? $t('business.message.dictionaryVersionConflict')
        : $t('business.message.dictionarySaveFailed'),
    );
    message.error(
      formData.value?.id
        ? $t('business.message.dictionaryUpdateFailed', [errorMessage])
        : $t('business.message.dictionaryCreateFailed', [errorMessage]),
    );
  } finally {
    drawerApi.unlock();
  }
}
</script>

<template>
  <Drawer class="w-full max-w-[880px]" :title="getDrawerTitle">
    <Alert
      class="mx-4 mt-4"
      :description="drawerIntroDescription"
      :message="drawerIntroTitle"
      show-icon
      type="info"
    />
    <Form class="mx-4 mt-4" />
    <FormTips
      :title="$t('business.message.dictionaryFormTips')"
      :tips="formTips"
    />
  </Drawer>
</template>
