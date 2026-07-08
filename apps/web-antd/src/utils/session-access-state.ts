import type { Router } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/stores';
import { resetStaticRoutes } from '@vben/utils';

import { routes } from '#/router/routes';

// resetSessionAccessState 清除旧账号权限、资料与动态路由，避免账号切换后复用旧可见状态。
export function resetSessionAccessState(router: Router) {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  resetStaticRoutes(router, routes);
  accessStore.setAccessCodes([]);
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(false);
  accessStore.setRefreshToken(null);
  userStore.setUserInfo(null);
}
