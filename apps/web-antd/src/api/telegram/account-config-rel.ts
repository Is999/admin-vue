import { requestClient } from '#/api/request';

/** TG账号与配置关系接口响应 */
export interface TgAccountConfigRelResponse {
  /** 状态: true 成功, false 失败 */
  status: boolean;
  /** 状态码: 1 成功, 2 失败, 0 未定义 */
  code: number;
  /** 消息 */
  message?: string;
}

/** 绑定TG账号与配置入参 */
export interface BindAccountConfigRelParams {
  /** TG账号ID */
  userID: number;
  /** 配置组标识 */
  configGroup: string;
}

/** 修改TG账号配置状态入参 */
export interface UpdateAccountConfigRelStatusParams {
  /** 状态: 1启用 0禁用 */
  status: 0 | 1;
}

const PREFIX = '/api/tg_account_config_rel';

/** 绑定TG账号与配置组 */
export function bindAccountConfigRel(data: BindAccountConfigRelParams) {
  return requestClient.post<TgAccountConfigRelResponse>(PREFIX, data);
}
