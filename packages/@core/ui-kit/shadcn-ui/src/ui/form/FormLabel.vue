<script lang="ts" setup>
import type { LabelProps } from 'reka-ui';

import { cn } from '@vben-core/shared/utils';

import { Label } from '../label';
import { useFormField } from './useFormField';

const props = defineProps<
  LabelProps & { class?: any; isControlGroup?: boolean }
>();

const { formItemId } = useFormField();
</script>

<template>
  <Label
    :as="props.isControlGroup ? 'span' : undefined"
    :class="cn(props.class)"
    :for="props.isControlGroup ? undefined : formItemId"
    :id="props.isControlGroup ? `${formItemId}-label` : undefined"
  >
    <slot></slot>
  </Label>
</template>
