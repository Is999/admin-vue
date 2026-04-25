import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    captcha?: string;
    key?: string;
    password?: string;
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

  /** LoginUserInfo 表示登录接口返回的MFA相关用户资料 */
  export interface LoginUserInfo {
    id?: number | string; // 用户ID
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

  export interface RefreshTokenResult {
    token: string;
    isRefresh: boolean;
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
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 获取登录图形验证码
 */
export async function getLoginCaptchaApi() {
  return requestClient.get<AuthApi.LoginCaptchaResult>('/auth/captcha');
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    undefined,
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', undefined, {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
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
