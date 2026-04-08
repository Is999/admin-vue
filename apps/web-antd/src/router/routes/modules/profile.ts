import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

// routes 定义个人中心目录，不限制权限，所有登录用户均可见。
const routes: RouteRecordRaw[] = [
  {
    path: '/profile-manage',
    name: 'ProfileManage',
    redirect: '/profile-manage/index',
    meta: {
      icon: 'ant-design:idcard-outlined',
      keepAlive: true,
      order: 900,
      title: $t('cron.route.profileManage'),
    },
    children: [
      {
        path: '/profile-manage/index',
        name: 'SystemProfile',
        meta: {
          icon: 'ant-design:user-outlined',
          title: $t('cron.route.profile'),
        },
        component: () => import('#/views/system/profile/index.vue'),
      },
      {
        path: '/profile-manage/message',
        name: 'ProfileMessage',
        meta: {
          icon: 'ant-design:bell-outlined',
          title: $t('cron.route.message'),
        },
        component: () => import('#/views/system/message/list.vue'),
      },
      {
        path: '/profile-manage/mfa',
        name: 'SystemMfa',
        meta: {
          icon: 'ant-design:qrcode-outlined',
          title: $t('cron.route.mfa'),
        },
        component: () => import('#/views/system/mfa/index.vue'),
      },
    ],
  },
];

export default routes;
