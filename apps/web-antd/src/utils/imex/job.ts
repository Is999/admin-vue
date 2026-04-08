// AsyncJobStatus 表示异步导入导出任务的统一状态。
export type AsyncJobStatus = 'failed' | 'queued' | 'running' | 'succeeded';

// AsyncJobItem 表示带 jobId 的通用异步任务状态对象。
export interface AsyncJobItem {
  jobId: string;
  status: AsyncJobStatus;
}

// AsyncJobPollerOptions 表示通用异步任务轮询器参数。
export interface AsyncJobPollerOptions<T extends AsyncJobItem> {
  fetchStatus: (jobId: string) => Promise<T>;
  intervalMs?: number;
  onStatusChange?: (status: T) => Promise<void> | void;
}

// createAsyncJobPoller 创建统一的异步任务轮询器，适用于导入/导出/任务执行结果查询。
export function createAsyncJobPoller<T extends AsyncJobItem>(
  options: AsyncJobPollerOptions<T>,
) {
  const intervalMs = Math.max(500, Number(options.intervalMs) || 2000);
  let pollTimer: null | ReturnType<typeof setTimeout> = null;

  function stop() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function refresh(jobId: string): Promise<T> {
    stop();
    const status = await options.fetchStatus(jobId);
    await options.onStatusChange?.(status);
    if (isAsyncJobRunning(status.status)) {
      pollTimer = setTimeout(() => {
        void refresh(jobId);
      }, intervalMs);
    }
    return status;
  }

  return {
    refresh,
    stop,
  };
}

// downloadBlobFile 把 Blob 数据保存为本地文件。
export function downloadBlobFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// isAsyncJobRunning 判断任务是否仍处于轮询阶段。
export function isAsyncJobRunning(status?: AsyncJobStatus | string) {
  return status === 'queued' || status === 'running';
}
