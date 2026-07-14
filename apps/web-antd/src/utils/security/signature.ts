import { $t } from '#/locales';
import { createTraceId } from '#/utils/request/trace';

import {
  aesCbcDecrypt,
  aesCbcEncrypt,
  aesCbcSign,
  bytesToBase64,
  rsaPkcs1Sign,
  rsaPkcs1Verify,
} from './crypto';
import routeSecurityManifest from './route-security-manifest.json';

// SignatureType 表示浏览器端允许使用的签名方式。
export type SignatureType = 'A' | 'R';

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

// resolveSignatureType 收敛签名配置；未知算法必须直接失败，避免静默降级到 RSA。
export function resolveSignatureType(value?: unknown): SignatureType {
  const signatureType = String(value || 'R')
    .trim()
    .toUpperCase();
  if (signatureType === 'A' || signatureType === 'R') {
    return signatureType;
  }
  throw new Error(
    $t('business.message.unsupportedSignatureType', [signatureType || '-']),
  );
}

// RouteSecurityManifestRoute 表示后端导出的单路由安全清单项。
interface RouteSecurityManifestRoute {
  access: string;
  alias: string;
  describe: string;
  method: string;
  path: string;
  requestCipher: string[];
  requestSign: string[];
  responseCipher: string[];
  responseSign: string[];
}

// RouteSecurityManifestSnapshot 表示后端生成、前端消费的安全策略快照。
interface RouteSecurityManifestSnapshot {
  routes: RouteSecurityManifestRoute[];
  version: number;
}

// ADMIN_ROUTE_SECURITY_MANIFEST 是后台路由安全策略的前端运行时来源。
const ADMIN_ROUTE_SECURITY_MANIFEST =
  routeSecurityManifest as RouteSecurityManifestSnapshot;

const ADMIN_ROUTE_SECURITY_POLICIES: Record<string, RouteSecurityPolicy> =
  Object.fromEntries(
    ADMIN_ROUTE_SECURITY_MANIFEST.routes.map((route) => [
      route.alias,
      routeManifestPolicy(route),
    ]),
  );

// ROUTE_SECURITY_RULES 将后端路由模板转换成前端请求路径匹配规则。
const ROUTE_SECURITY_RULES: RouteSecurityRule[] =
  ADMIN_ROUTE_SECURITY_MANIFEST.routes.map((route) => ({
    alias: route.alias,
    method: route.method.toUpperCase(),
    pattern: routePathPattern(route.path),
  }));

// routeManifestPolicy 从 manifest 路由项提取字段级安全策略。
function routeManifestPolicy(
  route: RouteSecurityManifestRoute,
): RouteSecurityPolicy {
  return {
    requestCipher: route.requestCipher,
    requestSign: route.requestSign,
    responseCipher: route.responseCipher,
    responseSign: route.responseSign,
  };
}

// routePathPattern 将 go-zero 路由模板转换为前端请求路径正则。
function routePathPattern(path: string) {
  const normalizedPath = normalizeApiPath(path).replace(/\/+$/u, '') || '/';
  const chunks = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((chunk) => (chunk.startsWith(':') ? '[^/]+' : escapeRegExp(chunk)));
  return new RegExp(`^/${chunks.join('/')}$`, 'u');
}

// escapeRegExp 转义普通路径片段中的正则特殊字符。
function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}
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

// buildSignString 使用版本化 UTF-8 长度前缀生成无歧义签名串。
export function buildSignString(
  data: Record<string, any>,
  params: string[],
  traceId: string,
  timestamp: string,
  appID: string,
) {
  const items = [...resolveSignParams(data, params)].toSorted();
  const chunks = [
    `v2|app=${lengthPrefixedSignPart(appID)}`,
    `|trace=${lengthPrefixedSignPart(traceId)}`,
    `|timestamp=${lengthPrefixedSignPart(timestamp)}`,
  ];
  for (const key of items) {
    const value = getNestedFieldValue(data, key);
    if (isEmptySignValue(value)) {
      continue;
    }
    const text = signValueString(value);
    assertSecurityTextSize(key, text, MAX_SECURITY_FIELD_BYTES);
    chunks.push(
      `|field=${lengthPrefixedSignPart(key)}${lengthPrefixedSignPart(text)}`,
    );
  }
  const text = chunks.join('');
  assertSecurityTextSize('signature', text, MAX_SECURITY_REQUEST_BODY_BYTES);
  return text;
}

