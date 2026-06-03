import type { SystemAdminApi } from './admin';

import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemProfileApi 定义个人信息页面使用的数据类型。
export namespace SystemProfileApi {
  // Item 表示当前登录管理员资料。
  export interface Item extends Partial<SystemAdminApi.Item> {
    buildMFAURL?: string; // MFA绑定二维码地址
    existMFA?: boolean; // 是否已经绑定MFA设备
    forceMFAEnabled?: boolean; // 系统是否开启强制启用MFA
    frequency?: number; // MFA校验频率，单位秒
    groupID?: number; // 当前账号分组ID
    id?: number; // 当前用户 ID
    mfaBindRequired?: boolean; // 当前登录是否必须先绑定并启用MFA
    needResetPassword?: number; // 是否必须先修改登录密码
    mfaCheck?: number; // 当前登录是否需要先完成MFA校验
    token?: string; // 当前访问令牌
  }

  // RefreshMfaSecretResp 表示重新生成 MFA 秘钥后的响应。
  export interface RefreshMfaSecretResp {
    buildMFAURL?: string; // 重新生成后的 MFA 绑定二维码地址
  }

  // UpdateMineParams 表示个人中心基础资料更新参数。
  export interface UpdateMineParams extends CommonApi.TwoStepReq {
    avatar?: string; // 头像地址
    description?: string; // 个人说明
    email?: string; // 邮箱
    phone?: string; // 手机号
    realName?: string; // 真实姓名
  }

  // UpdatePasswordParams 表示个人中心修改密码参数。
  export interface UpdatePasswordParams extends CommonApi.TwoStepReq {
    confirmPassword: string; // 确认新密码
    passwordNew: string; // 新密码
    passwordOld: string; // 旧密码
  }

  // UpdateMfaStatusParams 表示个人中心修改MFA状态参数。
  export interface UpdateMfaStatusParams extends CommonApi.TwoStepReq {
    mfaStatus: number; // MFA状态：0关闭，1开启
    mfaSecureKey?: string; // 当前绑定流程使用的TOTP MFA秘钥
  }
}

// fetchProfileInfo 查询当前登录管理员资料。
export async function fetchProfileInfo() {
  return requestClient.get<SystemProfileApi.Item>('/profile');
}

// updateProfileInfo 更新当前登录管理员基础资料。
export async function updateProfileInfo(
  data: SystemProfileApi.UpdateMineParams,
) {
  return requestClient.patch('/profile', data);
}

// updateProfilePassword 修改当前登录管理员密码。
export async function updateProfilePassword(
  data: SystemProfileApi.UpdatePasswordParams,
) {
  return requestClient.patch('/profile/password', data);
}

// updateProfileMfaStatus 修改当前登录管理员MFA状态。
export async function updateProfileMfaStatus(
  data: SystemProfileApi.UpdateMfaStatusParams,
) {
  return requestClient.patch('/profile/mfa-status', data);
}

// refreshProfileMfaSecretKey 重新生成当前登录管理员 MFA 秘钥。
export async function refreshProfileMfaSecretKey(data?: CommonApi.TwoStepReq) {
  return requestClient.post<SystemProfileApi.RefreshMfaSecretResp>(
    '/profile/mfa-secret/refresh',
    data || {},
  );
}
