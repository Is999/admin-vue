import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// RuntimeConfigApi 定义运行期大列表配置管理接口契约。
export namespace RuntimeConfigApi {
  /** MFA 二次确认票据字段 */
  export interface TwoStepReq {
    /** MFA 二次校验票据 key */
    twoStepKey?: string;
    /** MFA 二次校验票据 value */
    twoStepValue?: string;
  }

  /** 当前 active 版本状态 */
  export interface StateItem {
    /** 当前发布 ID */
    activeReleaseId: number;
    /** 当前版本号 */
    activeVersion: number;
    /** 当前快照 SHA256 */
    activeChecksum: string;
    /** 最近发布时间 */
    publishedAt: string;
  }

  /** 草稿数量 */
  export interface DraftCount {
    /** 周期任务草稿数量 */
    periodicTasks: number;
    /** 归档任务草稿数量 */
    archiveJobs: number;
  }

  /** 发布快照展示结构 */
  export interface Snapshot {
    /** 归档任务配置 */
    archiveJobs: ArchiveJobItem[];
    /** 周期任务配置 */
    taskPeriodic: PeriodicTaskItem[];
  }

  /** 概览响应 */
  export interface OverviewResp {
    /** 配置来源：file/database */
    source: 'database' | 'file' | string;
    /** 当前运行环境 */
    env: string;
    /** DB 模式轻量轮询间隔秒数 */
    pollIntervalSeconds: number;
    /** 当前 active 版本状态 */
    state: StateItem;
    /** 草稿数量 */
    draft: DraftCount;
    /** 当前运行态快照 */
    currentSnapshot: Snapshot;
  }

  /** 周期任务查询参数 */
  export interface PeriodicQueryReq {
    /** 当前页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 工作流过滤 */
    workflow?: string;
    /** 启用状态过滤 */
    enabled?: boolean;
    /** 名称或队列关键字 */
    keyword?: string;
  }

  /** 周期任务配置项 */
  export interface PeriodicTaskItem {
    /** 草稿 ID */
    id?: number;
    /** 是否启用 */
    enabled: boolean;
    /** 周期任务名称 */
    name: string;
    /** cron 表达式 */
    cron?: string;
    /** 固定间隔秒数 */
    everySeconds?: number;
    /** 工作流名称 */
    workflow: string;
    /** 投递队列 */
    queue?: string;
    /** 执行目标列表 */
    targets?: string[];
    /** 分片总数 */
    shardTotal?: number;
    /** 灰度比例 */
    grayPercent?: number;
    /** 覆盖重试次数 */
    retry?: number;
    /** 任务超时秒数 */
    timeoutSeconds?: number;
    /** 截止时间 */
    deadline?: string;
    /** 去重键 */
    uniqueKey?: string;
    /** 去重 TTL 秒数 */
    uniqueTtlSeconds?: number;
    /** 排序值 */
    sortOrder?: number;
    /** 备注 */
    remark?: string;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
  }

  /** 归档任务查询参数 */
  export interface ArchiveQueryReq {
    /** 当前页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 启用状态过滤 */
    enabled?: boolean;
    /** 数据库过滤 */
    database?: string;
    /** 名称或表名关键字 */
    keyword?: string;
  }

