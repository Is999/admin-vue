import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runSessionTransition } from '../session-state-gate';

const mocks = vi.hoisted(() => ({
  generateAccess: vi.fn(),
  getAccessCodes: vi.fn(),
  getUserInfo: vi.fn(),
  resetRoutes: vi.fn(),
}));

vi.mock('#/api/core/auth', () => ({
  getAccessCodesApi: mocks.getAccessCodes,
}));
vi.mock('#/api/core/user', () => ({
  getUserInfoApi: mocks.getUserInfo,
}));
vi.mock('#/router', () => ({
  resetRoutes: mocks.resetRoutes,
}));
vi.mock('#/router/access', () => ({
  generateAccess: mocks.generateAccess,
}));
vi.mock('#/router/routes', () => ({
  accessRoutes: [],
}));

describe('access state sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('keeps the old fingerprint and retries after route generation fails', async () => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('token');
    accessStore.setAccessCodes(['old-code']);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({
      id: 1,
      roleIds: [1],
      roles: ['old-role'],
      username: 'admin',
    } as any);

    mocks.getUserInfo.mockResolvedValue({
      id: 1,
      roleIds: [2],
      roles: ['new-role'],
      username: 'admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);
    mocks.generateAccess
      .mockRejectedValueOnce(new Error('route generation failed'))
      .mockResolvedValueOnce({
        accessibleMenus: ['old-menu'],
        accessibleRoutes: ['old-route'],
      })
      .mockResolvedValueOnce({
        accessibleMenus: ['new-menu'],
        accessibleRoutes: ['new-route'],
      });

    const router = {
      currentRoute: { value: { fullPath: '/dashboard' } },
      replace: vi.fn(),
      resolve: vi.fn(() => ({ matched: [{ name: 'Dashboard' }] })),
    } as any;
    const { refreshAccessState } = await import('../access-sync');

    await expect(
      refreshAccessState(router, { force: true, reason: 'forbidden' }),
    ).rejects.toThrow('route generation failed');
    expect(userStore.userInfo?.roles).toEqual(['old-role']);
    expect(accessStore.accessCodes).toEqual(['old-code']);
    expect(accessStore.isAccessChecked).toBe(false);

    await expect(
      refreshAccessState(router, { force: true, reason: 'forbidden' }),
    ).resolves.toMatchObject({ changed: true, skipped: false });
    expect(mocks.generateAccess).toHaveBeenCalledTimes(3);
    expect(userStore.userInfo?.roles).toEqual(['new-role']);
    expect(accessStore.accessCodes).toEqual(['new-code']);
    expect(accessStore.isAccessChecked).toBe(true);
  });

  it('does not join or commit an access sync started by another session', async () => {
    let resolveOldCodes: (codes: string[]) => void = () => {};
    let resolveOldUser: (user: any) => void = () => {};
    mocks.getUserInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldUser = resolve;
          }),
      )
      .mockResolvedValueOnce({
        id: 2,
        roleIds: [2],
        roles: ['new-session-role'],
        username: 'new-session',
      });
    mocks.getAccessCodes
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldCodes = resolve;
          }),
      )
      .mockResolvedValueOnce(['new-session-code']);
    mocks.generateAccess.mockResolvedValue({
      accessibleMenus: ['new-session-menu'],
      accessibleRoutes: ['new-session-route'],
    });

    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('old-session-token');
    accessStore.setAccessCodes(['old-session-code']);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({
      id: 1,
      roles: ['old-session-role'],
      username: 'old-session',
    } as any);
    const router = {
      currentRoute: { value: { fullPath: '/dashboard' } },
      replace: vi.fn(),
      resolve: vi.fn(() => ({ matched: [{ name: 'Dashboard' }] })),
    } as any;
    const { refreshAccessState } = await import('../access-sync');

    const oldSessionSync = refreshAccessState(router, {
      force: true,
      reason: 'interval',
    });
    await vi.waitFor(() => {
      expect(mocks.getUserInfo).toHaveBeenCalledTimes(1);
      expect(mocks.getAccessCodes).toHaveBeenCalledTimes(1);
    });

    accessStore.setAccessToken('new-session-token');
    accessStore.setAccessCodes([]);
    accessStore.setIsAccessChecked(false);
    userStore.setUserInfo({
      id: 2,
      roles: [],
      username: 'new-session',
    } as any);
    await expect(
      refreshAccessState(router, {
        force: true,
        reason: 'interval',
      }),
    ).resolves.toMatchObject({ changed: true, skipped: false });

    resolveOldUser({
      id: 1,
      roleIds: [1],
      roles: ['stale-role'],
      username: 'old-session',
    });
    resolveOldCodes(['stale-code']);
    await expect(oldSessionSync).resolves.toMatchObject({ skipped: true });

    expect(userStore.userInfo?.username).toBe('new-session');
    expect(accessStore.accessCodes).toEqual(['new-session-code']);
    expect(accessStore.accessMenus).toEqual(['new-session-menu']);
    expect(accessStore.accessRoutes).toEqual(['new-session-route']);
    expect(mocks.generateAccess).toHaveBeenCalledTimes(1);
  });

  it('does not restore old state when route generation fails after a session switch', async () => {
    let rejectRouteGeneration: (error: Error) => void = () => {};
    mocks.getUserInfo.mockResolvedValue({
      id: 1,
      roles: ['updated-old-role'],
      username: 'old-session',
    });
    mocks.getAccessCodes.mockResolvedValue(['updated-old-code']);
    mocks.generateAccess.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRouteGeneration = reject;
        }),
    );

    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('old-session-token');
    accessStore.setAccessCodes(['old-code']);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({
      id: 1,
      roles: ['old-role'],
      username: 'old-session',
    } as any);
    const router = {
      currentRoute: { value: { fullPath: '/dashboard' } },
      replace: vi.fn(),
      resolve: vi.fn(() => ({ matched: [{ name: 'Dashboard' }] })),
    } as any;
    const { refreshAccessState } = await import('../access-sync');

    const oldSessionSync = refreshAccessState(router, {
      force: true,
      reason: 'forbidden',
    });
    await vi.waitFor(() => expect(mocks.generateAccess).toHaveBeenCalled());
    accessStore.setAccessToken('new-session-token');
    accessStore.setAccessCodes(['new-session-code']);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({
      id: 2,
      roles: ['new-session-role'],
      username: 'new-session',
    } as any);
    rejectRouteGeneration(new Error('stale route generation failed'));

    await expect(oldSessionSync).resolves.toMatchObject({ skipped: true });
    expect(userStore.userInfo?.username).toBe('new-session');
    expect(accessStore.accessCodes).toEqual(['new-session-code']);
    expect(accessStore.isAccessChecked).toBe(true);
  });

  it('finishes a route rebuild before committing an account transition', async () => {
    let resolveRoutes: (value: any) => void = () => {};
    mocks.getUserInfo.mockResolvedValue({
      id: 1,
      roles: ['updated-role'],
      username: 'old-session',
    });
    mocks.getAccessCodes.mockResolvedValue(['updated-code']);
    mocks.generateAccess.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRoutes = resolve;
        }),
    );

    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('old-session-token');
    accessStore.setAccessCodes(['old-code']);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({
      id: 1,
      roles: ['old-role'],
      username: 'old-session',
    } as any);
    const router = {
      currentRoute: { value: { fullPath: '/dashboard' } },
      replace: vi.fn(),
      resolve: vi.fn(() => ({ matched: [{ name: 'Dashboard' }] })),
    } as any;
    const { refreshAccessState } = await import('../access-sync');

    const sync = refreshAccessState(router, {
      force: true,
      reason: 'interval',
    });
    await vi.waitFor(() => expect(mocks.generateAccess).toHaveBeenCalled());
    const transition = runSessionTransition(() => {
      accessStore.setAccessToken('new-session-token');
      accessStore.setAccessCodes([]);
      userStore.setUserInfo({ id: 2, username: 'new-session' } as any);
    });
    await Promise.resolve();
    expect(accessStore.accessToken).toBe('old-session-token');

    resolveRoutes({
      accessibleMenus: ['updated-menu'],
      accessibleRoutes: ['updated-route'],
    });
    await expect(sync).resolves.toMatchObject({
      changed: true,
      skipped: false,
    });
    await transition;

    expect(accessStore.accessToken).toBe('new-session-token');
    expect(userStore.userInfo?.username).toBe('new-session');
    expect(accessStore.accessCodes).toEqual([]);
  });

  it('runs a fresh request when a forced sync arrives behind an older task', async () => {
    let resolveOldCodes: (value: string[]) => void = () => {};
    let resolveOldUser: (value: any) => void = () => {};
    mocks.getUserInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldUser = resolve;
          }),
      )
      .mockResolvedValueOnce({
        id: 1,
        roles: ['saved-role'],
        username: 'admin',
      });
    mocks.getAccessCodes
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldCodes = resolve;
          }),
      )
      .mockResolvedValueOnce(['saved-code']);
    mocks.generateAccess.mockResolvedValue({
      accessibleMenus: ['menu'],
      accessibleRoutes: ['route'],
    });
    const accessStore = useAccessStore();
    useUserStore().setUserInfo({ id: 1, username: 'admin' } as any);
    accessStore.setAccessToken('token');
    const router = {
      currentRoute: { value: { fullPath: '/dashboard' } },
      replace: vi.fn(),
      resolve: vi.fn(() => ({ matched: [{ name: 'Dashboard' }] })),
    } as any;
    const { refreshAccessState } = await import('../access-sync');

    const older = refreshAccessState(router, {
      force: false,
      reason: 'interval',
    });
    await vi.waitFor(() => expect(mocks.getUserInfo).toHaveBeenCalledTimes(1));
    const forced = refreshAccessState(router, {
      force: true,
      reason: 'role-permission-save',
    });
    resolveOldUser({ id: 1, roles: ['old-role'], username: 'admin' });
    resolveOldCodes(['old-code']);

    await expect(older).resolves.toMatchObject({ skipped: false });
    await expect(forced).resolves.toMatchObject({
      reason: 'role-permission-save',
      skipped: false,
    });
    expect(mocks.getUserInfo).toHaveBeenCalledTimes(2);
    expect(mocks.getAccessCodes).toHaveBeenCalledTimes(2);
    expect(accessStore.accessCodes).toEqual(['saved-code']);
  });
});
