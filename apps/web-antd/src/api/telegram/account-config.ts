import type { CommonApi } from '#/api/telegram/common';

// TG账号配置相关API封装
// 代码风格参考 account-keyword-config.ts，所有类型、注释、接口严格对齐接口文档
import { requestClient } from '#/api/request';

export namespace TgAccountConfigApi {
  /**
   * 配置项对象
   */
  export interface Item {
    /** ID */
    id: number;
    /** 配置标题 */
    title: string;
    /** 配置键 */
    key: string;
    /** 配置值 */
    value: any;
  }

  /** 表单参数 */
  export interface FormParams {
    /** 分组标识 */
    group: string;
    /** 分组名称 */
    groupTitle: string;
    /** 配置项数组 */
    list: Item[];
  }

  /** 表单参数 */
  export interface FormResponse {
    /** 分组标识 */
    group: string;
    /** 分组名称 */
    groupTitle: string;
  }

  export interface Form {
    /** 分组标识 */
    group: string;
    /** 分组名称 */
    groupTitle: string;
    /** 每天上线时间段 */
    onlineTimeRanges: OnlineTimeRange[]; // 每天上线时间段，格式如 "08:00-12:00,14:00-18:00"
    /** 关键词触发开关 */
    keywordTriggersEnabled: boolean;
    /** 提及触发开关 */
    mentionTriggerEnabled: boolean;
    /** 连续发言最小间隔 */
    minMessageIntervalSec: number; // 最小消息间隔秒数
    /** 每小时发言上限 */
    maxMessagesPerHour: number; // 每小时最大消息数
  }

  /**
   * 在线时间段类型
   */
  export interface OnlineTimeRange {
    start: string;
    end: string;
  }
}

/**
 * 1. 批量保存账号配置
 * @param params 配置参数
 * @returns 保存结果
 */
export async function saveTgAccountConfig(
  params: TgAccountConfigApi.FormParams,
) {
  return requestClient.post<TgAccountConfigApi.FormResponse>(
    '/tg_account_config',
    params,
  );
}

/**
 * 2. 按group查询账号配置
 * @param group 分组标识
 * @returns 配置详情
 */
export async function fetchTgAccountConfigByGroup(group: string) {
  return requestClient.get<TgAccountConfigApi.FormParams>(
    `/tg_account_config/group/${group}`,
  );
}

/**
 * 3. 获取账号配置分组下拉框
 * @returns 下拉框选项数组
 */
export async function fetchTgAccountConfigDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>(
    '/tg_account_config/dropdown',
  );
}
