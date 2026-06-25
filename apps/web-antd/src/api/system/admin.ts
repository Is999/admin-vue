import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemAdminApi 定义后台管理员管理相关接口类型。
export namespace SystemAdminApi {
  // Status 表示后台账号启用状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示管理员列表与详情数据。
  export interface Item {
    id: number; // 管理员ID
    username: string; // 登录用户名
    realName: string; // 真实姓名
    needResetPassword: number; // 是否必须先修改登录密码：1需要
    email: string; // 邮箱
    phone: string; // 手机号
    mfaStatus: Status; // MFA状态
    status: Status; // 账号状态
    avatar: string; // 头像地址
    description: string; // 备注说明
    lastLoginTime: string; // 最近登录时间
    lastLoginIP: string; // 最近登录 IP
    lastLoginIpaddr: string; // 最近登录 IP 归属地
    roleIDs: number[]; // 已绑定角色 ID
    roles: Array<{ id: number; title: string }>; // 已绑定角色列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示管理员列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    username?: string; // 用户名筛选
    realName?: string; // 真实姓名筛选
    roleID?: number; // 角色 ID筛选
    status?: Status; // 状态筛选
  }

  // ExportParams 表示管理员列表导出筛选参数。
  export interface ExportParams {
    username?: string; // 用户名筛选
    realName?: string; // 真实姓名筛选
    roleID?: number; // 角色 ID筛选
    status?: Status; // 状态筛选
  }

  // ExportTriggerResp 表示管理员列表导出任务提交回执。
  export interface ExportTriggerResp {
    jobId: string; // 导出任务ID
    queue: string; // 队列名称
    status: string; // 初始状态
    taskId: string; // 后台任务ID
  }

  // ExportStatusResp 表示管理员列表导出任务进度。
  export interface ExportStatusResp {
    jobId: string; // 导出任务ID
    taskId: string; // 后台任务ID
    queue: string; // 队列名称
    status: 'failed' | 'queued' | 'running' | 'succeeded'; // 导出状态
    progress: number; // 当前进度百分比
    processed: number; // 已处理行数
    total: number; // 总行数
    estimatedSeconds: number; // 剩余预估秒数
    fileName: string; // 导出文件名
    downloadReady: boolean; // 是否已可下载
    errorMessage: string; // 失败原因
    createdAt: string; // 创建时间
    startedAt: string; // 开始时间
    finishedAt: string; // 完成时间
    updatedAt: string; // 更新时间
    downloadUrl: string; // 下载地址
    processAt: string; // 计划执行时间
    lastProcessedAt: string; // 最近处理时间
    averageRowsPerSec: number; // 平均处理速度
  }

  // SaveParams 表示新增或编辑管理员参数。
  export interface SaveParams extends CommonApi.TwoStepReq {
    username?: string; // 登录用户名
    realName?: string; // 真实姓名
    email?: string; // 邮箱
    phone?: string; // 手机号
    password?: string; // 登录密码
    avatar?: string; // 头像地址
    description?: string; // 备注说明
    mfaSecureKey?: string; // MFA密钥
    mfaStatus?: Status; // MFA状态
    status?: Status; // 账号状态
    roleIDs?: number[]; // 角色 ID列表
    isUpdateRoles?: boolean; // 是否同步角色
  }

  // MfaStatusParams 表示管理员 MFA 状态修改参数。
  export interface MfaStatusParams extends CommonApi.TwoStepReq {
    mfaStatus: Status; // MFA状态
  }

  // RoleItem 表示管理员已绑定角色列表项。
  export interface RoleItem {
    id: number; // 角色 ID
    title: string; // 角色名称
    status: Status; // 角色状态
    description: string; // 角色说明
    createdAt: string; // 绑定时间
  }
}

// fetchAdminList 分页查询管理员列表。
export async function fetchAdminList(params: SystemAdminApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemAdminApi.Item>>(
    '/admins',
    {
      params,
    },
  );
}

// triggerAdminExport 提交管理员列表异步导出任务。
export async function triggerAdminExport(data: SystemAdminApi.ExportParams) {
  return requestClient.post<SystemAdminApi.ExportTriggerResp>(
    '/admins/exports',
    data,
  );
}

// fetchAdminExportStatus 查询管理员列表异步导出进度。
export async function fetchAdminExportStatus(jobId: string) {
  return requestClient.get<SystemAdminApi.ExportStatusResp>(
    `/admins/exports/status/${encodeURIComponent(jobId)}`,
  );
}

// downloadAdminExport 下载管理员列表导出文件。
export async function downloadAdminExport(jobId: string) {
  return requestClient.download<Blob>(
    `/admins/exports/download/${encodeURIComponent(jobId)}`,
  );
}

// fetchAdminDetail 查询管理员详情。
export async function fetchAdminDetail(id: number) {
  return requestClient.get<SystemAdminApi.Item>(`/admins/${id}`);
}

// createAdmin 新增管理员。
export async function createAdmin(data: SystemAdminApi.SaveParams) {
  return requestClient.post('/admins', data);
}

// updateAdmin 编辑管理员。
export async function updateAdmin(id: number, data: SystemAdminApi.SaveParams) {
  return requestClient.patch(`/admins/${id}`, data);
}

// updateAdminMfaStatus 修改管理员 MFA 状态。
export async function updateAdminMfaStatus(
  id: number,
  data: SystemAdminApi.MfaStatusParams,
) {
  return requestClient.patch(`/admins/mfa-status/${id}`, data);
}

// deleteAdmin 删除管理员。
export async function deleteAdmin(id: number, twoStep?: CommonApi.TwoStepReq) {
  return requestClient.delete(`/admins/${id}`, {
    data: { ...twoStep },
  });
}

// updateAdminStatus 修改管理员状态。
export async function updateAdminStatus(
  id: number,
  status: SystemAdminApi.Status,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.patch(`/admins/status/${id}`, { status, ...twoStep });
}

// resetAdminPassword 重置管理员密码。
export async function resetAdminPassword(
  id: number,
  password: string,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.post(`/admins/password/reset/${id}`, {
    password,
    ...twoStep,
  });
}

// resetAdminInitialState 重置管理员到首次登录前状态。
export async function resetAdminInitialState(
  id: number,
  password: string,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.post(`/admins/initial-state/reset/${id}`, {
    password,
    ...twoStep,
  });
}

// fetchAdminRoles 查询管理员已绑定角色。
export async function fetchAdminRoles(id: number) {
  return requestClient.get<SystemAdminApi.RoleItem[]>(`/admins/roles/${id}`);
}

// updateAdminRoles 覆盖保存管理员角色。
export async function updateAdminRoles(
  id: number,
  roleIDs: number[],
  payload?: CommonApi.TwoStepReq,
) {
  return requestClient.patch(`/admins/roles/${id}`, { roleIDs, ...payload });
}
