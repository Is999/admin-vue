<script lang="ts" setup>
import { computed } from 'vue';

const appID = computed(() =>
  String(import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '').trim(),
);
</script>

<template>
  <span
    v-if="appID"
    class="inline-flex flex-none text-xs font-semibold leading-none text-primary/80"
  >
    {{ appID }}
  </span>
</template>
