import { requestClient } from '#/api/request';

// TaskApi 定义 cron 任务系统相关接口的请求与响应结构。
export namespace TaskApi {
  /** 手动触发工作流请求 */
  export interface TriggerWorkflowReq {
    /** 工作流名称 */
    name: string;
    /** 执行目标列表 */
    targets?: string[];
    /** 指定投递队列 */
    queue?: string;
    /** 分片总数 */
    shardTotal?: number;
    /** 灰度比例 */
    grayPercent?: number;
    /** 去重键 */
    uniqueKey?: string;
    /** 去重 TTL，单位秒 */
    uniqueTTLSeconds?: number;
    /** 覆盖默认重试次数 */
    retry?: number;
    /** 覆盖默认超时时间，单位秒 */
    timeoutSeconds?: number;
    /** 指定触发时间，RFC3339 */
    processAt?: string;
    /** 相对当前时间延迟执行，单位秒 */
    processInSeconds?: number;
    /** 任务截止时间，RFC3339 */
    deadline?: string;
  }

  /** 查询工作流状态请求 */
  export interface GetWorkflowStatusReq {
    /** 工作流实例 ID */
    workflowId: string;
  }

  /** 队列暂停/恢复请求 */
  export interface OperateTaskQueueReq {
    /** 队列名称 */
    queue: string;
  }

  /** 查询任务详情请求 */
  export interface GetTaskInfoReq {
    /** 队列名称 */
    queue: string;
    /** 任务 ID */
    taskId: string;
  }

  /** 查询任务列表请求 */
  export interface ListTaskItemsReq {
    /** 队列名称 */
    queue: string;
    /** 任务状态 */
    state:
      | 'active'
      | 'aggregating'
      | 'archived'
      | 'completed'
      | 'pending'
      | 'retry'
      | 'scheduled';
    /** 聚合组名称，仅 aggregating 使用 */
    group?: string;
    /** 工作流实例 ID */
    workflowId?: string;
    /** 任务名称关键字，支持按 task_periodic.name 或展示名筛选 */
    taskName?: string;
    /** 任务活动时间开始，RFC3339；scheduled 按 nextProcessAt 过滤 */
    timeStart?: string;
    /** 任务活动时间结束，RFC3339；scheduled 按 nextProcessAt 过滤 */
    timeEnd?: string;
    /** 页码 */
    page?: number;
    /** 每页条数 */
    pageSize?: number;
  }

  /** 查询任务总览请求 */
  export interface ListTaskItemsOverviewReq {
    /** 队列名称；为空时由后端按可见队列聚合 */
    queue?: string;
    /** 任务状态；为空时聚合常用状态并按任务时间倒序返回 */
    state?: '' | ListTaskItemsReq['state'];
    /** 聚合组名称，仅 aggregating 使用 */
    group?: string;
    /** 工作流实例 ID */
    workflowId?: string;
    /** 任务名称关键字，支持按 task_periodic.name 或展示名筛选 */
    taskName?: string;
    /** 任务活动时间开始，RFC3339；scheduled 按 nextProcessAt 过滤 */
    timeStart?: string;
    /** 任务活动时间结束，RFC3339；scheduled 按 nextProcessAt 过滤 */
    timeEnd?: string;
    /** 页码 */
    page?: number;
    /** 每页条数 */
    pageSize?: number;
    /** 状态为空时是否纳入 aggregating 聚合 */
    includeAggregating?: boolean;
  }

  /** 单任务操作请求 */
  export interface OperateTaskReq {
    /** 队列名称 */
    queue: string;
    /** 任务 ID */
    taskId: string;
  }

  /** 手动投递通用任务请求 */
  export interface EnqueueTaskReq {
    /** 已注册的任务类型 */
    taskType: string;
    /** 任务负载 JSON */
    payload: Record<string, any>;
    /** 指定队列 */
    queue?: string;
    /** 聚合分组名称 */
    group?: string;
    /** 覆盖最大重试次数 */
    retry?: number;
    /** 超时时间，单位秒 */
    timeoutSeconds?: number;
    /** 绝对执行时间，RFC3339 */
    processAt?: string;
    /** 相对延迟执行时间，单位秒 */
    processInSeconds?: number;
    /** 截止时间，RFC3339 */
    deadline?: string;
    /** 去重窗口，单位秒 */
    uniqueTTLSeconds?: number;
  }

