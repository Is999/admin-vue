<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { SystemSecretKeyApi } from '#/api/system';

import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, VbenButton } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  fetchSecretKeyList,
  renewSecretKeyCache,
  selfCheckSecretKey,
  updateSecretKeyStatus,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  buildSecretKeyCacheTargets,
  buildSecretKeyCacheTemplateKeys,
  openSystemCachePage,
} from '#/utils/cache/navigation';
import { showCacheSyncResult } from '#/utils/cache/sync';
import { submitWithMfaRetry, ticketPayload } from '#/utils/security/mfa';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// MFA_SCENARIO_SECRET_KEY_MANAGE 表示秘钥管理二次校验场景。
const MFA_SCENARIO_SECRET_KEY_MANAGE = 11;
// router 用于跳转缓存管理页定位秘钥缓存实例。
const router = useRouter();

// ================= 抽屉表单配置 =================
// FormDrawer 用于新增和编辑秘钥。
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// ================= 表格配置 =================
// Grid 使用 VbenVxeGrid 承载秘钥列表和缓存刷新操作。
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: {
      formItemClass: 'col-span-1',
    },
    schema: useGridFormSchema(),
    submitOnChange: false,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        // 查询秘钥配置列表，并对齐后端 page/pageSize 参数。
        query: async ({ page }: { page: any }, formValues: any) => {
          return await fetchSecretKeyList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
      response: {
        result: 'list',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});

// onActionClick 处理秘钥操作列事件。
function onActionClick(e: OnActionClickParams<SystemSecretKeyApi.Item>) {
  switch (e.code) {
    case 'cache': {
      onOpenSecretKeyCache(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'renew': {
      onRenew(e.row);
      break;
    }
    case 'self-check': {
      onSelfCheck(e.row);
      break;
    }
  }
}

// onCreate 打开新增秘钥抽屉。
function onCreate() {
  formDrawerApi.setData({}).open();
}

// onEdit 打开编辑秘钥抽屉。
function onEdit(row: SystemSecretKeyApi.Item) {
  formDrawerApi.setData(row).open();
}

// onRefresh 刷新秘钥列表。
function onRefresh() {
  gridApi.query();
}

// onOpenSecretKeyCache 跳转缓存管理页并定位当前秘钥的 AES/RSA 模板缓存实例。
async function onOpenSecretKeyCache(row: SystemSecretKeyApi.Item) {
  await openSystemCachePage(router, {
    source: $t('business.message.secretCacheSource', [row.uuid]),
    templateKeys: buildSecretKeyCacheTemplateKeys(),
    targets: buildSecretKeyCacheTargets(row.uuid, {
      grayVersion: row.grayVersion,
      stableVersion: row.stableVersion,
      versionList: (row.versionList || []).map((item) => item.keyVersion),
    }),
  });
}

// onStatusChange 修改秘钥启用状态。
async function onStatusChange(newStatus: number, row: SystemSecretKeyApi.Item) {
  const statusText: Record<number, string> = {
    0: $t('business.message.disable'),
    1: $t('business.message.enable'),
  };
  try {
    await confirm(
      $t('business.message.confirmSwitchSecretStatus', [
        row.title,
        statusText[newStatus],
      ]),
      $t('business.message.switchSecretStatus'),
    );
    const cacheSyncResult = await submitWithMfaRetry(
      MFA_SCENARIO_SECRET_KEY_MANAGE,
      (ticket) =>
        updateSecretKeyStatus(
          row.id,
          newStatus as SystemSecretKeyApi.Status,
          ticketPayload(ticket),
        ),
      $t('business.message.switchSecretStatusMfaTitle'),
    );
    showCacheSyncResult(
      cacheSyncResult,
      $t('business.message.secretStatusUpdated'),
    );
    return true;
  } catch {
    return false;
  }
}

// onRenew 刷新指定秘钥缓存。
function onRenew(row: SystemSecretKeyApi.Item) {
  Modal.confirm({
    content: $t('business.message.confirmRenewSecretCache', [row.uuid]),
    onOk: async () => {
      await submitWithMfaRetry(
        MFA_SCENARIO_SECRET_KEY_MANAGE,
        (ticket) => renewSecretKeyCache(row.uuid, ticketPayload(ticket)),
        $t('business.message.renewSecretCacheMfaTitle'),
      );
      message.success($t('business.message.secretCacheRefreshed'));
      onRefresh();
    },
    title: $t('business.message.renewSecretCache'),
  });
}

// onSelfCheck 执行指定秘钥的运行态自检。
function onSelfCheck(row: SystemSecretKeyApi.Item) {
  Modal.confirm({
    content: $t('business.message.confirmSecretRuntimeSelfCheck', [row.uuid]),
    onOk: async () => {
      const result = await submitWithMfaRetry(
        MFA_SCENARIO_SECRET_KEY_MANAGE,
        (ticket) =>
          selfCheckSecretKey(row.uuid, {
            keyVersion: row.keyVersion,
            ...ticketPayload(ticket),
          }),
        $t('business.message.secretSelfCheckMfaTitle'),
      );
      message.success(
        result.allPassed
          ? $t('business.message.secretSelfCheckPassed')
          : $t('business.message.secretSelfCheckCompleted'),
      );
      formDrawerApi
        .setData({
          ...row,
          initialCheckResult: result,
        })
        .open();
    },
    title: $t('business.message.secretRunSelfCheck'),
  });
}

// confirm 封装通用确认弹窗。
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error($t('business.message.cancelled')));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('business.message.secretKeyManagement')">
      <template #toolbar-tools>
        <VbenButton
          v-access="
            asActionPermission(SYSTEM_ACTION_PERMISSION_CODES.SECRET_KEY_ADD)
          "
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" /> {{ $t('business.message.addSecretKey') }}
        </VbenButton>
      </template>
    </Grid>
  </Page>
</template>
