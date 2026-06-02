import type { RouteRecordRaw } from 'vue-router';

import {
  asRouteAuthority,
  USER_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

// routes 定义用户管理路由，用户列表从系统管理目录中独立出来。
const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'UserManage',
    meta: {
      authority: asRouteAuthority(USER_ROUTE_PERMISSION_CODES.USER_MANAGE),
      icon: 'ant-design:team-outlined',
      keepAlive: true,
      order: 1050,
      title: $t('admin.route.userManage'),
    },
    children: [
      {
        path: '/user/list',
        name: 'UserList',
        meta: {
          authority: asRouteAuthority(USER_ROUTE_PERMISSION_CODES.USER_LIST),
          icon: 'ant-design:idcard-outlined',
          title: $t('admin.route.userList'),
        },
        component: () => import('#/views/user/list.vue'),
      },
    ],
  },
];

export default routes;
