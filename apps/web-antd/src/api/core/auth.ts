import {
  baseRequestClient,
  createSessionBoundRequestConfig,
  requestClient,
} from '#/api/request';

import { AUTH_REFRESH_PATH } from '../token-refresh';

// PUBLIC_AUTH_REQUEST_CONFIG 保证公共认证入口不参与已有会话的续签、重认证和登录 MFA 恢复流程。
const PUBLIC_AUTH_REQUEST_CONFIG = {
  skipAccessTokenRefresh: true,
  skipLoginMfaHandler: true,
  skipReAuthenticate: true,
} as const;

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    captcha?: string;
    key?: string;
    password?: string;
    secureCode?: string;
    username?: string;
  }

  /** 登录图形验证码返回值 */
  export interface LoginCaptchaResult {
    expireSeconds: number;
    image: string;
    key: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    token: string; // 访问令牌
    user?: LoginUserInfo; // 登录后的用户资料与MFA状态
  }

  /** RefreshTokenResult 表示有效会话主动续签后的令牌结果 */
  export interface RefreshTokenResult {
    isRefresh: boolean; // 是否已完成令牌轮换
    token: string; // 新访问令牌
  }

  /** LoginUserInfo 表示登录接口返回的MFA相关用户资料 */
  export interface LoginUserInfo {
    id?: number | string; // 用户 ID
    buildMFAURL?: string; // MFA绑定二维码地址
    existMFA?: boolean; // 是否已存在MFA秘钥
    forceMFAEnabled?: boolean; // 系统是否开启强制启用MFA
    frequency?: number; // MFA校验频率
    mfaBindRequired?: boolean; // 当前登录是否必须先绑定并启用MFA
    mfaCheck?: number; // 是否需要登录MFA校验：1需要
    mfaStatus?: number; // MFA启用状态
    needResetPassword?: number; // 是否必须先修改登录密码：1需要
    realName?: string; // 真实姓名
    username?: string; // 登录用户名
  }

  /** CheckMfaParams 表示校验MFA动态码请求参数 */
  export interface CheckMfaParams {
    scenarios: number; // MFA场景：0登录、1改密、2状态、3秘钥、6资料
    secure: string; // MFA动态验证码
    mfaSecureKey?: string; // 当前绑定流程使用的TOTP MFA秘钥
  }

  /** CheckSecureParams 表示校验当前账号登录密码请求参数 */
  export interface CheckSecureParams {
    secure: string; // 当前账号登录密码
  }

  /** CheckSecureResult 表示登录密码校验结果 */
  export interface CheckSecureResult {
    isOk: boolean; // 是否校验成功
  }

  /** TwoStepTicket 表示MFA二次确认票据 */
  export interface TwoStepTicket {
    expire: number; // 有效期秒数
    key: string; // 票据key
    time: number; // 生成时间
    value: string; // 票据value
  }

  /** CheckMfaResult 表示MFA动态码校验结果 */
  export interface CheckMfaResult {
    buildMFAURL?: string; // MFA绑定二维码地址
    existMFA?: boolean; // 是否已存在MFA秘钥
    frequency?: number; // MFA校验频率
    isOk: boolean; // 是否校验成功
    mfaCheck?: number; // 登录MFA校验状态
    scenarios: number; // MFA场景
    twoStep?: TwoStepTicket; // 二次确认票据
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/auth/login',
    data,
    PUBLIC_AUTH_REQUEST_CONFIG,
  );
}

/**
 * 获取登录图形验证码
 */
export async function getLoginCaptchaApi() {
  return requestClient.get<AuthApi.LoginCaptchaResult>(
    '/auth/captcha',
    PUBLIC_AUTH_REQUEST_CONFIG,
  );
}

/**
 * 为当前仍有效的会话主动续签访问令牌
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(AUTH_REFRESH_PATH);
}

/**
 * 退出登录
 */
export async function logoutApi(accessToken?: string) {
  return baseRequestClient.post('/auth/logout', undefined, {
    ...(accessToken ? createSessionBoundRequestConfig(accessToken) : {}),
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi(config?: Record<string, any>) {
  return requestClient.get<string[]>('/auth/codes', config);
}

/**
 * 校验当前账号登录密码
 */
export async function checkSecureApi(
  data: AuthApi.CheckSecureParams,
  config?: Record<string, any>,
) {
  return requestClient.post<AuthApi.CheckSecureResult>(
    '/profile/check-secure',
    data,
    config,
  );
}

/**
 * 校验MFA动态码
 */
export async function checkMfaSecureApi(
  data: AuthApi.CheckMfaParams,
  config?: Record<string, any>,
) {
  return requestClient.post<AuthApi.CheckMfaResult>(
    '/profile/check-mfa',
    data,
    config,
  );
}
