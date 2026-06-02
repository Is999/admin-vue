import type { CommonApi } from '#/api/common';
import type { TaskApi } from '#/api/ops/task';

import { requestClient } from '#/api/request';

// OpsAPIRuntimeApi 定义 API 服务运行态管理相关接口类型。
export namespace OpsAPIRuntimeApi {
  // ReloadResp 表示 API 热加载状态或触发回执。
  export interface ReloadResp {
    connected: boolean; // 是否成功访问 API 内网接口
    status?: null | TaskApi.TaskConfigReloadStatusResp; // API热加载状态
    message: string; // 调用说明
  }

  // ItemsResp 表示 API 运行态配置项查询回执。
  export interface ItemsResp {
    connected: boolean; // 是否成功访问 API 内网接口
    items?: null | TaskApi.TaskConfigItemQueryResp; // API运行态配置项快照
    message: string; // 调用说明
  }
}

// fetchAPIRuntimeConfigReloadStatus 查询 API 服务配置热加载状态。
export async function fetchAPIRuntimeConfigReloadStatus() {
  return requestClient.get<OpsAPIRuntimeApi.ReloadResp>(
    '/api-runtime/config-reload',
  );
}

// fetchAPIRuntimeConfigReloadItems 查询 API 服务当前运行态配置项。
export async function fetchAPIRuntimeConfigReloadItems(
  params: TaskApi.TaskConfigItemQueryReq,
) {
  return requestClient.get<OpsAPIRuntimeApi.ItemsResp>(
    '/api-runtime/config-reload/items',
    { params },
  );
}

// runAPIRuntimeConfigReload 手动触发 API 服务配置热加载。
export async function runAPIRuntimeConfigReload(data?: CommonApi.TwoStepReq) {
  return requestClient.post<OpsAPIRuntimeApi.ReloadResp>(
    '/api-runtime/config-reload',
    { ...data },
  );
}
