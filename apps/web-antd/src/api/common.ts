import type { Recordable } from '@vben/types';

// CommonApi 收口后台通用接口类型，避免 Admin/System 模块依赖已删除的业务目录。
export namespace CommonApi {
  // CacheSyncResp 表示数据库操作已提交后的缓存同步状态。
  export interface CacheSyncResp {
    syncPending: boolean; // 是否仍需操作员手动刷新相关缓存
  }

  // TwoStepReq 表示敏感操作通用 MFA 二次确认票据。
  export interface TwoStepReq {
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }

  // TwoStepWithKeyVersionReq 表示秘钥版本操作的二次确认参数。
  export interface TwoStepWithKeyVersionReq extends TwoStepReq {
    keyVersion?: string; // 当前秘钥版本号
  }

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
    meta?: Recordable<any>; // 附加分页或统计口径
    total: number; // 总记录数
  }
}
