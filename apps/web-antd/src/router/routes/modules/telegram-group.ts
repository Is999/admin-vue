import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/tgGroupManagement',
    name: 'TgGroupManagement',
    meta: {
      icon: 'ant-design:team-outlined',
      order: 1202,
      title: 'TG群组管理',
    },
    children: [
      {
        path: '/tgGroup',
        name: 'TelegramGroup',
        meta: {
          icon: 'ant-design:team-outlined',
          title: '群组列表',
        },
        component: () => import('#/views/telegram/group/list.vue'),
      },
    ],
  },
];

export default routes;
