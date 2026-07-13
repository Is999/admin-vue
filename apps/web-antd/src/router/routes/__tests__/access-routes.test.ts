import { generateRoutesByFrontend } from '@vben/utils';

import { describe, expect, it } from 'vitest';

import { APP_DEFAULT_HOME_PATH } from '#/constants/app';
import {
  OPS_ROUTE_PERMISSION_CODES,
  SYSTEM_ROUTE_PERMISSION_CODES,
  USER_ROUTE_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { overridesPreferences } from '#/preferences';
import {
  ADMIN_IP_WHITELIST_PATH,
  ADMIN_IP_WHITELIST_ROUTE,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
  ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
} from '#/views/system/config/editors/registry';

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

// findRouteByPath 按路由路径查找节点，适合校验隐藏页可跳转入口。
function findRouteByPath(routes: typeof accessRoutes, path: string) {
  const visit = (
    items: typeof accessRoutes,
  ): (typeof accessRoutes)[number] | null => {
    for (const route of items) {
      if (route.path === path) {
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

describe('admin access routes', () => {
  it('keeps production route modules focused and unique', () => {
    const names = collectRouteNames(accessRoutes);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'AdminTools',
        'OpsHome',
        'OpsApiDocs',
        'OpsApiServiceDocs',
        'OpsConfigReload',
        'OpsCollector',
        'OpsTaskConsole',
        'OpsTaskItem',
        'OpsTaskQueue',
        'OpsWorkflowStatus',
        'OpsUserTag',
        'ProfileManage',
        'ProfileMessage',
        'SystemAdmin',
        'SystemCache',
        'SystemConfig',
        ADMIN_IP_WHITELIST_ROUTE,
        ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
        'SystemLog',
        'SystemManage',
        'SystemMfa',
        'SystemPermission',
        'SystemProfile',
        'SystemRole',
        'SystemSecretKey',
        'SystemSecurityDebug',
        'UserList',
        'UserManage',
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

  it('keeps all admin and system entry paths available', () => {
    const paths = collectRoutePaths(accessRoutes);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/ops',
        '/ops/config-reload',
        '/ops/collector',
        '/ops/runtime-config',
        '/ops/task-console',
        '/ops/task-item',
        '/ops/task-queue',
        '/ops/task-workflow-status',
        '/ops/user-tag',
        '/profile-manage',
        '/profile-manage/index',
        '/profile-manage/message',
        '/profile-manage/mfa',
        '/system',
        '/system/admin',
        '/system/cache',
        '/system/config',
        ADMIN_IP_WHITELIST_PATH,
        ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
        '/system/log',
        '/system/permission',
        '/system/role',
        '/system/secret-key',
        '/tools',
        '/tools/api-docs',
        '/tools/api-service-docs',
        '/tools/security-debug',
        '/user',
        '/user/list',
      ]),
    );
  });

  it('keeps project tool children under the tool directory menu', () => {
    const toolsRoute = findRouteByName(accessRoutes, 'AdminTools');
    const childPaths = (toolsRoute?.children || []).map((route) => route.path);
    const apiDocsRoute = findRouteByName(accessRoutes, 'OpsApiDocs');
    const apiServiceDocsRoute = findRouteByName(
      accessRoutes,
      'OpsApiServiceDocs',
    );
    const securityDebugRoute = findRouteByName(
      accessRoutes,
      'SystemSecurityDebug',
    );

    expect(childPaths).toEqual(
      expect.arrayContaining([
        '/tools/api-docs',
        '/tools/api-service-docs',
        '/tools/security-debug',
      ]),
    );
    expect(apiDocsRoute?.alias).toBeUndefined();
    expect(apiDocsRoute?.meta?.keepAlive).toBe(true);
    expect(apiServiceDocsRoute?.meta?.keepAlive).toBe(true);
    expect(apiServiceDocsRoute?.props).toMatchObject({
      docsBase: '/api/docs/api',
      docsHash: '/接口文档/前台系统/系统接口',
      titleKey: 'admin.route.apiServiceDocs',
    });
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

  it('keeps project branding overrides outside the Vben core defaults', () => {
    expect(overridesPreferences.app?.defaultAvatar).toBe('/favicon.svg');
    expect(overridesPreferences.app?.enableRefreshToken).toBe(true);
    expect(overridesPreferences.app).toHaveProperty('name');
    expect(overridesPreferences.app?.preferencesButtonPosition).toBe('fixed');
    expect(overridesPreferences.copyright).toMatchObject({
      companyName: 'Admin',
      companySiteLink: '/',
      date: '2026',
    });
    expect(overridesPreferences.logo?.source).toBe('/favicon.svg');
  });

  it('keeps split admin tools on independent menu permissions', () => {
    const workflowStatusRoute = findRouteByName(
      accessRoutes,
      'OpsWorkflowStatus',
    );
    const apiServiceDocsRoute = findRouteByName(
      accessRoutes,
      'OpsApiServiceDocs',
    );
    const configReloadRoute = findRouteByName(accessRoutes, 'OpsConfigReload');
    const userManageRoute = findRouteByName(accessRoutes, 'UserManage');
    const userListRoute = findRouteByName(accessRoutes, 'UserList');

    expect(workflowStatusRoute?.meta?.authority).toEqual([
      OPS_ROUTE_PERMISSION_CODES.TASK_WORKFLOW_STATUS,
    ]);
    expect(configReloadRoute?.meta?.authority).toEqual([
      OPS_ROUTE_PERMISSION_CODES.CONFIG_RELOAD,
    ]);
    expect(apiServiceDocsRoute?.meta?.authority).toEqual([
      OPS_ROUTE_PERMISSION_CODES.API_SERVICE_DOCS,
    ]);
    expect(userManageRoute?.meta?.authority).toEqual([
      USER_ROUTE_PERMISSION_CODES.USER_MANAGE,
    ]);
    expect(userListRoute?.meta?.authority).toEqual([
      USER_ROUTE_PERMISSION_CODES.USER_LIST,
    ]);
    expect(workflowStatusRoute?.meta?.authority).not.toContain(
      OPS_ROUTE_PERMISSION_CODES.TASK_CONSOLE,
    );
    expect(configReloadRoute?.meta?.authority).not.toContain(
      OPS_ROUTE_PERMISSION_CODES.TASK_CONSOLE,
    );
  });

  it('keeps complex dictionary editor hidden under system config permissions', () => {
    const hiddenEditors: Array<[string, string]> = [
      [ADMIN_IP_WHITELIST_PATH, ADMIN_IP_WHITELIST_ROUTE],
      [
        ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
        ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
      ],
    ];

    for (const [path, routeName] of hiddenEditors) {
      const route = findRouteByPath(accessRoutes, path);

      expect(route?.name).toBe(routeName);
      expect(route?.meta?.hideInMenu).toBe(true);
      expect(route?.meta?.authority).toEqual([
        SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_CONFIG_LIST,
      ]);
    }
  });

  it('requires system parent and log child permissions for log menu', async () => {
    const routesWithOnlyLog = await generateRoutesByFrontend(accessRoutes, [
      SYSTEM_ROUTE_PERMISSION_CODES.ADMIN_LOG_QUERY,
    ]);
    expect(findRouteByName(routesWithOnlyLog, 'SystemLog')).toBeNull();

    const routesWithSystemLog = await generateRoutesByFrontend(accessRoutes, [
      SYSTEM_ROUTE_PERMISSION_CODES.SYSTEM_MANAGE,
      SYSTEM_ROUTE_PERMISSION_CODES.ADMIN_LOG_QUERY,
    ]);
    expect(findRouteByName(routesWithSystemLog, 'SystemLog')).not.toBeNull();
  });
});
