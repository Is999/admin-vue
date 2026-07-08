import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  SYSTEM_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
  ADMIN_IP_WHITELIST_PATH,
  ADMIN_IP_WHITELIST_ROUTE,
} from './registry';

// configEditorRoutes 集中维护复杂字典隐藏编辑页路由，避免系统路由文件继续膨胀。
export const configEditorRoutes: RouteRecordRaw[] = [
  {
    path: ADMIN_IP_WHITELIST_PATH,
    name: ADMIN_IP_WHITELIST_ROUTE,
    meta: {
      authority: asRouteAuthority(
        SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_CONFIG_LIST,
      ),
      hideInMenu: true,
      title: $t('business.message.adminIpWhitelistEditorTitle'),
    },
    component: () => import('./admin-ip-whitelist.vue'),
  },
  {
    path: ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
    name: ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
    meta: {
      authority: asRouteAuthority(
        SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_CONFIG_LIST,
      ),
      hideInMenu: true,
      title: $t('business.message.mfaScenarioEditorTitle'),
    },
    component: () => import('./admin-disable-mfa-check-scenario.vue'),
  },
];
