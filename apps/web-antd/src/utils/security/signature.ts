import { $t } from '#/locales';
import { createTraceId } from '#/utils/request/trace';

import {
  aesCbcDecrypt,
  aesCbcEncrypt,
  aesCbcSign,
  bytesToBase64,
  md5Hex,
  rsaPkcs1Sign,
  rsaPkcs1Verify,
} from './crypto';

// SignatureType 表示后端支持的签名方式。
type SignatureType = 'A' | 'M' | 'R';

// CryptoType 表示后端支持的加密方式。
type CryptoType = 'A' | 'R';

// RouteSecurityPolicy 与后端 RouteSecurityPolicy 保持字段语义一致。
interface RouteSecurityPolicy {
  requestSign?: string[];
  requestCipher?: string[];
  responseCipher?: string[];
  responseSign?: string[];
}

// RouteSecurityRule 描述前端路径和后端路由别名的映射。
interface RouteSecurityRule {
  alias: string;
  method: string;
  pattern: RegExp;
}

// SIGN_FIELD_ALL 表示安全调试工具里当前对象的全部首层字段都参与签名。
const SIGN_FIELD_ALL = '*';
const SIGNATURE_TIMESTAMP_HEADER = 'X-Timestamp';
// CIPHER_JSON_PREFIX 表示字段值需要按 JSON 文本整体加解密。
const CIPHER_JSON_PREFIX = 'json:';
// MAX_SECURITY_FIELD_COUNT 表示字段级安全处理的最大字段数。
const MAX_SECURITY_FIELD_COUNT = 24;
// MAX_SECURITY_FIELD_BYTES 表示普通签名或加密字段的最大字节数。
const MAX_SECURITY_FIELD_BYTES = 4096;
// MAX_SECURITY_JSON_FIELD_BYTES 表示 json: 小对象字段的最大字节数。
const MAX_SECURITY_JSON_FIELD_BYTES = 8192;
// MAX_SECURITY_REQUEST_BODY_BYTES 表示安全链路处理请求体的最大字节数。
const MAX_SECURITY_REQUEST_BODY_BYTES = 65_536;

