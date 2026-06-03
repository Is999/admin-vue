import { requestClient } from '#/api/request';

// CollectorApi 定义 Collector管理接口的请求与响应结构。
export namespace CollectorApi {
  export type TaskState = 0 | 1 | 2 | 3 | 4;
  export type Transport = 'db' | 'kafka' | 'redis';

  export interface WindowStat {
    windowMinutes: number;
    successCount: number;
    failCount: number;
    avgCostMs: number;
    maxCostMs: number;
  }

  export interface BizTypeStat {
    bizType: string;
    readyCount: number;
    runningCount: number;
    retryCount: number;
    deadCount: number;
    recentSuccessCount: number;
    recentFailCount: number;
    recentAvgCostMs: number;
    recentMaxCostMs: number;
  }

  export interface TransportStat {
    transport: string | Transport;
    totalCount: number;
    readyCount: number;
    runningCount: number;
    retryCount: number;
    deadCount: number;
    doneCount: number;
  }

  export interface OverviewResp {
    pendingCount: number;
    runningCount: number;
    doneCount: number;
    retryCount: number;
    deadCount: number;
    readyCount: number;
    runningTimeoutCount: number;
    oldestReadyAgeSeconds: number;
    kafkaBatchSize: number;
    redisReadCount: number;
    dbRunnerBatchSize: number;
    dbRunnerIntervalSecs: number;
    runningLeaseSeconds: number;
    maxRetryTimes: number;
    overviewGeneratedAt: string;
    overviewCacheTTLSeconds: number;
    overviewCacheAgeSeconds: number;
    overviewCacheHit: boolean;
    recent1m: WindowStat;
    recent5m: WindowStat;
    recent15m: WindowStat;
    bizTypeTop15m: BizTypeStat[];
    transportStats: TransportStat[];
  }

  export interface TaskItem {
    id: number;
    eventId: string;
    bizType: string;
    partitionKey: string;
    payload: string;
    transport: Transport;
    state: TaskState;
    attempt: number;
    nextRunAt: string;
    startedAt?: string;
    finishedAt?: string;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface ListTasksReq {
    page?: number;
    pageSize?: number;
    bizType?: string;
    transport?: Transport;
    state?: TaskState;
  }

  export interface ListTasksResp {
    list: TaskItem[];
    total: number;
  }

  export interface RunReq {
    limit?: number;
  }

  export interface RunResp {
    processed: number;
    error?: string;
    message?: string;
  }

  export interface RetryReq {
    ids: number[];
    delaySeconds?: number;
    resetAttempt?: boolean;
  }

  export interface RetryResp {
    updated: number;
  }
}

// fetchCollectorOverview 查询 Collector 概览与近期性能观察数据。
export async function fetchCollectorOverview() {
  return requestClient.get<CollectorApi.OverviewResp>('/collector/overview');
}

// fetchCollectorTasks 查询 Collector任务列表。
export async function fetchCollectorTasks(params: CollectorApi.ListTasksReq) {
  return requestClient.get<CollectorApi.ListTasksResp>('/collector/tasks', {
    params,
  });
}

// runCollector 手动触发执行一轮 Collector任务。
export async function runCollector(payload: CollectorApi.RunReq) {
  return requestClient.post<CollectorApi.RunResp>('/collector/run', payload);
}

// retryCollectorTasks 对指定任务发起人工重试/延迟重试。
export async function retryCollectorTasks(payload: CollectorApi.RetryReq) {
  return requestClient.post<CollectorApi.RetryResp>(
    '/collector/tasks/retry',
    payload,
  );
}
