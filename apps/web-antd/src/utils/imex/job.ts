import { registerSessionStateCleanup } from '../session-state-gate';

// AsyncJobStatus 表示异步导入导出任务的统一状态。
export type AsyncJobStatus = 'failed' | 'queued' | 'running' | 'succeeded';

// AsyncJobItem 表示带 jobId 的通用异步任务状态对象。
export interface AsyncJobItem {
  jobId: string;
  status: AsyncJobStatus;
}

// AsyncJobPollerOptions 表示通用异步任务轮询器参数。
export interface AsyncJobPollerOptions<T extends AsyncJobItem> {
  fetchStatus: (jobId: string, signal?: AbortSignal) => Promise<T>;
  getScopeKey?: () => unknown;
  intervalMs?: number;
  maxDurationMs?: number;
  maxErrorRetries?: number;
  onError?: (error: unknown) => Promise<void> | void;
  onStatusChange?: (status: T) => Promise<void> | void;
}

// AsyncJobSession 提供异步任务在页面重建后的账号级内存状态。
export interface AsyncJobSession<T> {
  clear: () => void;
  load: () => T | undefined;
  save: (value: T) => void;
}

// AsyncJobSessionEntry 保存任务状态及其所属账号。
interface AsyncJobSessionEntry {
  scopeKey: unknown;
  value: unknown;
}

// AsyncJobPollingTimeoutError 表示前端已达连续轮询上限，后端任务仍可通过手动刷新继续查询。
export class AsyncJobPollingTimeoutError extends Error {
  readonly code = 'ASYNC_JOB_POLL_TIMEOUT';

  constructor(jobId: string, maxDurationMs: number) {
    super(
      `Async job ${jobId} polling exceeded ${Math.ceil(maxDurationMs / 1000)} seconds`,
    );
    this.name = 'AsyncJobPollingTimeoutError';
  }
}

// DEFAULT_MAX_DURATION_MS 略高于后端大批量导出的 1 小时超时，既允许长任务完成，也避免页面无限请求。
const DEFAULT_MAX_DURATION_MS = 65 * 60 * 1000;
// DEFAULT_MAX_ERROR_RETRIES 表示连续查询失败后的默认有限重试次数。
const DEFAULT_MAX_ERROR_RETRIES = 3;
// MAX_RETRY_DELAY_MS 限制指数退避上限，避免短时抖动后过久不再查询。
const MAX_RETRY_DELAY_MS = 30_000;
// asyncJobSessions 保存 SPA 运行期内的异步任务状态，账号切换时统一清空。
const asyncJobSessions = new Map<string, AsyncJobSessionEntry>();

registerSessionStateCleanup(() => {
  asyncJobSessions.clear();
});

