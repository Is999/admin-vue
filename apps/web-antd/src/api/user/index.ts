import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// UserApi 定义用户管理相关接口类型。
export namespace UserApi {
  // Status 表示用户启用状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示用户列表与详情数据。
  export interface Item {
    id: number; // 用户 ID
    shardNo: number; // 取模分片
    username: string; // 用户名
    nickname: string; // 昵称
    email: string; // 邮箱
    phone: string; // 手机号
    avatar: string; // 头像地址
    status: Status; // 状态
    lastLoginAt: string; // 最后登录时间
    lastLoginIP: string; // 最后登录IP
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示用户列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    id?: number; // 用户 ID
    shardNo?: number; // 取模分片
    username?: string; // 用户名前缀
    email?: string; // 邮箱前缀
    phone?: string; // 手机号前缀
    status?: Status; // 状态筛选
  }

  // SaveParams 表示新增或编辑用户参数。
  export interface SaveParams extends CommonApi.TwoStepReq {
    username?: string; // 用户名
    password?: string; // 登录密码
    nickname?: string; // 昵称
    email?: string; // 邮箱
    phone?: string; // 手机号
    avatar?: string; // 头像地址
    status?: Status; // 状态
  }

  // RuntimeSyncParams 表示手动同步 API 运行态请求。
  export interface RuntimeSyncParams extends CommonApi.TwoStepReq {
    profile?: boolean; // 是否同步资料缓存
    sessions?: boolean; // 是否失效登录态
  }

  // RuntimeSyncResp 表示 API 运行态同步回执。
  export interface RuntimeSyncResp {
    enabled: boolean; // 是否配置 API 内网同步
    success: boolean; // 本次同步是否成功
    userId: number; // 用户 ID
    profileCacheInvalidated: boolean; // 是否处理资料缓存
    sessionsInvalidated: boolean; // 是否处理登录态
    message: string; // 同步说明
  }

  // MutationResp 表示用户写操作回执。
  export interface MutationResp {
    item?: Item; // 最新用户资料
    sync: RuntimeSyncResp; // API运行态同步结果
  }
}

// fetchUserList 分页查询用户列表。
export async function fetchUserList(params: UserApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<UserApi.Item>>('/users', {
    params,
  });
}

// fetchUserDetail 查询用户详情。
export async function fetchUserDetail(id: number) {
  return requestClient.get<UserApi.Item>(`/users/${id}`);
}

// createUser 新增用户。
export async function createUser(data: UserApi.SaveParams) {
  return requestClient.post<UserApi.MutationResp>('/users', data);
}

// updateUser 编辑用户资料。
export async function updateUser(id: number, data: UserApi.SaveParams) {
  return requestClient.patch<UserApi.MutationResp>(`/users/${id}`, data);
}

// updateUserStatus 修改用户状态。
export async function updateUserStatus(
  id: number,
  status: UserApi.Status,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.patch<UserApi.MutationResp>(`/users/status/${id}`, {
    status,
    ...twoStep,
  });
}

// resetUserPassword 重置用户密码。
export async function resetUserPassword(
  id: number,
  password: string,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.post<UserApi.MutationResp>(
    `/users/password/reset/${id}`,
    {
      password,
      ...twoStep,
    },
  );
}

// syncUserRuntime 手动同步用户 API 运行态。
export async function syncUserRuntime(
  id: number,
  data: UserApi.RuntimeSyncParams,
) {
  return requestClient.post<UserApi.RuntimeSyncResp>(
    `/users/runtime-sync/${id}`,
    data,
  );
}
