import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  OPS_ROUTE_PERMISSION_CODES,
  SYSTEM_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// routes 定义项目工具类页面，统一承载接口文档与安全调试台。
const routes: RouteRecordRaw[] = [
  {
    path: '/tools',
    name: 'AdminTools',
    meta: {
      authority: asRouteAuthority(SYSTEM_ROUTE_PERMISSION_CODES.PROJECT_DIR),
      icon: 'lucide:wrench',
      order: 1200,
      title: $t('admin.route.tools'),
    },
    children: [
      {
        path: '/tools/api-docs',
        name: 'OpsApiDocs',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.API_DOCS),
          icon: 'lucide:book-open-text',
          title: $t('admin.route.apiDocs'),
        },
        props: {
          docsHash: '/',
          titleKey: 'admin.route.apiDocs',
        },
        component: () => import('#/views/tools/api-docs/index.vue'),
      },
      {
        path: '/tools/api-service-docs',
        name: 'OpsApiServiceDocs',
        meta: {
          authority: asRouteAuthority(
            OPS_ROUTE_PERMISSION_CODES.API_SERVICE_DOCS,
          ),
          icon: 'lucide:file-code-2',
          title: $t('admin.route.apiServiceDocs'),
        },
        props: {
          docsHash: '/api/接口文档/接口文档统一规范',
          titleKey: 'admin.route.apiServiceDocs',
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
          title: $t('admin.route.securityDebug'),
        },
        component: () => import('#/views/system/security-debug/index.vue'),
      },
    ],
  },
];

export default routes;
