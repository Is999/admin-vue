import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AsyncJobPollingTimeoutError,
  createAsyncJobPoller,
  createAsyncJobSession,
} from '../job';

interface TestJobStatus {
  jobId: string;
  status: 'failed' | 'queued' | 'running' | 'succeeded';
}

describe('async job poller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects an in-flight request after stop and does not revive it', async () => {
    let resolveStatus: (status: TestJobStatus) => void = () => {};
    const fetchStatus = vi.fn(
      () =>
        new Promise<TestJobStatus>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    const onStatusChange = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      intervalMs: 500,
      onStatusChange,
    });

    const refreshPromise = poller.refresh('job-1');
    poller.stop();
    resolveStatus({ jobId: 'job-1', status: 'running' });

    await expect(refreshPromise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('rejects an in-flight result after its scope changes', async () => {
    let currentScope = 'account-a';
    let resolveStatus: (status: TestJobStatus) => void = () => {};
    const fetchStatus = vi.fn(
      () =>
        new Promise<TestJobStatus>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    const onStatusChange = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      getScopeKey: () => currentScope,
      onStatusChange,
    });

    const refreshPromise = poller.refresh('job-a');
    currentScope = 'account-b';
    resolveStatus({ jobId: 'job-a', status: 'running' });

    await expect(refreshPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(onStatusChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('normalizes a canceled client request after stop', async () => {
    const fetchStatus = vi.fn(
      (_jobId: string, signal?: AbortSignal) =>
        new Promise<TestJobStatus>((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('canceled');
              error.name = 'CanceledError';
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const poller = createAsyncJobPoller({ fetchStatus });

    const refreshPromise = poller.refresh('job-1');
    poller.stop();

    await expect(refreshPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('retries a transient scheduled error and continues polling', async () => {
    const refreshError = new Error('refresh failed');
    const fetchStatus = vi
      .fn<() => Promise<TestJobStatus>>()
      .mockResolvedValueOnce({ jobId: 'job-1', status: 'running' })
      .mockRejectedValueOnce(refreshError)
      .mockResolvedValueOnce({ jobId: 'job-1', status: 'running' });
    const onError = vi.fn();
    const onStatusChange = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      intervalMs: 500,
      onError,
      onStatusChange,
    });

    await poller.refresh('job-1');
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    poller.stop();
  });

  it('reports one terminal error after bounded exponential retries', async () => {
    const refreshError = new Error('refresh failed');
    const fetchStatus = vi
      .fn<() => Promise<TestJobStatus>>()
      .mockResolvedValueOnce({ jobId: 'job-1', status: 'running' })
      .mockRejectedValue(refreshError);
    const onError = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      intervalMs: 500,
      maxErrorRetries: 2,
      onError,
    });

    await poller.refresh('job-1');
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchStatus).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(refreshError);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it('stops at the total polling deadline', async () => {
    const fetchStatus = vi
      .fn<() => Promise<TestJobStatus>>()
      .mockResolvedValue({
        jobId: 'job-1',
        status: 'running',
      });
    const onError = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      intervalMs: 500,
      maxDurationMs: 1200,
      onError,
    });

    await poller.refresh('job-1');
    await vi.advanceTimersByTimeAsync(1200);

    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(
      AsyncJobPollingTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it('cancels a pending retry and aborts the active request signal', async () => {
    const refreshError = new Error('refresh failed');
    const signals: AbortSignal[] = [];
    const fetchStatus = vi
      .fn<(jobId: string, signal?: AbortSignal) => Promise<TestJobStatus>>()
      .mockImplementationOnce(async (_jobId, signal) => {
        if (signal) {
          signals.push(signal);
        }
        return { jobId: 'job-1', status: 'running' };
      })
      .mockImplementationOnce(async (_jobId, signal) => {
        if (signal) {
          signals.push(signal);
        }
        throw refreshError;
      });
    const onError = vi.fn();
    const poller = createAsyncJobPoller({
      fetchStatus,
      intervalMs: 500,
      onError,
    });

    await poller.refresh('job-1');
    await vi.advanceTimersByTimeAsync(500);
    poller.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('async job session', () => {
  it('restores state after the page creates a new session handle', () => {
    const first = createAsyncJobSession<TestJobStatus>(
      'test-job-restore',
      () => 'account-a',
    );
    first.clear();
    first.save({ jobId: 'job-1', status: 'running' });

    const restored = createAsyncJobSession<TestJobStatus>(
      'test-job-restore',
      () => 'account-a',
    );

    expect(restored.load()).toEqual({ jobId: 'job-1', status: 'running' });
    restored.clear();
  });

  it('drops state when the account scope changes', () => {
    let scope = 'account-a';
    const session = createAsyncJobSession<TestJobStatus>(
      'test-job-account',
      () => scope,
    );
    session.clear();
    session.save({ jobId: 'job-a', status: 'queued' });

    scope = 'account-b';

    expect(session.load()).toBeUndefined();
  });
});
