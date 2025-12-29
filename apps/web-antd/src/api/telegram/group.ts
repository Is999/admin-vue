import { requestClient } from '#/api/request';

export namespace TgGroupApi {
  // 群组详情对象
  export interface TgGroupDetail {
    id: number; // 群组ID
    chatID: number; // 群组唯一标识
    chatTitle: string; // 群组名称
    status: 0 | 1; // 状态 1启用 0禁用
    remark?: string; // 备注
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }
  // 列表项
  export type TgGroupListItem = TgGroupDetail;
  // 列表查询参数
  export interface TgGroupListParams {
    chatTitle?: string; // 群组名称，非必填
    status?: number; // 状态 1启用 0禁用，非必填
    page?: number; // 页码，默认1
    pageSize?: number; // 每页数量，默认10
  }
  // 列表响应
  export interface TgGroupListResult {
    list: TgGroupListItem[];
    total: number;
  }
  // 创建参数
  export interface TgGroupCreateParams {
    chatID: number; // 群组ID
    chatTitle: string; // 群组名称
    status?: number; // 状态 1启用 0禁用，非必填
    remark?: string; // 备注
  }
  // 更新参数
  export interface TgGroupUpdateParams {
    chatID: number; // 群组ID
    chatTitle: string; // 群组名称
    status?: number; // 状态 1启用 0禁用，非必填
    remark?: string; // 备注
  }
  // 状态变更参数
  export interface TgGroupStatusParams {
    status: 0 | 1; // 状态 1启用 0禁用
  }
  // 下拉选项
  export interface TgGroupDropdownItem {
    id: number;
    label: string;
    value: number;
  }
}

// 1. 创建TG群组
export function createTgGroup(data: TgGroupApi.TgGroupCreateParams) {
  return requestClient.post('/tg_group', data);
}

// 2. 更新TG群组
export function updateTgGroup(
  id: number,
  data: TgGroupApi.TgGroupUpdateParams,
) {
  return requestClient.patch(`/tg_group/${id}`, data);
}

// 3. 删除TG群组
export function deleteTgGroup(id: number) {
  return requestClient.delete<{
    code: number;
    message: string;
    status: boolean;
  }>(`/tg_group/${id}`);
}

// 4. 获取TG群组详情
export function fetchTgGroupDetail(id: number) {
  return requestClient.get<TgGroupApi.TgGroupDetail>(`/tg_group/${id}`);
}

// 5. 查询TG群组列表
export function fetchTgGroupList(params: TgGroupApi.TgGroupListParams) {
  return requestClient.get<{
    code: number;
    data: TgGroupApi.TgGroupListResult;
    message: string;
    status: boolean;
  }>('/tg_group', { params });
}

// 6. 更改TG群组状态
export function toggleTgGroupStatus(
  id: number,
  data: TgGroupApi.TgGroupStatusParams,
) {
  return requestClient.patch<{
    code: number;
    message: string;
    status: boolean;
  }>(`/tg_group/status/${id}`, data);
}

// 7. 获取可用群组下拉框
export function fetchTgGroupDropdown() {
  return requestClient.get<{
    code: number;
    data: TgGroupApi.TgGroupDropdownItem[];
    message: string;
    status: boolean;
  }>('/tg_group/dropdown');
}
