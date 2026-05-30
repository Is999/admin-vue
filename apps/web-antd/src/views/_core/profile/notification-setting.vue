<script setup lang="ts">
import { computed } from 'vue';

import { ProfileNotificationSetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => {
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('business.message.accountPassword'),
      description: $t('business.message.accountPasswordNoticeDesc'),
    },
    {
      value: true,
      fieldName: 'systemMessage',
      label: $t('business.message.systemMessage'),
      description: $t('business.message.systemMessageNoticeDesc'),
    },
    {
      value: true,
      fieldName: 'todoTask',
      label: $t('business.message.todoTask'),
      description: $t('business.message.todoTaskNoticeDesc'),
    },
  ];
});
</script>
<template>
  <ProfileNotificationSetting :form-schema="formSchema" />
</template>