  /** 归档任务配置项 */
  export interface ArchiveJobItem {
    /** 草稿 ID */
    id?: number;
    /** 是否启用 */
    enabled: boolean;
    /** 归档任务名称 */
    name: string;
    /** 热表数据库 */
    database: string;
    /** 热表名 */
    tableName: string;
    /** 归档时间列 */
    timeColumn?: string;
    /** 时间列类型 */
    timeColumnType?: string;
    /** 字符串时间格式 */
    timeColumnFormat?: string;
    /** Unix 时间单位 */
    timeColumnUnixUnit?: string;
    /** 主键列 */
    primaryKey?: string;
    /** 归档过滤条件 */
    archiveCondition?: string;
    /** 清理过滤条件 */
    deleteCondition?: string;
    /** 历史表拆分粒度 */
    splitUnit?: string;
    /** 自定义分段天数 */
    customDays?: number;
    /** 热表保留天数 */
    hotKeepDays?: number;
    /** 归档延迟天数 */
    archiveDelayDays?: number;
    /** 归档窗口秒数 */
    archiveWindowSeconds?: number;
    /** 归档窗口模式 */
    archiveWindowMode?: string;
    /** 单次最大归档窗口数 */
    archiveMaxWindowsPerRun?: number;
    /** auto 最大追赶窗口数 */
    archiveAutoMaxWindows?: number;
    /** auto 轻量行数阈值 */
    archiveAutoLightRows?: number;
    /** auto 轻量耗时阈值毫秒 */
    archiveAutoLightMs?: number;
    /** 是否禁用删除 */
    deleteDisabled?: boolean;
    /** 删除延迟天数 */
    deleteDelayDays?: number;
    /** 删除窗口秒数 */
    deleteWindowSeconds?: number;
    /** 单次最大删除窗口数 */
    deleteMaxWindowsPerRun?: number;
    /** 归档批次大小 */
    batchSize?: number;
    /** 删除批次大小 */
    deleteBatchSize?: number;
    /** 最大历史表数量 */
    maxHistoryTables?: number;
    /** 历史表前缀 */
    historyTablePrefix?: string;
    /** 历史表命名规则 */
    historyTableNameRule?: string;
    /** 首次归档起点 */
    startAt?: string;
    /** 查询是否强制走主库 */
    queryWriteDb?: boolean;
    /** 排序值 */
    sortOrder?: number;
    /** 备注 */
    remark?: string;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
  }

  /** 预检结果 */
  export interface ValidateResp {
    /** 是否通过预检 */
    valid: boolean;
    /** 预检信息列表 */
    messages: string[];
    /** 草稿快照 SHA256 */
    checksum: string;
  }

  /** 发布、回滚和导入回执 */
  export interface PublishResp {
    /** 新发布 ID */
    releaseId: number;
    /** 新版本号 */
    versionNo: number;
    /** 快照 SHA256 */
    checksum: string;
    /** 是否需要重启完全生效 */
    restartRequired: boolean;
    /** 重启原因 */
    restartReason: string;
  }

  /** 发布请求 */
  export interface PublishReq extends TwoStepReq {
    /** 发布备注 */
    remark?: string;
  }

  /** 回滚请求 */
  export interface RollbackReq extends TwoStepReq {
    /** 目标发布 ID */
    releaseId: number;
    /** 回滚备注 */
    remark?: string;
  }

  /** 导入当前配置请求 */
  export interface ImportCurrentReq extends TwoStepReq {
    /** 导入备注 */
    remark?: string;
  }

  /** 发布历史查询参数 */
  export interface ReleaseQueryReq {
    /** 当前页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
  }

  /** 发布历史列表项 */
  export interface ReleaseItem {
    /** 发布 ID */
    id: number;
    /** 发布版本号 */
    versionNo: number;
    /** 快照 SHA256 */
    checksum: string;
    /** 来源发布 ID */
    baseReleaseId: number;
    /** 是否需要重启 */
    restartRequired: boolean;
    /** 重启原因 */
    restartReason: string;
    /** 发布备注 */
    remark: string;
    /** 发布管理员 ID */
    publishedByAdminId: number;
    /** 发布管理员账号 */
    publishedByName: string;
    /** 发布时间 */
    publishedAt: string;
  }

