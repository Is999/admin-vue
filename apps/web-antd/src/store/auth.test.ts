import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  currentSessionStateIdentity,
  registerSessionStateCleanup,
  runSessionTransition,
} from '#/utils/session-state-gate';

import { useAuthStore } from './auth';

const mocks = vi.hoisted(() => ({
  checkMfaSecure: vi.fn(),
  createMfaCheckDialog: vi.fn(),
  currentPath: '/login',
  getAccessCodes: vi.fn(),
  getUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  resetAllStores: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  updateProfileMfaStatus: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { fullPath: mocks.currentPath } },
    getRoutes: () => [],
    hasRoute: () => false,
    push: mocks.routerPush,
    removeRoute: vi.fn(),
    replace: mocks.routerReplace,
  }),
}));
vi.mock('@vben/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vben/stores')>();
  return { ...actual, resetAllStores: mocks.resetAllStores };
});
vi.mock('ant-design-vue', () => ({
  Modal: { destroyAll: vi.fn() },
  notification: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));
vi.mock('#/api', () => ({
  checkMfaSecureApi: mocks.checkMfaSecure,
  getAccessCodesApi: mocks.getAccessCodes,
  getUserInfoApi: mocks.getUserInfo,
  loginApi: mocks.login,
  logoutApi: mocks.logout,
}));
vi.mock('#/api/system', () => ({
  updateProfileMfaStatus: mocks.updateProfileMfaStatus,
}));
vi.mock('#/api/request', () => ({
  createSessionBoundRequestConfig: (accessToken: string) => ({
    __accessTokenOverride: accessToken,
    skipAccessTokenRefresh: true,
    skipLoginMfaHandler: true,
    skipPasswordResetHandler: true,
    skipReAuthenticate: true,
  }),
}));
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));
vi.mock('#/utils/security/mfa', () => ({
  createMfaCheckDialog: mocks.createMfaCheckDialog,
  extractMfaSecret: vi.fn(),
  getMfaMicrosoftScanTip: vi.fn(() => ''),
  ticketPayload: vi.fn(() => ({})),
}));

