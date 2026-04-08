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
  // roles 表示当前账号启用角色名称列表，主要用于布局展示和兼容 Vben 路由过滤入参。
  roles?: string[];
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<AdminUserInfo>('/login/after/info');
}
