import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  OPS_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// routes 定义任务运维静态路由，供本地联调和运维操作使用。
const routes: RouteRecordRaw[] = [
  {
    path: '/ops',
    name: 'OpsHome',
    meta: {
      authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.HOME),
      icon: 'ant-design:deployment-unit-outlined',
      keepAlive: true,
      order: 1100,
      title: $t('admin.route.workbench'),
    },
    children: [
      {
        path: '/ops/collector',
        name: 'OpsCollector',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.COLLECTOR),
          icon: 'ant-design:database-outlined',
          title: $t('admin.route.collector'),
        },
        component: () => import('#/views/ops/collector/list.vue'),
      },
      {
        path: '/ops/task-console',
        name: 'OpsTaskConsole',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.TASK_CONSOLE),
          icon: 'ant-design:control-outlined',
          title: $t('admin.route.taskConsole'),
        },
        component: () => import('#/views/ops/task-console/index.vue'),
      },
      {
        path: '/ops/task-workflow-status',
        name: 'OpsWorkflowStatus',
        meta: {
          authority: asRouteAuthority(
            OPS_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
          ),
          icon: 'ant-design:branches-outlined',
          title: $t('admin.route.taskWorkflowStatus'),
        },
        component: () => import('#/views/ops/task-workflow-status/index.vue'),
      },
      {
        path: '/ops/config-reload',
        name: 'OpsConfigReload',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.CONFIG_RELOAD),
          icon: 'ant-design:reload-outlined',
          title: $t('admin.route.configReload'),
        },
        component: () => import('#/views/ops/config-reload/index.vue'),
      },
      {
        path: '/ops/runtime-config',
        name: 'OpsRuntimeConfig',
        meta: {
          authority: asRouteAuthority(
            OPS_ROUTE_PERMISSION_CODES.RUNTIME_CONFIG,
          ),
          icon: 'ant-design:setting-outlined',
          title: $t('admin.route.runtimeConfig'),
        },
        component: () => import('#/views/ops/runtime-config/index.vue'),
      },
      {
        path: '/ops/task-queue',
        name: 'OpsTaskQueue',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.TASK_QUEUE),
          icon: 'ant-design:database-outlined',
          title: $t('admin.route.taskQueue'),
        },
        component: () => import('#/views/ops/task-queue/list.vue'),
      },
      {
        path: '/ops/task-item',
        name: 'OpsTaskItem',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.TASK_ITEM),
          icon: 'ant-design:unordered-list-outlined',
          title: $t('admin.route.taskItem'),
        },
        component: () => import('#/views/ops/task-item/list.vue'),
      },
      {
        path: '/ops/user-tag',
        name: 'OpsUserTag',
        meta: {
          authority: asRouteAuthority(OPS_ROUTE_PERMISSION_CODES.USER_TAG),
          icon: 'ant-design:tags-outlined',
          title: $t('admin.route.userTag'),
        },
        component: () => import('#/views/ops/user-tag/index.vue'),
      },
    ],
  },
];

export default routes;
