/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientConfig, RequestClientOptions } from '@vben/request';

import type { AuthApi } from './core';
import type { SystemProfileApi } from './system';

import { LOGIN_PATH } from '@vben/constants';
import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { ACCESS_SYNC_FORBIDDEN_EVENT } from '#/constants/access-sync';
import { $t } from '#/locales';
import { router } from '#/router';
import {
  createTraceId,
  createTraceparent,
  extractResponseTraceId,
  formatTraceErrorMessage,
  TRACE_ID_HEADER,
  TRACEPARENT_HEADER,
} from '#/utils/request/trace';
import { extractMfaSecret } from '#/utils/security/mfa-core';
import { getMfaMicrosoftScanTip } from '#/utils/security/mfa-guide';
import { createMfaOverlayDialog } from '#/utils/security/mfa-overlay';
import {
  attachAdminSecurityHeaders,
  handleAdminSecurityResponse,
} from '#/utils/security/signature';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
// reauthRedirecting 标记当前是否正在跳转登录页，避免并发 401 触发多次重定向。
let reauthRedirecting = false;
// loginMfaVerifying 标记当前是否存在进行中的登录 MFA 校验弹窗流程，避免重复弹窗。
let loginMfaVerifying: null | Promise<void> = null;
// passwordResetRedirecting 标记当前是否正在执行“强制改密”跳转，避免并发请求反复弹提示。
let passwordResetRedirecting = false;
// lastPasswordResetPromptAt 记录上次提示时间，避免短时间内重复提示刷屏。
let lastPasswordResetPromptAt = 0;

// LOGIN_MFA_BIND_REQUIRED_CODE 表示后端要求当前账号先完成 MFA 绑定与启用。
const LOGIN_MFA_BIND_REQUIRED_CODE = 5;
// LOGIN_MFA_REQUIRED_CODE 表示后端要求当前登录会话先完成 MFA 校验。
const LOGIN_MFA_REQUIRED_CODE = 6;
// PASSWORD_RESET_REQUIRED_CODE 表示后端要求当前账号先修改登录密码。
const PASSWORD_RESET_REQUIRED_CODE = 7;
// MFA_CHECK_AGAIN_CODE 表示后端要求当前请求重新执行一次 MFA 二次确认。
const MFA_CHECK_AGAIN_CODE = 8;
// FORBIDDEN_CODES 表示后端无权限业务码集合，命中时会触发一次节流权限同步。
const FORBIDDEN_CODES = new Set([5, 403]);
// LOGIN_MFA_CANCELLED 表示用户主动取消登录 MFA 弹窗时抛出的统一错误码。
const LOGIN_MFA_CANCELLED = 'LOGIN_MFA_CANCELLED';
// LOGIN_MFA_USER_UPDATED_EVENT 表示登录 MFA 成功后向页面广播最新用户上下文的事件名。
const LOGIN_MFA_USER_UPDATED_EVENT = 'login-mfa-user-updated';
// LOGIN_MFA_SKIP_URLS 表示不应再触发登录 MFA 拦截的接口白名单，避免递归请求自身。
const LOGIN_MFA_SKIP_URLS = new Set([
  '/auth/profile',
  '/profile/check-mfa',
  '/profile/mfa-status',
]);
// PASSWORD_RESET_PROFILE_URLS 表示会返回 needResetPassword 标记的用户资料接口。
const PASSWORD_RESET_PROFILE_URLS = new Set(['/auth/profile', '/profile']);
// ACCESS_SYNC_SKIP_URLS 表示权限同步自身依赖的接口，避免 403 兜底刷新形成递归触发。
const ACCESS_SYNC_SKIP_URLS = new Set(['/auth/codes', '/auth/profile']);

// LoginMfaUserContext 表示登录 MFA 弹窗依赖的最小用户上下文字段集合。
type LoginMfaUserContext = {
  buildMFAURL?: string;
  existMFA?: boolean;
  forceMFAEnabled?: boolean;
  id?: number | string;
  mfaBindRequired?: boolean;
  mfaStatus?: number;
  username?: string;
};

// UserStoreInfo 表示当前 vben 用户仓库接受的用户资料结构。
type UserStoreInfo = NonNullable<ReturnType<typeof useUserStore>['userInfo']>;

// UserInfoPatch 表示后端用户资料增量字段。
type UserInfoPatch = Partial<UserStoreInfo> &
  Record<string, unknown> & {
    id?: number | string;
    needResetPassword?: number;
  };

