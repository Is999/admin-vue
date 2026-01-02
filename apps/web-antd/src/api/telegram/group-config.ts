import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

// TG群组配置相关API封装，严格对齐 tg_group_config_api_examples.md
export namespace TgGroupConfigApi {
  /** 配置项对象 */
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

  /** 保存响应 */
  export interface FormResponse {
    /** 分组标识 */
    group: string;
    /** 分组名称 */
    groupTitle: string;
  }
}

/**
 * 1. 批量保存群组配置
 * @param params 配置参数
 * @returns 保存结果
 */
export async function saveTgGroupConfig(params: TgGroupConfigApi.FormParams) {
  return requestClient.post<TgGroupConfigApi.FormResponse>(
    '/tg_group_config',
    params,
  );
}

/**
 * 2. 按 group 查询群组配置
 * @param group 分组标识
 * @returns 配置详情
 */
export async function fetchTgGroupConfigByGroup(group: string) {
  return requestClient.get<TgGroupConfigApi.FormParams>(
    `/tg_group_config/group/${group}`,
  );
}

/**
 * 3. 获取群组配置分组下拉框
 * @returns 下拉框选项数组
 */
export async function fetchTgGroupConfigDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>(
    '/tg_group_config/dropdown',
  );
}
