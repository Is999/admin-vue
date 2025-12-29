import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

export namespace TgGroupApi {
  // 群组详情对象
  export interface Item {
    id: number; // 群组ID
    chatID: number; // 群组唯一标识
    chatTitle: string; // 群组名称
    status: 0 | 1; // 状态 1启用 0禁用
    remark?: string; // 备注
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // 列表查询参数
  export interface ListParams {
    chatTitle?: string; // 群组名称，非必填
    status?: number; // 状态 1启用 0禁用，非必填
    page?: number; // 页码，默认1
    pageSize?: number; // 每页数量，默认10
  }

  // 创建|更新参数
  export interface FormParams {
    chatID: number; // 群组ID
    chatTitle: string; // 群组名称
    status?: number; // 状态 1启用 0禁用，非必填
    remark?: string; // 备注
  }
  // 状态变更参数
  export interface StatusParams {
    status: 0 | 1; // 状态 1启用 0禁用
  }
}

// 1. 创建TG群组
export async function createTgGroup(data: TgGroupApi.FormParams) {
  return requestClient.post('/tg_group', data);
}

// 2. 更新TG群组
export async function updateTgGroup(id: number, data: TgGroupApi.FormParams) {
  return requestClient.patch(`/tg_group/${id}`, data);
}

// 3. 删除TG群组
export async function deleteTgGroup(id: number) {
  return requestClient.delete(`/tg_group/${id}`);
}

// 4. 获取TG群组详情
export async function fetchTgGroupDetail(id: number) {
  return requestClient.get<TgGroupApi.Item>(`/tg_group/${id}`);
}

// 5. 查询TG群组列表
export async function fetchTgGroupList(params: TgGroupApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<TgGroupApi.Item>>('/tg_group', {
    params,
  });
}

// 6. 更改TG群组状态
export async function toggleTgGroupStatus(
  id: number,
  data: TgGroupApi.StatusParams,
) {
  return requestClient.patch(`/tg_group/status/${id}`, data);
}

// 7. 获取可用群组下拉框
export async function fetchTgGroupDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>('/tg_group/dropdown');
}
