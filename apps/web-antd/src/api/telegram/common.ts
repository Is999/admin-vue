import type { Recordable } from '@vben/types';

export namespace CommonApi {
  /** 下拉选项类型 */
  export interface DropdownItem {
    id: number | string; // 配置ID
    label: string; // 关键词
    value: number | string; // 配置ID
    meta: any | Recordable<any>; // 其他元信息
  }

  // 分页响应
  export interface ListResult<T = Recordable<any>> {
    list: T[];
    total: number;
  }
}
