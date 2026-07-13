import type { CommonApi } from '#/api/common';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';

// showCacheSyncResult 按后端缓存同步状态展示提交结果，避免待同步操作被固定成功提示覆盖。
export function showCacheSyncResult(
  result: null | Partial<CommonApi.CacheSyncResp> | undefined,
  successMessage: string,
) {
  if (result?.syncPending) {
    message.warning($t('business.message.cacheSyncPendingWarning'));
    return;
  }
  message.success(successMessage);
}
