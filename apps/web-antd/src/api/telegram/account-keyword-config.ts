import type { CommonApi } from '#/api/telegram/common';

// TG账号关键词配置相关API封装
import { requestClient } from '#/api/request';

export namespace TgAccountKeywordConfigApi {
  // 关键词配置项类型定义
  export interface Item {
    id: number; // 配置ID（主键）
    keyword: string; // 关键词
    actionType: string; // 行为类型
    status: 0 | 1; // 状态 0=禁用 1=启用
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // 分页查询参数
  export interface ListParams {
    keyword?: string; // 关键词，非必填
    actionType?: string; // 行为类型，非必填
    status?: number; // 状态，非必填
    page: number; // 当前页码
    pageSize: number; // 每页条数
  }

  // 新增/编辑参数
  export interface FormParams {
    keyword: string; // 关键词
    actionType: string; // 行为类型
    status?: number; // 状态 1启用 0禁用，可选
  }
}

// 1. 分页获取关键词配置列表
export async function fetchTgAccountKeywordConfigList(
  params: TgAccountKeywordConfigApi.ListParams,
) {
  return requestClient.get<
    CommonApi.ListResult<TgAccountKeywordConfigApi.Item>
  >('/tg_account_keyword_config', { params });
}

// 2. 获取关键词配置详情
export async function fetchTgAccountKeywordConfigDetail(id: number) {
  return requestClient.get<TgAccountKeywordConfigApi.Item>(
    `/tg_account_keyword_config/${id}`,
  );
}

// 3. 新增关键词配置
export async function createTgAccountKeywordConfig(
  data: TgAccountKeywordConfigApi.FormParams,
) {
  return requestClient.post('/tg_account_keyword_config', data);
}

// 4. 编辑关键词配置
export async function updateTgAccountKeywordConfig(
  id: number,
  data: TgAccountKeywordConfigApi.FormParams,
) {
  return requestClient.patch(`/tg_account_keyword_config/${id}`, data);
}

// 5. 删除关键词配置
export async function deleteTgAccountKeywordConfig(id: number) {
  return requestClient.delete(`/tg_account_keyword_config/${id}`);
}

// 6. 切换关键词配置状态
export async function updateTgAccountKeywordConfigStatus(
  id: number,
  status: number,
) {
  return requestClient.patch(`/tg_account_keyword_config/status/${id}`, {
    status,
  });
}

// 7. 获取TG账号下拉选项（用于关键词配置表单）
export async function fetchTgAccountDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>('/tg_account/dropdown');
}