// ADMIN_ROUTE_SECURITY_POLICIES 与 admin/internal/security.RouteSecurityPolicies 保持一致。
// 每个 key 都对应一个后端路由别名，用于声明该接口的请求签名、请求加密、响应加密与响应回签策略。
const ADMIN_ROUTE_SECURITY_POLICIES: Record<string, RouteSecurityPolicy> = {
  // admin.add 表示新增管理员接口。
  'admin.add': {
    requestCipher: ['password', 'mfaSecureKey', 'twoStepKey', 'twoStepValue'],
    requestSign: [
      'username',
      'realName',
      'email',
      'phone',
      'password',
      'mfaSecureKey',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // admin.password.reset 表示管理员重置密码接口。
  'admin.password.reset': {
    requestCipher: ['password', 'twoStepKey', 'twoStepValue'],
    requestSign: ['password', 'twoStepKey', 'twoStepValue'],
  },
  // admin.reset.initial_state 表示管理员重置初始状态接口。
  'admin.reset.initial_state': {
    requestCipher: ['password', 'twoStepKey', 'twoStepValue'],
    requestSign: ['password', 'twoStepKey', 'twoStepValue'],
  },
  // admin.role.update 表示覆盖保存管理员角色接口。
  'admin.role.update': {
    requestSign: ['roleIDs', 'twoStepKey', 'twoStepValue'],
  },
  // admin.status.update 表示修改管理员状态接口。
  'admin.status.update': {
    requestSign: ['status', 'twoStepKey', 'twoStepValue'],
  },
  // admin.update 表示编辑管理员接口。
  'admin.update': {
    requestCipher: ['password', 'mfaSecureKey', 'twoStepKey', 'twoStepValue'],
    requestSign: [
      'username',
      'realName',
      'email',
      'phone',
      'password',
      'mfaSecureKey',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // admin.delete 表示删除管理员接口。
  'admin.delete': {
    requestSign: ['twoStepKey', 'twoStepValue'],
  },
  // api_user.add 表示后台新增前台用户接口。
  'api_user.add': {
    requestCipher: ['password', 'email', 'phone', 'twoStepKey', 'twoStepValue'],
    requestSign: [
      'username',
      'password',
      'nickname',
      'email',
      'phone',
      'avatar',
      'status',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // api_user.update 表示后台编辑前台用户资料接口。
  'api_user.update': {
    requestCipher: ['email', 'phone', 'twoStepKey', 'twoStepValue'],
    requestSign: [
      'nickname',
      'email',
      'phone',
      'avatar',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // api_user.status.update 表示后台修改前台用户状态接口。
  'api_user.status.update': {
    requestSign: ['status', 'twoStepKey', 'twoStepValue'],
  },
  // api_user.password.reset 表示后台重置前台用户密码接口。
  'api_user.password.reset': {
    requestCipher: ['password', 'twoStepKey', 'twoStepValue'],
    requestSign: ['password', 'twoStepKey', 'twoStepValue'],
  },
  // api_user.runtime.sync 表示手动同步前台用户 API 运行态接口。
  'api_user.runtime.sync': {
    requestSign: ['profile', 'sessions', 'twoStepKey', 'twoStepValue'],
  },
  // api_runtime.config_reload.run 表示后台触发 API 配置热加载接口。
  'api_runtime.config_reload.run': {
    requestSign: ['twoStepKey', 'twoStepValue'],
  },
  // auth.login 表示新版登录接口。
  'auth.login': {
    requestCipher: ['password', 'secureCode'],
    requestSign: ['username', 'password', 'secureCode', 'key', 'captcha'],
    responseCipher: ['token', 'user.phone', 'user.buildMFAURL'],
    responseSign: ['token'],
  },
  // auth.refresh 表示刷新令牌接口。
  'auth.refresh': {
    responseCipher: ['token'],
    responseSign: ['token', 'isRefresh'],
  },
  // auth.profile 表示登录后初始化资料接口。
  'auth.profile': {
    responseCipher: ['token'],
    responseSign: ['token'],
  },
  // secretKey.add 表示新增秘钥接口。
  'secretKey.add': {
    requestCipher: [
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'twoStepKey',
      'twoStepValue',
    ],
    requestSign: [
      'uuid',
      'title',
      'keyVersion',
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'status',
      'signStatus',
      'cryptoStatus',
      'versionStatus',
      'stableVersion',
      'grayVersion',
      'grayPercent',
      'remark',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // secretKey.edit 表示编辑秘钥接口。
  'secretKey.edit': {
    requestCipher: [
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'twoStepKey',
      'twoStepValue',
    ],
    requestSign: [
      'uuid',
      'title',
      'keyVersion',
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'status',
      'signStatus',
      'cryptoStatus',
      'versionStatus',
      'stableVersion',
      'grayVersion',
      'grayPercent',
      'remark',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // secretKey.editStatus 表示修改秘钥状态接口。
  'secretKey.editStatus': {
    requestSign: ['status', 'twoStepKey', 'twoStepValue'],
  },
  // secretKey.get 表示读取秘钥详情接口。
  'secretKey.get': {
    responseCipher: [
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      `${CIPHER_JSON_PREFIX}versionList`,
    ],
  },
  // security.debug.sign 表示安全调试台签名接口。
  'security.debug.sign': {
    requestCipher: ['payloadText'],
    responseCipher: ['payloadText', 'signText', 'sign'],
    responseSign: [
      'appId',
      'requestId',
      'traceId',
      'timestamp',
      'signatureType',
      'payloadText',
      'signText',
      'sign',
    ],
  },
  // security.debug.verify 表示安全调试台验签接口。
  'security.debug.verify': {
    requestCipher: ['payloadText', 'sign'],
    responseCipher: ['payloadText', 'signText', 'sign'],
    responseSign: [
      'appId',
      'requestId',
      'traceId',
      'timestamp',
      'signatureType',
      'payloadText',
      'signText',
      'sign',
      'verified',
    ],
  },
  // security.debug.encrypt 表示安全调试台加密接口。
  'security.debug.encrypt': {
    requestCipher: ['payloadText'],
    responseCipher: ['payloadText', 'resultPayloadText'],
    responseSign: [
      'appId',
      'cryptoType',
      'cipherHeader',
      'payloadText',
      'resultPayloadText',
    ],
  },
  // security.debug.decrypt 表示安全调试台解密接口。
  'security.debug.decrypt': {
    requestCipher: ['payloadText'],
    responseCipher: ['payloadText', 'resultPayloadText'],
    responseSign: [
      'appId',
      'cryptoType',
      'cipherHeader',
      'payloadText',
      'resultPayloadText',
    ],
  },
  // secretKey.renew 表示刷新秘钥缓存接口。
  'secretKey.renew': {
    requestSign: ['twoStepKey', 'twoStepValue'],
  },
  // secretKey.validate 表示秘钥路径预检接口。
  'secretKey.validate': {
    requestCipher: [
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'twoStepKey',
      'twoStepValue',
    ],
    requestSign: [
      'uuid',
      'title',
      'keyVersion',
      'aesKeyRef',
      'aesIvRef',
      'rsaPublicKeyUserRef',
      'rsaPublicKeyServerRef',
      'rsaPrivateKeyServerRef',
      'status',
      'signStatus',
      'cryptoStatus',
      'versionStatus',
      'stableVersion',
      'grayVersion',
      'grayPercent',
      'remark',
      'twoStepKey',
      'twoStepValue',
    ],
    responseSign: [
      'uuid',
      'title',
      'keyVersion',
      'mode',
      'status',
      'allPassed',
      'canSave',
      'canEnable',
      'runtimeChecked',
      'cacheRefreshed',
      'checkedAt',
      'durationMs',
    ],
  },
  // secretKey.self_check 表示秘钥运行态自检接口。
  'secretKey.self_check': {
    requestSign: ['keyVersion', 'twoStepKey', 'twoStepValue'],
    responseSign: [
      'uuid',
      'title',
      'keyVersion',
      'mode',
      'status',
      'allPassed',
      'canSave',
      'canEnable',
      'runtimeChecked',
      'cacheRefreshed',
      'checkedAt',
      'durationMs',
    ],
  },
  // admin.mfa_status.update 表示后台修改管理员 MFA 状态接口。
  'admin.mfa_status.update': {
    requestSign: ['mfaStatus', 'twoStepKey', 'twoStepValue'],
  },
  // auth.verify_account 表示登录预校验接口。
  'auth.verify_account': {
    requestCipher: ['password', 'secureCode'],
    requestSign: ['username', 'password', 'secureCode', 'key', 'captcha'],
    responseCipher: ['token', 'user.phone', 'user.buildMFAURL'],
    responseSign: ['token'],
  },
  // profile.check_mfa 表示 MFA 动态码校验接口。
  'profile.check_mfa': {
    requestCipher: ['secure', 'mfaSecureKey'],
    requestSign: ['secure', 'scenarios', 'mfaSecureKey'],
  },
  // profile.check_secure 表示通用安全码校验接口。
  'profile.check_secure': {
    requestCipher: ['secure'],
    requestSign: ['secure'],
  },
  // profile.mine 表示个人中心资料接口，手机号和 MFA 绑定地址都需要按响应字段级解密。
  'profile.mine': {
    responseCipher: ['phone', 'buildMFAURL'],
  },
  // profile.update_avatar 表示个人头像更新接口。
  'profile.update_avatar': {
    requestSign: ['avatar'],
  },
  // profile.update_mfa_secret 表示刷新个人 MFA 秘钥接口。
  'profile.update_mfa_secret': {
    requestCipher: ['mfaSecureKey', 'twoStepKey', 'twoStepValue'],
    requestSign: ['mfaSecureKey', 'twoStepKey', 'twoStepValue'],
  },
  // profile.update_mfa_status 表示个人中心启停 MFA 接口。
  'profile.update_mfa_status': {
    requestCipher: ['mfaSecureKey', 'twoStepKey', 'twoStepValue'],
    requestSign: ['mfaStatus', 'mfaSecureKey', 'twoStepKey', 'twoStepValue'],
  },
  // profile.update_mine 表示个人中心资料更新接口。
  'profile.update_mine': {
    requestCipher: ['email', 'phone', 'twoStepKey', 'twoStepValue'],
    requestSign: [
      'realName',
      'email',
      'phone',
      'avatar',
      'description',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // profile.update_password 表示个人中心改密接口。
  'profile.update_password': {
    requestCipher: [
      'passwordOld',
      'passwordNew',
      'confirmPassword',
      'twoStepKey',
      'twoStepValue',
    ],
    requestSign: [
      'passwordOld',
      'passwordNew',
      'confirmPassword',
      'twoStepKey',
      'twoStepValue',
    ],
  },
  // user_tag.workflow_lease.release 表示释放用户标签工作流互斥锁接口。
  'user_tag.workflow_lease.release': {
    requestSign: ['workflowId', 'mode', 'reason', 'twoStepKey', 'twoStepValue'],
  },
};

// ROUTE_SECURITY_RULES 将前端请求路径映射到后端统一路由别名。
const ROUTE_SECURITY_RULES: RouteSecurityRule[] = [
  // auth.captcha 表示登录页获取图形验证码接口。
  { alias: 'auth.captcha', method: 'GET', pattern: /^\/auth\/captcha$/ },
  // auth.login 表示新版登录接口。
  { alias: 'auth.login', method: 'POST', pattern: /^\/auth\/login$/ },
  // auth.refresh 表示刷新访问令牌接口。
  { alias: 'auth.refresh', method: 'POST', pattern: /^\/auth\/refresh$/ },
  // auth.refresh 表示退出登录接口，当前沿用刷新令牌的响应保护策略。
  { alias: 'auth.logout', method: 'POST', pattern: /^\/auth\/logout$/ },
  // auth.codes 表示获取当前登录用户权限码接口。
  { alias: 'auth.codes', method: 'GET', pattern: /^\/auth\/codes$/ },
  {
    // auth.profile 表示登录后初始化资料接口。
    alias: 'auth.profile',
    method: 'GET',
    pattern: /^\/auth\/profile$/,
  },
  {
    // auth.verify_account 表示登录预校验并生成 MFA 绑定信息接口。
    alias: 'auth.verify_account',
    method: 'POST',
    pattern: /^\/auth\/verify-account$/,
  },
  {
    // profile.check_secure 表示校验当前管理员密码接口。
    alias: 'profile.check_secure',
    method: 'POST',
    pattern: /^\/profile\/check-secure$/,
  },
  {
    // profile.check_mfa 表示校验当前管理员 MFA 动态码接口。
    alias: 'profile.check_mfa',
    method: 'POST',
    pattern: /^\/profile\/check-mfa$/,
  },
  // profile.mine 表示获取当前管理员个人资料接口。
  { alias: 'profile.mine', method: 'GET', pattern: /^\/profile$/ },
  {
    // profile.permissions 表示获取当前管理员角色权限接口。
    alias: 'profile.permissions',
    method: 'GET',
    pattern: /^\/admin\/permissions$/,
  },
  // admin.add 表示 REST 风格新增管理员接口。
  { alias: 'admin.add', method: 'POST', pattern: /^\/admins$/ },
  // admin.update 表示 REST 风格编辑管理员接口。
  { alias: 'admin.update', method: 'PATCH', pattern: /^\/admins\/\d+$/ },
  // admin.delete 表示 REST 风格删除管理员接口。
  { alias: 'admin.delete', method: 'DELETE', pattern: /^\/admins\/\d+$/ },
  {
    // admin.status.update 表示 REST 风格修改管理员状态接口。
    alias: 'admin.status.update',
    method: 'PATCH',
    pattern: /^\/admins\/status\/\d+$/,
  },
  {
    // admin.password.reset 表示 REST 风格重置管理员密码接口。
    alias: 'admin.password.reset',
    method: 'POST',
    pattern: /^\/admins\/password\/reset\/\d+$/,
  },
  {
    // admin.reset.initial_state 表示 REST 风格重置管理员初始状态接口。
    alias: 'admin.reset.initial_state',
    method: 'POST',
    pattern: /^\/admins\/initial-state\/reset\/\d+$/,
  },
  {
    // admin.role.list 表示 REST 风格查询管理员已绑定角色接口。
    alias: 'admin.role.list',
    method: 'GET',
    pattern: /^\/admins\/roles\/\d+$/,
  },
  {
    // admin.role.update 表示 REST 风格覆盖保存管理员角色接口。
    alias: 'admin.role.update',
    method: 'PATCH',
    pattern: /^\/admins\/roles\/\d+$/,
  },
  {
    // admin.mfa_status.update 表示后台修改指定管理员 MFA 状态接口。
    alias: 'admin.mfa_status.update',
    method: 'PATCH',
    pattern: /^\/admins\/mfa-status\/\d+$/,
  },
  {
    // api_user.add 表示后台新增前台用户接口。
    alias: 'api_user.add',
    method: 'POST',
    pattern: /^\/api-users$/,
  },
  {
    // api_user.update 表示后台编辑前台用户资料接口。
    alias: 'api_user.update',
    method: 'PATCH',
    pattern: /^\/api-users\/\d+$/,
  },
  {
    // api_user.status.update 表示后台修改前台用户状态接口。
    alias: 'api_user.status.update',
    method: 'PATCH',
    pattern: /^\/api-users\/status\/\d+$/,
  },
  {
    // api_user.password.reset 表示后台重置前台用户密码接口。
    alias: 'api_user.password.reset',
    method: 'POST',
    pattern: /^\/api-users\/password\/reset\/\d+$/,
  },
  {
    // api_user.runtime.sync 表示手动同步前台用户 API 运行态接口。
    alias: 'api_user.runtime.sync',
    method: 'POST',
    pattern: /^\/api-users\/runtime-sync\/\d+$/,
  },
  {
    // api_runtime.config_reload.run 表示后台触发 API 配置热加载接口。
    alias: 'api_runtime.config_reload.run',
    method: 'POST',
    pattern: /^\/api-runtime\/config-reload$/,
  },
  {
    // secretKey.add 表示新增秘钥接口。
    alias: 'secretKey.add',
    method: 'POST',
    pattern: /^\/secret-keys$/,
  },
  {
    // secretKey.edit 表示编辑秘钥接口。
    alias: 'secretKey.edit',
    method: 'PATCH',
    pattern: /^\/secret-keys\/\d+$/,
  },
  {
    // secretKey.get 表示查询秘钥详情接口。
    alias: 'secretKey.get',
    method: 'GET',
    pattern: /^\/secret-keys\/\d+$/,
  },
  {
    // secretKey.editStatus 表示修改秘钥状态接口。
    alias: 'secretKey.editStatus',
    method: 'PATCH',
    pattern: /^\/secret-keys\/status\/\d+$/,
  },
  {
    // secretKey.renew 表示刷新秘钥缓存接口。
    alias: 'secretKey.renew',
    method: 'POST',
    pattern: /^\/secret-keys\/cache\/refresh\/[^/]+$/,
  },
  {
    // secretKey.validate 表示秘钥路径预检接口。
    alias: 'secretKey.validate',
    method: 'POST',
    pattern: /^\/secret-keys\/validate$/,
  },
  {
    // secretKey.self_check 表示秘钥运行态自检接口。
    alias: 'secretKey.self_check',
    method: 'POST',
    pattern: /^\/secret-keys\/self-check\/[^/]+$/,
  },
  {
    // security.debug.sign 表示安全调试台签名接口。
    alias: 'security.debug.sign',
    method: 'POST',
    pattern: /^\/security\/debug\/sign$/,
  },
  {
    // security.debug.verify 表示安全调试台验签接口。
    alias: 'security.debug.verify',
    method: 'POST',
    pattern: /^\/security\/debug\/verify$/,
  },
  {
    // security.debug.encrypt 表示安全调试台加密接口。
    alias: 'security.debug.encrypt',
    method: 'POST',
    pattern: /^\/security\/debug\/encrypt$/,
  },
  {
    // security.debug.decrypt 表示安全调试台解密接口。
    alias: 'security.debug.decrypt',
    method: 'POST',
    pattern: /^\/security\/debug\/decrypt$/,
  },
  {
    // profile.update_password 表示个人中心修改密码接口。
    alias: 'profile.update_password',
    method: 'PATCH',
    pattern: /^\/profile\/password$/,
  },
  {
    // profile.update_mine 表示个人中心修改资料接口。
    alias: 'profile.update_mine',
    method: 'PATCH',
    pattern: /^\/profile$/,
  },
  {
    // profile.update_mfa_status 表示个人中心启停 MFA 接口。
    alias: 'profile.update_mfa_status',
    method: 'PATCH',
    pattern: /^\/profile\/mfa-status$/,
  },
  {
    // profile.update_mfa_secret 表示个人中心刷新 MFA 秘钥接口。
    alias: 'profile.update_mfa_secret',
    method: 'PATCH',
    pattern: /^\/profile\/mfa-secret$/,
  },
  {
    // profile.refresh_mfa_secret 表示个人中心重新生成 MFA 秘钥接口。
    alias: 'profile.refresh_mfa_secret',
    method: 'POST',
    pattern: /^\/profile\/mfa-secret\/refresh$/,
  },
  {
    // profile.update_avatar 表示个人中心修改头像接口。
    alias: 'profile.update_avatar',
    method: 'PATCH',
    pattern: /^\/profile\/avatar$/,
  },
  {
    // user_tag.workflow_lease.release 表示释放用户标签工作流互斥锁接口。
    alias: 'user_tag.workflow_lease.release',
    method: 'POST',
    pattern: /^\/user-tags\/workflow-lease\/release$/,
  },
];

// isSecurityEnabled 判断指定安全能力是否已通过环境变量开启。
function isSecurityEnabled(flag: string) {
  return String(flag || '').toLowerCase() === 'true';
}

// isPlainObject 判断请求体是否为普通对象，避免误处理 FormData/Blob。
function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

// resolveRequestPayload 统一解析当前请求用于签名/加密的首层参数容器。
// POST/PUT 等优先使用 JSON body；GET/DELETE 等无 body 场景退回 query params。
function resolveRequestPayload(config: any) {
  if (isPlainObject(config.data)) {
    return {
      payload: config.data as Record<string, any>,
      target: 'data' as const,
    };
  }
  if (isPlainObject(config.params)) {
    return {
      payload: config.params as Record<string, any>,
      target: 'params' as const,
    };
  }
  return {
    payload: {} as Record<string, any>,
    target: 'params' as const,
  };
}

// normalizeApiPath 统一去掉 query 与 /api 前缀，保持路由匹配稳定。
function normalizeApiPath(url?: string) {
  const path = (url || '').split('?')[0] || '';
  return path.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api(?=\/)/, '');
}

// resolveRouteSecurityRule 根据请求方法与路径查找统一安全策略。
export function resolveRouteSecurityRule(method?: string, url?: string) {
  const currentMethod = String(method || 'GET').toUpperCase();
  const currentPath = normalizeApiPath(url);
  return ROUTE_SECURITY_RULES.find(
    (rule) => rule.method === currentMethod && rule.pattern.test(currentPath),
  );
}

// resolvePolicyForAlias 根据别名返回显式安全策略。
export function resolvePolicyForAlias(alias?: string): RouteSecurityPolicy {
  if (!alias || alias === 'ignore') {
    return {};
  }
  return ADMIN_ROUTE_SECURITY_POLICIES[alias] || {};
}

// signValueString 将参与签名的值转换为后端兼容的字符串。
function signValueString(value: any) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return stableJSONStringify(value);
}

// stableJSONStringify 对对象值执行递归稳定序列化，确保每层对象 key 都按字典序输出。
function stableJSONStringify(value: any): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJSONStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, any>).toSorted(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${stableJSONStringify(item)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// isEmptySignValue 判断字段是否需要跳过签名。
function isEmptySignValue(value: any) {
  return value === undefined || value === null || value === '';
}

// uniqueStrings 对字段数组去重并过滤空值。
function uniqueStrings(items: string[] = []) {
  return [
    ...new Set(items.map((item) => String(item || '').trim()).filter(Boolean)),
  ];
}

// byteLength 计算 UTF-8 字节长度，和后端按字节限制保持一致。
function byteLength(text: string) {
  return new TextEncoder().encode(text).length;
}

// assertSecurityTextSize 校验签名、加密和请求体文本大小。
function assertSecurityTextSize(
  scope: string,
  value: string,
  maxBytes: number,
) {
  if (byteLength(value) > maxBytes) {
    throw new Error(
      $t('business.message.securityPayloadTooLarge', [scope, String(maxBytes)]),
    );
  }
}

// stringifySecurityValue 序列化安全字段，并限制序列化后的大小。
function stringifySecurityValue(scope: string, value: any, maxBytes: number) {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value ?? null);
  assertSecurityTextSize(scope, text, maxBytes);
  return text;
}

// assertSecurityFieldCount 校验字段级安全处理数量。
function assertSecurityFieldCount(scope: string, fields: string[]) {
  const normalized = uniqueStrings(fields);
  if (normalized.length > MAX_SECURITY_FIELD_COUNT) {
    throw new Error(
      $t('business.message.securityFieldCountTooLarge', [
        scope,
        String(MAX_SECURITY_FIELD_COUNT),
      ]),
    );
  }
}

// resolveSignParams 解析签名字段；配置为 * 时改为当前首层所有字段。
function resolveSignParams(data: Record<string, any>, params: string[] = []) {
  const normalized = uniqueStrings(params);
  if (!normalized.includes(SIGN_FIELD_ALL)) {
    return normalized;
  }
  return Object.keys(data)
    .map((key) => key.trim())
    .filter((key) => key && key !== 'ciphertext' && key !== 'sign');
}

// buildSignString 生成后端兼容的待签名字符串。
export function buildSignString(
  data: Record<string, any>,
  params: string[],
  traceId: string,
  timestamp: string,
  appID: string,
) {
  const items = [...resolveSignParams(data, params)].toSorted();
  const chunks: string[] = [];
  for (const key of items) {
    const value = data[key];
    if (isEmptySignValue(value)) {
      continue;
    }
    const text = signValueString(value);
    assertSecurityTextSize(key, text, MAX_SECURITY_FIELD_BYTES);
    chunks.push(`${key}=${text}`);
  }
  chunks.push(`key=${md5Hex(`${appID}-${traceId}-${timestamp}`)}`);
  const text = chunks.join('&');
  assertSecurityTextSize('signature', text, MAX_SECURITY_REQUEST_BODY_BYTES);
  return text;
}

function createSignatureTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

// encodeAppID 对 AppID 做 base64 编码，后端会从 X-App-Id 解码真实 AppID。
function encodeAppID(appID: string) {
  return bytesToBase64(new TextEncoder().encode(appID));
}

// encodeCipherHeader 把字段加密配置编码成后端 X-Cipher 请求头。
export function encodeCipherHeader(params: string[] = []) {
  const normalized = uniqueStrings(params);
  if (normalized.length === 0) {
    return '';
  }
  assertSecurityFieldCount('X-Cipher', normalized);
  if (normalized.some((field) => field.toLowerCase() === 'cipher')) {
    throw new Error($t('business.message.wholeBodyCipherForbidden'));
  }
  const header = bytesToBase64(
    new TextEncoder().encode(JSON.stringify(normalized)),
  );
  assertSecurityTextSize('X-Cipher', header, MAX_SECURITY_JSON_FIELD_BYTES);
  return header;
}

// decodeCipherHeader 解析 base64(JSON数组) 格式的字段名单。
function decodeCipherHeader(cipherHeader: string) {
  const text = String(cipherHeader || '').trim();
  if (!text) {
    return [];
  }
  assertSecurityTextSize('X-Cipher', text, MAX_SECURITY_JSON_FIELD_BYTES);
  if (text.toLowerCase() === 'cipher') {
    throw new Error($t('business.message.wholeBodyCipherForbidden'));
  }
  try {
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(text), (item) => item.codePointAt(0) ?? 0),
    );
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return uniqueStrings(parsed.map((item) => String(item ?? '')));
  } catch {
    return [];
  }
}

// resolveCipherFieldConfig 解析单个 X-Cipher 字段配置，识别是否为 JSON 文本加解密。
function resolveCipherFieldConfig(field: string) {
  const raw = String(field || '').trim();
  const isJSON = raw.startsWith(CIPHER_JSON_PREFIX);
  return {
    isJSON,
    fieldPath: isJSON ? raw.slice(CIPHER_JSON_PREFIX.length).trim() : raw,
  };
}

// resolveHeader 兼容 AxiosHeaders 与普通对象的取值。
function resolveHeader(headers: Record<string, any>, key: string) {
  return headers[key] || headers[key.toLowerCase()];
}

// setHeader 统一写入请求头，兼容 AxiosHeaders 与普通对象。
function setHeader(headers: Record<string, any>, key: string, value: any) {
  headers[key] = value;
}

// hasResponseCrypto 判断当前响应是否真的携带了后端加密标记。
function hasResponseCrypto(headers: Record<string, any>) {
  return Boolean(
    resolveHeader(headers, 'X-Crypto') && resolveHeader(headers, 'X-Cipher'),
  );
}

// hasResponseSignature 判断当前响应是否真的携带了后端回签结果。
function hasResponseSignature(payload: any, headers: Record<string, any>) {
  const sign = payload?.data?.sign;
  return Boolean(
    resolveHeader(headers, 'X-Signature') &&
    typeof sign === 'string' &&
    sign.trim() !== '',
  );
}

// signString 按指定签名方式生成 sign 字段。
// M 表示 MD5，A 表示 AES-CBC 摘要签名，R 表示 RSA PKCS#1 签名。
async function signString(text: string, type: SignatureType) {
  if (type === 'M') {
    return md5Hex(text);
  }
  if (type === 'A') {
    return aesCbcSign(
      text,
      import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '',
      import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '',
    );
  }
  return rsaPkcs1Sign(
    text,
    import.meta.env.VITE_ADMIN_SIGNATURE_PRIVATE_KEY || '',
  );
}

// verifyString 按指定签名方式校验 sign 字段。
// 响应验签阶段会复用这套规则，保证前后端对签名算法的判断完全一致。
async function verifyString(text: string, sign: string, type: SignatureType) {
  if (type === 'M') {
    return md5Hex(text) === sign;
  }
  if (type === 'A') {
    const expected = await aesCbcSign(
      text,
      import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '',
      import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '',
    );
    return expected === sign;
  }
  const publicKey =
    import.meta.env.VITE_ADMIN_SIGNATURE_PUBLIC_KEY ||
    import.meta.env.VITE_ADMIN_SECURITY_RSA_PUBLIC_KEY_SERVER ||
    '';
  if (!publicKey) {
    throw new Error($t('business.message.rsaVerifyPublicKeyMissing'));
  }
  const ok = await rsaPkcs1Verify(text, sign, publicKey);
  return ok;
}

// attachSignature 给请求体补充 sign 字段和签名请求头。
// 这里会统一写入 X-App-Id、X-Trace-Id、X-Timestamp、X-Signature。
async function attachSignature(
  config: any,
  body: Record<string, any>,
  policy: RouteSecurityPolicy,
  appID: string,
) {
  const headers = config.headers as Record<string, any>;
  // 签名链路统一只认 X-Trace-Id 与 X-Timestamp。
  const traceId = resolveHeader(headers, 'X-Trace-Id') || createTraceId();
  const timestamp =
    resolveHeader(headers, SIGNATURE_TIMESTAMP_HEADER) ||
    createSignatureTimestamp();
  const signatureType = String(
    import.meta.env.VITE_ADMIN_SIGNATURE_TYPE || 'R',
  ).toUpperCase() as SignatureType;
  const signStringText = buildSignString(
    body,
    policy.requestSign || [],
    String(traceId),
    String(timestamp),
    appID,
  );
  setHeader(headers, 'X-App-Id', encodeAppID(appID));
  setHeader(headers, 'X-Trace-Id', traceId);
  setHeader(headers, SIGNATURE_TIMESTAMP_HEADER, timestamp);
  setHeader(headers, 'X-Signature', signatureType);
  return {
    ...body,
    sign: await signString(signStringText, signatureType),
  };
}

// attachCrypto 按策略对签名后的请求体做字段级加密。
// 当前浏览器端只支持 AES 请求加密，因此字段级模式也会走同一套 AES-CBC 实现。
async function attachCrypto(
  config: any,
  body: Record<string, any>,
  policy: RouteSecurityPolicy,
  appID: string,
) {
  const cipherConfig = policy.requestCipher || [];
  if (cipherConfig.length === 0) {
    return body;
  }
  const cryptoType = String(
    import.meta.env.VITE_ADMIN_CRYPTO_TYPE || 'A',
  ).toUpperCase() as CryptoType;
  if (cryptoType !== 'A') {
    throw new Error($t('business.message.browserOnlySupportsAesRequestCrypto'));
  }
  const headers = config.headers as Record<string, any>;
  setHeader(
    headers,
    'X-App-Id',
    resolveHeader(headers, 'X-App-Id') || encodeAppID(appID),
  );
  setHeader(headers, 'X-Crypto', cryptoType);
  setHeader(headers, 'X-Cipher', encodeCipherHeader(cipherConfig));
  const result = { ...body };
  for (const field of cipherConfig) {
    const { fieldPath, isJSON } = resolveCipherFieldConfig(field);
    if (!fieldPath) {
      continue;
    }
    const current = result[fieldPath];
    if (isEmptySignValue(current)) {
      continue;
    }
    // plainValue 根据字段配置生成待加密明文，兼容字符串和 JSON 对象。
    let plainValue = '';
    if (isJSON) {
      plainValue = stringifySecurityValue(
        fieldPath,
        current,
        MAX_SECURITY_JSON_FIELD_BYTES,
      );
    } else if (typeof current === 'string') {
      plainValue = stringifySecurityValue(
        fieldPath,
        current,
        MAX_SECURITY_FIELD_BYTES,
      );
    } else {
      plainValue = stringifySecurityValue(
        fieldPath,
        current,
        MAX_SECURITY_JSON_FIELD_BYTES,
      );
    }
    result[fieldPath] = await aesCbcEncrypt(
      plainValue,
      import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '',
      import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '',
    );
  }
  return result;
}

// shouldEnableSignature 判断当前请求是否启用验签。
function shouldEnableSignature() {
  return isSecurityEnabled(
    import.meta.env.VITE_ADMIN_SIGNATURE_ENABLED || 'true',
  );
}

// shouldEnableRequestCrypto 判断当前请求是否需要按策略启用请求加密。
function shouldEnableRequestCrypto(policy: RouteSecurityPolicy) {
  if ((policy.requestCipher || []).length === 0) {
    return false;
  }
  return isSecurityEnabled(import.meta.env.VITE_ADMIN_CRYPTO_ENABLED || 'true');
}

// extractEnvelope 从响应中提取标准 data 包装。
function extractEnvelope(payload: any) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload;
}

// decryptResponseData 按响应头 X-Cipher 动态解密标准响应 data 下的敏感字段。
// 只要后端明确返回了加密头，前端就按头里声明的字段路径逐个解密，不再依赖本地 responseCipher 预配置。
async function decryptResponseData(payload: any, headers: any) {
  const responseCipherHeader = String(
    resolveHeader(headers || {}, 'X-Cipher') || '',
  );
  const cipherFields = decodeCipherHeader(responseCipherHeader);
  if (cipherFields.length === 0) {
    return payload;
  }
  if (!hasResponseCrypto(headers || {})) {
    return payload;
  }
  const key = import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '';
  const iv = import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '';
  const envelope = extractEnvelope(payload);
  if (!envelope || !envelope.data || typeof envelope.data !== 'object') {
    return payload;
  }
  const data = { ...(envelope.data as Record<string, any>) };
  for (const field of cipherFields) {
    const { fieldPath, isJSON } = resolveCipherFieldConfig(field);
    if (!fieldPath) {
      continue;
    }
    const ciphertext = getNestedFieldValue(data, fieldPath);
    if (typeof ciphertext !== 'string' || ciphertext.trim() === '') {
      continue;
    }
    assertSecurityTextSize(
      fieldPath,
      ciphertext,
      MAX_SECURITY_JSON_FIELD_BYTES,
    );
    const plain = await aesCbcDecrypt(ciphertext, key, iv);
    assertSecurityTextSize(
      fieldPath,
      plain,
      isJSON ? MAX_SECURITY_JSON_FIELD_BYTES : MAX_SECURITY_FIELD_BYTES,
    );
    let decryptedValue: any = plain;
    if (isJSON) {
      try {
        decryptedValue = JSON.parse(plain);
      } catch {
        decryptedValue = plain;
      }
    }
    setNestedFieldValue(data, fieldPath, decryptedValue);
  }
  envelope.data = data;
  return envelope;
}

// getNestedFieldValue 按点路径读取对象中的嵌套字段。
function getNestedFieldValue(data: Record<string, any>, fieldPath: string) {
  const parts = splitFieldPath(fieldPath);
  let current: any = data;
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

// setNestedFieldValue 按点路径回写对象中的嵌套字段。
function setNestedFieldValue(
  data: Record<string, any>,
  fieldPath: string,
  value: any,
) {
  const parts = splitFieldPath(fieldPath);
  if (parts.length === 0) {
    return;
  }
  let current: Record<string, any> = data;
  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    const next = current[part];
    if (!next || typeof next !== 'object') {
      return;
    }
    current = next as Record<string, any>;
  }
}

// splitFieldPath 拆分 `user.buildMFAURL` 这类响应字段路径。
function splitFieldPath(fieldPath: string) {
  return String(fieldPath || '')
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean);
}

// verifyResponseSignature 校验标准响应 data.sign，避免 token 等敏感结果被中间人篡改。
// 响应签名文本沿用请求签名的同一套拼接规则，确保调试台与业务接口行为一致。
async function verifyResponseSignature(
  payload: any,
  policy: RouteSecurityPolicy,
  headers: any,
  config?: any,
) {
  const signFields = policy.responseSign || [];
  if (signFields.length === 0) {
    return payload;
  }
  if (!hasResponseSignature(payload, headers || {})) {
    return payload;
  }
  const envelope = extractEnvelope(payload);
  const data = envelope?.data;
  if (!data || typeof data !== 'object') {
    return payload;
  }
  const sign = data.sign;
  if (typeof sign !== 'string' || sign.trim() === '') {
    throw new Error($t('business.message.responseSignMissing'));
  }
  assertSecurityTextSize('response sign', sign, MAX_SECURITY_FIELD_BYTES);
  const appID = import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '';
  const signatureType = String(
    headers?.['x-signature'] ||
      headers?.['X-Signature'] ||
      import.meta.env.VITE_ADMIN_SIGNATURE_TYPE ||
      'R',
  ).toUpperCase() as SignatureType;

  const traceIdCandidates = uniqueStrings([
    headers?.['x-trace-id'],
    headers?.['X-Trace-Id'],
    config?.headers?.['X-Trace-Id'],
    config?.headers?.['x-trace-id'],
  ]);
  const timestampCandidates = uniqueStrings([
    headers?.['x-timestamp'],
    headers?.[SIGNATURE_TIMESTAMP_HEADER],
    config?.headers?.[SIGNATURE_TIMESTAMP_HEADER],
    config?.headers?.['x-timestamp'],
  ]);
  if (traceIdCandidates.length === 0) {
    throw new Error($t('business.message.responseTraceIdRequiredForVerify'));
  }
  if (timestampCandidates.length === 0) {
    throw new Error($t('business.message.responseTimestampRequiredForVerify'));
  }

  for (const traceId of traceIdCandidates) {
    for (const timestamp of timestampCandidates) {
      const signText = buildSignString(
        data,
        signFields,
        String(traceId),
        String(timestamp),
        appID,
      );
      assertSecurityTextSize(
        'response signature',
        signText,
        MAX_SECURITY_REQUEST_BODY_BYTES,
      );
      const ok = await verifyString(signText, sign, signatureType);
      if (ok) {
        return payload;
      }
    }
  }

  throw new Error($t('business.message.responseSignVerifyFailed'));
}

// attachAdminSecurityHeaders 统一对后台接口执行显式签名和敏感请求加密。
// 该入口挂在 request interceptor 上，是前端安全头、签名和请求加密的统一收口。
export async function attachAdminSecurityHeaders(config: any) {
  const appID = import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '';
  if (!appID) {
    return config;
  }
  const headers = (config.headers ||= {});
  setHeader(
    headers,
    'X-App-Id',
    resolveHeader(headers, 'X-App-Id') || encodeAppID(appID),
  );
  // 每个安全请求必须携带 X-Trace-Id 和 X-Timestamp。
  if (!resolveHeader(headers, 'X-Trace-Id')) {
    setHeader(headers, 'X-Trace-Id', createTraceId());
  }
  if (!resolveHeader(headers, SIGNATURE_TIMESTAMP_HEADER)) {
    setHeader(headers, SIGNATURE_TIMESTAMP_HEADER, createSignatureTimestamp());
  }
  const routeRule = resolveRouteSecurityRule(config.method, config.url);
  const policy = routeRule ? resolvePolicyForAlias(routeRule.alias) : {};
  const { payload, target } = resolveRequestPayload(config);
  let nextBody = { ...payload };
  stringifySecurityValue(
    target === 'data' ? 'request body' : 'request params',
    nextBody,
    MAX_SECURITY_REQUEST_BODY_BYTES,
  );
  if (shouldEnableSignature() && (policy.requestSign?.length || 0) > 0) {
    nextBody = await attachSignature(config, nextBody, policy, appID);
  }
  if (target === 'data' && shouldEnableRequestCrypto(policy)) {
    nextBody = await attachCrypto(config, nextBody, policy, appID);
  }
  if (target === 'data') {
    config.data = nextBody;
  } else {
    config.params = nextBody;
  }
  return config;
}

// handleAdminSecurityResponse 统一执行响应解密和响应验签。
// 该入口挂在 response interceptor 上，先解密后验签，保持与后端输出顺序一致。
export async function handleAdminSecurityResponse(response: any) {
  const routeRule = resolveRouteSecurityRule(
    response?.config?.method,
    response?.config?.url,
  );
  const appID = import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '';
  if (!routeRule && !hasResponseCrypto(response?.headers || {})) {
    return response;
  }
  if (!appID) {
    return response;
  }
  const policy = routeRule
    ? resolvePolicyForAlias(routeRule.alias)
    : { responseSign: [] };
  if (isSecurityEnabled(import.meta.env.VITE_ADMIN_CRYPTO_ENABLED || 'true')) {
    response.data = await decryptResponseData(
      response.data,
      response.headers || {},
    );
  }
  if (routeRule && shouldEnableSignature()) {
    response.data = await verifyResponseSignature(
      response.data,
      policy,
      response.headers || {},
      response?.config,
    );
  }
  return response;
}
