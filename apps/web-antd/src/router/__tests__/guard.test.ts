import type { RouteRecordRaw } from 'vue-router';

import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { APP_DEFAULT_HOME_PATH } from '#/constants/app';

import { resolveAccessibleRedirectPath } from '../guard';

// EmptyComponent 表示路由测试用的空组件，避免引入真实页面组件和异步加载副作用。
const EmptyComponent = {
  render() {
    return null;
  },
};

// createTestRouter 构造最小路由实例，用于验证登录回跳路径是否会落入 404。
function createTestRouter(extraRoutes: RouteRecordRaw[] = []) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: APP_DEFAULT_HOME_PATH,
        name: 'SystemProfile',
        component: EmptyComponent,
      },
      ...extraRoutes,
      {
        path: '/:path(.*)*',
        name: 'FallbackNotFound',
        component: EmptyComponent,
      },
    ],
  });
}

describe('router access guard redirect resolver', () => {
  it('falls back to profile page when cached redirect points to an inaccessible page', () => {
    const router = createTestRouter();

    // 旧偏好或登录前访问无权限菜单时可能带入任务中心回跳，这里必须降级到个人信息页。
    expect(
      resolveAccessibleRedirectPath(
        router,
        encodeURIComponent('/cron-admin/task-console'),
      ),
    ).toBe(APP_DEFAULT_HOME_PATH);
  });

  it('keeps accessible redirect paths after dynamic routes are registered', () => {
    const router = createTestRouter([
      {
        path: '/cron-admin/task-console',
        name: 'CronTaskConsole',
        component: EmptyComponent,
      },
    ]);

    // 已注册且有权限的深链仍然保留，避免影响用户从登录页进入目标业务页面。
    expect(
      resolveAccessibleRedirectPath(
        router,
        '/cron-admin/task-console?tab=running',
      ),
    ).toBe('/cron-admin/task-console?tab=running');
  });
});
