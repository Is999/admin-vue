import type { CommonApi } from '#/api/telegram/common';

import { requestClient } from '#/api/request';

// AI提示词模板相关API封装，严格对齐 ai_prompt_template_api_examples.md
export namespace AiPromptTemplateApi {
  /** 模板详情 */
  export interface Item {
    /** 模板ID */
    id: number;
    /** 场景 */
    scene: string;
    /** 模板名称 */
    templateName: string;
    /** 提示词内容 */
    promptContent: string;
    /** 状态 1启用 0禁用 */
    status: 0 | 1;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
  }

  /** 列表查询参数 */
  export interface ListParams {
    /** 场景 */
    scene?: string;
    /** 状态 1启用 0禁用 */
    status?: number;
    /** 页码，默认1 */
    page?: number;
    /** 每页数量，默认10 */
    pageSize?: number;
  }

  /** 新增/编辑参数 */
  export interface FormParams {
    /** 场景 */
    scene: string;
    /** 模板名称 */
    templateName: string;
    /** 提示词内容 */
    promptContent: string;
    /** 状态 1启用 0禁用 */
    status?: number;
  }
}

const PREFIX = '/ai_prompt_template';

/** 1. 新增AI提示词模板 */
export async function createAiPromptTemplate(
  data: AiPromptTemplateApi.FormParams,
) {
  return requestClient.post(PREFIX, data);
}

/** 2. 更新AI提示词模板 */
export async function updateAiPromptTemplate(
  id: number,
  data: AiPromptTemplateApi.FormParams,
) {
  return requestClient.patch(`${PREFIX}/${id}`, data);
}

/** 3. 删除AI提示词模板 */
export async function deleteAiPromptTemplate(id: number) {
  return requestClient.delete(`${PREFIX}/${id}`);
}

/** 4. 修改AI提示词模板状态 */
export async function updateAiPromptTemplateStatus(id: number, status: number) {
  return requestClient.patch(`${PREFIX}/status/${id}`, { status });
}

/** 5. 获取AI提示词模板详情 */
export async function fetchAiPromptTemplateDetail(id: number) {
  return requestClient.get<AiPromptTemplateApi.Item>(`${PREFIX}/${id}`);
}

/** 6. 查询AI提示词模板列表 */
export async function fetchAiPromptTemplateList(
  params: AiPromptTemplateApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<AiPromptTemplateApi.Item>>(
    PREFIX,
    { params },
  );
}

/** 7. AI提示词模板下拉框 */
export async function fetchAiPromptTemplateDropdown() {
  return requestClient.get<CommonApi.DropdownItem[]>(`${PREFIX}/dropdown`);
}
