import type { SystemPermissionApi } from './permission';

import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemRoleApi 定义后台角色管理相关接口类型。
export namespace SystemRoleApi {
  // Status 表示角色状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示角色列表、树与详情数据。
  export interface Item {
    id: number; // 角色 ID
    title: string; // 角色名称
    pid: number; // 上级角色 ID
    pids: string; // 上级角色族谱
    status: Status; // 角色状态
    description: string; // 角色描述
    isDelete: number; // 删除标记
    disabled: boolean; // 是否禁用
    disableCheckbox: boolean; // 是否禁止勾选
    selectable: boolean; // 是否允许选择
    permissions: number[]; // 权限ID列表
    children?: Item[]; // 子角色列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示角色列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    title?: string; // 角色名称筛选
    pid?: number; // 上级角色筛选
    status?: Status; // 状态筛选
  }

  // SaveParams 表示新增或编辑角色参数。
  export interface SaveParams extends CommonApi.TwoStepReq {
    title?: string; // 角色名称
    pid?: number; // 上级角色 ID
    status?: Status; // 角色状态
    description?: string; // 角色描述
    permissions?: number[]; // 权限ID列表
  }
}

// fetchRoleList 分页查询角色列表。
export async function fetchRoleList(params: SystemRoleApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemRoleApi.Item>>('/roles', {
    params,
  });
}

// fetchRoleTree 查询角色树。
export async function fetchRoleTree() {
  return requestClient.get<SystemRoleApi.Item[]>('/roles/tree');
}

// fetchRoleTreeOptions 查询角色树下拉，适用于用户管理等只要求登录态合法的选择场景。
export async function fetchRoleTreeOptions() {
  return requestClient.get<SystemRoleApi.Item[]>('/roles/tree-options');
}

// fetchRoleParentTreeOptions 查询角色父级下拉，允许普通管理员选择自身角色创建下级。
export async function fetchRoleParentTreeOptions() {
  return requestClient.get<SystemRoleApi.Item[]>('/roles/tree-options', {
    params: { scope: 'parent' },
  });
}

// createRole 新增角色。
export async function createRole(data: SystemRoleApi.SaveParams) {
  return requestClient.post('/roles', data);
}

// updateRole 编辑角色。
export async function updateRole(id: number, data: SystemRoleApi.SaveParams) {
  return requestClient.patch(`/roles/${id}`, data);
}

// deleteRole 删除角色。
export async function deleteRole(id: number) {
  return requestClient.delete(`/roles/${id}`);
}

// updateRoleStatus 修改角色状态。
export async function updateRoleStatus(
  id: number,
  status: SystemRoleApi.Status,
) {
  return requestClient.patch(`/roles/status/${id}`, { status });
}

// fetchRolePermissionTree 查询角色权限树，checked 字段表示已授权。
export async function fetchRolePermissionTree(id: number, isPid = false) {
  return requestClient.get<SystemPermissionApi.Item[]>(
    `/roles/permissions/tree/${id}/${isPid ? 'y' : 'n'}`,
  );
}

// updateRolePermissions 覆盖保存角色权限。
export async function updateRolePermissions(id: number, permissions: number[]) {
  return requestClient.patch(`/roles/permissions/${id}`, { permissions });
}
