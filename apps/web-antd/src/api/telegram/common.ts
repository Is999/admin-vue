import type { Recordable } from '@vben/types';

export namespace CommonApi {
  /** 下拉选项类型 */
  export interface DropdownItem {
    id: number; // 配置ID
    label: string; // 关键词
    value: number; // 配置ID
  }

  // 分页响应
  export interface ListResult<T = Recordable<any>> {
    list: T[];
    total: number;
  }
}
