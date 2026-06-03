import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  CRON_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// routes 定义 cron 管理后台的静态路由，供本地联调和运维操作使用。
const routes: RouteRecordRaw[] = [
  {
    path: '/cron-admin',
    name: 'CronAdmin',
    meta: {
      authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.CRON_ADMIN),
      icon: 'ant-design:deployment-unit-outlined',
      keepAlive: true,
      order: 1100,
      title: $t('cron.route.cronAdmin'),
    },
    children: [
      {
        path: '/cron-admin/collector',
        name: 'CronCollector',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.COLLECTOR),
          icon: 'ant-design:database-outlined',
          title: $t('cron.route.collector'),
        },
        component: () => import('#/views/cron/collector/list.vue'),
      },
      {
        path: '/cron-admin/task-console',
        name: 'CronTaskConsole',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.TASK_CONSOLE),
          icon: 'ant-design:control-outlined',
          title: $t('cron.route.taskConsole'),
        },
        component: () => import('#/views/cron/task-console/index.vue'),
      },
      {
        path: '/cron-admin/task-workflow-status',
        name: 'CronTaskWorkflowStatus',
        meta: {
          authority: asRouteAuthority(
            CRON_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
          ),
          icon: 'ant-design:branches-outlined',
          title: $t('cron.route.taskWorkflowStatus'),
        },
        component: () => import('#/views/cron/task-workflow-status/index.vue'),
      },
      {
        path: '/cron-admin/config-reload',
        name: 'CronConfigReload',
        meta: {
          authority: asRouteAuthority(
            CRON_ROUTE_PERMISSION_CODES.CONFIG_RELOAD,
          ),
          icon: 'ant-design:reload-outlined',
          title: $t('cron.route.configReload'),
        },
        component: () => import('#/views/cron/config-reload/index.vue'),
      },
      {
        path: '/cron-admin/task-queue',
        name: 'CronTaskQueue',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.TASK_QUEUE),
          icon: 'ant-design:database-outlined',
          title: $t('cron.route.taskQueue'),
        },
        component: () => import('#/views/cron/task-queue/list.vue'),
      },
      {
        path: '/cron-admin/task-item',
        name: 'CronTaskItem',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.TASK_ITEM),
          icon: 'ant-design:unordered-list-outlined',
          title: $t('cron.route.taskItem'),
        },
        component: () => import('#/views/cron/task-item/list.vue'),
      },
      {
        path: '/cron-admin/user-tag',
        name: 'CronUserTag',
        meta: {
          authority: asRouteAuthority(CRON_ROUTE_PERMISSION_CODES.USER_TAG),
          icon: 'ant-design:tags-outlined',
          title: $t('cron.route.userTag'),
        },
        component: () => import('#/views/cron/user-tag/index.vue'),
      },
    ],
  },
];

export default routes;
