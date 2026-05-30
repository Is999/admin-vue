<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import { computed, ref, watch } from 'vue';

import { Button, Input, message, Space, Tag } from 'ant-design-vue';

import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

// props 定义 JSON 编辑器输入属性，兼容 Vben Form 默认的 value 模型。
const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    placeholder?: string;
    readonly?: boolean;
    rows?: number;
    value?: string;
  }>(),
  {
    disabled: false,
    placeholder: '',
    readonly: false,
    rows: 10,
    value: '',
  },
);

// emit 定义组件对外同步值的事件。
const emit = defineEmits<{
  'update:value': [value: string];
}>();

// innerValue 保存当前编辑中的文本内容。
const innerValue = ref(String(props.value || ''));

// textAreaAutoSize 定义文本域自适应行数，避免模板里使用类型断言。
const textAreaAutoSize = computed(() => ({
  maxRows: Math.max(props.rows, 18),
  minRows: props.rows,
}));

// editorPlaceholder 返回 JSON 编辑器默认占位文案，允许表单按需覆盖。
const editorPlaceholder = computed(
  () => props.placeholder || $t('business.message.jsonEditorPlaceholder'),
);

// 监听外部值变化，确保抽屉回填或重置时编辑器同步更新。
watch(
  () => props.value,
  (value) => {
    innerValue.value = String(value || '');
  },
);

// syncValue 把组件内部文本同步给表单。
function syncValue(value: string) {
  innerValue.value = value;
  emit('update:value', value);
}

// jsonState 计算当前文本是否可被解析为 JSON。
const jsonState = computed(() => {
  const text = innerValue.value.trim();
  if (!text) {
    return {
      status: 'empty' as const,
      text: $t('business.message.jsonStateEmpty'),
    };
  }
  try {
    JSON.parse(text);
    return {
      status: 'valid' as const,
      text: $t('business.message.jsonStateValid'),
    };
  } catch {
    return {
      status: 'plain' as const,
      text: $t('business.message.jsonStatePlain'),
    };
  }
});

// normalizeJsonContent 按需格式化或压缩当前 JSON 文本。
function normalizeJsonContent(space?: number) {
  const text = innerValue.value.trim();
  if (!text) {
    message.warning($t('business.message.emptyContentNoop'));
    return;
  }
  try {
    const result = JSON.stringify(JSON.parse(text), null, space);
    syncValue(result);
    message.success(
      $t(
        space === undefined
          ? 'business.message.jsonCompressed'
          : 'business.message.jsonFormatted',
      ),
    );
  } catch {
    message.error($t('business.message.invalidJsonContent'));
  }
}

// onValidateJson 手动校验当前 JSON 文本。
function onValidateJson() {
  const text = innerValue.value.trim();
  if (!text) {
    message.warning($t('business.message.emptyContent'));
    return;
  }
  try {
    JSON.parse(text);
    message.success($t('business.message.jsonValidationPassed'));
  } catch {
    message.error($t('business.message.jsonValidationFailed'));
  }
}

// onCopyContent 复制当前编辑器内容，便于外部联调、排障和配置复用。
async function onCopyContent() {
  await copyTextToClipboard(
    innerValue.value,
    $t('business.message.contentCopied'),
    $t('business.message.emptyCopyContent'),
  );
}
</script>

<template>
  <div class="w-full space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <Space wrap>
        <Button
          size="small"
          :disabled="disabled"
          @click="normalizeJsonContent(2)"
        >
          {{ $t('business.message.formatJson') }}
        </Button>
        <Button
          size="small"
          :disabled="disabled"
          @click="normalizeJsonContent()"
        >
          {{ $t('business.message.compressJson') }}
        </Button>
        <Button size="small" :disabled="disabled" @click="onValidateJson">
          {{ $t('business.message.validateJson') }}
        </Button>
        <Button size="small" :disabled="disabled" @click="onCopyContent">
          {{ $t('business.message.copy') }}
        </Button>
      </Space>
      <Tag v-if="jsonState.status === 'valid'" color="success">
        {{ jsonState.text }}
      </Tag>
      <Tag v-else-if="jsonState.status === 'plain'" color="warning">
        {{ jsonState.text }}
      </Tag>
      <Tag v-else>
        {{ jsonState.text }}
      </Tag>
    </div>
    <Input.TextArea
      :auto-size="textAreaAutoSize"
      :disabled="disabled"
      :placeholder="editorPlaceholder"
      :readonly="readonly"
      :value="innerValue"
      class="font-mono text-sm"
      @update:value="syncValue"
    />
  </div>
</template>
