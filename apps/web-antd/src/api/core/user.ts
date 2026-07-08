import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

// AdminUserInfo 表示后端登录后初始化返回的管理员资料。
export interface AdminUserInfo extends UserInfo {
  // id 表示当前账号ID。
  id?: number;
  // isSuperAdmin 表示当前账号是否拥有超级管理员身份。
  isSuperAdmin?: boolean;
  // needResetPassword 表示当前账号是否必须先修改登录密码。
  needResetPassword?: number;
  // roleIds 表示当前账号启用角色 ID 列表。
  roleIds?: number[];
  // roles 仅用于 Vben 路由过滤入参和布局展示，真实权限以 accessCodes 为准。
  roles?: string[];
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi(config?: Record<string, any>) {
  return requestClient.get<AdminUserInfo>('/auth/profile', config);
}
