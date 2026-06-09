import type { Recordable } from '@vben/types';

// CommonApi 收口后台通用接口类型，避免 Admin/System 模块依赖已删除的业务目录。
export namespace CommonApi {
  // DropdownItem 表示通用下拉选项。
  export interface DropdownItem {
    id: number | string; // 选项ID
    label: string; // 展示文案
    value: number | string; // 选项值
    meta: any | Recordable<any>; // 扩展元数据
  }

  // ListResult 表示标准分页响应结构。
  export interface ListResult<T = Recordable<any>> {
    list: T[]; // 当前页数据
    total: number; // 总记录数
  }
}
