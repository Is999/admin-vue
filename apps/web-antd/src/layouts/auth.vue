<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';

import { $t } from '#/locales';

import AppIdBadge from './components/app-id-badge.vue';

const { isDark } = usePreferences();
const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const logoDark = computed(() => preferences.logo.sourceDark);
const logoSrc = computed(() => {
  return isDark.value && logoDark.value ? logoDark.value : logo.value;
});
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :logo="logo"
    :logo-dark="logoDark"
    :page-description="$t('authentication.pageDesc')"
    :page-title="$t('authentication.pageTitle')"
  >
    <template #logo>
      <div
        v-if="logoSrc || appName"
        class="absolute left-0 top-0 z-10 flex flex-1"
      >
        <div
          class="ml-4 mt-4 flex min-w-0 flex-1 items-center gap-2 text-foreground sm:left-6 sm:top-6"
        >
          <img
            v-if="logoSrc"
            :key="logoSrc"
            :alt="appName"
            :src="logoSrc"
            class="flex-none"
            width="42"
          />
          <div class="flex min-w-0 items-baseline gap-1.5">
            <p v-if="appName" class="m-0 truncate text-xl font-medium">
              {{ appName }}
            </p>
            <AppIdBadge />
          </div>
        </div>
      </div>
    </template>
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
