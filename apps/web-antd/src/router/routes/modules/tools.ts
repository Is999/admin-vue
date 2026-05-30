import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  CRON_ROUTE_PERMISSION_CODES,
  SYSTEM_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// routes 定义项目工具类页面，仅保留接口文档与安全调试台，删除 Vben 示例外链。
const routes: RouteRecordRaw[] = [
  {
    path: '/tools',
    name: 'AdminCronTools',
    meta: {
      authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.PROJECT_DIR),
      icon: 'lucide:wrench',
      order: 1200,
      title: $t('cron.route.tools'),
    },
    children: [
      {
        path: '/tools/api-docs',
        alias: '/cron-admin/api-docs',
        name: 'CronApiDocs',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.API_DOCS),
          icon: 'lucide:book-open-text',
          title: $t('cron.route.apiDocs'),
        },
        component: () => import('#/views/tools/api-docs/index.vue'),
      },
      {
        path: '/tools/security-debug',
        alias: '/system/security-debug',
        name: 'SystemSecurityDebug',
        meta: {
          authority: asRouteAuthority(
            SYSTEM_ROUTE_PERMISSION_CODES.SECURITY_DEBUG_INDEX,
          ),
          icon: 'ant-design:safety-outlined',
          title: $t('cron.route.securityDebug'),
        },
        component: () => import('#/views/system/security-debug/index.vue'),
      },
    ],
  },
];

export default routes;
