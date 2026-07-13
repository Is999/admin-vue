<script lang="ts" setup>
import { Slot } from 'reka-ui';

import { useFormField } from './useFormField';

const props = defineProps<{ isControlGroup?: boolean }>();
const { error, formDescriptionId, formItemId, formMessageId } = useFormField();
</script>

<template>
  <Slot
    :id="formItemId"
    :aria-describedby="
      !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
    "
    :aria-invalid="!!error"
    :aria-labelledby="props.isControlGroup ? `${formItemId}-label` : undefined"
  >
    <slot></slot>
  </Slot>
</template>