  /** 工作流触发回执 */
  export interface WorkflowTriggerResp {
    /** 触发任务 ID */
    taskId: string;
    /** 工作流实例 ID */
    workflowId: string;
    /** 工作流名称 */
    workflowName: string;
    /** 投递队列 */
    queue: string;
    /** 计划执行时间 */
    processAt?: string;
  }

  /** 通用任务投递回执 */
  export interface EnqueueTaskResp {
    /** 任务 ID */
    taskId: string;
    /** 任务类型 */
    taskType: string;
    /** 投递队列 */
    queue: string;
    /** 计划执行时间 */
    processAt?: string;
  }

  /** 单个任务状态快照 */
  export interface TaskItem {
    /** 任务 ID */
    id: string;
    /** 所属队列 */
    queue: string;
    /** 任务类型 */
    taskType: string;
    /** 任务名称/脚本名称 */
    taskName?: string;
    /** 关联工作流实例 ID */
    workflowId?: string;
    /** 当前状态 */
    state: string;
    /** 聚合分组 */
    group?: string;
    /** 最大重试次数 */
    maxRetry: number;
    /** 已重试次数 */
    retried: number;
    /** 最后一次错误 */
    lastErr?: string;
    /** 超时时间，单位秒 */
    timeoutSec: number;
    /** 开始执行时间 */
    startedAt?: string;
    /** 执行耗时，单位毫秒；执行中任务表示已运行时长 */
    durationMs?: number;
    /** 截止时间 */
    deadline?: string;
    /** 下次计划执行时间 */
    nextProcessAt?: string;
    /** 完成时间 */
    completedAt?: string;
    /** 最近失败时间 */
    lastFailedAt?: string;
    /** 是否孤儿任务 */
    isOrphaned: boolean;
    /** 任务头信息 */
    headers?: Record<string, string>;
    /** 原始任务负载 */
    payload: Record<string, any>;
    /** 任务结果 */
    result?: Record<string, any>;
  }

  /** 任务列表响应 */
  export interface TaskListResp {
    /** 查询队列 */
    queue: string;
    /** 查询状态 */
    state: string;
    /** 聚合分组 */
    group?: string;
    /** 工作流实例 ID 筛选条件 */
    workflowId?: string;
    /** 任务名称关键字筛选条件 */
    taskName?: string;
    /** 时间范围开始 */
    timeStart?: string;
    /** 时间范围结束 */
    timeEnd?: string;
    /** 当前页码 */
    page: number;
    /** 当前页大小 */
    pageSize: number;
    /** 任务总数 */
    total: number;
    /** 任务列表 */
    tasks: TaskItem[];
  }

  /** 任务总览响应 */
  export interface TaskListOverviewResp {
    /** 当前筛选队列 */
    queue?: string;
    /** 当前显式筛选状态 */
    state?: string;
    /** 本次真正命中的状态 */
    effectiveState?: string;
    /** 聚合组 */
    group?: string;
    /** 工作流实例 ID 筛选条件 */
    workflowId?: string;
    /** 任务名称关键字筛选条件 */
    taskName?: string;
    /** 时间范围开始 */
    timeStart?: string;
    /** 时间范围结束 */
    timeEnd?: string;
    /** 当前页码 */
    page: number;
    /** 当前页大小 */
    pageSize: number;
    /** 当前结果总数 */
    total: number;
    /** 是否为聚合查询 */
    aggregateMode: boolean;
    /** 实际参与查询的队列列表 */
    queues?: string[];
    /** 各任务状态的队列级总数，用于展示可切换状态入口 */
    stateTotals?: Partial<Record<ListTaskItemsReq['state'], number>>;
    /** 任务列表 */
    tasks: TaskItem[];
  }

