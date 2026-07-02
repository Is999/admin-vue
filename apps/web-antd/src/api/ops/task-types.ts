// TaskApi 定义运维任务系统相关接口的请求与响应结构。
export namespace TaskApi {
  /** 手动触发工作流请求 */
  export interface TriggerWorkflowReq {
    /** 工作流名称 */
    name: string;
    /** 业务目标列表 */
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
    /** 任务 ID 关键字，支持完整或片段匹配 */
    taskId?: string;
    /** 工作流实例 ID */
    workflowId?: string;
    /** 任务名称关键字，支持按 task_periodic.name 或展示名筛选 */
    taskName?: string;
    /** 任务时间段开始时间 */
    startTime?: string;
    /** 任务时间段结束时间 */
    endTime?: string;
    /** 页码 */
    page?: number;
    /** 每页条数 */
    pageSize?: number;
  }

  /** 查询任务总览请求 */
  export interface ListTaskItemsOverviewReq {
    /** 队列名称；为空时由后端按可见队列聚合 */
    queue?: string;
    /** 任务状态；为空时由后端按推荐顺序探测 */
    state?: '' | ListTaskItemsReq['state'];
    /** 聚合组名称，仅 aggregating 使用 */
    group?: string;
    /** 任务 ID 关键字，支持完整或片段匹配 */
    taskId?: string;
    /** 工作流实例 ID */
    workflowId?: string;
    /** 任务名称关键字，支持按 task_periodic.name 或展示名筛选 */
    taskName?: string;
    /** 任务时间段开始时间 */
    startTime?: string;
    /** 任务时间段结束时间 */
    endTime?: string;
    /** 页码 */
    page?: number;
    /** 每页条数 */
    pageSize?: number;
    /** 状态为空时是否纳入 aggregating 探测 */
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

  /** 单个任务处理量明细 */
  export interface TaskExecutionTraceDetail {
    /** 动作类型 */
    action: string;
    /** 业务对象或阶段名称 */
    name: string;
    /** 累计处理数量 */
    count: number;
    /** 记录次数 */
    times: number;
    /** 累计耗时，单位毫秒 */
    elapsedMs?: number;
  }

  /** 任务执行处理量追踪摘要 */
  export interface TaskExecutionTrace {
    /** 追踪器名称 */
    name?: string;
    /** 追踪开始时间 */
    startedAt?: string;
    /** 快照生成时间 */
    finishedAt?: string;
    /** 追踪总耗时，单位毫秒 */
    durationMs?: number;
    /** 所有动作累计数量 */
    totalCount?: number;
    /** 读取数量 */
    readCount?: number;
    /** 新增数量 */
    insertCount?: number;
    /** 更新数量 */
    updateCount?: number;
    /** 删除数量 */
    deleteCount?: number;
    /** 新增或更新数量 */
    upsertCount?: number;
    /** 跳过数量 */
    skipCount?: number;
    /** 隔离错误数量 */
    errorCount?: number;
    /** 按动作和对象聚合后的明细 */
    details?: TaskExecutionTraceDetail[];
  }

  /** 工作流状态，和后端 TaskWorkflowStatusResp.status 保持一致。 */
  export type WorkflowStatus = 'failed' | 'pending' | 'running' | 'success';

  /** 工作流节点状态，和后端 TaskWorkflowNodeItem.status 保持一致。 */
  export type WorkflowNodeStatus = 'skipped' | WorkflowStatus;

  /** 执行进度摘要 */
  export interface TaskExecutionProgress {
    /** 进度单位 */
    unit?: string;
    /** 当前状态 */
    status?: WorkflowNodeStatus;
    /** 计划执行总量 */
    total?: number;
    /** 已进入终态数量 */
    finished?: number;
    /** 成功数量 */
    succeeded?: number;
    /** 失败数量 */
    failed?: number;
    /** 跳过数量 */
    skipped?: number;
    /** 运行中数量 */
    running?: number;
    /** 等待执行数量 */
    pending?: number;
    /** 未进入终态数量 */
    remaining?: number;
    /** 终态完成比例，0~100 */
    percent?: number;
    /** 成功比例，0~100 */
    successPercent?: number;
    /** 是否缺少总量，无法计算百分比 */
    indeterminate?: boolean;
  }

  /** 工作流节点分片处理量明细 */
  export interface WorkflowShardTraceItem {
    /** 分片下标 */
    shardIndex: number;
    /** 分片总数 */
    shardTotal: number;
    /** 分片状态 */
    status?: WorkflowNodeStatus;
    /** 分片执行进度 */
    progress?: TaskExecutionProgress;
    /** 分片处理量摘要 */
    executionTrace?: TaskExecutionTrace;
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
    /** 本次任务处理量追踪摘要 */
    executionTrace?: TaskExecutionTrace;
  }

