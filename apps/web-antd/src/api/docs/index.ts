import { requestClient } from '#/api/request';

// DocsApi 定义接口文档站相关接口结构。
export namespace DocsApi {
  // SessionResp 表示文档访问会话创建结果。
  export interface SessionResp {
    expiresIn: number; // cookie 最长有效秒数
  }
}

// createDocsSession 创建文档站访问会话，后端会写入仅限 /api/docs 的 HttpOnly cookie。
export function createDocsSession() {
  return requestClient.post<DocsApi.SessionResp>('/docs/session', {}, {
    skipGlobalErrorMessage: true,
  } as Record<string, any>);
}
