import type { RouteRecordRaw } from 'vue-router';

// 如有国际化需求可引入 $t
// import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    path: '/tg-account',
    name: 'TgAccount',
    meta: {
      icon: 'ant-design:user-outlined',
      keepAlive: true,
      order: 1000,
      title: 'TG账号管理', // 如需国际化可用 $t('telegram.title')
    },
    children: [
      {
        path: '/tg-account/list',
        name: 'TgAccountList',
        meta: {
          icon: 'ant-design:user-outlined',
          title: '账号列表', // 如需国际化可用 $t('telegram.account.title')
        },
        component: () => import('#/views/telegram/account/list.vue'),
      },
      {
        path: '/tg-account/keyword-config',
        name: 'TgAccountKeywordConfig',
        meta: {
          icon: 'ant-design:key-outlined',
          title: '关键词配置',
        },
        component: () =>
          import('#/views/telegram/account-keyword-config/list.vue'),
      },
      {
        path: '/tg-account/config',
        name: 'TgAccountConfi',
        meta: {
          icon: 'ant-design:setting-outlined',
          title: '账号配置',
        },
        component: () => import('#/views/telegram/account-config/config.vue'),
      },
      {
        path: '/tg-account/ai-prompt-template',
        name: 'AiPromptTemplate',
        meta: {
          icon: 'ant-design:bulb-outlined',
          title: 'AI提示词模板',
        },
        component: () => import('#/views/telegram/ai-prompt-template/list.vue'),
      },
      {
        path: '/tg-account/group-rel',
        name: 'TgAccountGroupRel',
        meta: {
          icon: 'ant-design:link-outlined',
          title: '账号-群组关系',
        },
        component: () => import('#/views/telegram/account-group-rel/list.vue'),
      },
      {
        path: '/tg-account/keyword-config-rel',
        name: 'TgAccountKeywordConfigRel',
        meta: {
          icon: 'ant-design:link-outlined',
          title: '账号-关键词关系',
        },
        component: () =>
          import('#/views/telegram/account-keyword-config-rel/list.vue'),
      },
      // 预留后续子路由
    ],
  },
];

export default routes;
