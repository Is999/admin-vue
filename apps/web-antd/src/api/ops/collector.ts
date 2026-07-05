import { requestClient } from '#/api/request';

// CollectorApi 定义 Collector管理接口的请求与响应结构。
export namespace CollectorApi {
  export type FailureState = 0 | 1 | 2 | 3 | 4;

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

  export interface RuntimeTotals {
    published: number;
    publishFailed: number;
    consumed: number;
    invalid: number;
    duplicate: number;
    processed: number;
    succeeded: number;
    failed: number;
    batches: number;
    failedBatches: number;
    dead: number;
  }

  export interface RuntimeWindow extends RuntimeTotals {
    windowMinutes: number;
    avgBatchSize: number;
    avgCostMs: number;
    maxCostMs: number;
    lastEventAt: string;
  }

  export interface RuntimeBizType extends RuntimeTotals {
    bizType: string;
    avgBatchSize: number;
    avgCostMs: number;
    maxCostMs: number;
    lastEventAt: string;
  }

  export interface RuntimeMetrics {
    enabled: boolean;
    scope: string;
    startedAt: string;
    generatedAt: string;
    totals: RuntimeTotals;
    recent1m: RuntimeWindow;
    recent5m: RuntimeWindow;
    recent15m: RuntimeWindow;
    bizTypeTop15m: RuntimeBizType[];
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
    failureRunnerBatchSize: number;
    failureRunnerIntervalSecs: number;
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
    runtimeMetrics: RuntimeMetrics;
  }

  export interface FailureItem {
    id: number;
    eventId: string;
    bizType: string;
    partitionKey: string;
    payload: string;
    state: FailureState;
    attempt: number;
    nextRunAt: string;
    startedAt?: string;
    finishedAt?: string;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface ListFailuresReq {
    page?: number;
    pageSize?: number;
    bizType?: string;
    state?: FailureState;
  }

  export interface ListFailuresResp {
    list: FailureItem[];
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

// fetchCollectorFailures 查询 Collector 失败事件列表。
export async function fetchCollectorFailures(
  params: CollectorApi.ListFailuresReq,
) {
  return requestClient.get<CollectorApi.ListFailuresResp>(
    '/collector/failures',
    {
      params,
    },
  );
}

// runCollector 手动触发执行一轮 Collector 失败账本重试。
export async function runCollector(payload: CollectorApi.RunReq) {
  return requestClient.post<CollectorApi.RunResp>(
    '/collector/failures/run',
    payload,
  );
}

// retryCollectorFailures 对指定失败事件发起人工重试/延迟重试。
export async function retryCollectorFailures(payload: CollectorApi.RetryReq) {
  return requestClient.post<CollectorApi.RetryResp>(
    '/collector/failures/retry',
    payload,
  );
}
