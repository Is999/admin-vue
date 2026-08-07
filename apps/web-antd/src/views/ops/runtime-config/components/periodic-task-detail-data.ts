import type { TaskApi } from '#/api/ops/task';

// PeriodicRecentTask 是周期任务详情统一展示的 Redis 热状态或 DB 终态摘要。
export type PeriodicRecentTask = {
  /** dataSource 标识当前摘要来自 Redis 热状态或数据库终态历史。 */
  dataSource: 'database' | 'redis';
  /** historyId 是 DB 终态历史主键；Redis 热状态不设置。 */
  historyId?: number;
  /** traceTotal 是 Redis 或 DB 快照记录的任务总处理量。 */
  traceTotal: number;
} & Pick<
  TaskApi.TaskItem,
  | 'completedAt'
  | 'deadline'
  | 'durationMs'
  | 'id'
  | 'lastErr'
  | 'lastFailedAt'
  | 'maxRetry'
  | 'nextProcessAt'
  | 'queue'
  | 'retried'
  | 'startedAt'
  | 'state'
  | 'taskName'
  | 'taskType'
  | 'workflowId'
>;

// mergePeriodicRecentTasks 合并 Redis 热状态与 DB 终态，按队列和任务 ID 去重后倒序截取。
export function mergePeriodicRecentTasks(
  liveTasks: TaskApi.TaskItem[],
  taskRuns: TaskApi.TaskRunHistoryItem[],
  limit: number,
): PeriodicRecentTask[] {
  const taskByID = new Map<string, PeriodicRecentTask>();
  for (const run of taskRuns) {
    const key = periodicTaskKey(run.queue, run.taskId);
    if (!taskByID.has(key)) {
      taskByID.set(key, taskRunToRecentTask(run));
    }
  }
  for (const task of liveTasks) {
    taskByID.set(periodicTaskKey(task.queue, task.id), {
      completedAt: task.completedAt,
      dataSource: 'redis',
      deadline: task.deadline,
      durationMs: task.durationMs,
      id: task.id,
      lastErr: task.lastErr,
      lastFailedAt: task.lastFailedAt,
      maxRetry: task.maxRetry,
      nextProcessAt: task.nextProcessAt,
      queue: task.queue,
      retried: task.retried,
      startedAt: task.startedAt,
      state: task.state,
      taskName: task.taskName,
      taskType: task.taskType,
      traceTotal: task.executionTrace?.totalCount ?? 0,
      workflowId: task.workflowId,
    });
  }
  return [...taskByID.values()]
    .toSorted((left, right) => taskActivityTime(right) - taskActivityTime(left))
    .slice(0, Math.max(0, limit));
}

// taskRunToRecentTask 把数据库终态摘要转换为详情抽屉的统一展示结构。
function taskRunToRecentTask(
  run: TaskApi.TaskRunHistoryItem,
): PeriodicRecentTask {
  const failed = run.status === 'failed';
  return {
    completedAt: run.finishedAt,
    dataSource: 'database',
    durationMs: run.durationMs,
    historyId: run.id,
    id: run.taskId,
    lastErr: run.errorMessage,
    lastFailedAt: failed ? run.finishedAt : undefined,
    maxRetry: run.maxRetry,
    queue: run.queue,
    retried: run.retried,
    startedAt: run.startedAt,
    state: failed ? 'archived' : 'completed',
    taskName: run.taskName,
    taskType: run.taskType,
    traceTotal: run.traceTotal,
    workflowId: run.workflowId,
  };
}

// periodicTaskKey 使用 Asynq 的队列内任务身份去重，避免不同队列同 ID 相互覆盖。
function periodicTaskKey(queue: string, taskID: string) {
  return `${queue}\u0000${taskID}`;
}

// taskActivityTime 返回任务最有意义的活动时间，非法或缺失时间排在末尾。
function taskActivityTime(task: PeriodicRecentTask) {
  const value =
    task.completedAt ||
    task.lastFailedAt ||
    task.startedAt ||
    task.nextProcessAt ||
    '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
