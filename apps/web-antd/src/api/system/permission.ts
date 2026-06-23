import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemPermissionApi 定义后台权限管理相关接口类型。
export namespace SystemPermissionApi {
  // Status 表示权限状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示权限列表、树与角色权限树数据。
  export interface Item {
    id: number; // 权限ID
    uuid: string; // 权限标识
    title: string; // 权限名称
    module: string; // 模块名称
    pid: number; // 上级权限ID
    pids: string; // 上级权限族谱
    type: number; // 权限类型
    description: string; // 权限描述
    status: Status; // 权限状态
    checked: boolean; // 角色权限树是否勾选
    disabled: boolean; // 是否禁用
    disableCheckbox: boolean; // 是否禁止勾选
    selectable: boolean; // 是否允许选择
    children?: Item[]; // 子权限列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示权限列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    uuid?: string; // 权限标识筛选
    title?: string; // 权限名称筛选
    module?: string; // 模块筛选
    pid?: number; // 上级权限筛选
    status?: Status; // 状态筛选
    type?: number[]; // 权限类型筛选
  }

  // SaveParams 表示新增或编辑权限参数。
  export interface SaveParams {
    uuid?: string; // 权限标识
    title?: string; // 权限名称
    module?: string; // 模块名称
    pid?: number; // 上级权限ID
    type?: number; // 权限类型
    description?: string; // 权限说明
    status?: Status; // 权限状态
  }

  // MaxUuidResp 表示后端返回的下一个权限标识。
  export interface MaxUuidResp {
    uuid: string; // 下一个权限标识
  }
}

// fetchPermissionList 分页查询权限列表。
export async function fetchPermissionList(
  params: SystemPermissionApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<SystemPermissionApi.Item>>(
    '/permissions',
    {
      params,
    },
  );
}

// fetchPermissionTree 查询权限树。
export async function fetchPermissionTree() {
  return requestClient.get<SystemPermissionApi.Item[]>('/permissions/tree');
}

// fetchPermissionMaxUuid 查询下一个权限标识。
export async function fetchPermissionMaxUuid() {
  return requestClient.get<SystemPermissionApi.MaxUuidResp>(
    '/permissions/max-uuid',
  );
}

// createPermission 新增权限。
export async function createPermission(data: SystemPermissionApi.SaveParams) {
  return requestClient.post('/permissions', data);
}

// updatePermission 编辑权限。
export async function updatePermission(
  id: number,
  data: SystemPermissionApi.SaveParams,
) {
  return requestClient.patch(`/permissions/${id}`, data);
}

// deletePermission 删除权限。
export async function deletePermission(id: number) {
  return requestClient.delete(`/permissions/${id}`);
}

// updatePermissionStatus 修改权限状态。
export async function updatePermissionStatus(
  id: number,
  status: SystemPermissionApi.Status,
) {
  return requestClient.patch(`/permissions/status/${id}`, { status });
}
