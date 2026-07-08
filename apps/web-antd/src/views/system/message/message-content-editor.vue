<script setup lang="ts">
import { useId } from 'vue';

import { VbenTiptap } from '@vben/plugins/tiptap';

defineOptions({ inheritAttrs: false });

defineProps<{
  disabled?: boolean;
  label: string;
  maxHeight?: number;
  minHeight?: number;
  modelValue?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const labelId = useId();
</script>

<template>
  <div
    v-bind="$attrs"
    role="group"
    :aria-labelledby="labelId"
    aria-required="true"
    class="flex min-w-0 w-full items-start"
  >
    <div
      :id="labelId"
      class="mr-2 flex w-24 shrink-0 justify-end text-sm font-medium leading-6"
    >
      <span class="text-destructive mr-1" aria-hidden="true">*</span>
      {{ label }}:
    </div>
    <VbenTiptap
      :aria-label="label"
      :disabled="disabled"
      :max-height="maxHeight"
      :min-height="minHeight"
      :model-value="modelValue"
      :placeholder="placeholder"
      class="min-w-0 flex-1"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
