<script lang="ts" setup>
import type { SystemPermissionApi } from '#/api/system';

import { computed } from 'vue';

import { Tabs } from 'ant-design-vue';

import { $t } from '#/locales';

import PermissionTreePanel from './permission-tree-panel.vue';

interface Props {
  canWrite: boolean;
  docPermissionIds: number[];
  docTree: SystemPermissionApi.Item[];
  idPrefix: string;
  readOnlyDescription?: string;
  routePermissionIds: number[];
  routeTree: SystemPermissionApi.Item[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:docPermissionIds': [value: number[]];
  'update:routePermissionIds': [value: number[]];
}>();

const routePermissionIds = computed({
  get: () => props.routePermissionIds,
  set: (value: number[]) => emit('update:routePermissionIds', value),
});
const docPermissionIds = computed({
  get: () => props.docPermissionIds,
  set: (value: number[]) => emit('update:docPermissionIds', value),
});
</script>

<template>
  <Tabs>
    <Tabs.TabPane key="route" :tab="$t('business.message.routePermissions')">
      <PermissionTreePanel
        v-model="routePermissionIds"
        :can-write="canWrite"
        :id-prefix="`${idPrefix}-route`"
        :read-only-description="readOnlyDescription"
        :title="$t('business.message.routePermissions')"
        :tree-data="routeTree"
      />
    </Tabs.TabPane>
    <Tabs.TabPane key="doc" :tab="$t('business.message.docPermissions')">
      <PermissionTreePanel
        v-model="docPermissionIds"
        :can-write="canWrite"
        :id-prefix="`${idPrefix}-doc`"
        :read-only-description="readOnlyDescription"
        :search-placeholder="$t('business.message.searchDocPermissionKeyword')"
        :show-type-filter="false"
        :title="$t('business.message.docPermissions')"
        :tree-data="docTree"
      />
    </Tabs.TabPane>
  </Tabs>
</template>
