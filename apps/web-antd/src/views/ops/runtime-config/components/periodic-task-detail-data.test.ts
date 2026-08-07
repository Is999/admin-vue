import type { PeriodicRecentTask } from './periodic-task-detail-data';

import { describe, expect, it } from 'vitest';

import { mergePeriodicRecentTasks } from './periodic-task-detail-data';

// buildLiveTask 构造周期详情所需的最小 Redis 热状态任务。
function buildLiveTask(id: string, startedAt: string) {
  return {
    executionTrace: { totalCount: 12 },
    id,
    isOrphaned: false,
    maxRetry: 3,
    payload: {},
    queue: 'maintenance',
    retried: 0,
    startedAt,
    state: 'active',
    taskType: 'demo.run',
    timeoutSec: 60,
  };
}

// buildTaskRun 构造周期详情所需的最小 DB 终态摘要。
function buildTaskRun(taskId: string, finishedAt: string) {
  return {
    dataSource: 'database' as const,
    durationMs: 10,
    finishedAt,
    id: 1,
    maxRetry: 3,
    queue: 'maintenance',
    retried: 0,
    shardIndex: 0,
    shardTotal: 1,
    startedAt: finishedAt,
    status: 'success' as const,
    taskId,
    taskName: 'demo-periodic',
    taskType: 'demo.run',
    traceDelete: 0,
    traceError: 0,
    traceRead: 0,
    traceTotal: 7,
    traceWrite: 0,
  };
}

describe('mergePeriodicRecentTasks', () => {
  it('合并热状态与终态并按活动时间倒序', () => {
    const result = mergePeriodicRecentTasks(
      [buildLiveTask('live', '2026-08-07T02:00:00Z')],
      [buildTaskRun('done', '2026-08-07T01:00:00Z')],
      20,
    );

    expect(
      result.map((item) => [
        item.id,
        item.dataSource,
        item.state,
        item.historyId,
      ]),
    ).toEqual([
      ['live', 'redis', 'active', undefined],
      ['done', 'database', 'completed', 1],
    ]);
  });

  it('同队列同任务优先展示 Redis 热状态并执行上限截取', () => {
    const result: PeriodicRecentTask[] = mergePeriodicRecentTasks(
      [buildLiveTask('same', '2026-08-07T03:00:00Z')],
      [
        buildTaskRun('same', '2026-08-07T02:00:00Z'),
        buildTaskRun('older', '2026-08-07T01:00:00Z'),
      ],
      1,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('same');
    expect(result[0]?.dataSource).toBe('redis');
    expect(result[0]?.traceTotal).toBe(12);
  });

  it('统一保留 Redis 热状态与 DB 终态的总处理量', () => {
    const result = mergePeriodicRecentTasks(
      [buildLiveTask('live', '2026-08-07T03:00:00Z')],
      [buildTaskRun('done', '2026-08-07T02:00:00Z')],
      20,
    );

    expect(result.map((item) => [item.id, item.traceTotal])).toEqual([
      ['live', 12],
      ['done', 7],
    ]);
  });
});
