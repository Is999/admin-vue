import type { Router } from 'vue-router';

// CacheNavigationOptions 定义跳转缓存管理页时携带的定位参数。
export interface CacheNavigationOptions {
  autoViewKey?: string;
  source: string;
  templateKeys?: Array<null | string | undefined>;
  targets: Array<null | string | undefined>;
}

// normalizeCacheTargets 过滤空值并去重，避免把无效 key 带入缓存管理页。
function normalizeCacheTargets(targets: Array<null | string | undefined>) {
  return [
    ...new Set(
      targets.map((item) => String(item || '').trim()).filter(Boolean),
    ),
  ];
}

// openSystemCachePage 跳转到缓存管理页，并把目标缓存 key 作为查询参数带过去。
export async function openSystemCachePage(
  router: Router,
  options: CacheNavigationOptions,
) {
  const targets = normalizeCacheTargets(options.targets);
  const templateKeys = normalizeCacheTargets(options.templateKeys || []);
  if (targets.length === 0) {
    return;
  }
  await router.push({
    name: 'SystemCache',
    query: {
      autoViewKey: options.autoViewKey || '',
      source: options.source,
      templateKeys,
      targets,
    },
  });
}

// buildAdminCacheTargets 返回管理员记录常用的内置缓存实例 key。
export function buildAdminCacheTargets(adminID?: number) {
  const currentAdminID = Number(adminID || 0);
  if (!Number.isFinite(currentAdminID) || currentAdminID <= 0) {
    return [];
  }
  return [
    `admin_profile:${currentAdminID}`,
    `admin_roles_detail:${currentAdminID}`,
    `admin_role_ids:${currentAdminID}`,
    `admin_permission_ids:${currentAdminID}`,
    `admin_permission_uuids:${currentAdminID}`,
    `admin:info:${currentAdminID}`,
  ];
}

// buildRoleCacheTargets 返回角色记录对应的模板缓存实例 key。
export function buildRoleCacheTargets(roleID?: number) {
  const currentRoleID = Number(roleID || 0);
  if (!Number.isFinite(currentRoleID) || currentRoleID <= 0) {
    return [];
  }
  return [`role_permission:${currentRoleID}`];
}

// buildRoleCacheTemplateKeys 返回角色管理页关联的模板缓存 key 定义。
export function buildRoleCacheTemplateKeys() {
  return ['role_permission:{roleID}'];
}

// buildConfigCacheTargets 返回字典配置对应的模板缓存实例 key。
export function buildConfigCacheTargets(uuid?: string) {
  const currentUUID = String(uuid || '').trim();
  if (!currentUUID) {
    return [];
  }
  return [`config_uuid:${currentUUID}`];
}

// buildSecretKeyCacheTargets 返回秘钥配置对应的模板缓存实例 key。
export function buildSecretKeyCacheTargets(
  uuid?: string,
  options?: {
    grayVersion?: string;
    stableVersion?: string;
    versionList?: string[];
  },
) {
  const currentUUID = String(uuid || '').trim();
  if (!currentUUID) {
    return [];
  }
  const versions = [
    ...new Set(
      [
        String(options?.stableVersion || '').trim(),
        String(options?.grayVersion || '').trim(),
        ...(options?.versionList || []).map((item) =>
          String(item || '').trim(),
        ),
      ].filter(Boolean),
    ),
  ];
  return [
    `secret_key_route:${currentUUID}`,
    ...versions.flatMap((version) => [
      `secret_key_aes:${currentUUID}:${version}`,
      `secret_key_rsa:${currentUUID}:${version}`,
    ]),
  ];
}

// buildSecretKeyCacheTemplateKeys 返回秘钥管理页关联的模板缓存 key 定义。
export function buildSecretKeyCacheTemplateKeys() {
  return [
    'secret_key_route:{uuid}',
    'secret_key_aes:{uuid}:{keyVersion}',
    'secret_key_rsa:{uuid}:{keyVersion}',
  ];
}

// buildPermissionCacheTargets 返回权限管理页相关的缓存 key 与模板实例搜索条件。
export function buildPermissionCacheTargets() {
  return [
    'permission_tree',
    'permission_uuid',
    'permission_module',
    'route_permission_ids:*',
  ];
}

// buildPermissionCacheTemplateKeys 返回权限管理页关联的模板缓存 key 定义。
export function buildPermissionCacheTemplateKeys() {
  return ['route_permission_ids:{routeAlias}'];
}