  /** 发布快照详情 */
  export interface ReleaseDetailResp extends ReleaseItem {
    /** 发布快照 JSON */
    snapshotJson: string;
    /** 发布快照 YAML */
    snapshotYaml: string;
  }
}

const RUNTIME_CONFIG_PREFIX = '/runtime-config';

// fetchRuntimeConfigOverview 查询运行配置概览。
export async function fetchRuntimeConfigOverview() {
  return requestClient.get<RuntimeConfigApi.OverviewResp>(
    `${RUNTIME_CONFIG_PREFIX}/overview`,
  );
}

// fetchRuntimePeriodicTasks 分页查询周期任务草稿。
export async function fetchRuntimePeriodicTasks(
  params: RuntimeConfigApi.PeriodicQueryReq,
) {
  return requestClient.get<
    CommonApi.ListResult<RuntimeConfigApi.PeriodicTaskItem>
  >(`${RUNTIME_CONFIG_PREFIX}/periodic`, { params });
}

// saveRuntimePeriodicTask 保存周期任务草稿。
export async function saveRuntimePeriodicTask(
  data: RuntimeConfigApi.PeriodicTaskItem,
) {
  return requestClient.post(`${RUNTIME_CONFIG_PREFIX}/periodic`, data);
}

// deleteRuntimePeriodicTask 删除周期任务草稿。
export async function deleteRuntimePeriodicTask(id: number) {
  return requestClient.delete(`${RUNTIME_CONFIG_PREFIX}/periodic/${id}`);
}

// fetchRuntimeArchiveJobs 分页查询归档任务草稿。
export async function fetchRuntimeArchiveJobs(
  params: RuntimeConfigApi.ArchiveQueryReq,
) {
  return requestClient.get<
    CommonApi.ListResult<RuntimeConfigApi.ArchiveJobItem>
  >(`${RUNTIME_CONFIG_PREFIX}/archive-jobs`, { params });
}

// saveRuntimeArchiveJob 保存归档任务草稿。
export async function saveRuntimeArchiveJob(
  data: RuntimeConfigApi.ArchiveJobItem,
) {
  return requestClient.post(`${RUNTIME_CONFIG_PREFIX}/archive-jobs`, data);
}

// deleteRuntimeArchiveJob 删除归档任务草稿。
export async function deleteRuntimeArchiveJob(id: number) {
  return requestClient.delete(`${RUNTIME_CONFIG_PREFIX}/archive-jobs/${id}`);
}

// validateRuntimeConfigDraft 预检运行配置草稿。
export async function validateRuntimeConfigDraft() {
  return requestClient.post<RuntimeConfigApi.ValidateResp>(
    `${RUNTIME_CONFIG_PREFIX}/validate`,
  );
}

// publishRuntimeConfig 发布运行配置草稿。
export async function publishRuntimeConfig(data: RuntimeConfigApi.PublishReq) {
  return requestClient.post<RuntimeConfigApi.PublishResp>(
    `${RUNTIME_CONFIG_PREFIX}/publish`,
    data,
  );
}

// rollbackRuntimeConfig 回滚到指定发布快照。
export async function rollbackRuntimeConfig(
  data: RuntimeConfigApi.RollbackReq,
) {
  return requestClient.post<RuntimeConfigApi.PublishResp>(
    `${RUNTIME_CONFIG_PREFIX}/rollback`,
    data,
  );
}

// importCurrentRuntimeConfig 导入当前文件运行配置并发布。
export async function importCurrentRuntimeConfig(
  data: RuntimeConfigApi.ImportCurrentReq,
) {
  return requestClient.post<RuntimeConfigApi.PublishResp>(
    `${RUNTIME_CONFIG_PREFIX}/import-current`,
    data,
  );
}

// fetchRuntimeConfigReleases 分页查询发布历史。
export async function fetchRuntimeConfigReleases(
  params: RuntimeConfigApi.ReleaseQueryReq,
) {
  return requestClient.get<CommonApi.ListResult<RuntimeConfigApi.ReleaseItem>>(
    `${RUNTIME_CONFIG_PREFIX}/releases`,
    { params },
  );
}

// fetchRuntimeConfigRelease 查询发布快照详情。
export async function fetchRuntimeConfigRelease(releaseId: number) {
  return requestClient.get<RuntimeConfigApi.ReleaseDetailResp>(
    `${RUNTIME_CONFIG_PREFIX}/releases/${releaseId}`,
  );
}