  /** 工作流节点状态 */
  export interface WorkflowNodeItem {
    /** 节点名称 */
    name: string;
    /** 实际执行任务类型 */
    taskType: string;
    /** 节点执行队列 */
    queue: string;
    /** 节点状态 */
    status: string;
    /** 依赖节点列表 */
    dependsOn?: string[];
    /** 期望执行实例数 */
    expected: number;
    /** 已成功实例数 */
    succeeded: number;
    /** 已失败实例数 */
    failed: number;
    /** 被灰度跳过的实例数 */
    skipped: number;
    /** 节点失败信息 */
    errorMessage?: string;
    /** 节点开始时间 */
    startedAt?: string;
    /** 节点完成时间 */
    finishedAt?: string;
    /** 节点执行耗时，单位毫秒；运行中节点表示已运行时长 */
    durationMs?: number;
  }

  /** 工作流整体状态 */
  export interface WorkflowStatusResp {
    /** 工作流实例 ID */
    workflowId: string;
    /** 工作流名称 */
    workflowName: string;
    /** 工作流状态 */
    status: string;
    /** 触发来源 */
    source: string;
    /** 默认执行队列 */
    queue: string;
    /** 执行目标列表 */
    targets?: string[];
    /** 分片总数 */
    shardTotal: number;
    /** 灰度比例 */
    grayPercent: number;
    /** 失败原因 */
    errorMessage?: string;
    /** 创建时间 */
    createdAt: string;
    /** 最近更新时间 */
    updatedAt: string;
    /** 完成时间 */
    finishedAt?: string;
    /** 工作流总耗时，单位毫秒；运行中工作流表示已运行时长 */
    durationMs?: number;
    /** 节点明细 */
    nodes: WorkflowNodeItem[];
  }

  /** 已注册任务类型 */
  export interface TaskTypeRegistryItem {
    /** 任务类型标识 */
    taskType: string;
    /** 中文说明 */
    description?: string;
    /** 使用提示 */
    usageHint?: string;
    /** 推荐负载 JSON 示例 */
    payloadExample?: string;
    /** 是否推荐人工手动投递 */
    manualRecommended: boolean;
  }

  /** 任务类型注册清单 */
  export interface TaskTypeRegistryResp {
    /** 已注册任务类型列表 */
    items: TaskTypeRegistryItem[];
  }

  /** 已注册工作流 */
  export interface WorkflowRegistryItem {
    /** 工作流名称 */
    name: string;
    /** 工作流说明 */
    description: string;
    /** 默认执行队列 */
    defaultQueue: string;
    /** 节点数量 */
    nodeCount: number;
    /** 使用提示 */
    usageHint?: string;
    /** 执行目标填写示例 */
    targetsExample?: string;
  }

  /** 工作流注册清单 */
  export interface WorkflowRegistryResp {
    /** 已注册工作流列表 */
    items: WorkflowRegistryItem[];
  }

  /** 队列快照 */
  export interface TaskQueueItem {
    /** 队列名称 */
    name: string;
    /** 是否已暂停 */
    paused: boolean;
    /** 队列总任务数 */
    size: number;
    /** 待执行任务数 */
    pending: number;
    /** 执行中任务数 */
    active: number;
    /** 定时任务数 */
    scheduled: number;
    /** 重试队列任务数 */
    retry: number;
    /** 归档任务数 */
    archived: number;
    /** 已完成保留任务数 */
    completed: number;
    /** 聚合中的任务数 */
    aggregating: number;
    /** 当日已处理任务数 */
    processed: number;
    /** 当日失败任务数 */
    failed: number;
    /** 队列延迟，单位毫秒 */
    latencyMs: number;
    /** 预估内存占用，单位字节 */
    memoryUsage: number;
  }

  /** 在线 Worker 节点快照 */
  export interface TaskServerItem {
    /** Worker 实例 ID */
    id: string;
    /** 所在主机 */
    host: string;
    /** 进程 ID */
    pid: number;
    /** Worker 状态 */
    status: string;
    /** 并发度 */
    concurrency: number;
    /** 是否启用严格优先级 */
    strictPriority: boolean;
    /** 队列权重配置 */
    queues?: Record<string, number>;
    /** 启动时间 */
    startedAt?: string;
  }

