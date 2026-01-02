import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/tg-group',
    name: 'TgGroup',
    meta: {
      icon: 'ant-design:team-outlined',
      order: 1202,
      title: 'TG群组管理',
    },
    children: [
      {
        path: '/tg-group/list',
        name: 'TgGroupList',
        meta: {
          icon: 'ant-design:team-outlined',
          title: '群组列表',
        },
        component: () => import('#/views/telegram/group/list.vue'),
      },
      {
        path: '/tg-group/bot-keyword-config',
        name: 'TgGroupBotKeywordConfig',
        meta: {
          icon: 'ant-design:robot-outlined',
          title: '群组机器人关键词配置',
        },
        component: () =>
          import('#/views/telegram/group-bot-keyword-config/list.vue'),
      },
      {
        path: '/tg-group/config',
        name: 'TgGroupConfig',
        meta: {
          icon: 'ant-design:setting-outlined',
          title: '群组配置',
        },
        component: () => import('#/views/telegram/group-config/config.vue'),
      },
    ],
  },
];

export default routes;
