import type { CommonApi } from '#/api/telegram/common';

// TG账号管理相关API封装
// 代码风格参考 playground/src/api/system/role.ts
import { requestClient } from '#/api/request';

export namespace TgAccountApi {
  // TG账号类型定义
  export interface Item {
    id: number; // 账号ID（主键）
    userID: number; // 所属用户ID
    phoneNumber: string; // 手机号码
    username: string; // 用户名（通常以@开头）
    firstName: string; // 名
    lastName: string; // 姓
    languageCode: string; // 语言代码
    prompt: string; // 交互提示词
    webhook: string; // 回调地址
    status: 0 | 1; // 账号状态
    screenX: number; // 屏幕宽度
    screenY: number; // 屏幕高度
    screenIndex: number; // 屏幕索引
    apiID: number; // Telegram API id
    apiHash: string; // Telegram API hash
    isAbnormal: boolean; // 是否异常
    remark: string; // 备注
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
    promptTemplateID: number; // 绑定的AI提示词模板ID
    promptTemplateContent: string; // 绑定AI提示词模板内容
  }

  // 分页查询参数
  export interface ListParams {
    userID?: number; // TG账号ID，非必填
    username?: string; // TG用户名，非必填
    phoneNumber?: string; // 手机号码，非必填
    status?: number; // 账号状态，非必填，0=未激活，1=激活
    webhook?: string; // 回调地址，非必填
    startTime?: string; // 创建时间范围开始时间，非必填
    endTime?: string; // 创建时间范围结束时间，非必填
    page: number; // 当前页码
    pageSize: number; // 每页条数
  }

  // 新增/编辑参数
  export type FormParams = Partial<Item>;
}
// 1. 分页获取TG账号列表
export async function fetchTgAccountList(params: TgAccountApi.ListParams) {
  // 强制 userID 为 number 类型，防止字符串传递
  const fixedParams = {
    ...params,
    userID: params.userID === undefined ? undefined : Number(params.userID),
  };
  // GET请求参数需拼接到params属性下
  return requestClient.get<CommonApi.ListResult<TgAccountApi.Item>>(
    '/tg_account',
    {
      params: fixedParams,
    },
  );
}

// 2. 获取TG账号详情
export async function fetchTgAccountDetail(id: number) {
  return requestClient.get<TgAccountApi.Item>(`/tg_account/${id}`);
}

// 3. 新增TG账号
export async function createTgAccount(data: TgAccountApi.FormParams) {
  return requestClient.post('/tg_account', data);
}

// 4. 编辑TG账号
export async function updateTgAccount(
  id: number,
  data: TgAccountApi.FormParams,
) {
  return requestClient.patch(`/tg_account/${id}`, data);
}

// 6. 删除TG账号
export async function deleteTgAccount(id: number) {
  return requestClient.delete(`/tg_account/${id}`);
}

// 7. 切换账号状态
export async function toggleTgAccountStatus(id: number, status: number) {
  return requestClient.patch(`/tg_account/status/${id}`, { status });
}
