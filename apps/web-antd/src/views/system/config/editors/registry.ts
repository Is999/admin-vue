// ConfigHiddenEditor 描述需要从字典管理拆出的隐藏路由编辑页。
export interface ConfigHiddenEditor {
  path: string; // path 表示隐藏编辑页路由路径。
  routeName: string; // routeName 表示隐藏编辑页路由名称。
  titleKey: string; // titleKey 表示编辑页标题的 i18n key。
}

export const ADMIN_IP_WHITELIST_UUID = 'adminIpWhitelist';
export const ADMIN_IP_WHITELIST_PATH = '/system/config/admin-ip-whitelist';
export const ADMIN_IP_WHITELIST_ROUTE = 'SystemConfigAdminIpWhitelist';

export const ADMIN_DISABLE_MFA_CHECK_SCENARIO_UUID =
  'adminDisableMFACheckScenario';
export const ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH =
  '/system/config/admin-disable-mfa-check-scenario';
export const ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE =
  'SystemConfigAdminDisableMFACheckScenario';

// CONFIG_HIDDEN_EDITORS 只保存轻量路由元数据，避免字典列表加载复杂编辑页代码。
export const CONFIG_HIDDEN_EDITORS: Record<string, ConfigHiddenEditor> = {
  [ADMIN_IP_WHITELIST_UUID]: {
    path: ADMIN_IP_WHITELIST_PATH,
    routeName: ADMIN_IP_WHITELIST_ROUTE,
    titleKey: 'business.message.adminIpWhitelistEditorTitle',
  },
  [ADMIN_DISABLE_MFA_CHECK_SCENARIO_UUID]: {
    path: ADMIN_DISABLE_MFA_CHECK_SCENARIO_PATH,
    routeName: ADMIN_DISABLE_MFA_CHECK_SCENARIO_ROUTE,
    titleKey: 'business.message.mfaScenarioEditorTitle',
  },
};

// resolveConfigHiddenEditor 按字典标识查找隐藏编辑页配置。
export function resolveConfigHiddenEditor(uuid?: string) {
  return CONFIG_HIDDEN_EDITORS[String(uuid || '').trim()];
}

// hasConfigHiddenEditor 判断当前字典项是否存在隐藏编辑页。
export function hasConfigHiddenEditor(row?: { uuid?: string }) {
  return Boolean(resolveConfigHiddenEditor(row?.uuid));
}