// createRequestClient 创建后台请求客户端，并统一挂载登录态、安全头、刷新令牌与登录 MFA 处理逻辑。
function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  // redirectToLoginPage 统一清理登录态并带上当前路由回跳登录页。
  async function redirectToLoginPage() {
    if (reauthRedirecting) {
      return;
    }
    reauthRedirecting = true;
    try {
      const accessStore = useAccessStore();
      const currentPath = router.currentRoute.value.fullPath;
      resetAllStores();
      accessStore.setAccessToken(null);
      accessStore.setLoginExpired(false);
      await router.replace({
        path: LOGIN_PATH,
        query:
          currentPath && currentPath !== LOGIN_PATH
            ? { redirect: encodeURIComponent(currentPath) }
            : {},
      });
    } finally {
      reauthRedirecting = false;
    }
  }

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    const accessStore = useAccessStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await redirectToLoginPage();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    if (!resp.isRefresh) {
      return resp.token;
    }
    const newToken = resp.token;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // normalizeApiPath 把绝对地址和带查询参数的 URL 统一归一成小写 API 路径。
  function normalizeApiPath(url?: string) {
    const rawUrl = String(url ?? '');
    return (rawUrl.split('?')[0] ?? '')
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/api(?=\/)/, '')
      .toLowerCase();
  }

  // notifyAccessForbiddenSync 通知布局层低频刷新权限态；请求层只发事件，避免和 API 客户端形成循环依赖。
  function notifyAccessForbiddenSync(config?: Record<string, any>) {
    if (typeof window === 'undefined') {
      return;
    }
    const accessStore = useAccessStore();
    if (!accessStore.accessToken) {
      return;
    }
    const apiPath = normalizeApiPath(String(config?.url || ''));
    if (ACCESS_SYNC_SKIP_URLS.has(apiPath)) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent(ACCESS_SYNC_FORBIDDEN_EVENT, {
        detail: { path: apiPath },
      }),
    );
  }

  // promptPasswordResetRequired 统一提示“必须先修改登录密码”，并做短时间去重。
  function promptPasswordResetRequired() {
    const now = Date.now();
    if (now - lastPasswordResetPromptAt < 1500) {
      return;
    }
    lastPasswordResetPromptAt = now;
    message.warning($t('business.message.passwordChangeRequiredGoProfile'));
  }

  // syncPasswordResetFlag 把必须改密状态同步回 userStore，便于路由守卫和个人中心页面复用同一份状态。
  function syncPasswordResetFlag(user?: UserInfoPatch) {
    const userStore = useUserStore();
    if (!userStore.userInfo && !user) {
      return;
    }
    userStore.setUserInfo(
      toUserStoreInfo(
        {
          ...user,
          needResetPassword: 1,
        },
        userStore.userInfo,
      ),
    );
  }

  // toUserStoreInfo 合并后端用户资料并补齐 vben 用户仓库需要的基础字段。
  function toUserStoreInfo(
    user: UserInfoPatch,
    currentUserInfo: null | UserStoreInfo,
  ): UserStoreInfo {
    const merged = {
      ...currentUserInfo,
      ...user,
    };
    return {
      ...merged,
      avatar: String(merged.avatar || preferences.app.defaultAvatar || ''),
      realName: String(merged.realName || ''),
      roles: Array.isArray(merged.roles) ? merged.roles.map(String) : [],
      userId: String(merged.userId || merged.id || ''),
      username: String(merged.username || ''),
    };
  }

  // redirectToPasswordResetPage 统一处理“必须先修改登录密码”的前端提示与跳转。
  async function redirectToPasswordResetPage(user?: UserInfoPatch) {
    syncPasswordResetFlag(user);
    promptPasswordResetRequired();
    if (passwordResetRedirecting) {
      return;
    }
    if (router.currentRoute.value.name === 'SystemProfile') {
      return;
    }
    passwordResetRedirecting = true;
    try {
      const accessStore = useAccessStore();
      accessStore.setLoginExpired(false);
      try {
        await router.push({
          name: 'SystemProfile',
          query: { forceChangePassword: '1' },
        });
      } catch {
        await router.push({
          path: '/profile-manage/index',
          query: { forceChangePassword: '1' },
        });
      }
    } finally {
      passwordResetRedirecting = false;
    }
  }

  // shouldSkipLoginMfaHandler 判断当前请求是否应跳过登录 MFA 全局拦截。
  function shouldSkipLoginMfaHandler(config?: RequestClientConfig) {
    if (!config) {
      return true;
    }
    if (config.skipLoginMfaHandler) {
      return true;
    }
    return LOGIN_MFA_SKIP_URLS.has(normalizeApiPath(String(config.url || '')));
  }

  // markSkipGlobalMessage 给错误对象打标，避免再被全局错误提示重复弹出。
  function markSkipGlobalMessage(error: any) {
    if (error && typeof error === 'object') {
      error.__skipGlobalErrorMessage = true;
      return error;
    }
    return {
      __skipGlobalErrorMessage: true,
      message: String(error || ''),
    };
  }

  // currentLoginMfaUser 读取当前用户资料中的登录 MFA 上下文。
  function currentLoginMfaUser() {
    return (useUserStore().userInfo || {}) as LoginMfaUserContext;
  }

  // setLoginMfaUser 合并并回写登录 MFA 过程中拿到的最新用户资料。
  function setLoginMfaUser(user: UserInfoPatch) {
    const userStore = useUserStore();
    const currentUserInfo = userStore.userInfo;
    let nextRoles: string[] = [];
    if (Array.isArray(user.roles)) {
      nextRoles = user.roles;
    } else if (Array.isArray(currentUserInfo?.roles)) {
      nextRoles = currentUserInfo.roles;
    }
    const nextUserInfo = toUserStoreInfo(
      {
        ...user,
        id: Number(user.id || currentUserInfo?.id || 0) || undefined,
        roles: nextRoles,
      },
      currentUserInfo,
    );
    userStore.setUserInfo(nextUserInfo);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(LOGIN_MFA_USER_UPDATED_EVENT, {
          detail: nextUserInfo,
        }),
      );
    }
  }

  // refreshUserInfoAfterLoginMfa 在登录 MFA 完成后刷新一次登录后资料，保证前端缓存同步最新状态。
  async function refreshUserInfoAfterLoginMfa() {
    try {
      const userInfo = await client.get('/auth/profile', {
        skipLoginMfaHandler: true,
      });
      if (userInfo && typeof userInfo === 'object') {
        setLoginMfaUser(userInfo as UserInfoPatch);
      }
    } catch {
      // 登录 MFA 完成后刷新资料失败时，不阻断原请求重试。
    }
  }

  // openLoginMfaDialog 打开登录 MFA 弹窗，并在需要时完成“校验 + 绑定启用”两段式流程。
  async function openLoginMfaDialog(user: LoginMfaUserContext) {
    // mfaStatus 表示当前用户是否已正式启用 MFA。
    const mfaStatus = Number(user?.mfaStatus || 0);
    // buildMfaUrl 表示当前登录上下文下发的 MFA 绑定二维码地址。
    let buildMfaUrl = String(user?.buildMFAURL || '').trim();
    // mfaBindRequired 表示后端是否要求本次登录先完成绑定。
    const mfaBindRequired = Boolean(user?.mfaBindRequired);
    // forceMfaEnabled 表示系统是否开启“必须启用 MFA”策略。
    const forceMfaEnabled = Boolean(user?.forceMFAEnabled);
    // existMfa 表示当前账号是否仍然存在可用的已绑定设备。
    const existMfa = Boolean(user?.existMFA);
    // needBind 表示当前登录是否处于“必须先绑定后继续”的流程。
    const needBind = mfaBindRequired || (forceMfaEnabled && mfaStatus !== 1);
    // hasUserContext 表示当前登录态是否具备完成登录 MFA 的最小上下文。
    const hasUserContext =
      mfaStatus === 1 || needBind || Boolean(user?.username);

    if (!hasUserContext) {
      message.error($t('business.message.mfaVerifyContextMissing'));
      throw new Error(LOGIN_MFA_CANCELLED);
    }

    if (mfaStatus === 1 && !existMfa && !needBind) {
      message.error($t('business.message.mfaDeviceUnavailable'));
      throw new Error(LOGIN_MFA_CANCELLED);
    }
    if (needBind && !buildMfaUrl) {
      try {
        const resp = await client.post<SystemProfileApi.RefreshMfaSecretResp>(
          '/profile/mfa-secret/refresh',
          {},
          {
            skipGlobalErrorMessage: true,
            skipLoginMfaHandler: true,
          },
        );
        const refreshed = String(resp?.buildMFAURL || '').trim();
        if (refreshed) {
          buildMfaUrl = refreshed;
          setLoginMfaUser({
            buildMFAURL: refreshed,
            existMFA: false,
            mfaBindRequired: true,
            mfaStatus: 0,
          });
        }
      } catch {
        // ignore
      }
    }
    if (needBind && !buildMfaUrl) {
      message.error($t('business.message.mfaBindingContextMissing'));
      throw new Error(LOGIN_MFA_CANCELLED);
    }
    let headerDescription = $t('business.message.mfaLoginVerifyDescription');
    let headerMessage = $t('business.message.mfaLoginVerifyTitle');
    if (needBind) {
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
    const dialog = createMfaOverlayDialog({
      accountName: user.username,
      buildMfaUrl: needBind ? buildMfaUrl : '',
      cancelErrorMessage: LOGIN_MFA_CANCELLED,
      headerDescription,
      headerMessage,
      okText: $t('business.message.mfaVerifyButton'),
      onSubmit: async ({ buildMfaUrl: currentBuildMfaUrl, secure }) => {
        const loginCheckResp = await client.post<AuthApi.CheckMfaResult>(
          '/profile/check-mfa',
          {
            mfaSecureKey: needBind
              ? extractMfaSecret(currentBuildMfaUrl) || undefined
              : undefined,
            scenarios: 0,
            secure,
          },
          {
            skipGlobalErrorMessage: true,
            skipLoginMfaHandler: true,
          },
        );

        if (!loginCheckResp?.isOk) {
          throw new Error($t('business.message.mfaCodeInvalid'));
        }

        if (needBind) {
          const mfaSecureKey =
            extractMfaSecret(currentBuildMfaUrl) || undefined;
          const enableCheckResp = await client.post<AuthApi.CheckMfaResult>(
            '/profile/check-mfa',
            {
              mfaSecureKey,
              scenarios: 2,
              secure,
            },
            {
              skipGlobalErrorMessage: true,
              skipLoginMfaHandler: true,
            },
          );

          if (!enableCheckResp?.isOk || !enableCheckResp?.twoStep) {
            throw new Error($t('business.message.mfaEnableCheckFailed'));
          }

          await client.patch(
            '/profile/mfa-status',
            {
              mfaSecureKey,
              mfaStatus: 1,
              twoStepKey: enableCheckResp.twoStep?.key,
              twoStepValue: enableCheckResp.twoStep?.value,
            },
            {
              skipGlobalErrorMessage: true,
              skipLoginMfaHandler: true,
            },
          );

          setLoginMfaUser({
            buildMFAURL: '',
            existMFA: true,
            mfaStatus: 1,
            mfaBindRequired: false,
          });
        }
      },
      submitErrorMessage: needBind
        ? $t('business.message.mfaBindCheckFailed')
        : $t('business.message.mfaCodeInvalid'),
      title: $t('business.message.mfaAuthTitle'),
    });
    await dialog.promise;
  }

  // ensureLoginMfaVerified 保证同一时刻只存在一个登录 MFA 校验流程。
  async function ensureLoginMfaVerified(bindRequired = false) {
    if (loginMfaVerifying) {
      return loginMfaVerifying;
    }

    loginMfaVerifying = (async () => {
      const currentUser = currentLoginMfaUser();
      const user = bindRequired
        ? {
            ...currentUser,
            existMFA: false,
            mfaBindRequired: true,
            mfaStatus: 0,
          }
        : currentUser;
      await openLoginMfaDialog(user);
      await refreshUserInfoAfterLoginMfa();
    })().finally(() => {
      loginMfaVerifying = null;
    });

    return loginMfaVerifying;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      // 为每个请求添加 X-Trace-Id，用于链路/请求追踪
      // 如果调用方已传入，则保留原值
      if (
        !config.headers[TRACE_ID_HEADER] &&
        !config.headers[TRACE_ID_HEADER.toLowerCase()]
      ) {
        config.headers[TRACE_ID_HEADER] = createTraceId();
      }
      if (
        !config.headers[TRACEPARENT_HEADER] &&
        !config.headers[TRACEPARENT_HEADER.toLowerCase()]
      ) {
        const traceId = String(
          config.headers[TRACE_ID_HEADER] ||
            config.headers[TRACE_ID_HEADER.toLowerCase()] ||
            '',
        );
        const traceparent = createTraceparent(traceId);
        if (traceparent) {
          config.headers[TRACEPARENT_HEADER] = traceparent;
        }
      }
      // 参考 laravel-admin：敏感接口可按环境变量开启 AppID、签名与加密。
      return attachAdminSecurityHeaders(config);
    },
  });

  // 响应返回后，先做敏感字段解密和响应验签，再交给通用响应拆包逻辑处理。
  client.addResponseInterceptor({
    fulfilled: async (response) => handleAdminSecurityResponse(response),
  });

  // 用户资料接口若明确返回 needResetPassword=1，则前端立即提示并跳转个人中心改密。
  client.addResponseInterceptor({
    fulfilled: async (response) => {
      const apiPath = normalizeApiPath(String(response?.config?.url || ''));
      const payload = response?.data?.data;
      if (
        PASSWORD_RESET_PROFILE_URLS.has(apiPath) &&
        Number(payload?.needResetPassword || 0) === 1
      ) {
        await redirectToPasswordResetPage(payload);
      }
      return response;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      // 后端返回格式: { status: true, code: 1, message: '成功', data: {...} }
      // 使用 `status` 字段作为成功标识，successCode 为 true
      codeField: 'status',
      dataField: 'data',
      successCode: (v: any) => v === true,
    }),
  );

  // 后端部分接口虽然 HTTP 仍返回 200，但业务体会返回 code=401，这里统一视为未授权处理。
  client.addResponseInterceptor({
    rejected: async (error) => {
      const response = error?.response;
      const httpStatus = response?.status;
      const businessCode = Number(response?.data?.code ?? 0);
      if (httpStatus === 403 || FORBIDDEN_CODES.has(businessCode)) {
        notifyAccessForbiddenSync(error?.config || response?.config);
      }
      if (httpStatus !== 401 && businessCode === 401) {
        await doReAuthenticate();
      }
      throw error;
    },
  });

  // 登录后若后端统一返回 code=6，自动拉起 MFA 认证或首次绑定流程，成功后重放原请求。
  client.addResponseInterceptor({
    rejected: async (error) => {
      const response = error?.response;
      const businessCode = Number(response?.data?.code ?? 0);
      const requestConfig = (error?.config ||
        response?.config ||
        {}) as RequestClientConfig;

      if (
        businessCode !== LOGIN_MFA_REQUIRED_CODE &&
        businessCode !== LOGIN_MFA_BIND_REQUIRED_CODE
      ) {
        throw error;
      }
      if (
        shouldSkipLoginMfaHandler(requestConfig) ||
        requestConfig.__loginMfaRetried
      ) {
        throw error;
      }

      try {
        await ensureLoginMfaVerified(
          businessCode === LOGIN_MFA_BIND_REQUIRED_CODE,
        );
      } catch (mfaError) {
        throw markSkipGlobalMessage(mfaError);
      }

      const retryUrl = requestConfig.url;
      if (!retryUrl) {
        throw error;
      }
      return client.request(retryUrl, {
        ...requestConfig,
        __loginMfaRetried: true,
      });
    },
  });

  // 业务码 7 表示当前账号必须先修改登录密码；统一提示并跳转个人中心，避免各页面各自处理。
  client.addResponseInterceptor({
    rejected: async (error) => {
      const response = error?.response;
      const businessCode = Number(response?.data?.code ?? 0);
      if (businessCode !== PASSWORD_RESET_REQUIRED_CODE) {
        throw error;
      }
      await redirectToPasswordResetPage(response?.data?.data);
      throw markSkipGlobalMessage(error);
    },
  });

  // 敏感操作在窗口内若票据缺失或刚好过期，会返回业务码 8；
  // 这类错误由页面侧的 submitWithMfaRetry/requestMfaTwoStep 负责接管并直接拉起 MFA 弹窗，
  // 这里不要再走通用错误提示，避免用户先看到一条红色报错再弹窗。
  client.addResponseInterceptor({
    rejected: async (error) => {
      const response = error?.response;
      const businessCode = Number(response?.data?.code ?? 0);
      if (businessCode === MFA_CHECK_AGAIN_CODE) {
        throw markSkipGlobalMessage(error);
      }
      throw error;
    },
  });

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      if (
        error?.__skipGlobalErrorMessage ||
        error?.config?.skipGlobalErrorMessage ||
        error?.response?.config?.skipGlobalErrorMessage
      ) {
        return;
      }
      const responseData = error?.response?.data ?? {};
      const respCode = responseData?.code ?? '';
      const respMessage = responseData?.message ?? responseData?.error ?? '';
      const traceId = extractResponseTraceId(error);

      // 拼接 code 与 message
      let errorMessage = '';
      if (respCode && respMessage) {
        errorMessage = `code: ${respCode} ${respMessage}`;
      } else if (respMessage) {
        errorMessage = respMessage;
      } else if (respCode) {
        errorMessage = `code: ${respCode}`;
      }

      // 如果没有任何后端错误信息，则使用通用 msg
      message.error(formatTraceErrorMessage(errorMessage || msg, traceId));
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});
