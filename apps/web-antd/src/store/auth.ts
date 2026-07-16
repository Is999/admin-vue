import type { Recordable } from '@vben/types';

import type { AuthApi } from '#/api';
import type { AdminUserInfo } from '#/api/core/user';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { Modal, notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  checkMfaSecureApi,
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '#/api';
import { createSessionBoundRequestConfig } from '#/api/request';
import { updateProfileMfaStatus } from '#/api/system';
import { APP_DEFAULT_HOME_PATH } from '#/constants/app';
import { buildEffectiveAccessCodes } from '#/constants/permission-codes';
import { $t } from '#/locales';
import {
  createMfaCheckDialog,
  extractMfaSecret,
  getMfaMicrosoftScanTip,
  ticketPayload,
} from '#/utils/security/mfa';
import { destroyAllMfaOverlayDialogs } from '#/utils/security/mfa-overlay';
import { resetSessionAccessState } from '#/utils/session-access-state';
import {
  currentSessionStateIdentity,
  currentSessionStateVersion,
  runSessionStateMutation,
  runSessionTransition,
  runSessionTransitionIf,
  SESSION_STATE_CHANGED,
} from '#/utils/session-state-gate';

// MFA_LOGIN_SCENARIO 表示登录后的MFA校验场景。
const MFA_LOGIN_SCENARIO = 0;
// MFA_STATUS_SCENARIO 表示启停 MFA 状态的二次校验场景。
const MFA_STATUS_SCENARIO = 2;
// LOGIN_MFA_BIND_REQUIRED_CODE 表示后端要求当前账号先完成 MFA 绑定与启用。
const LOGIN_MFA_BIND_REQUIRED_CODE = 5;
// LOGIN_MFA_REQUIRED_CODE 表示后端要求当前登录会话先完成 MFA 校验。
const LOGIN_MFA_REQUIRED_CODE = 6;
// MFA_CANCELLED_ERROR 表示用户主动取消登录阶段 MFA 认证。
const MFA_CANCELLED_ERROR = 'MFA_CANCELLED';
// LOGIN_ATTEMPT_SUPERSEDED 表示当前登录已被更新的登录尝试取代。
const LOGIN_ATTEMPT_SUPERSEDED = 'LOGIN_ATTEMPT_SUPERSEDED';
export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  // loginMfaModalRef 保存当前登录阶段的 MFA 弹窗实例，便于取消或跳转时显式销毁。
  let loginMfaModalRef: null | { destroy: () => void } = null;
  // loginAttemptVersion 标记最新登录事务，旧事务不得提交或清理新会话。
  let loginAttemptVersion = 0;

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    const attemptVersion = ++loginAttemptVersion;
    destroyLoginMfaModal();
    let userInfo: AdminUserInfo | null = null;
    let issuedToken = '';
    try {
      loginLoading.value = true;
      // 登录滑块等表单态字段仅用于前端校验，提交后端时只保留登录接口实际识别的参数。
      const loginParams = {
        captcha: params?.captcha,
        key: params?.key,
        password: params?.password,
        secureCode: params?.secureCode,
        username: params?.username,
      };
      const { token, user } = await loginApi(loginParams);

      if (!token) {
        throw new Error('LOGIN_TOKEN_MISSING');
      }
      issuedToken = token;
      const committed = await runSessionTransitionIf(
        () => isCurrentLoginAttempt(attemptVersion),
        () => {
          resetSessionAccessState(router);
          accessStore.setAccessToken(issuedToken);
          userStore.setUserInfo((user || null) as any);
        },
      );
      if (!committed) {
        throw new Error(LOGIN_ATTEMPT_SUPERSEDED);
      }
      assertCurrentLoginAttempt(attemptVersion);
      if (needLoginMfa(user)) {
        await verifyLoginMfa(user, issuedToken);
        assertCurrentLoginAttempt(attemptVersion);
      }

      const [fetchUserInfoResult, accessCodes] = await Promise.all([
        loadUserInfo(attemptVersion, issuedToken),
        getAccessCodesApi(createSessionBoundRequestConfig(issuedToken)),
      ]);
      userInfo = fetchUserInfoResult;
      await runSessionStateMutation(() => {
        assertCurrentLoginAttempt(attemptVersion);
        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(
          buildEffectiveAccessCodes(userInfo || undefined, accessCodes),
        );
      });
      assertCurrentLoginAttempt(attemptVersion);

      if (needResetPassword(userInfo || user)) {
        await runSessionStateMutation(() => {
          assertCurrentLoginAttempt(attemptVersion);
          accessStore.setLoginExpired(false);
        });
        assertCurrentLoginAttempt(attemptVersion);
        await router.push({
          path: APP_DEFAULT_HOME_PATH,
          query: { forceChangePassword: '1' },
        });
        assertCurrentLoginAttempt(attemptVersion);
        notification.warning({
          description: $t('business.message.passwordResetRequiredDesc'),
          duration: 4,
          message: $t('business.message.passwordResetRequiredTitle'),
        });
        return { userInfo };
      }

      const resumeCurrentRoute = await runSessionStateMutation(() => {
        assertCurrentLoginAttempt(attemptVersion);
        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
          return true;
        }
        return false;
      });
      assertCurrentLoginAttempt(attemptVersion);
      if (resumeCurrentRoute) {
        await router.replace(router.currentRoute.value.fullPath);
        assertCurrentLoginAttempt(attemptVersion);
      } else {
        await (onSuccess
          ? onSuccess()
          : router.push(userInfo.homePath || APP_DEFAULT_HOME_PATH));
        assertCurrentLoginAttempt(attemptVersion);
      }

      assertCurrentLoginAttempt(attemptVersion);
      if (userInfo?.realName) {
        notification.success({
          description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
          duration: 3,
          message: $t('authentication.loginSuccess'),
        });
      }
    } catch (error) {
      if (issuedToken) {
        // 始终撤销本次签发的令牌，不能从共享 store 读取可能已切换的新会话。
        await logoutApi(issuedToken).catch(() => undefined);
      }
      if (
        !isCurrentLoginAttempt(attemptVersion) ||
        isLoginAttemptSupersededError(error)
      ) {
        return { userInfo: null };
      }
      await (isMfaCancelledError(error)
        ? handleMfaCancelled()
        : clearLoginSession(false));
      throw error;
    } finally {
      if (isCurrentLoginAttempt(attemptVersion)) {
        loginLoading.value = false;
      }
    }

    return {
      userInfo,
    };
  }

  // clearLoginSession 清理登录初始化失败留下的本地状态；MFA 取消时同时回到登录页。
  async function clearLoginSession(redirectToLogin: boolean) {
    destroyLoginMfaModal();
    await runSessionTransition(async () => {
      resetAllStores();
      resetSessionAccessState(router);
      accessStore.setAccessToken(null);
      accessStore.setAccessCodes([]);
      accessStore.setIsAccessChecked(false);
      accessStore.setLoginExpired(false);
      userStore.setUserInfo(null);
      if (redirectToLogin) {
        await router.replace({
          path: LOGIN_PATH,
          query: {},
        });
      }
    });
  }

  async function logout(redirect: boolean = true) {
    loginAttemptVersion += 1;
    loginLoading.value = false;
    destroyLoginMfaModal();
    const sourceToken = String(accessStore.accessToken || '');
    const sourceSessionIdentity = currentSessionStateIdentity();
    try {
      await logoutApi(sourceToken || undefined);
    } catch {
      // 不做任何处理
    }
    await runSessionTransitionIf(
      () => sourceSessionIdentity === currentSessionStateIdentity(),
      async () => {
        resetAllStores();
        resetSessionAccessState(router);
        accessStore.setLoginExpired(false);

        // 回登录页带上当前路由地址
        await router.replace({
          path: LOGIN_PATH,
          query: redirect
            ? {
                redirect: encodeURIComponent(
                  router.currentRoute.value.fullPath,
                ),
              }
            : {},
        });
      },
    );
  }

  async function fetchUserInfo() {
    const sessionVersion = currentSessionStateVersion();
    try {
      const userInfo = await loadUserInfo();
      await runSessionStateMutation(() => {
        if (sessionVersion !== currentSessionStateVersion()) {
          throw new Error(SESSION_STATE_CHANGED);
        }
        userStore.setUserInfo(userInfo);
      });
      return userInfo;
    } catch (error) {
      if (isMfaCancelledError(error)) {
        if (sessionVersion !== currentSessionStateVersion()) {
          throw new Error(SESSION_STATE_CHANGED, { cause: error });
        }
        await handleMfaCancelled();
      }
      throw error;
    }
  }

  // loadUserInfo 读取用户资料并处理登录 MFA；登录事务传入令牌后不会误用其他会话。
  async function loadUserInfo(attemptVersion?: number, accessToken?: string) {
    let userInfo: AdminUserInfo | null = null;
    const requestConfig = () => ({
      ...(accessToken ? createSessionBoundRequestConfig(accessToken) : {}),
      skipPasswordResetHandler: true,
    });
    try {
      userInfo = await getUserInfoApi(requestConfig());
    } catch (error) {
      assertOptionalLoginAttempt(attemptVersion);
      if (!isMfaRequiredError(error)) {
        throw error;
      }
      await verifyLoginMfa(
        (userStore.userInfo || undefined) as AuthApi.LoginUserInfo | undefined,
        accessToken,
      );
      assertOptionalLoginAttempt(attemptVersion);
      userInfo = await getUserInfoApi(requestConfig());
    }
    assertOptionalLoginAttempt(attemptVersion);
    return userInfo;
  }

  /**
   * 判断后端是否要求当前登录先完成MFA认证
   * @param user 登录接口返回的用户信息
   */
  function needLoginMfa(user?: AuthApi.LoginUserInfo) {
    const mfaCheckRequired = Number(user?.mfaCheck || 0) === 1;
    const mfaBindRequired = Boolean(user?.mfaBindRequired);
    const forceMfaEnabled = Boolean(user?.forceMFAEnabled);
    const mfaStatus = Number(user?.mfaStatus || 0);
    const forceNeedBind = forceMfaEnabled && mfaStatus !== 1;
    return mfaCheckRequired || mfaBindRequired || forceNeedBind;
  }

  /**
   * 判断后端是否要求当前登录先修改密码
   * @param user 登录接口或登录后初始化返回的用户信息
   */
  function needResetPassword(
    user?: AdminUserInfo | AuthApi.LoginUserInfo | null,
  ) {
    return Number(user?.needResetPassword || 0) === 1;
  }

  /**
   * 判断接口错误是否为MFA登录校验拦截
   * @param error 请求异常
   */
  function isMfaRequiredError(error: any) {
    const data = error?.response?.data ?? error;
    const code = Number(data?.code || 0);
    return (
      code === LOGIN_MFA_BIND_REQUIRED_CODE || code === LOGIN_MFA_REQUIRED_CODE
    );
  }

  /**
   * 弹出MFA认证框并调用后端完成登录场景校验
   * @param user 登录接口返回的用户信息
   */
  async function verifyLoginMfa(
    user?: AuthApi.LoginUserInfo,
    accessToken?: string,
  ) {
    const forceMfaEnabled = Boolean(user?.forceMFAEnabled);
    const mfaBindRequired = Boolean(user?.mfaBindRequired);
    const mfaStatus = Number(user?.mfaStatus || 0);
    const existMfa = Boolean(user?.existMFA);
    const needBind = mfaBindRequired || (forceMfaEnabled && mfaStatus !== 1);
    // 登录阶段只信任后端返回的 existMFA，避免“状态开启但秘钥丢失”时前端误判成可直接输码。
    const buildMfaUrl = needBind ? user?.buildMFAURL || '' : '';
    if (mfaStatus === 1 && !existMfa && !needBind) {
      notification.error({
        description: $t('business.message.mfaDeviceUnavailable'),
        duration: 5,
        message: $t('business.message.mfaDeviceUnavailableTitle'),
      });
      throw new Error(MFA_CANCELLED_ERROR);
    }
    if (needBind && !buildMfaUrl) {
      notification.error({
        description: $t('business.message.mfaBindingInfoMissingDesc'),
        duration: 5,
        message: $t('business.message.mfaBindingInfoMissingTitle'),
      });
      throw new Error(MFA_CANCELLED_ERROR);
    }
    let headerDescription = $t('business.message.mfaLoginVerifyDescription');
    let headerMessage = $t('business.message.mfaLoginVerifyTitle');
    if (buildMfaUrl) {
      headerDescription = forceMfaEnabled
        ? $t('business.message.mfaLoginBindForcedDescription', [
            getMfaMicrosoftScanTip(),
          ])
        : $t('business.message.mfaLoginBindDescription', [
            getMfaMicrosoftScanTip(),
          ]);
      headerMessage = forceMfaEnabled
        ? $t('business.message.mfaLoginBindForcedTitle')
        : $t('business.message.mfaLoginBindTitle');
    }
    destroyLoginMfaModal();
    const dialog = createMfaCheckDialog(MFA_LOGIN_SCENARIO, {
      accountName: user?.username,
      buildMfaUrl,
      cancelErrorMessage: MFA_CANCELLED_ERROR,
      headerDescription,
      headerMessage,
      okText: $t('business.message.mfaVerifyButton'),
      requestConfig: accessToken
        ? createSessionBoundRequestConfig(accessToken)
        : undefined,
      requireTwoStep: false,
      title: $t('business.message.mfaAuthTitle'),
    });
    loginMfaModalRef = dialog;
    try {
      const { secure } = await dialog.promise;
      if (!needBind) {
        return;
      }
      const mfaSecureKey = extractMfaSecret(buildMfaUrl) || undefined;
      const requestConfig = () => ({
        ...(accessToken ? createSessionBoundRequestConfig(accessToken) : {}),
        skipGlobalErrorMessage: true,
      });
      const enableResult = await checkMfaSecureApi(
        {
          mfaSecureKey,
          scenarios: MFA_STATUS_SCENARIO,
          secure,
        },
        requestConfig(),
      );
      if (!enableResult?.isOk || !enableResult.twoStep) {
        throw new Error($t('business.message.mfaEnableCheckFailed'));
      }
      await updateProfileMfaStatus(
        {
          mfaStatus: 1,
          mfaSecureKey,
          ...ticketPayload(enableResult.twoStep),
        },
        requestConfig(),
      );
    } finally {
      releaseLoginMfaModal(dialog);
    }
  }

  /**
   * 判断当前异常是否为用户主动取消登录阶段MFA认证。
   * @param error 登录阶段MFA异常
   */
  function isMfaCancelledError(error: unknown) {
    return error instanceof Error && error.message === MFA_CANCELLED_ERROR;
  }

  // isCurrentLoginAttempt 判断当前异步分支是否仍属于最新登录事务。
  function isCurrentLoginAttempt(attemptVersion: number) {
    return attemptVersion === loginAttemptVersion;
  }

  // assertCurrentLoginAttempt 在异步边界后拒绝旧登录事务继续提交。
  function assertCurrentLoginAttempt(attemptVersion: number) {
    if (!isCurrentLoginAttempt(attemptVersion)) {
      throw new Error(LOGIN_ATTEMPT_SUPERSEDED);
    }
  }

  // assertOptionalLoginAttempt 仅在登录初始化链路中校验事务版本。
  function assertOptionalLoginAttempt(attemptVersion?: number) {
    if (attemptVersion !== undefined) {
      assertCurrentLoginAttempt(attemptVersion);
    }
  }

  // isLoginAttemptSupersededError 识别被新登录取代的内部控制错误。
  function isLoginAttemptSupersededError(error: unknown) {
    return error instanceof Error && error.message === LOGIN_ATTEMPT_SUPERSEDED;
  }

  /**
   * handleMfaCancelled 在登录阶段取消MFA时统一清理登录态，并停留在登录页。
   */
  async function handleMfaCancelled() {
    Modal.destroyAll();
    await clearLoginSession(true);
  }

  /**
   * destroyLoginMfaModal 显式销毁当前登录阶段的 MFA 弹窗，避免页面回到登录页后仍残留旧弹层。
   */
  function destroyLoginMfaModal() {
    loginMfaModalRef?.destroy();
    destroyAllMfaOverlayDialogs();
    // 登录阶段只会使用全局确认框承载 MFA 弹窗，这里一并清理全局容器，避免成功跳转后残留旧节点。
    Modal.destroyAll();
    loginMfaModalRef = null;
  }

  // releaseLoginMfaModal 只释放本次登录持有的引用，旧异步分支不得销毁新登录弹层。
  function releaseLoginMfaModal(dialog: { destroy: () => void }) {
    if (loginMfaModalRef === dialog) {
      loginMfaModalRef = null;
    }
  }

  function $reset() {
    loginAttemptVersion += 1;
    loginLoading.value = false;
    destroyLoginMfaModal();
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
