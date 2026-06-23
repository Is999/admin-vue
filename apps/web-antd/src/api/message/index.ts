import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// AdminMessageApi 定义管理员消息（站内信/通知）相关接口类型。
export namespace AdminMessageApi {
  // Level 表示消息等级：1info 2warning 3error。
  export type Level = 1 | 2 | 3;

  // ReadStatus 表示已读状态筛选：0未读 1已读。
  export type ReadStatus = 0 | 1;

  // Item 表示管理员收件箱消息项。
  export interface Item {
    id: number; // 消息ID
    type: string; // 消息类型
    level: Level; // 消息等级
    title: string; // 消息标题
    content: string; // 消息内容，支持受控富文本HTML
    data: string; // 扩展数据JSON
    link: string; // 跳转链接
    senderAdminId: number; // 发送人管理员ID
    senderAdminName: string; // 发送人账号
    handledStatus: number; // 处理状态：0未处理 1已处理
    handledByAdminName: string; // 处理人账号
    handledAt: string; // 处理时间
    isRead: boolean; // 是否已读
    readAt: string; // 已读时间
    createdAt: string; // 创建时间
  }

  // ListParams 表示收件箱列表查询参数。
  export interface ListParams {
    page?: number; // 页码
    pageSize?: number; // 每页条数
    type?: string; // 消息类型
    level?: Level; // 消息等级
    readStatus?: ReadStatus; // 已读状态
    keyword?: string; // 关键字
    startTime?: string; // 起始时间：YYYY-MM-DD HH:mm:ss
    endTime?: string; // 结束时间：YYYY-MM-DD HH:mm:ss
  }

  // UnreadCountResp 表示未读数量响应。
  export interface UnreadCountResp {
    unread: number; // 未读数量
  }

  // NotificationParams 表示通知列表请求参数。
  export interface NotificationParams {
    limit?: number; // 最大条数
  }

  // MarkReadReq 表示标记已读请求参数。
  export interface MarkReadReq {
    ids?: number[]; // 消息ID列表
    all?: boolean; // 是否全部标记已读
  }

  // DeleteReq 表示删除消息请求参数。
  export interface DeleteReq {
    ids?: number[]; // 消息ID列表
    allRead?: boolean; // 是否删除全部已读
  }

  // SendReq 表示发送消息请求参数。
  export interface SendReq {
    type: string; // 消息类型
    level: Level; // 消息等级
    title: string; // 消息标题
    content: string; // 消息内容，支持受控富文本HTML
    data?: string; // 扩展数据JSON
    link?: string; // 跳转链接
    receiverIDs?: number[]; // 收件人管理员ID列表；为空表示广播
  }

  // SentListParams 表示已发送列表查询参数。
  export interface SentListParams {
    page?: number; // 页码
    pageSize?: number; // 每页条数
    type?: string; // 消息类型
    level?: Level; // 消息等级
    keyword?: string; // 关键字
    startTime?: string; // 起始时间：YYYY-MM-DD HH:mm:ss
    endTime?: string; // 结束时间：YYYY-MM-DD HH:mm:ss
  }

  // SentItem 表示已发送消息列表项（包含收件人已读统计）。
  export interface SentItem {
    id: number; // 消息ID
    type: string; // 消息类型
    level: Level; // 消息等级
    title: string; // 消息标题
    content: string; // 消息内容，支持受控富文本HTML
    data: string; // 扩展数据JSON
    link: string; // 跳转链接
    senderAdminId: number; // 发送人管理员ID
    senderAdminName: string; // 发送人账号
    receiverTotal: number; // 收件人总数
    receiverReadTotal: number; // 已读收件人数
    receiverUnreadTotal: number; // 未读收件人数
    handledStatus: number; // 处理状态：0未处理 1已处理
    handledByAdminName: string; // 处理人账号
    handledAt: string; // 处理时间
    createdAt: string; // 创建时间
  }

  // ReceiverItem 表示收件人已读明细项。
  export interface ReceiverItem {
    receiverAdminId: number; // 收件人管理员ID
    receiverAdminName: string; // 收件人账号
    receiverRealName: string; // 收件人姓名
    readStatus: number; // 已读状态：0未读 1已读
    readAt: string; // 已读时间
    deleteStatus: number; // 删除状态：0未删 1已删
    deletedAt: string; // 删除时间
  }

  // HandleReq 表示标记消息已处理请求参数。
  export interface HandleReq {
    id: number; // 消息ID
  }
}

// fetchAdminMessageList 分页查询管理员消息收件箱。
export async function fetchAdminMessageList(
  params: AdminMessageApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<AdminMessageApi.Item>>(
    '/admin-messages',
    {
      params,
    },
  );
}

// fetchAdminMessageSentList 分页查询管理员已发送消息列表。
export async function fetchAdminMessageSentList(
  params: AdminMessageApi.SentListParams,
) {
  return requestClient.get<CommonApi.ListResult<AdminMessageApi.SentItem>>(
    '/admin-messages/sent',
    {
      params,
    },
  );
}

// fetchAdminMessageReceivers 查询指定消息的收件人已读明细（仅发送人可见）。
export async function fetchAdminMessageReceivers(id: number) {
  return requestClient.get<AdminMessageApi.ReceiverItem[]>(
    `/admin-messages/${id}/receivers`,
  );
}

// fetchAdminMessageUnreadCount 查询当前管理员未读消息数量。
export async function fetchAdminMessageUnreadCount() {
  return requestClient.get<AdminMessageApi.UnreadCountResp>(
    '/admin-messages/unread-count',
  );
}

// fetchAdminMessageNotifications 查询顶部铃铛通知列表。
export async function fetchAdminMessageNotifications(
  params?: AdminMessageApi.NotificationParams,
) {
  return requestClient.get<AdminMessageApi.Item[]>(
    '/admin-messages/notifications',
    {
      params,
    },
  );
}

// markAdminMessageRead 标记消息已读（支持批量与全部）。
export async function markAdminMessageRead(data: AdminMessageApi.MarkReadReq) {
  return requestClient.patch('/admin-messages/read', data);
}

// deleteAdminMessage 删除消息（软删除，支持批量与清空全部已读）。
export async function deleteAdminMessage(data: AdminMessageApi.DeleteReq) {
  return requestClient.post('/admin-messages/delete', data);
}

// sendAdminMessage 发送管理员消息到收件箱。
export async function sendAdminMessage(data: AdminMessageApi.SendReq) {
  return requestClient.post('/admin-messages/send', data);
}

// handleAdminMessage 标记消息为已处理（仅支持部分业务类型）。
export async function handleAdminMessage(data: AdminMessageApi.HandleReq) {
  return requestClient.post('/admin-messages/handle', data);
}