  /** 任务列表响应 */
  export interface TaskListResp {
    /** 查询队列 */
    queue: string;
    /** 查询状态 */
    state: string;
    /** 聚合分组 */
    group?: string;
    /** 任务 ID 筛选条件 */
    taskId?: string;
    /** 工作流实例 ID 筛选条件 */
    workflowId?: string;
    /** 任务名称关键字筛选条件 */
    taskName?: string;
    /** 任务时间段开始时间 */
    startTime?: string;
    /** 任务时间段结束时间 */
    endTime?: string;
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
    /** 任务 ID 筛选条件 */
    taskId?: string;
    /** 工作流实例 ID 筛选条件 */
    workflowId?: string;
    /** 任务名称关键字筛选条件 */
    taskName?: string;
    /** 任务时间段开始时间 */
    startTime?: string;
    /** 任务时间段结束时间 */
    endTime?: string;
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
    status: WorkflowNodeStatus;
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
    /** 节点实例执行进度 */
    progress?: TaskExecutionProgress;
    /** 节点处理量聚合摘要 */
    executionTrace?: TaskExecutionTrace;
    /** 节点分片处理量明细 */
    shardTraces?: WorkflowShardTraceItem[];
  }

  /** 工作流整体状态 */
  export interface WorkflowStatusResp {
    /** 工作流实例 ID */
    workflowId: string;
    /** 工作流名称 */
    workflowName: string;
    /** 工作流状态 */
    status: WorkflowStatus;
    /** 触发来源 */
    source: string;
    /** 默认执行队列 */
    queue: string;
    /** 业务目标列表 */
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
    /** 工作流执行进度 */
    progress?: TaskExecutionProgress;
    /** 工作流处理量聚合摘要 */
    executionTrace?: TaskExecutionTrace;
    /** 节点明细 */
    nodes: WorkflowNodeItem[];
  }

  /** 已注册任务类型 */
  export interface TaskTypeRegistryItem {
    /** 任务类型标识 */
    taskType: string;
    /** 按请求语言返回的说明 */
    description?: string;
    /** 按请求语言返回的使用提示 */
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
    /** 按请求语言返回的工作流说明 */
    description: string;
    /** 默认执行队列 */
    defaultQueue: string;
    /** 节点数量 */
    nodeCount: number;
    /** 按请求语言返回的使用提示 */
    usageHint?: string;
    /** 业务目标填写示例 */
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

  /** 查询运行态配置项请求 */
  export interface TaskConfigItemQueryReq {
    /** 配置路径或已脱敏展示值关键字 */
    keyword?: string;
    /** 是否只查看敏感配置项 */
    sensitiveOnly?: boolean;
    /** 页码 */
    page?: number;
    /** 每页条数 */
    pageSize?: number;
  }

  /** 已脱敏运行态配置项 */
  export interface TaskConfigItem {
    /** 扁平化配置路径 */
    path: string;
    /** 展示值，敏感项已脱敏 */
    value: string;
    /** 值类型 */
    valueType: string;
    /** 是否按敏感配置处理 */
    sensitive: boolean;
  }

  /** 顶层配置分组统计 */
  export interface TaskConfigSectionStat {
    /** 顶层配置名称 */
    name: string;
    /** 配置项数量 */
    total: number;
    /** 敏感配置项数量 */
    sensitiveTotal: number;
  }

  /** 运行态配置快照来源 */
  export interface TaskConfigSourceMeta {
    /** 快照来源 */
    source: string;
    /** 当前监听的配置文件 */
    configFile: string;
    /** 当前声明的运行期外部配置文件 */
    runtimeFile: string;
    /** 当前生效配置版本 */
    configVersion: string;
    /** 最近一次热加载状态 */
    lastStatus: string;
    /** 最近一次触发来源 */
    lastTriggerSource: string;
    /** 最近一次重载时间 */
    lastReloadAt?: string;
    /** 最近一次成功加载时间 */
    lastSuccessAt?: string;
    /** 是否仍需重启 */
    restartRequired: boolean;
  }

  /** 运行态配置项查询响应 */
  export interface TaskConfigItemQueryResp {
    /** 当前关键字 */
    keyword?: string;
    /** 是否只查看敏感配置项 */
    sensitiveOnly: boolean;
    /** 当前页码 */
    page: number;
    /** 当前页大小 */
    pageSize: number;
    /** 命中总数 */
    total: number;
    /** 当前快照配置项总数 */
    totalItems: number;
    /** 当前快照敏感配置项总数 */
    sensitiveTotal: number;
    /** 顶层配置分组统计 */
    sections: TaskConfigSectionStat[];
    /** 当前快照来源 */
    source: TaskConfigSourceMeta;
    /** 完整脱敏 YAML 快照 */
    snapshotYaml: string;
    /** 按 runtime.yaml 顶层结构生成的脱敏 YAML 视图 */
    runtimeYaml: string;
    /** 当前页配置项 */
    items: TaskConfigItem[];
  }
}
