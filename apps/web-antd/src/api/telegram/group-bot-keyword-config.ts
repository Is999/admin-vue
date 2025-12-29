import type { CommonApi } from '#/api/telegram/common';

// 群组机器人关键词配置相关API封装，严格对齐接口文档
import { requestClient } from '#/api/request';

export namespace TgGroupBotKeywordConfigApi {
  /** 关键词配置详情类型 */
  export interface Item {
    id: number; // 配置ID
    keyword: string; // 关键词
    actionType: string; // 行为类型
    status: number; // 状态 1启用 0禁用
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  /** 新增|编辑参数 */
  export interface FormParams {
    keyword?: string; // 关键词
    actionType?: string; // 行为类型
    status?: number; // 状态 1启用 0禁用
  }

  /** 状态变更参数 */
  export interface StatusParams {
    status: number; // 状态 1启用 0禁用
  }

  /** 列表查询参数 */
  export interface ListParams {
    keyword?: string; // 关键词
    status?: number; // 状态 1启用 0禁用
    page?: number; // 页码
    pageSize?: number; // 每页数量
  }
}

/** 新增群组机器人关键词配置 */
export async function createTgGroupBotKeywordConfig(
  data: TgGroupBotKeywordConfigApi.FormParams,
) {
  return requestClient.post('/tg_group_bot_keyword_config', data);
}

/** 更新群组机器人关键词配置 */
export async function updateTgGroupBotKeywordConfig(
  id: number,
  data: TgGroupBotKeywordConfigApi.FormParams,
) {
  return requestClient.patch(`/tg_group_bot_keyword_config/${id}`, data);
}

/** 删除群组机器人关键词配置 */
export async function deleteTgGroupBotKeywordConfig(id: number) {
  return requestClient.delete(`/tg_group_bot_keyword_config/${id}`);
}

/** 修改群组机器人关键词配置状态 */
export async function updateTgGroupBotKeywordConfigStatus(
  id: number,
  status: number,
) {
  return requestClient.patch(`/tg_group_bot_keyword_config/status/${id}`, {
    status,
  });
}

/** 获取群组机器人关键词配置详情 */
export async function fetchTgGroupBotKeywordConfigDetail(id: number) {
  return requestClient.get<TgGroupBotKeywordConfigApi.Item>(
    `/tg_group_bot_keyword_config/${id}`,
  );
}

/** 查询群组机器人关键词配置列表 */
export async function fetchTgGroupBotKeywordConfigList(
  params: TgGroupBotKeywordConfigApi.ListParams,
) {
  return requestClient.get<
    CommonApi.ListResult<TgGroupBotKeywordConfigApi.Item>
  >('/tg_group_bot_keyword_config', { params });
}

/** 群组机器人关键词下拉框 */

export async function fetchTgAccountDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>(
    '/tg_group_bot_keyword_config/dropdown',
  );
}
