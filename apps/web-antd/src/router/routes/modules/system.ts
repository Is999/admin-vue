import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  SYSTEM_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  ADMIN_IP_WHITELIST_PATH,
  ADMIN_IP_WHITELIST_ROUTE,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
} from '#/views/system/config/editors/registry';

// routes 定义后台系统管理路由，权限码由后端 /auth/codes 控制。
const routes: RouteRecordRaw[] = [
  {
    path: '/system',
    name: 'SystemManage',
    meta: {
      authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_MANAGE),
      icon: 'ant-design:setting-outlined',
      keepAlive: true,
      order: 1000,
      title: $t('admin.route.systemManage'),
    },
    children: [
      {
        path: '/system/admin',
        name: 'SystemAdmin',
        meta: {
          authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.ADMIN_LIST),
          icon: 'ant-design:user-outlined',
          title: $t('admin.route.admin'),
        },
        component: () => import('#/views/system/admin/list.vue'),
      },
      {
        path: '/system/role',
        name: 'SystemRole',
        meta: {
          authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.ROLE_LIST),
          icon: 'ant-design:team-outlined',
          title: $t('admin.route.role'),
        },
        component: () => import('#/views/system/role/list.vue'),
      },
      {
        path: '/system/permission',
        name: 'SystemPermission',
        meta: {
          authority: asRouteAuthority(
            SYSTEM_ROUTE_PERMISSION_CODES.PERMISSION_LIST,
          ),
          icon: 'ant-design:safety-certificate-outlined',
          title: $t('admin.route.permission'),
        },
        component: () => import('#/views/system/permission/list.vue'),
      },
      {
        path: '/system/config',
        name: 'SystemConfig',
        meta: {
          authority: asRouteAuthority(
            SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_CONFIG_LIST,
          ),
          icon: 'ant-design:control-outlined',
          title: $t('admin.route.config'),
        },
        component: () => import('#/views/system/config/list.vue'),
      },
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
        component: () =>
          import('#/views/system/config/editors/admin-ip-whitelist.vue'),
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
        component: () =>
          import('#/views/system/config/editors/admin-disable-mfa-check-scenario.vue'),
      },
      {
        path: '/system/cache',
        name: 'SystemCache',
        meta: {
          authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.CACHE_LIST),
          icon: 'ant-design:thunderbolt-outlined',
          title: $t('admin.route.cache'),
        },
        component: () => import('#/views/system/cache/list.vue'),
      },
      {
        path: '/system/log',
        name: 'SystemLog',
        meta: {
          authority: asRouteAuthority(
            SYSTEM_ROUTE_PERMISSION_CODES.ADMIN_LOG_QUERY,
          ),
          icon: 'ant-design:profile-outlined',
          title: $t('admin.route.log'),
        },
        component: () => import('#/views/system/log/list.vue'),
      },
      {
        path: '/system/secret-key',
        name: 'SystemSecretKey',
        meta: {
          authority: asRouteAuthority(
            SYSTEM_ROUTE_PERMISSION_CODES.SECRET_KEY_INDEX,
          ),
          icon: 'ant-design:key-outlined',
          title: $t('admin.route.secretKey'),
        },
        component: () => import('#/views/system/secret-key/list.vue'),
      },
    ],
  },
];

export default routes;