// createAsyncJobSession 创建账号隔离的内存状态，供页面卸载后恢复任务进度。
export function createAsyncJobSession<T>(
  key: string,
  getScopeKey: () => unknown,
): AsyncJobSession<T> {
  return {
    clear() {
      asyncJobSessions.delete(key);
    },
    load() {
      const entry = asyncJobSessions.get(key);
      if (!entry) {
        return undefined;
      }
      if (!Object.is(entry.scopeKey, getScopeKey())) {
        asyncJobSessions.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    save(value) {
      asyncJobSessions.set(key, {
        scopeKey: getScopeKey(),
        value,
      });
    },
  };
}

// PollRun 保存单次 refresh 启动的可取消轮询上下文。
interface PollRun {
  controller: AbortController;
  jobId: string;
  scopeKey: unknown;
  startedAt: number;
}

// createAsyncJobPoller 创建统一的异步任务轮询器，适用于导入/导出/任务执行结果查询。
export function createAsyncJobPoller<T extends AsyncJobItem>(
  options: AsyncJobPollerOptions<T>,
) {
  const intervalMs = Math.max(500, Number(options.intervalMs) || 2000);
  const configuredMaxDurationMs = Number(options.maxDurationMs);
  const maxDurationMs = Math.max(
    intervalMs,
    Number.isFinite(configuredMaxDurationMs) && configuredMaxDurationMs > 0
      ? configuredMaxDurationMs
      : DEFAULT_MAX_DURATION_MS,
  );
  const configuredMaxErrorRetries = Number(options.maxErrorRetries);
  const maxErrorRetries =
    Number.isFinite(configuredMaxErrorRetries) && configuredMaxErrorRetries >= 0
      ? Math.floor(configuredMaxErrorRetries)
      : DEFAULT_MAX_ERROR_RETRIES;
  let pollTimer: null | ReturnType<typeof setTimeout> = null;
  let activeRun: null | PollRun = null;

  function stop() {
    const run = activeRun;
    activeRun = null;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    run?.controller.abort();
  }

  // reportBackgroundError 收口后台轮询异常；错误回调自身失败也不能形成未处理 Promise。
  async function reportBackgroundError(error: unknown) {
    try {
      await options.onError?.(error);
    } catch {
      // 错误通知不能反向破坏轮询生命周期。
    }
  }

  // isRunScopeCurrent 判断轮询是否仍属于启动时的账号或调用方作用域。
  function isRunScopeCurrent(run: PollRun) {
    return (
      !options.getScopeKey || Object.is(run.scopeKey, options.getScopeKey())
    );
  }

  // deactivateRun 结束指定轮询并取消仍在途的请求或等待。
  function deactivateRun(run: PollRun) {
    if (activeRun !== run) {
      return;
    }
    activeRun = null;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    run.controller.abort();
  }

  // isActiveRun 判断请求、回调或定时器是否仍属于当前轮询和启动作用域。
  function isActiveRun(run: PollRun) {
    if (activeRun !== run || run.controller.signal.aborted) {
      return false;
    }
    if (!isRunScopeCurrent(run)) {
      deactivateRun(run);
      return false;
    }
    return true;
  }

  // finishRun 结束指定轮询，不得误停后续 refresh 启动的新任务。
  function finishRun(run: PollRun) {
    deactivateRun(run);
  }

  // waitForDelay 等待下次查询，同时受 stop 和总轮询时长约束。
  function waitForDelay(run: PollRun, delayMs: number) {
    return new Promise<void>((resolve, reject) => {
      if (!isActiveRun(run)) {
        reject(createAbortError());
        return;
      }
      const remainingMs = maxDurationMs - (Date.now() - run.startedAt);
      if (remainingMs <= 0) {
        reject(new AsyncJobPollingTimeoutError(run.jobId, maxDurationMs));
        return;
      }
      const onAbort = () => {
        cleanup();
        reject(createAbortError());
      };
      const cleanup = () => {
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        run.controller.signal.removeEventListener('abort', onAbort);
      };
      pollTimer = setTimeout(
        () => {
          cleanup();
          if (!isActiveRun(run)) {
            reject(createAbortError());
            return;
          }
          if (Date.now() - run.startedAt >= maxDurationMs) {
            reject(new AsyncJobPollingTimeoutError(run.jobId, maxDurationMs));
            return;
          }
          resolve();
        },
        Math.min(Math.max(0, delayMs), remainingMs),
      );
      run.controller.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // fetchWithRetry 对连续瞬时错误做有限指数退避，任何一次成功都会重置错误计数。
  async function fetchWithRetry(run: PollRun): Promise<T> {
    let errorRetries = 0;
    while (isActiveRun(run)) {
      try {
        const status = await options.fetchStatus(
          run.jobId,
          run.controller.signal,
        );
        if (!isActiveRun(run)) {
          throw createAbortError();
        }
        return status;
      } catch (error) {
        if (!isActiveRun(run)) {
          throw createAbortError();
        }
        if (isAsyncJobPollingAbortError(error)) {
          throw error;
        }
        if (errorRetries >= maxErrorRetries) {
          throw error;
        }
        const retryDelayMs = Math.min(
          intervalMs * 2 ** errorRetries,
          MAX_RETRY_DELAY_MS,
        );
        errorRetries += 1;
        await waitForDelay(run, retryDelayMs);
      }
    }
    throw createAbortError();
  }

  // applyStatus 只向当前轮询提交状态，终态不再创建后续定时器。
  async function applyStatus(run: PollRun, status: T) {
    if (!isActiveRun(run)) {
      return false;
    }
    await options.onStatusChange?.(status);
    if (!isActiveRun(run)) {
      return false;
    }
    if (!isAsyncJobRunning(status.status)) {
      finishRun(run);
      return false;
    }
    return true;
  }

  // continuePolling 执行首次查询后的后台轮询链路。
  async function continuePolling(run: PollRun) {
    try {
      while (isActiveRun(run)) {
        await waitForDelay(run, intervalMs);
        const status = await fetchWithRetry(run);
        if (!(await applyStatus(run, status))) {
          return;
        }
      }
    } catch (error) {
      if (!isActiveRun(run) || isAsyncJobPollingAbortError(error)) {
        return;
      }
      finishRun(run);
      await reportBackgroundError(error);
    }
  }

  async function refresh(jobId: string): Promise<T> {
    stop();
    const run: PollRun = {
      controller: new AbortController(),
      jobId,
      scopeKey: options.getScopeKey?.(),
      startedAt: Date.now(),
    };
    activeRun = run;
    try {
      const status = await fetchWithRetry(run);
      if (await applyStatus(run, status)) {
        void continuePolling(run);
      }
      return status;
    } catch (error) {
      finishRun(run);
      throw error;
    }
  }

  return {
    refresh,
    stop,
  };
}

// createAbortError 创建跨浏览器与测试环境一致的取消错误。
function createAbortError() {
  const error = new Error('Async job polling aborted');
  error.name = 'AbortError';
  return error;
}

// isAbortError 识别 AbortController 或本轮询生成的取消错误。
export function isAsyncJobPollingAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

// isAsyncJobRunning 判断任务是否仍处于轮询阶段。
export function isAsyncJobRunning(status?: AsyncJobStatus | string) {
  return status === 'queued' || status === 'running';
}