// lengthPrefixedSignPart 按 UTF-8 字节长度编码签名片段，与 Go 后端 len(string) 语义一致。
function lengthPrefixedSignPart(value: string) {
  return `${new TextEncoder().encode(value).byteLength}:${value}`;
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
    throw new Error($t('business.message.responseCipherHeaderInvalid'));
  }
  assertSecurityTextSize('X-Cipher', text, MAX_SECURITY_JSON_FIELD_BYTES);
  if (text.toLowerCase() === 'cipher') {
    throw new Error($t('business.message.wholeBodyCipherForbidden'));
  }
  let parsed: unknown;
  try {
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(text), (item) => item.codePointAt(0) ?? 0),
    );
    parsed = JSON.parse(decoded);
  } catch (error) {
    throw new Error($t('business.message.responseCipherHeaderInvalid'), {
      cause: error,
    });
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError($t('business.message.responseCipherHeaderInvalid'));
  }
  const fields = uniqueStrings(parsed.map((item) => String(item ?? '')));
  if (fields.length === 0) {
    throw new Error($t('business.message.responseCipherHeaderInvalid'));
  }
  assertSecurityFieldCount('X-Cipher', fields);
  for (const field of fields) {
    assertSafeCipherField(field);
  }
  return fields;
}

// assertSafeCipherField 拒绝危险或含糊的对象路径，避免响应头驱动原型链写入。
function assertSafeCipherField(field: string) {
  const { fieldPath } = resolveCipherFieldConfig(field);
  const parts = fieldPath.split('.');
  const unsafeParts = new Set(['__proto__', 'constructor', 'prototype']);
  if (
    parts.length === 0 ||
    parts.length > 8 ||
    parts.some(
      (part) =>
        !/^[A-Z_$][\w$]*$/i.test(part) || unsafeParts.has(part.toLowerCase()),
    )
  ) {
    throw new Error($t('business.message.responseCipherHeaderInvalid'));
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

// hasResponseCryptoMarker 判断服务端是否声明响应字段已加密；X-Crypto 可能只表示请求解密算法。
function hasResponseCryptoMarker(headers: Record<string, any>) {
  return Boolean(resolveHeader(headers, 'X-Cipher'));
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
async function signString(text: string, type: SignatureType) {
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
  const signatureType = resolveSignatureType(
    import.meta.env.VITE_ADMIN_SIGNATURE_TYPE,
  );
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
  const cryptoType = String(resolveHeader(headers || {}, 'X-Crypto') || '')
    .trim()
    .toUpperCase();
  if (cryptoType !== 'A') {
    throw new Error($t('business.message.responseCipherHeaderInvalid'));
  }
  const responseCipherHeader = String(
    resolveHeader(headers || {}, 'X-Cipher') || '',
  );
  const cipherFields = decodeCipherHeader(responseCipherHeader);
  if (!hasResponseCrypto(headers || {})) {
    throw new Error($t('business.message.responseCipherHeaderInvalid'));
  }
  const key = import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '';
  const iv = import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '';
  if (!key || !iv) {
    throw new Error($t('business.message.missingFrontendAesConfig'));
  }
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
  // 后端只对成功响应回签；业务失败仍交给统一错误拦截器保留原始业务码。
  if (payload?.status !== true) {
    return payload;
  }
  if (!hasResponseSignature(payload, headers || {})) {
    throw new Error($t('business.message.responseSignMissing'));
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
  const signatureType = resolveSignatureType(
    headers?.['x-signature'] ||
      headers?.['X-Signature'] ||
      import.meta.env.VITE_ADMIN_SIGNATURE_TYPE,
  );

  const requestTraceID = resolveHeader(config?.headers || {}, 'X-Trace-Id');
  const requestTimestamp = resolveHeader(
    config?.headers || {},
    SIGNATURE_TIMESTAMP_HEADER,
  );
  if (!requestTraceID) {
    throw new Error($t('business.message.responseTraceIdRequiredForVerify'));
  }
  if (!requestTimestamp) {
    throw new Error($t('business.message.responseTimestampRequiredForVerify'));
  }
  const responseTraceID = resolveHeader(headers || {}, 'X-Trace-Id');
  const responseTimestamp = resolveHeader(
    headers || {},
    SIGNATURE_TIMESTAMP_HEADER,
  );
  if (
    (responseTraceID && responseTraceID !== requestTraceID) ||
    (responseTimestamp && responseTimestamp !== requestTimestamp)
  ) {
    throw new Error($t('business.message.responseSignVerifyFailed'));
  }
  const signText = buildSignString(
    data,
    signFields,
    requestTraceID,
    requestTimestamp,
    appID,
  );
  assertSecurityTextSize(
    'response signature',
    signText,
    MAX_SECURITY_REQUEST_BODY_BYTES,
  );
  if (await verifyString(signText, sign, signatureType)) {
    return payload;
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
  if (shouldEnableSignature()) {
    resolveSignatureType(import.meta.env.VITE_ADMIN_SIGNATURE_TYPE);
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
  if (!routeRule && !hasResponseCryptoMarker(response?.headers || {})) {
    return response;
  }
  if (!appID) {
    if (hasResponseCryptoMarker(response?.headers || {})) {
      throw new Error($t('business.message.missingFrontendSecurityAppId'));
    }
    return response;
  }
  const policy = routeRule
    ? resolvePolicyForAlias(routeRule.alias)
    : { responseSign: [] };
  // 服务端响应头是密文事实来源；本地开关只控制是否主动加密请求，不能让密文绕过解密后进入页面。
  if (hasResponseCryptoMarker(response?.headers || {})) {
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
