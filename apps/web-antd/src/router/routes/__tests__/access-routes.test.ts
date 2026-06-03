import { describe, expect, it } from 'vitest';

import { APP_DEFAULT_HOME_PATH } from '#/constants/app';
import { CRON_ROUTE_PERMISSION_CODES } from '#/constants/permission-codes';
import { overridesPreferences } from '#/preferences';

import { coreRoutes } from '../core';
import { accessRoutes } from '../index';

// collectRouteNames 收集路由名称，便于断言生产路由没有漂移。
function collectRouteNames(routes: typeof accessRoutes) {
  // names 保存全部路由名称，包含父级菜单和子页面。
  const names: string[] = [];
  // visit 递归遍历路由树，覆盖多级菜单结构。
  const visit = (items: typeof accessRoutes) => {
    for (const route of items) {
      if (route.name) {
        names.push(String(route.name));
      }
      if (route.children?.length) {
        visit(route.children);
      }
    }
  };
  visit(routes);
  return names;
}

// collectRoutePaths 收集路由路径，便于断言核心页面入口完整。
function collectRoutePaths(routes: typeof accessRoutes) {
  // paths 保存全部路由 path，包含父级菜单和子页面。
  const paths: string[] = [];
  // visit 递归遍历路由树，避免新增多级路由时漏检。
  const visit = (items: typeof accessRoutes) => {
    for (const route of items) {
      paths.push(route.path);
      if (route.children?.length) {
        visit(route.children);
      }
    }
  };
  visit(routes);
  return paths;
}

// findRouteByName 按路由名称查找节点，便于校验菜单权限码不会误复用其它页面。
function findRouteByName(routes: typeof accessRoutes, name: string) {
  // visit 递归遍历静态路由树，覆盖 cron 子菜单挂在父级下的场景。
  const visit = (
    items: typeof accessRoutes,
  ): (typeof accessRoutes)[number] | null => {
    for (const route of items) {
      if (route.name === name) {
        return route;
      }
      if (route.children?.length) {
        const child = visit(route.children);
        if (child) {
          return child;
        }
      }
    }
    return null;
  };
  return visit(routes);
}

describe('admin-cron access routes', () => {
  it('keeps production route modules focused and unique', () => {
    const names = collectRouteNames(accessRoutes);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'AdminCronTools',
        'CronAdmin',
        'CronApiDocs',
        'CronConfigReload',
        'CronCollector',
        'CronTaskConsole',
        'CronTaskItem',
        'CronTaskQueue',
        'CronTaskWorkflowStatus',
        'CronUserTag',
        'ProfileManage',
        'ProfileMessage',
        'SystemAdmin',
        'SystemCache',
        'SystemConfig',
        'SystemLog',
        'SystemManage',
        'SystemMfa',
        'SystemPermission',
        'SystemProfile',
        'SystemRole',
        'SystemSecretKey',
        'SystemSecurityDebug',
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        'Analytics',
        'Demos',
        'TgAccount',
        'TgGroup',
        'VbenProject',
      ]),
    );
  });

  it('keeps all cron and system entry paths available', () => {
    const paths = collectRoutePaths(accessRoutes);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/cron-admin',
        '/cron-admin/config-reload',
        '/cron-admin/collector',
        '/cron-admin/task-console',
        '/cron-admin/task-item',
        '/cron-admin/task-queue',
        '/cron-admin/task-workflow-status',
        '/cron-admin/user-tag',
        '/profile-manage',
        '/profile-manage/index',
        '/profile-manage/message',
        '/profile-manage/mfa',
        '/system',
        '/system/admin',
        '/system/cache',
        '/system/config',
        '/system/log',
        '/system/permission',
        '/system/role',
        '/system/secret-key',
        '/tools',
        '/tools/api-docs',
        '/tools/security-debug',
      ]),
    );
  });

  it('keeps project tool children under the tool directory menu', () => {
    const toolsRoute = findRouteByName(accessRoutes, 'AdminCronTools');
    const childPaths = (toolsRoute?.children || []).map((route) => route.path);
    const apiDocsRoute = findRouteByName(accessRoutes, 'CronApiDocs');
    const securityDebugRoute = findRouteByName(
      accessRoutes,
      'SystemSecurityDebug',
    );

    expect(childPaths).toEqual(
      expect.arrayContaining(['/tools/api-docs', '/tools/security-debug']),
    );
    expect(apiDocsRoute?.alias).toBe('/cron-admin/api-docs');
    expect(securityDebugRoute?.alias).toBe('/system/security-debug');
  });

  it('uses profile information page as login home', () => {
    const paths = collectRoutePaths(accessRoutes);
    const rootRoute = coreRoutes.find((route) => route.path === '/');

    // defaultHomePath 是登录成功后的兜底首页，必须指向所有登录用户均可访问的个人信息页。
    expect(APP_DEFAULT_HOME_PATH).toBe('/profile-manage/index');
    expect(overridesPreferences.app?.defaultHomePath).toBe(
      APP_DEFAULT_HOME_PATH,
    );
    expect(paths).toContain(overridesPreferences.app?.defaultHomePath);
    expect(rootRoute?.redirect).toBe(APP_DEFAULT_HOME_PATH);
  });

  it('keeps split cron tools on independent menu permissions', () => {
    const workflowStatusRoute = findRouteByName(
      accessRoutes,
      'CronTaskWorkflowStatus',
    );
    const configReloadRoute = findRouteByName(accessRoutes, 'CronConfigReload');

    expect(workflowStatusRoute?.meta?.authority).toEqual([
      CRON_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]);
    expect(configReloadRoute?.meta?.authority).toEqual([
      CRON_ROUTE_PERMISSION_CODES.CONFIG_RELOAD,
    ]);
    expect(workflowStatusRoute?.meta?.authority).not.toContain(
      CRON_ROUTE_PERMISSION_CODES.TASK_CONSOLE,
    );
    expect(configReloadRoute?.meta?.authority).not.toContain(
      CRON_ROUTE_PERMISSION_CODES.TASK_CONSOLE,
    );
  });
});
