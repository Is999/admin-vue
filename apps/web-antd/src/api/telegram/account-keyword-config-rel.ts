import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

/** TG账号与关键词配置关系接口响应 */
export interface TgAccountKeywordConfigRelResponse {
  /** 状态: true 成功, false 失败 */
  status: boolean;
  /** 状态码: 1 成功, 2 失败, 0 未定义 */
  code: number;
  /** 消息 */
  message?: string;
}

/** 绑定TG账号与关键词配置入参 */
export interface BindAccountKeywordConfigRelParams {
  /** TG账号ID */
  userID: number;
  /** 关键词配置ID列表 */
  keywordID: number;
  /** 行为参数(JSON字符串) */
  actionPayload?: string;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

/** 修改TG账号关键词配置状态入参 */
export interface UpdateAccountKeywordConfigRelStatusParams {
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

const PREFIX = '/tg_account_keyword_config_rel';

/** 绑定TG账号与关键词配置 */
export function bindAccountKeywordConfigRel(
  data: BindAccountKeywordConfigRelParams,
) {
  return requestClient.post<TgAccountKeywordConfigRelResponse>(PREFIX, data);
}

/** 解绑TG账号与关键词配置 */
export function unbindAccountKeywordConfigRel(
  userID: number,
  data: { keywordIDs: number[] },
) {
  return requestClient.delete<TgAccountKeywordConfigRelResponse>(
    `${PREFIX}/${userID}`,
    { data },
  );
}

/** 修改TG账号关键词配置状态 */
export function updateAccountKeywordConfigRelStatus(
  userID: number,
  keywordID: number,
  data: UpdateAccountKeywordConfigRelStatusParams,
) {
  return requestClient.patch<TgAccountKeywordConfigRelResponse>(
    `${PREFIX}/status/${userID}/${keywordID}`,
    data,
  );
}

/** 账号与关键词绑定关系详情 */
export interface AccountKeywordConfigRelItem {
  /** TG账号ID */
  userID: number;
  /** 关键词配置ID */
  keywordID: number;
  /** 行为参数(JSON字符串) */
  actionPayload?: string;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 账号与关键词绑定关系查询参数 */
export interface AccountKeywordConfigRelListParams {
  /** 按用户过滤 */
  userID?: number;
  /** 按关键词过滤 */
  keywordID?: number;
  /** 状态: 1启用 0禁用 */
  status?: number;
  /** 页码，默认1 */
  page?: number;
  /** 每页数量，默认10 */
  pageSize?: number;
}

/** 查询账号与关键词绑定关系详情 */
export function fetchAccountKeywordConfigRelDetail(
  userID: number,
  keywordID: number,
) {
  return requestClient.get<AccountKeywordConfigRelItem>(
    `${PREFIX}/${userID}/${keywordID}`,
  );
}

/** 查询账号与关键词绑定关系列表 */
export function fetchAccountKeywordConfigRelList(
  params: AccountKeywordConfigRelListParams,
) {
  return requestClient.get<CommonApi.ListResult<AccountKeywordConfigRelItem>>(
    PREFIX,
    { params },
  );
}