describe('auth store login transaction', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.currentPath = '/login';
    mocks.routerPush.mockResolvedValue(undefined);
    mocks.routerReplace.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
    mocks.updateProfileMfaStatus.mockResolvedValue(undefined);
  });

  it('revokes the issued token and clears local state when initialization fails', async () => {
    mocks.login.mockResolvedValue({
      token: 'issued-token',
      user: { mfaCheck: 0, username: 'admin' },
    });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/dashboard',
      id: 1,
      roles: ['admin'],
      username: 'admin',
    });
    mocks.getAccessCodes.mockRejectedValue(new Error('codes unavailable'));

    const authStore = useAuthStore();
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    await expect(
      authStore.authLogin({ password: 'secret', username: 'admin' }),
    ).rejects.toThrow('codes unavailable');

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.logout).toHaveBeenCalledWith('issued-token');
    expect(accessStore.accessToken).toBeNull();
    expect(accessStore.accessCodes).toEqual([]);
    expect(accessStore.isAccessChecked).toBe(false);
    expect(userStore.userInfo).toBeNull();
    expect(authStore.loginLoading).toBe(false);
  });

  it('rejects a successful response without a token', async () => {
    mocks.login.mockResolvedValue({ token: '', user: null });

    const authStore = useAuthStore();
    await expect(
      authStore.authLogin({ password: 'secret', username: 'admin' }),
    ).rejects.toThrow('LOGIN_TOKEN_MISSING');
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
    expect(authStore.loginLoading).toBe(false);
  });

  it('keeps the latest session when an older login finishes later', async () => {
    let resolveOldCodes: (codes: string[]) => void = () => {};
    let resolveOldUser: (user: any) => void = () => {};
    mocks.login
      .mockResolvedValueOnce({
        token: 'old-issued-token',
        user: { mfaCheck: 0, username: 'old-admin' },
      })
      .mockResolvedValueOnce({
        token: 'new-issued-token',
        user: { mfaCheck: 0, username: 'new-admin' },
      });
    mocks.getUserInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldUser = resolve;
          }),
      )
      .mockResolvedValueOnce({
        homePath: '/new-dashboard',
        id: 2,
        roles: ['new-role'],
        username: 'new-admin',
      });
    mocks.getAccessCodes
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldCodes = resolve;
          }),
      )
      .mockResolvedValueOnce(['new-code']);

    const authStore = useAuthStore();
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const oldLogin = authStore.authLogin({
      password: 'old-secret',
      username: 'old-admin',
    });
    await vi.waitFor(() => {
      expect(mocks.getUserInfo).toHaveBeenCalledTimes(1);
      expect(mocks.getAccessCodes).toHaveBeenCalledTimes(1);
    });

    await expect(
      authStore.authLogin({
        password: 'new-secret',
        username: 'new-admin',
      }),
    ).resolves.toMatchObject({ userInfo: { username: 'new-admin' } });
    expect(accessStore.accessToken).toBe('new-issued-token');
    expect(userStore.userInfo?.username).toBe('new-admin');
    expect(accessStore.accessCodes).toEqual(['new-code']);

    resolveOldUser({
      homePath: '/old-dashboard',
      id: 1,
      roles: ['old-role'],
      username: 'old-admin',
    });
    resolveOldCodes(['old-code']);
    await expect(oldLogin).resolves.toEqual({ userInfo: null });

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.logout).toHaveBeenCalledWith('old-issued-token');
    expect(mocks.resetAllStores).not.toHaveBeenCalled();
    expect(accessStore.accessToken).toBe('new-issued-token');
    expect(userStore.userInfo?.username).toBe('new-admin');
    expect(accessStore.accessCodes).toEqual(['new-code']);
    expect(mocks.routerPush).toHaveBeenCalledTimes(1);
    expect(mocks.routerPush).toHaveBeenCalledWith('/new-dashboard');
    expect(authStore.loginLoading).toBe(false);
  });

  it('does not advance the latest session when an older login response arrives late', async () => {
    let resolveOldLogin: (value: any) => void = () => {};
    mocks.login
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldLogin = resolve;
          }),
      )
      .mockResolvedValueOnce({
        token: 'new-issued-token',
        user: { mfaCheck: 0, username: 'new-admin' },
      });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/new-dashboard',
      id: 2,
      roles: ['new-role'],
      username: 'new-admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);

    const authStore = useAuthStore();
    const oldLogin = authStore.authLogin({
      password: 'old-secret',
      username: 'old-admin',
    });
    await vi.waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    await authStore.authLogin({
      password: 'new-secret',
      username: 'new-admin',
    });

    const latestIdentity = currentSessionStateIdentity();
    const cleanup = vi.fn();
    const unregisterCleanup = registerSessionStateCleanup(cleanup);
    resolveOldLogin({
      token: 'old-issued-token',
      user: { mfaCheck: 0, username: 'old-admin' },
    });
    await expect(oldLogin).resolves.toEqual({ userInfo: null });
    unregisterCleanup();

    expect(currentSessionStateIdentity()).toBe(latestIdentity);
    expect(cleanup).not.toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledWith('old-issued-token');
    expect(useAccessStore().accessToken).toBe('new-issued-token');
    expect(useUserStore().userInfo?.username).toBe('new-admin');
  });

  it('does not clear a newer account when an older logout finishes later', async () => {
    let resolveOldLogout = () => {};
    mocks.logout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveOldLogout = resolve;
        }),
    );
    mocks.login.mockResolvedValue({
      token: 'account-b-token',
      user: { mfaCheck: 0, username: 'account-b' },
    });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/account-b-home',
      id: 2,
      roles: ['account-b-role'],
      username: 'account-b',
    });
    mocks.getAccessCodes.mockResolvedValue(['account-b-code']);
    const authStore = useAuthStore();
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    await runSessionTransition(() => {
      accessStore.setAccessToken('account-a-token');
      userStore.setUserInfo({ id: 1, username: 'account-a' } as any);
    });

    const oldLogout = authStore.logout();
    await vi.waitFor(() => {
      expect(mocks.logout).toHaveBeenCalledWith('account-a-token');
    });
    await authStore.authLogin({
      password: 'secret',
      username: 'account-b',
    });
    resolveOldLogout();
    await oldLogout;

    expect(accessStore.accessToken).toBe('account-b-token');
    expect(userStore.userInfo?.username).toBe('account-b');
    expect(accessStore.accessCodes).toEqual(['account-b-code']);
    expect(mocks.resetAllStores).not.toHaveBeenCalled();
    expect(mocks.routerReplace).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/login' }),
    );
  });

  it('does not open an older mfa dialog after a newer login transition is queued', async () => {
    mocks.login
      .mockResolvedValueOnce({
        token: 'old-mfa-token',
        user: {
          existMFA: true,
          mfaCheck: 1,
          mfaStatus: 1,
          username: 'old-admin',
        },
      })
      .mockResolvedValueOnce({
        token: 'new-token',
        user: { mfaCheck: 0, username: 'new-admin' },
      });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/new-dashboard',
      id: 2,
      roles: ['new-role'],
      username: 'new-admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);
    const authStore = useAuthStore();

    const oldLogin = authStore.authLogin({
      password: 'old-secret',
      username: 'old-admin',
    });
    const newLogin = authStore.authLogin({
      password: 'new-secret',
      username: 'new-admin',
    });

    await expect(newLogin).resolves.toMatchObject({
      userInfo: { username: 'new-admin' },
    });
    await expect(oldLogin).resolves.toEqual({ userInfo: null });
    expect(mocks.createMfaCheckDialog).not.toHaveBeenCalled();
    expect(useAccessStore().accessToken).toBe('new-token');
  });

  it('clears the previous account routes and menus before committing a new token', async () => {
    mocks.login.mockResolvedValue({
      token: 'new-token',
      user: { mfaCheck: 0, username: 'new-admin' },
    });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/new-dashboard',
      id: 2,
      roles: ['new-role'],
      username: 'new-admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessCodes(['old-code']);
    accessStore.setAccessMenus([{ name: 'Old', path: '/old' }] as any);
    accessStore.setAccessRoutes([{ name: 'Old', path: '/old' }] as any);
    accessStore.setIsAccessChecked(true);
    userStore.setUserInfo({ id: 1, username: 'old-admin' } as any);

    await expect(
      useAuthStore().authLogin({
        password: 'new-secret',
        username: 'new-admin',
      }),
    ).resolves.toMatchObject({ userInfo: { username: 'new-admin' } });

    expect(accessStore.accessToken).toBe('new-token');
    expect(accessStore.accessCodes).toEqual(['new-code']);
    expect(accessStore.accessMenus).toEqual([]);
    expect(accessStore.accessRoutes).toEqual([]);
    expect(accessStore.isAccessChecked).toBe(false);
  });

  it('revalidates the current route after modal reauthentication', async () => {
    mocks.currentPath = '/account-a-only';
    mocks.login.mockResolvedValue({
      token: 'account-b-token',
      user: { mfaCheck: 0, username: 'account-b' },
    });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/account-b-home',
      id: 2,
      roles: ['account-b-role'],
      username: 'account-b',
    });
    mocks.getAccessCodes.mockResolvedValue(['account-b-code']);
    const authStore = useAuthStore();
    useAccessStore().setLoginExpired(true);

    await authStore.authLogin({
      password: 'secret',
      username: 'account-b',
    });

    expect(mocks.routerPush).not.toHaveBeenCalled();
    expect(mocks.routerReplace).toHaveBeenCalledWith('/account-a-only');
  });

  it('does not clear a new account when an old profile mfa dialog is cancelled', async () => {
    let rejectOldMfa = (_error: Error) => {};
    mocks.getUserInfo.mockRejectedValueOnce({ code: 6 });
    mocks.createMfaCheckDialog.mockReturnValueOnce({
      destroy: vi.fn(),
      promise: new Promise((_resolve, reject) => {
        rejectOldMfa = reject;
      }),
    });
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('account-a-token');
    userStore.setUserInfo({
      existMFA: true,
      id: 1,
      mfaStatus: 1,
      username: 'account-a',
    } as any);
    const pending = useAuthStore().fetchUserInfo();
    await vi.waitFor(() => {
      expect(mocks.createMfaCheckDialog).toHaveBeenCalledTimes(1);
    });

    await runSessionTransition(() => {
      accessStore.setAccessToken('account-b-token');
      userStore.setUserInfo({ id: 2, username: 'account-b' } as any);
    });
    rejectOldMfa(new Error('MFA_CANCELLED'));

    await expect(pending).rejects.toThrow('SESSION_STATE_CHANGED');
    expect(mocks.resetAllStores).not.toHaveBeenCalled();
    expect(accessStore.accessToken).toBe('account-b-token');
    expect(userStore.userInfo?.username).toBe('account-b');
  });

  it('settles and revokes an older login when its MFA dialog is destroyed', async () => {
    let rejectOldMfa = (_error: Error) => {};
    const oldMfaPromise = new Promise((_resolve, reject) => {
      rejectOldMfa = reject;
    });
    const destroyOldMfa = vi.fn(() => {
      rejectOldMfa(new Error('MFA_CANCELLED'));
    });
    mocks.createMfaCheckDialog.mockReturnValueOnce({
      destroy: destroyOldMfa,
      promise: oldMfaPromise,
    });
    mocks.login
      .mockResolvedValueOnce({
        token: 'old-mfa-token',
        user: {
          existMFA: true,
          mfaCheck: 1,
          mfaStatus: 1,
          username: 'old-admin',
        },
      })
      .mockResolvedValueOnce({
        token: 'new-token',
        user: { mfaCheck: 0, username: 'new-admin' },
      });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/new-dashboard',
      id: 2,
      roles: ['new-role'],
      username: 'new-admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);

    const authStore = useAuthStore();
    const oldLogin = authStore.authLogin({
      password: 'old-secret',
      username: 'old-admin',
    });
    await vi.waitFor(() => {
      expect(mocks.createMfaCheckDialog).toHaveBeenCalledTimes(1);
    });

    await expect(
      authStore.authLogin({
        password: 'new-secret',
        username: 'new-admin',
      }),
    ).resolves.toMatchObject({ userInfo: { username: 'new-admin' } });
    await expect(oldLogin).resolves.toEqual({ userInfo: null });

    expect(destroyOldMfa).toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledWith('old-mfa-token');
    expect(useAccessStore().accessToken).toBe('new-token');
  });

  it('does not destroy a newer mfa dialog when an older bind request finishes', async () => {
    let resolveOldCheck: (value: any) => void = () => {};
    let resolveNewMfa: (value: any) => void = () => {};
    const destroyOldMfa = vi.fn();
    const destroyNewMfa = vi.fn();
    mocks.createMfaCheckDialog
      .mockReturnValueOnce({
        destroy: destroyOldMfa,
        promise: Promise.resolve({ secure: '123456' }),
      })
      .mockReturnValueOnce({
        destroy: destroyNewMfa,
        promise: new Promise((resolve) => {
          resolveNewMfa = resolve;
        }),
      });
    mocks.checkMfaSecure.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldCheck = resolve;
      }),
    );
    mocks.login
      .mockResolvedValueOnce({
        token: 'old-bind-token',
        user: {
          buildMFAURL: 'otpauth://totp/admin?secret=OLDSECRET',
          forceMFAEnabled: true,
          mfaBindRequired: true,
          mfaStatus: 0,
          username: 'old-admin',
        },
      })
      .mockResolvedValueOnce({
        token: 'new-mfa-token',
        user: {
          existMFA: true,
          mfaCheck: 1,
          mfaStatus: 1,
          username: 'new-admin',
        },
      });
    mocks.getUserInfo.mockResolvedValue({
      homePath: '/new-dashboard',
      id: 2,
      roles: ['new-role'],
      username: 'new-admin',
    });
    mocks.getAccessCodes.mockResolvedValue(['new-code']);

    const authStore = useAuthStore();
    const oldLogin = authStore.authLogin({
      password: 'old-secret',
      username: 'old-admin',
    });
    await vi.waitFor(() => {
      expect(mocks.checkMfaSecure).toHaveBeenCalledTimes(1);
    });

    const newLogin = authStore.authLogin({
      password: 'new-secret',
      username: 'new-admin',
    });
    await vi.waitFor(() => {
      expect(mocks.createMfaCheckDialog).toHaveBeenCalledTimes(2);
    });

    resolveOldCheck({
      isOk: true,
      twoStep: { expire: 60, key: 'key', time: 1, value: 'value' },
    });
    await expect(oldLogin).resolves.toEqual({ userInfo: null });
    expect(destroyNewMfa).not.toHaveBeenCalled();

    resolveNewMfa({ secure: '654321' });
    await expect(newLogin).resolves.toMatchObject({
      userInfo: { username: 'new-admin' },
    });
    expect(useAccessStore().accessToken).toBe('new-mfa-token');
  });
});
