import type { Router } from 'vue-router';

import type { AdminUserInfo } from '#/api/core/user';

import { useAccessStore, useUserStore } from '@vben/stores';

import { getAccessCodesApi } from '#/api/core/auth';
import { getUserInfoApi } from '#/api/core/user';
import { ACCESS_SYNC_THROTTLE_MS } from '#/constants/access-sync';
import { APP_DEFAULT_HOME_PATH } from '#/constants/app';
import { buildEffectiveAccessCodes } from '#/constants/permission-codes';
import { resetRoutes } from '#/router';
import { generateAccess } from '#/router/access';
import { accessRoutes } from '#/router/routes';

// AccessSyncReason 表示触发权限态刷新的来源，用于后续排查定时器和 403 兜底链路。
export type AccessSyncReason =
  | 'forbidden'
  | 'interval'
  | 'role-permission-save';

// AccessSyncOptions 表示刷新权限态时的节流控制参数。
export interface AccessSyncOptions {
  force?: boolean; // 是否忽略节流立即刷新，角色权限保存后需要立刻生效。
  reason: AccessSyncReason; // 刷新来源，便于调试和后续日志扩展。
}

// AccessSyncResult 表示一次权限态同步的执行结果。
export interface AccessSyncResult {
  changed: boolean; // 后端角色或权限码是否相对前端缓存发生变化。
  reason: AccessSyncReason; // 刷新来源。
  skipped: boolean; // 是否因为未登录、节流或已有请求而跳过。
}

// accessSyncPromise 保存当前正在执行的权限同步请求，合并并发触发，避免短时间重复拉取权限码。
let accessSyncPromise: null | Promise<AccessSyncResult> = null;
// lastAccessSyncAt 记录上次权限同步发起时间，用于定时器和 403 触发的统一节流。
let lastAccessSyncAt = 0;

// normalizedStringList 归一化字符串集合，保证权限码和角色名比较不受顺序、空值影响。
function normalizedStringList(values: readonly string[] | undefined) {
  return [
    ...new Set(
      (values || []).map((item) => String(item).trim()).filter(Boolean),
    ),
  ].toSorted();
}

// normalizedNumberList 归一化数字集合，保证角色 ID 比较不受顺序、空值影响。
function normalizedNumberList(values: readonly number[] | undefined) {
  return [
    ...new Set((values || []).map(Number).filter((item) => item > 0)),
  ].toSorted((a, b) => a - b);
}

// buildAccessFingerprint 构造前端菜单依赖的最小权限指纹，字段变化即需要重建路由和菜单。
function buildAccessFingerprint(
  userInfo: AdminUserInfo | null | undefined,
  accessCodes: readonly string[] | undefined,
) {
  return JSON.stringify({
    accessCodes: normalizedStringList(accessCodes),
    isSuperAdmin: Boolean(userInfo?.isSuperAdmin),
    roleIds: normalizedNumberList(userInfo?.roleIds),
    roles: normalizedStringList(userInfo?.roles),
  });
}

// ensureCurrentRouteStillAccessible 在权限刷新后校验当前页面是否仍可访问；失权时降级到个人信息页。
async function ensureCurrentRouteStillAccessible(router: Router) {
  const currentPath = router.currentRoute.value.fullPath;
  const resolved = router.resolve(currentPath);
  const isNotFound = resolved.matched.some(
    (route) => route.name === 'FallbackNotFound',
  );
  if (resolved.matched.length === 0 || isNotFound) {
    await router.replace(APP_DEFAULT_HOME_PATH).catch(() => undefined);
  }
}

// rebuildAccessMenus 根据最新用户资料和权限码重建动态路由与侧边栏菜单。
async function rebuildAccessMenus(
  router: Router,
  userInfo: AdminUserInfo,
  latestAccessCodes: string[],
) {
  const userRoles = Array.isArray(userInfo.roles) ? userInfo.roles : [];
  resetRoutes();
  const { accessibleMenus, accessibleRoutes } = await generateAccess({
    roles: [...userRoles, ...latestAccessCodes],
    router,
    routes: accessRoutes,
  });
  const accessStore = useAccessStore();
  accessStore.setAccessMenus(accessibleMenus);
  accessStore.setAccessRoutes(accessibleRoutes);
  accessStore.setIsAccessChecked(true);
}

// refreshAccessState 从后端低频同步最新用户角色和权限码，解决后端权限变更后前端菜单仍使用旧缓存的问题。
export async function refreshAccessState(
  router: Router,
  options: AccessSyncOptions,
): Promise<AccessSyncResult> {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const now = Date.now();

  if (!accessStore.accessToken) {
    return { changed: false, reason: options.reason, skipped: true };
  }
  if (!options.force && now - lastAccessSyncAt < ACCESS_SYNC_THROTTLE_MS) {
    return { changed: false, reason: options.reason, skipped: true };
  }
  if (accessSyncPromise) {
    return accessSyncPromise;
  }

  lastAccessSyncAt = now;
  accessSyncPromise = (async () => {
    const currentUserInfo = userStore.userInfo as AdminUserInfo | null;
    const currentFingerprint = buildAccessFingerprint(
      currentUserInfo,
      accessStore.accessCodes,
    );
    const [latestUserInfo, rawAccessCodes] = await Promise.all([
      getUserInfoApi(),
      getAccessCodesApi(),
    ]);
    const latestAccessCodes = buildEffectiveAccessCodes(
      latestUserInfo,
      rawAccessCodes,
    );
    const latestFingerprint = buildAccessFingerprint(
      latestUserInfo,
      latestAccessCodes,
    );
    const changed =
      currentFingerprint !== latestFingerprint || !accessStore.isAccessChecked;

    userStore.setUserInfo(latestUserInfo);
    accessStore.setAccessCodes(latestAccessCodes);

    if (changed) {
      await rebuildAccessMenus(router, latestUserInfo, latestAccessCodes);
      await ensureCurrentRouteStillAccessible(router);
    }

    return { changed, reason: options.reason, skipped: false };
  })().finally(() => {
    accessSyncPromise = null;
  });

  return accessSyncPromise;
}
