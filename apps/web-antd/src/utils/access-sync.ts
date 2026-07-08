import type { Router } from 'vue-router';

import type { AdminUserInfo } from '#/api/core/user';

import { useAccessStore, useUserStore } from '@vben/stores';

import { getAccessCodesApi } from '#/api/core/auth';
import { getUserInfoApi } from '#/api/core/user';
import { createSessionBoundRequestConfig } from '#/api/request';
import { ACCESS_SYNC_THROTTLE_MS } from '#/constants/access-sync';
import { APP_DEFAULT_HOME_PATH } from '#/constants/app';
import { buildEffectiveAccessCodes } from '#/constants/permission-codes';
import { resetRoutes } from '#/router';
import { generateAccess } from '#/router/access';
import { accessRoutes } from '#/router/routes';
import { runSessionStateMutation } from '#/utils/session-state-gate';

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

// AccessSyncTask 表示绑定到发起时会话的权限同步任务。
interface AccessSyncTask {
  promise: Promise<AccessSyncResult>;
  sourceToken: string;
}

// accessSyncTask 仅合并同一会话的并发触发，账号切换后必须启动新任务。
let accessSyncTask: AccessSyncTask | null = null;
// lastAccessSync 按会话记录上次同步时间，避免旧账号的节流窗口阻塞新账号。
let lastAccessSync = { at: 0, sourceToken: '' };

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

// rebuildAccessMenus 根据指定用户资料和权限码重建动态路由与侧边栏菜单。
async function rebuildAccessMenus(
  router: Router,
  userInfo: AdminUserInfo,
  accessCodes: string[],
) {
  const userRoles = Array.isArray(userInfo.roles) ? userInfo.roles : [];
  resetRoutes();
  return generateAccess({
    roles: [...userRoles, ...accessCodes],
    router,
    routes: accessRoutes,
  });
}

// refreshAccessState 从后端低频同步最新用户角色和权限码，解决后端权限变更后前端菜单仍使用旧缓存的问题。
export async function refreshAccessState(
  router: Router,
  options: AccessSyncOptions,
): Promise<AccessSyncResult> {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const now = Date.now();
  const sourceToken = String(accessStore.accessToken || '');

  if (!sourceToken) {
    return { changed: false, reason: options.reason, skipped: true };
  }
  if (
    !options.force &&
    lastAccessSync.sourceToken === sourceToken &&
    now - lastAccessSync.at < ACCESS_SYNC_THROTTLE_MS
  ) {
    return { changed: false, reason: options.reason, skipped: true };
  }
  if (accessSyncTask?.sourceToken === sourceToken) {
    if (!options.force) {
      return accessSyncTask.promise;
    }
    // 保存权限后的强制同步不能复用保存前已发出的旧请求；等待旧任务收口后重新拉取。
    await accessSyncTask.promise.catch(() => undefined);
    return refreshAccessState(router, options);
  }

  lastAccessSync = { at: now, sourceToken };
  const sessionRequestConfig = () => ({
    ...createSessionBoundRequestConfig(sourceToken),
    skipGlobalErrorMessage: true,
  });
  const task: AccessSyncTask = {
    promise: (async (): Promise<AccessSyncResult> => {
      const skippedResult: AccessSyncResult = {
        changed: false,
        reason: options.reason,
        skipped: true,
      };
      const isCurrentSession = () =>
        String(accessStore.accessToken || '') === sourceToken;
      if (!isCurrentSession()) {
        return skippedResult;
      }
      const [latestUserInfo, rawAccessCodes] = await Promise.all([
        getUserInfoApi(sessionRequestConfig()),
        getAccessCodesApi(sessionRequestConfig()),
      ]);
      if (!isCurrentSession()) {
        return skippedResult;
      }
      const latestAccessCodes = buildEffectiveAccessCodes(
        latestUserInfo,
        rawAccessCodes,
      );
      return runSessionStateMutation(async () => {
        if (!isCurrentSession()) {
          return skippedResult;
        }
        const currentUserInfo = userStore.userInfo as AdminUserInfo | null;
        const currentFingerprint = buildAccessFingerprint(
          currentUserInfo,
          accessStore.accessCodes,
        );
        const latestFingerprint = buildAccessFingerprint(
          latestUserInfo,
          latestAccessCodes,
        );
        const changed =
          currentFingerprint !== latestFingerprint ||
          !accessStore.isAccessChecked;

        if (changed) {
          const previousAccessCodes = [...accessStore.accessCodes];
          const previousChecked = accessStore.isAccessChecked;
          accessStore.setIsAccessChecked(false);
          try {
            const { accessibleMenus, accessibleRoutes } =
              await rebuildAccessMenus(
                router,
                latestUserInfo,
                latestAccessCodes,
              );
            if (!isCurrentSession()) {
              return skippedResult;
            }
            userStore.setUserInfo(latestUserInfo);
            accessStore.setAccessCodes(latestAccessCodes);
            accessStore.setAccessMenus(accessibleMenus);
            accessStore.setAccessRoutes(accessibleRoutes);
            accessStore.setIsAccessChecked(true);
          } catch (error) {
            if (!isCurrentSession()) {
              return skippedResult;
            }
            // 新权限构建失败时尽力恢复旧路由，但保持未校验状态，确保下一次同步能够自愈。
            userStore.setUserInfo(currentUserInfo);
            accessStore.setAccessCodes(previousAccessCodes);
            if (currentUserInfo && previousChecked) {
              try {
                const { accessibleMenus, accessibleRoutes } =
                  await rebuildAccessMenus(
                    router,
                    currentUserInfo,
                    previousAccessCodes,
                  );
                accessStore.setAccessMenus(accessibleMenus);
                accessStore.setAccessRoutes(accessibleRoutes);
              } catch {
                accessStore.setAccessMenus([]);
                accessStore.setAccessRoutes([]);
              }
            }
            accessStore.setIsAccessChecked(false);
            throw error;
          }
          if (!isCurrentSession()) {
            return skippedResult;
          }
          await ensureCurrentRouteStillAccessible(router);
        } else {
          if (!isCurrentSession()) {
            return skippedResult;
          }
          userStore.setUserInfo(latestUserInfo);
          accessStore.setAccessCodes(latestAccessCodes);
        }

        return { changed, reason: options.reason, skipped: false };
      });
    })().finally(() => {
      if (accessSyncTask === task) {
        accessSyncTask = null;
      }
    }),
    sourceToken,
  };
  accessSyncTask = task;

  return task.promise;
}
