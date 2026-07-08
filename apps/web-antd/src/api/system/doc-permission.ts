import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemDocPermissionApi 定义后台文档权限管理相关接口类型。
export namespace SystemDocPermissionApi {
  // Status 表示文档权限状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示文档权限管理列表项。
  export interface Item {
    id: number; // 文档权限 ID
    site: 'admin' | 'api'; // 文档站
    path: string; // 文档站内 Markdown 相对路径
    title: string; // 文档标题
    description: string; // 文档描述
    status: Status; // 文档权限状态
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示文档权限列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    site?: 'admin' | 'api'; // 文档站筛选
    title?: string; // 文档标题筛选
    path?: string; // 文档相对路径筛选
    status?: Status; // 状态筛选
  }
}

// fetchDocPermissionList 分页查询文档权限列表。
export async function fetchDocPermissionList(
  params: SystemDocPermissionApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<SystemDocPermissionApi.Item>>(
    '/doc-permissions',
    { params },
  );
}

// updateDocPermissionStatus 修改文档权限全局状态。
export async function updateDocPermissionStatus(
  id: number,
  status: SystemDocPermissionApi.Status,
) {
  return requestClient.patch<CommonApi.CacheSyncResp>(
    `/doc-permissions/status/${id}`,
    { status },
  );
}
