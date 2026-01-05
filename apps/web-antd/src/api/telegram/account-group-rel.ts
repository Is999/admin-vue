import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

/** TG账号与群组关系接口响应 */
export interface TgAccountGroupRelResponse {
  /** 状态: true 成功, false 失败 */
  status: boolean;
  /** 状态码: 1 成功, 2 失败, 0 未定义 */
  code: number;
  /** 消息 */
  message?: string;
}

/** 绑定TG账号与群组入参 */
export interface BindAccountGroupRelParams {
  /** TG账号ID */
  userID: number;
  /** 群组ID */
  chatID: number;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

/** 修改TG账号在群组中的在线状态入参 */
export interface UpdateAccountGroupStatusParams {
  /** 状态: 1在线 0离线 */
  status: 0 | 1;
}

/** 账号与群组关系详情 */
export interface AccountGroupRelItem {
  /** TG账号ID */
  userID: number;
  /** TG账号用户名 */
  username: string;
  /** 群组ID */
  chatID: number;
  /** 群组名称 */
  chatTitle: string;
  /** 在线状态: 1在线 0离线 */
  online: 0 | 1;
  /** 上线时间 */
  onlineAt?: string;
  /** 下线时间 */
  offlineAt?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 账号与群组关系查询参数 */
export interface AccountGroupRelListParams {
  /** 按用户过滤 */
  userID?: number;
  /** 按群组过滤 */
  chatID?: number;
  /** 在线状态: 1在线 0离线 */
  online?: number;
  /** 页码，默认1 */
  page?: number;
  /** 每页数量，默认10 */
  pageSize?: number;
}

const PREFIX = '/tg_account_group_rel';

/** 绑定TG账号与群组 */
export function bindAccountGroupRel(data: BindAccountGroupRelParams) {
  return requestClient.post<TgAccountGroupRelResponse>(PREFIX, data);
}

/** 解绑TG账号与群组 */
export function unbindAccountGroupRel(userID: number, chatID: number) {
  return requestClient.delete<TgAccountGroupRelResponse>(
    `${PREFIX}/${userID}/${chatID}`,
  );
}

/** 修改TG账号在群组中的在线状态 */
export function updateAccountGroupRelStatus(
  userID: number,
  chatID: number,
  data: UpdateAccountGroupStatusParams,
) {
  return requestClient.patch<TgAccountGroupRelResponse>(
    `${PREFIX}/online/${userID}/${chatID}`,
    data,
  );
}

/** 获取账号与群组关系详情 */
export function fetchAccountGroupRelDetail(userID: number, chatID: number) {
  return requestClient.get<AccountGroupRelItem>(
    `${PREFIX}/${userID}/${chatID}`,
  );
}

/** 查询账号与群组关系列表 */
export function fetchAccountGroupRelList(params: AccountGroupRelListParams) {
  return requestClient.get<CommonApi.ListResult<AccountGroupRelItem>>(PREFIX, {
    params,
  });
}
