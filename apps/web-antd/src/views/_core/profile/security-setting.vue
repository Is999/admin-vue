<script setup lang="ts">
import { computed } from 'vue';

import { ProfileSecuritySetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => {
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('business.message.accountPassword'),
      description: $t('business.message.passwordStrengthStrong'),
    },
    {
      value: true,
      fieldName: 'securityPhone',
      label: $t('business.message.securityPhone'),
      description: $t('business.message.securityPhoneBound'),
    },
    {
      value: true,
      fieldName: 'securityQuestion',
      label: $t('business.message.securityQuestion'),
      description: $t('business.message.securityQuestionUnset'),
    },
    {
      value: true,
      fieldName: 'securityEmail',
      label: $t('business.message.securityEmail'),
      description: $t('business.message.securityEmailBound'),
    },
    {
      value: false,
      fieldName: 'securityMfa',
      label: $t('business.message.mfaDevice'),
      description: $t('business.message.mfaDeviceUnboundDesc'),
    },
  ];
});
</script>
<template>
  <ProfileSecuritySetting :form-schema="formSchema" />
</template>
