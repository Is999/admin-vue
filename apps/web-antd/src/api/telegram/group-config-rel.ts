import { requestClient } from '#/api/request';

/** TG群组与配置关系接口响应 */
export interface TgGroupConfigRelResponse {
  /** 状态: true 成功, false 失败 */
  status: boolean;
  /** 状态码: 1 成功, 2 失败, 0 未定义 */
  code: number;
  /** 消息 */
  message?: string;
}

/** 绑定TG群组与配置组入参 */
export interface BindGroupConfigRelParams {
  /** TG群组ID */
  chatID: number;
  /** 配置组标识 */
  configGroup: string;
}

/** 修改TG群组配置状态入参 */
export interface UpdateGroupConfigRelStatusParams {
  /** 配置组标识 */
  configGroup: string;
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

const PREFIX = '/api/tg_group_config_rel';

/** 绑定TG群组与配置组 */
export function bindGroupConfigRel(data: BindGroupConfigRelParams) {
  return requestClient.post<TgGroupConfigRelResponse>(PREFIX, data);
}

/** 解绑TG群组与配置组 */
export function unbindGroupConfigRel(
  chatID: number,
  data: { configGroup: string },
) {
  return requestClient.delete<TgGroupConfigRelResponse>(`${PREFIX}/${chatID}`, {
    data,
  });
}

/** 修改TG群组配置状态 */
export function updateGroupConfigRelStatus(
  chatID: number,
  data: UpdateGroupConfigRelStatusParams,
) {
  return requestClient.patch<TgGroupConfigRelResponse>(
    `${PREFIX}/status/${chatID}`,
    data,
  );
}
