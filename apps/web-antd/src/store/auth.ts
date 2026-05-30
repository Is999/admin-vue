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

// MFA_LOGIN_SCENARIO 表示登录后的MFA校验场景。
const MFA_LOGIN_SCENARIO = 0;
const MFA_STATUS_SCENARIO = 2;
// MFA_CANCELLED_ERROR 表示用户主动取消登录阶段 MFA 认证。
const MFA_CANCELLED_ERROR = 'MFA_CANCELLED';
export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  // loginMfaModalRef 保存当前登录阶段的 MFA 弹窗实例，便于取消或跳转时显式销毁。
  let loginMfaModalRef: null | { destroy: () => void } = null;

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: AdminUserInfo | null = null;
    try {
      loginLoading.value = true;
      // 登录滑块等表单态字段仅用于前端校验，提交后端时只保留登录接口实际识别的参数。
      const loginParams = {
        captcha: params?.captcha,
        ip: params?.ip,
        key: params?.key,
        password: params?.password,
        secureCode: params?.secureCode,
        username: params?.username,
      };
      const { token, user } = await loginApi(loginParams);

      // 如果成功获取到 accessToken
      if (token) {
        accessStore.setAccessToken(token);
        userStore.setUserInfo((user || null) as any);
        try {
          if (needLoginMfa(user)) {
            await verifyLoginMfa(user);
          }
        } catch (error) {
          if (isMfaCancelledError(error)) {
            await handleMfaCancelled();
            return { userInfo: null };
          }
          accessStore.setAccessToken(null);
          userStore.setUserInfo(null);
          throw error;
        }

        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);

        userInfo = fetchUserInfoResult;

        userStore.setUserInfo(userInfo);
        // 超级管理员后端可能返回空权限码，前端统一补齐全部权限码，避免菜单与按钮显隐失效。
        accessStore.setAccessCodes(
          buildEffectiveAccessCodes(userInfo, accessCodes),
        );

        if (needResetPassword(userInfo || user)) {
          accessStore.setLoginExpired(false);
          await router.push({
            name: 'SystemProfile',
            query: { forceChangePassword: '1' },
          });
          notification.warning({
            description: $t('business.message.passwordResetRequiredDesc'),
            duration: 4,
            message: $t('business.message.passwordResetRequiredTitle'),
          });
          return { userInfo };
        }

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          await (onSuccess
            ? onSuccess()
            : router.push(userInfo.homePath || APP_DEFAULT_HOME_PATH));
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    let userInfo: AdminUserInfo | null = null;
    try {
      userInfo = await getUserInfoApi();
    } catch (error) {
      if (!isMfaRequiredError(error)) {
        throw error;
      }
      try {
        await verifyLoginMfa(
          (userStore.userInfo || undefined) as
            | AuthApi.LoginUserInfo
            | undefined,
        );
      } catch (mfaError) {
        if (isMfaCancelledError(mfaError)) {
          await handleMfaCancelled();
        }
        throw mfaError;
      }
      userInfo = await getUserInfoApi();
    }
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  /**
   * 判断后端是否要求当前登录先完成MFA认证
   * @param user 登录接口返回的兼容用户信息
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
    return code === 6 || code === 9;
  }

  /**
   * 弹出MFA认证框并调用后端完成登录场景校验
   * @param user 登录接口返回的兼容用户信息
   */
  function verifyLoginMfa(user?: AuthApi.LoginUserInfo) {
    const forceMfaEnabled = Boolean(user?.forceMFAEnabled);
    const mfaBindRequired = Boolean(user?.mfaBindRequired);
    const mfaStatus = Number(user?.mfaStatus || 0);
    const needBind = mfaBindRequired || (forceMfaEnabled && mfaStatus !== 1);
    // 登录阶段只信任后端返回的 existMFA，避免“状态开启但秘钥丢失”时前端误判成可直接输码。
    const existMfa = Boolean(user?.existMFA);
    const buildMfaUrl = needBind ? user?.buildMFAURL || '' : '';
    if (mfaStatus === 1 && !existMfa) {
      notification.error({
        description: $t('business.message.mfaDeviceUnavailable'),
        duration: 5,
        message: $t('business.message.mfaDeviceUnavailableTitle'),
      });
      return Promise.reject(new Error(MFA_CANCELLED_ERROR));
    }
    if (needBind && !buildMfaUrl) {
      notification.error({
        description: $t('business.message.mfaBindingInfoMissingDesc'),
        duration: 5,
        message: $t('business.message.mfaBindingInfoMissingTitle'),
      });
      return Promise.reject(new Error(MFA_CANCELLED_ERROR));
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
    return new Promise<void>((resolve, reject) => {
      destroyLoginMfaModal();
      const dialog = createMfaCheckDialog(MFA_LOGIN_SCENARIO, {
        accountName: user?.username,
        buildMfaUrl,
        cancelErrorMessage: MFA_CANCELLED_ERROR,
        headerDescription,
        headerMessage,
        okText: $t('business.message.mfaVerifyButton'),
        requireTwoStep: false,
        title: $t('business.message.mfaAuthTitle'),
      });
      loginMfaModalRef = dialog;
      dialog.promise
        .then(async ({ secure }) => {
          if (needBind) {
            const mfaSecureKey = extractMfaSecret(buildMfaUrl) || undefined;
            const enableResult = await checkMfaSecureApi(
              {
                mfaSecureKey,
                scenarios: MFA_STATUS_SCENARIO,
                secure,
              },
              {
                skipGlobalErrorMessage: true,
              },
            );
            if (!enableResult?.isOk || !enableResult.twoStep) {
              throw new Error($t('business.message.mfaEnableCheckFailed'));
            }
            await updateProfileMfaStatus({
              mfaStatus: 1,
              mfaSecureKey,
              ...ticketPayload(enableResult.twoStep),
            });
          }
          destroyLoginMfaModal();
          resolve();
        })
        .catch((error) => {
          destroyLoginMfaModal();
          reject(error);
        });
    });
  }

  /**
   * 判断当前异常是否为用户主动取消登录阶段MFA认证。
   * @param error 登录阶段MFA异常
   */
  function isMfaCancelledError(error: unknown) {
    return error instanceof Error && error.message === MFA_CANCELLED_ERROR;
  }

  /**
   * handleMfaCancelled 在登录阶段取消MFA时统一清理登录态，并停留在登录页。
   */
  async function handleMfaCancelled() {
    destroyLoginMfaModal();
    Modal.destroyAll();
    resetAllStores();
    accessStore.setAccessToken(null);
    accessStore.setLoginExpired(false);
    userStore.setUserInfo(null);
    await router.replace({
      path: LOGIN_PATH,
      query: {},
    });
  }

  /**
   * destroyLoginMfaModal 显式销毁当前登录阶段的 MFA 弹窗，避免页面回到登录页后仍残留旧弹层。
   */
  function destroyLoginMfaModal() {
    loginMfaModalRef?.destroy();
    // 登录阶段只会使用全局确认框承载 MFA 弹窗，这里一并清理全局容器，避免成功跳转后残留旧节点。
    Modal.destroyAll();
    loginMfaModalRef = null;
  }

  function $reset() {
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
