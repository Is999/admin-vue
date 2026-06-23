import type { TaskApi } from './task-types';

import { requestClient } from '#/api/request';

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

// fetchConfigReloadItems 查询当前运行态配置项，后端已完成敏感值脱敏。
export async function fetchConfigReloadItems(
  params: TaskApi.TaskConfigItemQueryReq,
) {
  return requestClient.get<TaskApi.TaskConfigItemQueryResp>(
    `${TASK_PREFIX}/config-reload/items`,
    {
      params,
    },
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
