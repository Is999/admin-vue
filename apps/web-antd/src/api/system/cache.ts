import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemCacheApi 定义缓存管理相关接口类型。
export namespace SystemCacheApi {
  // Item 表示系统内置可刷新缓存目标。
  export interface Item {
    index: string; // 缓存索引
    key: string; // 缓存Key
    keyTitle: string; // 缓存标题
    type: string; // Redis类型
    remark: string; // 缓存说明
    category: string; // 缓存分类
    isTemplate: boolean; // 是否为模板缓存键
    exampleKey: string; // 模板缓存示例键
    autoRebuild: boolean; // 查看详情 miss 时是否自动回源重建
    refreshScope: string; // 刷新粒度
  }

  // KeyInfo 表示 Redis Key 详情。
  export interface KeyInfo {
    key: string; // 缓存Key
    type: string; // Redis类型
    ttl: number; // 剩余过期秒数
    total: number; // 值数量
    value: any; // 当前缓存值
    item?: Item | null; // 当前缓存键命中的缓存项元信息
  }

  // SearchItem 表示缓存键检索结果项。
  export interface SearchItem {
    key: string; // 真实 Redis Key
    item?: Item | null; // 当前缓存键命中的缓存项元信息
  }

  // SearchResp 表示缓存键分页检索结果。
  export interface SearchResp {
    list: SearchItem[]; // 当前页真实 Redis Key
    total: number; // 当前搜索条件下已确认存在的 Key 总数
    page: number; // 当前页码
    pageSize: number; // 当前每页数量
    hasMore: boolean; // 是否还有下一页
    nextPage?: number; // 下一页页码
    searchPath?: string; // 后端搜索链路
    providerName?: string; // 模板 provider 名称
    templateKey?: string; // 命中的模板 Key 定义
    candidateTotal?: number; // 模板候选 Key 数量
    existingTotal?: number; // 已确认存在的 Key 数量
    limited?: boolean; // 是否触发后端搜索窗口保护
    maxResults?: number; // 后端最大搜索窗口
  }

  // SearchParams 表示缓存键分页检索请求参数。
  export interface SearchParams {
    key: string; // 缓存 Key 或已登记模板搜索模式
    source?: string; // 请求来源标记，便于后端日志排障
    page?: number; // 页码
    pageSize?: number; // 每页数量
  }

  // WarmupResp 表示模板缓存预热响应。
  export interface WarmupResp {
    templateKey: string; // 模板缓存 key 定义
    total: number; // 处理的实例 key 总数
    success: number; // 预热成功数量
    failed: number; // 预热失败数量
    failedKeys?: string[]; // 失败 key 采样列表
    latencyMs: number; // 耗时毫秒
  }

  // ServerInfo 表示 Redis 服务信息。
  export type ServerInfo = Record<string, Record<string, string>>;
}

// fetchCacheList 查询系统内置可刷新缓存列表。
export async function fetchCacheList(params?: { key?: string }) {
  return requestClient.get<CommonApi.ListResult<SystemCacheApi.Item>>(
    '/caches',
    {
      params,
    },
  );
}

// fetchCacheServerInfo 查询 Redis 服务信息。
export async function fetchCacheServerInfo() {
  return requestClient.get<SystemCacheApi.ServerInfo>('/caches/server-info');
}

// fetchCacheKeyInfo 查询 Redis Key 详情。
export async function fetchCacheKeyInfo(key: string) {
  return requestClient.get<SystemCacheApi.KeyInfo>('/caches/key-info', {
    params: { key },
  });
}

// normalizeCacheSearchResp 归一化当前分页搜索响应，避免页面散落默认值处理。
function normalizeCacheSearchResp(
  resp: SystemCacheApi.SearchResp,
  fallbackPage = 1,
  fallbackPageSize = 20,
): SystemCacheApi.SearchResp {
  return {
    hasMore: !!resp.hasMore,
    list: resp.list || [],
    page: resp.page || fallbackPage,
    pageSize: resp.pageSize || fallbackPageSize,
    total: Number(resp.total || 0),
    nextPage: resp.nextPage,
    searchPath: resp.searchPath,
    providerName: resp.providerName,
    templateKey: resp.templateKey,
    candidateTotal: resp.candidateTotal,
    existingTotal: resp.existingTotal,
    limited: resp.limited,
    maxResults: resp.maxResults,
  };
}

// searchCacheKeys 搜索 Redis Key 列表，默认按分页方式返回，避免前端一次拉取过多 Key。
export async function searchCacheKeys(params: SystemCacheApi.SearchParams) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const resp = await requestClient.get<SystemCacheApi.SearchResp>(
    '/caches/keys',
    {
      params: { ...params, page, pageSize },
    },
  );
  return normalizeCacheSearchResp(resp, page, pageSize);
}

// fetchSearchCacheKeyInfo 查询搜索结果中的 Redis Key 详情。
export async function fetchSearchCacheKeyInfo(key: string) {
  return requestClient.get<SystemCacheApi.KeyInfo>('/caches/key-info/search', {
    params: { key },
  });
}

// renewCache 刷新指定缓存。
export async function renewCache(key: string, type?: string) {
  return requestClient.post('/caches/refresh', { key, type });
}

// renewAllCache 刷新全部系统内置缓存。
export async function renewAllCache() {
  return requestClient.post('/caches/refresh-all');
}

// warmupCacheTemplate 按模板预热缓存实例，解决模板 key 在 Redis 未命中时无法全量刷新的问题。
export async function warmupCacheTemplate(templateKey: string, limit?: number) {
  return requestClient.post<SystemCacheApi.WarmupResp>('/caches/warmup', {
    templateKey,
    limit,
  });
}