  /** 周期调度器运行状态 */
  export interface TaskSchedulerItem {
    /** 配置中是否启用调度器 */
    enabled: boolean;
    /** 当前进程是否已启动 leader 选举循环 */
    running: boolean;
    /** 当前进程是否持有 leader */
    hasLeader: boolean;
    /** 当前进程实例 ID */
    instanceId?: string;
    /** leader 锁 key */
    leaderLockKey?: string;
    /** leader 锁租约时长，单位秒 */
    leaseTtlSeconds: number;
    /** leader 锁续租间隔，单位秒 */
    renewIntervalSeconds: number;
    /** 周期任务配置同步间隔，单位秒 */
    syncIntervalSeconds: number;
    /** 调度器心跳间隔，单位秒 */
    heartbeatIntervalSeconds: number;
    /** 当前有效周期任务数量 */
    periodicTaskCount: number;
    /** 最近一次调度器总体状态 */
    lastStatus?: string;
    /** 最近一次调度器总体状态说明 */
    lastMessage?: string;
    /** 最近一次启动 leader 选举时间 */
    lastStartedAt?: string;
    /** 最近一次心跳上报时间 */
    lastHeartbeatAt?: string;
    /** 最近一次获取 leader 时间 */
    lastAcquireAt?: string;
    /** 最近一次释放或丢失 leader 时间 */
    lastReleaseAt?: string;
    /** 最近一次同步周期配置时间 */
    lastSyncAt?: string;
    /** 最近一次同步结果 */
    lastSyncStatus?: string;
    /** 最近一次同步结果说明 */
    lastSyncMessage?: string;
    /** 最近一次周期任务入队时间 */
    lastEnqueueAt?: string;
    /** 最近一次入队的任务名称 */
    lastEnqueueTaskName?: string;
    /** 最近一次入队的任务类型 */
    lastEnqueueTaskType?: string;
    /** 最近一次入队失败时间 */
    lastEnqueueErrorAt?: string;
    /** 最近一次入队失败原因 */
    lastEnqueueErrorMessage?: string;
  }

  /** 队列与 Worker 概览 */
  export interface TaskQueueListResp {
    /** 队列快照列表 */
    queues: TaskQueueItem[];
    /** 在线 Worker 节点列表 */
    servers?: TaskServerItem[];
    /** 周期调度器运行状态 */
    scheduler?: TaskSchedulerItem;
  }

  /** 配置热加载运行状态 */
  export interface TaskConfigReloadStatusResp {
    /** 是否启用配置热加载 */
    enabled: boolean;
    /** 当前是否正在后台监听配置文件 */
    watching: boolean;
    /** 当前监听的配置文件路径 */
    configFile: string;
    /** 当前轮询间隔，单位秒 */
    checkIntervalSeconds: number;
    /** 当前生效配置版本指纹 */
    configVersion: string;
    /** 当前关键配置摘要 */
    configSummary: string;
    /** 本次热加载后是否仍需重启进程才能完全生效 */
    restartRequired: boolean;
    /** 需要重启才能完全生效的原因摘要 */
    restartReason: string;
    /** 最近一次处理结果 */
    lastStatus: string;
    /** 最近一次处理结果说明 */
    lastMessage: string;
    /** 最近一次触发来源 */
    lastTriggerSource: string;
    /** 最近一次失败分类 */
    lastFailureCategory: string;
    /** 最近一次检查配置文件时间 */
    lastCheckedAt?: string;
    /** 最近一次触发配置重载时间 */
    lastReloadAt?: string;
    /** 最近一次成功加载时间 */
    lastSuccessAt?: string;
    /** 最近一次失败时间 */
    lastFailureAt?: string;
    /** 累计成功加载次数 */
    reloadCount: number;
    /** 限频压制的重复失败日志次数 */
    suppressedFailureCount: number;
  }
}

// TASK_PREFIX 统一管理任务系统接口前缀。
const TASK_PREFIX = '/tasks';

