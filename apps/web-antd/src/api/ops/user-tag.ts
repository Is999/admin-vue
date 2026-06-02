import type { TaskApi } from './task';

import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// UserTagApi 定义用户标签工作流相关接口的请求与响应结构。
export namespace UserTagApi {
  /** 触发用户标签工作流请求 */
  export interface TriggerWorkflowReq {
    /** 运行模式：full/delta/targeted/recalculate */
    mode?: 'delta' | 'full' | 'recalculate' | 'targeted';
    /** 指定标签类型 */
    tagTypes?: number[];
    /** 指定用户 UID */
    uids?: number[];
    /** 指定任务队列 */
    queue?: string;
    /** 分片数 */
    shardTotal?: number;
    /** 游标批次大小 */
    batchSize?: number;
    /** 节点内部 worker 数 */
    workerCount?: number;
    /** 只计算不落库 */
    dryRun?: boolean;
    /** 去重键 */
    uniqueKey?: string;
    /** 去重 TTL，单位秒 */
    uniqueTTLSeconds?: number;
    /** 工作流节点重试次数 */
    retry?: number;
    /** 触发任务超时时间，单位秒 */
    timeoutSeconds?: number;
  }

  /** 指定标签重算请求 */
  export interface RecalculateReq {
    /** 指定重算的标签类型 */
    tag_types: number[];
    /** 指定任务队列 */
    queue?: string;
    /** 分片数 */
    shard_total?: number;
    /** 游标批次大小 */
    batch_size?: number;
    /** 节点内部 worker 数 */
    worker_count?: number;
    /** 只计算不落库 */
    dry_run?: boolean;
    /** 去重 TTL，单位秒 */
    unique_ttl_seconds?: number;
    /** 工作流节点重试次数 */
    retry?: number;
    /** 触发任务超时时间，单位秒 */
    timeout_seconds?: number;
  }

  /** 释放工作流互斥锁请求 */
  export interface ReleaseWorkflowLeaseReq extends CommonApi.TwoStepReq {
    /** 工作流实例 ID */
    workflowId: string;
    /** 运行模式：full/delta/targeted/recalculate */
    mode?: 'delta' | 'full' | 'recalculate' | 'targeted';
    /** 人工释放原因 */
    reason: string;
  }

  /** 释放工作流互斥锁回执 */
  export interface ReleaseWorkflowLeaseResp {
    /** 当前 Redis owner */
    currentOwner?: string;
    /** Redis 租约 key */
    leaseKey: string;
    /** 工作流运行模式 */
    mode: string;
    /** 请求匹配的 owner */
    owner: string;
    /** 人工释放原因 */
    reason: string;
    /** 是否已释放 */
    released: boolean;
    /** 释放时间 */
    releasedAt: string;
    /** 释放前剩余 TTL 秒数 */
    ttlSeconds: number;
    /** 工作流实例 ID */
    workflowId: string;
  }

  /** 指定标签重算回执 */
  export interface RecalculateResp {
    /** 提示信息 */
    message: string;
    /** 本次重算标签数量 */
    tag_count: number;
    /** 触发任务 ID */
    taskId: string;
    /** 工作流实例 ID */
    workflowId: string;
    /** 工作流名称 */
    workflowName: string;
    /** 投递队列 */
    queue: string;
  }
}

// USER_TAG_WORKFLOW_PATH 定义用户标签工作流触发接口路径。
const USER_TAG_WORKFLOW_PATH = '/user-tags/workflows';

// USER_TAG_RECALCULATE_PATH 定义指定标签重算接口路径。
const USER_TAG_RECALCULATE_PATH = '/user-tags/recalculations';

// USER_TAG_LEASE_RELEASE_PATH 定义用户标签工作流互斥锁释放接口路径。
const USER_TAG_LEASE_RELEASE_PATH = '/user-tags/workflow-lease/release';

// triggerUserTagWorkflow 触发用户标签计算工作流。
export async function triggerUserTagWorkflow(
  data: UserTagApi.TriggerWorkflowReq,
) {
  return requestClient.post<TaskApi.WorkflowTriggerResp>(
    USER_TAG_WORKFLOW_PATH,
    data,
  );
}

// recalculateUserTagByTypes 调用指定标签重算接口。
export async function recalculateUserTagByTypes(
  data: UserTagApi.RecalculateReq,
) {
  return requestClient.post<UserTagApi.RecalculateResp>(
    USER_TAG_RECALCULATE_PATH,
    data,
  );
}

// releaseUserTagWorkflowLease 释放用户标签工作流互斥锁。
export async function releaseUserTagWorkflowLease(
  data: UserTagApi.ReleaseWorkflowLeaseReq,
) {
  return requestClient.post<UserTagApi.ReleaseWorkflowLeaseResp>(
    USER_TAG_LEASE_RELEASE_PATH,
    data,
  );
}
