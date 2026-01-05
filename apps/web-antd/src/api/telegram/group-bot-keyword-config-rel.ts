import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

/** 群组机器人关键词配置绑定关系接口响应 */
export interface TgGroupBotKeywordConfigRelResponse {
  /** 状态: true 成功, false 失败 */
  status: boolean;
  /** 状态码: 1 成功, 2 失败, 0 未定义 */
  code: number;
  /** 消息 */
  message?: string;
}

/** 绑定群组与关键词配置入参 */
export interface BindGroupBotKeywordConfigRelParams {
  /** 群组ID */
  chatID: number;
  /** 关键词配置ID列表 */
  keywordID: number;
  /** 行为参数(JSON字符串) */
  actionPayload?: string;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

/** 修改群组机器人关键词配置状态入参 */
export interface UpdateGroupBotKeywordConfigRelStatusParams {
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

/** 群组与关键词配置绑定关系详情 */
export interface GroupBotKeywordConfigRelItem {
  /** 群组ID */
  chatID: number;
  /** 群组名称 */
  chatTitle: string;
  /** 关键词配置ID */
  keywordID: number;
  /** 关键词 */
  keyword: string;
  /** 行为类型 */
  actionType: string;
  /** 行为参数(JSON字符串) */
  actionPayload?: string;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 群组与关键词配置绑定关系查询参数 */
export interface GroupBotKeywordConfigRelListParams {
  /** 按群组过滤 */
  chatID?: number;
  /** 按关键词过滤 */
  keywordID?: number;
  /** 状态: 1启用 0禁用 */
  status?: number;
  /** 页码，默认1 */
  page?: number;
  /** 每页数量，默认10 */
  pageSize?: number;
}

const PREFIX = '/tg_group_bot_keyword_config_rel';

/** 绑定群组与关键词配置 */
export function bindGroupBotKeywordConfigRel(
  data: BindGroupBotKeywordConfigRelParams,
) {
  return requestClient.post<TgGroupBotKeywordConfigRelResponse>(PREFIX, data);
}

/** 解绑群组与关键词配置 */
export function unbindGroupBotKeywordConfigRel(
  chatID: number,
  data: { keywordIDs: number[] },
) {
  return requestClient.delete<TgGroupBotKeywordConfigRelResponse>(
    `${PREFIX}/${chatID}`,
    { data },
  );
}

/** 修改群组机器人关键词配置状态 */
export function updateGroupBotKeywordConfigRelStatus(
  userID: number,
  keywordID: number,
  data: UpdateGroupBotKeywordConfigRelStatusParams,
) {
  return requestClient.patch<TgGroupBotKeywordConfigRelResponse>(
    `${PREFIX}/status/${userID}/${keywordID}`,
    data,
  );
}

/** 获取群组与关键词配置绑定关系详情 */
export function fetchGroupBotKeywordConfigRelDetail(
  chatID: number,
  keywordID: number,
) {
  return requestClient.get<GroupBotKeywordConfigRelItem>(
    `${PREFIX}/${chatID}/${keywordID}`,
  );
}

/** 查询群组与关键词配置绑定关系列表 */
export function fetchGroupBotKeywordConfigRelList(
  params: GroupBotKeywordConfigRelListParams,
) {
  return requestClient.get<CommonApi.ListResult<GroupBotKeywordConfigRelItem>>(
    PREFIX,
    {
      params,
    },
  );
}