// triggerTaskWorkflow 调用工作流触发接口。
export async function triggerTaskWorkflow(data: TaskApi.TriggerWorkflowReq) {
  return requestClient.post<TaskApi.WorkflowTriggerResp>(
    `${TASK_PREFIX}/workflows`,
    data,
  );
}

// enqueueTask 调用通用任务投递接口。
export async function enqueueTask(data: TaskApi.EnqueueTaskReq) {
  return requestClient.post<TaskApi.EnqueueTaskResp>(TASK_PREFIX, data);
}

// getTaskWorkflowStatus 查询工作流实例状态。
export async function getTaskWorkflowStatus(
  params: TaskApi.GetWorkflowStatusReq,
) {
  return requestClient.get<TaskApi.WorkflowStatusResp>(
    `${TASK_PREFIX}/workflows/${encodeURIComponent(params.workflowId)}`,
  );
}

// getTaskInfo 查询单个任务详情。
export async function getTaskInfo(params: TaskApi.GetTaskInfoReq) {
  return requestClient.get<TaskApi.TaskItem>(
    `${TASK_PREFIX}/${encodeURIComponent(params.taskId)}`,
    {
      params: { queue: params.queue },
    },
  );
}

// fetchTaskItems 查询任务列表。
export async function fetchTaskItems(params: TaskApi.ListTaskItemsReq) {
  return requestClient.get<TaskApi.TaskListResp>(TASK_PREFIX, {
    params,
  });
}

// fetchTaskItemsOverview 查询任务总览列表。
export async function fetchTaskItemsOverview(
  params: TaskApi.ListTaskItemsOverviewReq,
) {
  return requestClient.get<TaskApi.TaskListOverviewResp>(
    `${TASK_PREFIX}/overview`,
    {
      params,
    },
  );
}

// fetchTaskQueues 查询任务队列与 Worker 概览。
export async function fetchTaskQueues() {
  return requestClient.get<TaskApi.TaskQueueListResp>(`${TASK_PREFIX}/queues`);
}

// fetchTaskRegistryTaskTypes 查询已注册任务类型清单。
export async function fetchTaskRegistryTaskTypes() {
  return requestClient.get<TaskApi.TaskTypeRegistryResp>(
    `${TASK_PREFIX}/registry/task-types`,
  );
}

// fetchTaskRegistryWorkflows 查询已注册工作流清单。
export async function fetchTaskRegistryWorkflows() {
  return requestClient.get<TaskApi.WorkflowRegistryResp>(
    `${TASK_PREFIX}/registry/workflows`,
  );
}

// fetchConfigReloadStatus 查询配置热加载状态。
export async function fetchConfigReloadStatus() {
  return requestClient.get<TaskApi.TaskConfigReloadStatusResp>(
    `${TASK_PREFIX}/config-reload`,
  );
}

// runConfigReload 手动触发配置热加载。
export async function runConfigReload() {
  return requestClient.post<TaskApi.TaskConfigReloadStatusResp>(
    `${TASK_PREFIX}/config-reload`,
  );
}

// pauseTaskQueue 暂停指定队列消费。
export async function pauseTaskQueue(data: TaskApi.OperateTaskQueueReq) {
  return requestClient.post(
    `${TASK_PREFIX}/queues/pause/${encodeURIComponent(data.queue)}`,
    data,
  );
}

// resumeTaskQueue 恢复指定队列消费。
export async function resumeTaskQueue(data: TaskApi.OperateTaskQueueReq) {
  return requestClient.post(
    `${TASK_PREFIX}/queues/resume/${encodeURIComponent(data.queue)}`,
    data,
  );
}

// runTaskNow 让任务立即执行。
export async function runTaskNow(data: TaskApi.OperateTaskReq) {
  return requestClient.post(
    `${TASK_PREFIX}/run/${encodeURIComponent(data.taskId)}`,
    {
      queue: data.queue,
    },
  );
}

// deleteTask 删除指定任务。
export async function deleteTask(data: TaskApi.OperateTaskReq) {
  return requestClient.delete(
    `${TASK_PREFIX}/${encodeURIComponent(data.taskId)}`,
    {
      data: { queue: data.queue },
    },
  );
}
