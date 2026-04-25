/**
 * @zh_CN 后台源码仓库地址，私有化部署时可替换为企业内部仓库。
 */
export const VBEN_GITHUB_URL = '/';

/**
 * @zh_CN 后台接口文档地址，默认指向 admin 暴露的 Swagger 文档。
 */
export const VBEN_DOC_URL = '/api/docs#/';

/**
 * @zh_CN 后台默认 Logo 资源地址。
 */
export const VBEN_LOGO_URL = '/favicon.svg';

/**
 * @zh_CN 后台默认首页地址。
 */
export const VBEN_PREVIEW_URL = '/ops/task-console';

// VBEN_ANTDV_NEXT_PREVIEW_URL 沿用上游导出名，生产项目统一指向当前后台首页。
export const VBEN_ANTDV_NEXT_PREVIEW_URL = VBEN_PREVIEW_URL;

// VBEN_ELE_PREVIEW_URL 沿用上游导出名，已不再承载 Element Plus 示例站点。
export const VBEN_ELE_PREVIEW_URL = VBEN_PREVIEW_URL;

// VBEN_NAIVE_PREVIEW_URL 沿用上游导出名，已不再承载 Naive UI 示例站点。
export const VBEN_NAIVE_PREVIEW_URL = VBEN_PREVIEW_URL;

// VBEN_ANT_PREVIEW_URL 沿用上游导出名，指向当前 Ant Design Vue 后台。
export const VBEN_ANT_PREVIEW_URL = VBEN_PREVIEW_URL;

// VBEN_TD_PREVIEW_URL 沿用上游导出名，已不再承载 TDesign 示例站点。
export const VBEN_TD_PREVIEW_URL = VBEN_PREVIEW_URL;
