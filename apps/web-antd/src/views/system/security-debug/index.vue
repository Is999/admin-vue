<script lang="ts" setup>
import type { SystemSecurityDebugApi } from '#/api/system';

import { computed, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';

import {
  Alert,
  Card,
  Input,
  InputPassword,
  message,
  Select,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  debugSecurityDecrypt,
  debugSecurityEncrypt,
  debugSecuritySign,
  debugSecurityVerify,
} from '#/api/system';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { createTraceId } from '#/utils/request/trace';
import {
  aesCbcDecrypt,
  aesCbcEncrypt,
  aesCbcSign,
  bytesToBase64,
  rsaPkcs1Sign,
  rsaPkcs1Verify,
} from '#/utils/security/crypto';
import {
  buildSignString,
  resolvePolicyForAlias,
  resolveRouteSecurityRule,
  resolveSignatureType,
} from '#/utils/security/signature';

import { resolveBackendMessage } from '../shared';

type DebugFlowMode = 'request' | 'response';
type DebugSignatureType = 'A' | 'R';
type DebugCryptoType = 'A' | 'R';

const CIPHER_JSON_PREFIX = 'json:';

// flowMode 表示当前模拟的是前端请求链路还是后端响应链路。
const flowMode = ref<DebugFlowMode>('request');
// appId 保存当前调试使用的 AppID。
const appId = ref(import.meta.env.VITE_ADMIN_SECURITY_APP_ID || '');
// traceId 保存当前调试使用的请求追踪标识，对应真实请求头 X-Trace-Id。
const traceId = ref('');
// signatureTimestamp 保存当前调试使用的秒级时间戳，对应真实请求头 X-Timestamp。
const signatureTimestamp = ref('');
// signatureType 保存当前签名方式。
const signatureType = ref<DebugSignatureType>('R');
// cryptoType 保存当前加密方式。
const cryptoType = ref<DebugCryptoType>('A');
// signFieldsText 保存签名字段列表输入。
const signFieldsText = ref('*');
// cipherFieldsText 保存加解密字段列表输入。
const cipherFieldsText = ref('password');
// payloadText 保存调试原始 JSON 文本。
const payloadText = ref(
  '{\n  "username": "admin999",\n  "password": "123456",\n  "token": "demo-token"\n}',
);
// signValue 保存待验签签名值。
const signValue = ref('');
// fieldCipherPayloadText 保存字段模式下包含密文字段的 JSON 文本。
const fieldCipherPayloadText = ref('');
const rawPasteText = ref('');
const pasteSegmentIndex = ref(0);

// busy 保存当前执行状态。
const busy = ref(false);

// signResult 保存签名结果。
const signResult = ref<null | SystemSecurityDebugApi.SignResult>(null);
// verifyResult 保存验签结果。
const verifyResult = ref<null | SystemSecurityDebugApi.VerifyResult>(null);
// encryptResult 保存加密结果。
const encryptResult = ref<null | SystemSecurityDebugApi.CipherResult>(null);
// decryptResult 保存解密结果。
const decryptResult = ref<null | SystemSecurityDebugApi.CipherResult>(null);

// flowOptions 定义当前模拟的数据方向。
const flowOptions = [
  { label: $t('business.message.frontendRequest'), value: 'request' },
  { label: $t('business.message.backendResponse'), value: 'response' },
] satisfies Array<{ label: string; value: DebugFlowMode }>;

// signatureOptions 定义签名方式选项。
const signatureOptions = [
  { label: 'RSA', value: 'R' },
  { label: 'AES', value: 'A' },
] satisfies Array<{ label: string; value: DebugSignatureType }>;

// cryptoOptions 定义加密方式选项。
const cryptoOptions = [
  { label: 'AES', value: 'A' },
  { label: 'RSA', value: 'R' },
] satisfies Array<{ label: string; value: DebugCryptoType }>;

// frontendSecurityConfigItems 汇总当前构建时注入的前端安全配置状态，只展示是否配置，不展示密钥明文。
const frontendSecurityConfigItems = computed(() => [
  {
    configured: Boolean(import.meta.env.VITE_ADMIN_SECURITY_APP_ID),
    envName: 'VITE_ADMIN_SECURITY_APP_ID',
    label: 'AppID',
    value:
      import.meta.env.VITE_ADMIN_SECURITY_APP_ID ||
      $t('business.message.notConfigured'),
  },
  {
    configured:
      String(import.meta.env.VITE_ADMIN_SIGNATURE_ENABLED || 'true') === 'true',
    envName: 'VITE_ADMIN_SIGNATURE_ENABLED',
    label: $t('business.message.requestSignResponseVerify'),
    value: String(import.meta.env.VITE_ADMIN_SIGNATURE_ENABLED || 'true'),
  },
  {
    configured:
      String(import.meta.env.VITE_ADMIN_CRYPTO_ENABLED || 'true') === 'true',
    envName: 'VITE_ADMIN_CRYPTO_ENABLED',
    label: $t('business.message.requestEncryptResponseDecrypt'),
    value: String(import.meta.env.VITE_ADMIN_CRYPTO_ENABLED || 'true'),
  },
  {
    configured: Boolean(import.meta.env.VITE_ADMIN_SECURITY_AES_KEY),
    envName: 'VITE_ADMIN_SECURITY_AES_KEY',
    label: 'AES KEY',
    value: import.meta.env.VITE_ADMIN_SECURITY_AES_KEY
      ? $t('business.message.configured')
      : $t('business.message.notConfigured'),
  },
  {
    configured: Boolean(import.meta.env.VITE_ADMIN_SECURITY_AES_IV),
    envName: 'VITE_ADMIN_SECURITY_AES_IV',
    label: 'AES IV',
    value: import.meta.env.VITE_ADMIN_SECURITY_AES_IV
      ? $t('business.message.configured')
      : $t('business.message.notConfigured'),
  },
  {
    configured: Boolean(import.meta.env.VITE_ADMIN_SIGNATURE_PRIVATE_KEY),
    envName: 'VITE_ADMIN_SIGNATURE_PRIVATE_KEY',
    label: $t('business.message.requestSignPrivateKey'),
    value: import.meta.env.VITE_ADMIN_SIGNATURE_PRIVATE_KEY
      ? $t('business.message.configured')
      : $t('business.message.notConfigured'),
  },
  {
    configured: Boolean(
      import.meta.env.VITE_ADMIN_SIGNATURE_PUBLIC_KEY ||
      import.meta.env.VITE_ADMIN_SECURITY_RSA_PUBLIC_KEY_SERVER,
    ),
    envName: 'VITE_ADMIN_SIGNATURE_PUBLIC_KEY',
    label: $t('business.message.responseVerifyPublicKey'),
    value:
      import.meta.env.VITE_ADMIN_SIGNATURE_PUBLIC_KEY ||
      import.meta.env.VITE_ADMIN_SECURITY_RSA_PUBLIC_KEY_SERVER
        ? $t('business.message.configured')
        : $t('business.message.notConfigured'),
  },
]);

// cipherInputText 保存字段加解密调试输入。
const cipherInputText = computed({
  get() {
    return fieldCipherPayloadText.value;
  },
  set(value: string) {
    fieldCipherPayloadText.value = value;
  },
});

// normalizedSignFields 把签名字段输入拆分为数组。
const normalizedSignFields = computed(() =>
  signFieldsText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

// effectiveSignFields 返回本次签名或验签实际使用的字段列表。
const effectiveSignFields = computed(() =>
  normalizedSignFields.value.length > 0 ? normalizedSignFields.value : ['*'],
);

// normalizedCipherFields 把加解密字段输入拆分为数组。
const normalizedCipherFields = computed(() =>
  cipherFieldsText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

// flowSummaryText 说明当前模式下各按钮真正对应的链路侧。
const flowSummaryText = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.frontendRequestModeDesc')
    : $t('business.message.backendResponseModeDesc'),
);

// currentFlowTitle 返回当前模式中文名称。
const currentFlowTitle = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.frontendRequest')
    : $t('business.message.backendResponse'),
);

// currentSignActionText 返回当前签名按钮对应的真实执行侧。
const currentSignActionText = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.runFrontendRequestSign')
    : $t('business.message.runBackendResponseSign'),
);

// currentVerifyActionText 返回当前验签按钮对应的真实执行侧。
const currentVerifyActionText = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.runFrontendRequestVerify')
    : $t('business.message.runBackendResponseVerify'),
);

// currentEncryptActionText 返回当前加密按钮对应的真实执行侧。
const currentEncryptActionText = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.runFrontendRequestEncrypt')
    : $t('business.message.runBackendResponseEncrypt'),
);

// currentDecryptActionText 返回当前解密按钮对应的真实执行侧。
const currentDecryptActionText = computed(() =>
  flowMode.value === 'request'
    ? $t('business.message.runFrontendRequestDecrypt')
    : $t('business.message.runBackendResponseDecrypt'),
);

// executeAction 封装统一执行逻辑，并把错误文本直接反馈到页面。
async function executeAction(action: () => Promise<void>) {
  if (!appId.value.trim()) {
    message.warning($t('business.message.appidRequired'));
    return false;
  }
  busy.value = true;
  try {
    await action();
    return true;
  } catch (error: any) {
    message.error(
      resolveBackendMessage(
        error?.message,
        'business.message.debugExecuteFailed',
      ),
    );
    return false;
  } finally {
    busy.value = false;
  }
}

// ensureCipherFields 确保用户已填写字段配置。
function ensureCipherFields() {
  if (normalizedCipherFields.value.length === 0) {
    throw new Error($t('business.message.cipherFieldsRequired'));
  }
}

// resolveActionTraceId 获取当前动作应该使用的 TraceId，并同步回表单。
function resolveActionTraceId() {
  const current = traceId.value.trim() || createTraceId();
  traceId.value = current;
  return current;
}

function createSignatureTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

// resolveActionTimestamp 获取当前动作应该使用的 X-Timestamp，并同步回表单。
function resolveActionTimestamp() {
  const current = signatureTimestamp.value.trim() || createSignatureTimestamp();
  signatureTimestamp.value = current;
  return current;
}

// resolveResultTraceId 从调试结果中读取真实参与签名的 X-Trace-Id。
function resolveResultTraceId(
  result:
    | null
    | SystemSecurityDebugApi.SignResult
    | SystemSecurityDebugApi.VerifyResult,
) {
  return String(result?.traceId || result?.requestId || '').trim();
}

// resolveResultTimestamp 从调试结果中读取真实参与签名的 X-Timestamp。
function resolveResultTimestamp(
  result:
    | null
    | SystemSecurityDebugApi.SignResult
    | SystemSecurityDebugApi.VerifyResult,
) {
  return String(result?.timestamp || '').trim();
}

// getAESConfig 读取前端本地 AES 配置。
function getAESConfig() {
  const key = import.meta.env.VITE_ADMIN_SECURITY_AES_KEY || '';
  const iv = import.meta.env.VITE_ADMIN_SECURITY_AES_IV || '';
  if (!key || !iv) {
    throw new Error($t('business.message.missingFrontendAesConfig'));
  }
  return { iv, key };
}

// getRequestPrivateKey 读取前端请求签名使用的用户私钥。
function getRequestPrivateKey() {
  const pem = import.meta.env.VITE_ADMIN_SIGNATURE_PRIVATE_KEY || '';
  if (!pem) {
    throw new Error($t('business.message.missingRequestPrivateKey'));
  }
  return pem;
}

// getResponseVerifyPublicKey 读取后端响应验签使用的服务端公钥。
function getResponseVerifyPublicKey() {
  const pem =
    import.meta.env.VITE_ADMIN_SIGNATURE_PUBLIC_KEY ||
    import.meta.env.VITE_ADMIN_SECURITY_RSA_PUBLIC_KEY_SERVER ||
    '';
  if (!pem) {
    throw new Error($t('business.message.missingResponsePublicKey'));
  }
  return pem;
}

// parseJSONObjectText 把输入文本解析成 JSON 对象。
function parseJSONObjectText(text: string) {
  const parsed = tryParseJson(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error($t('business.message.enterJsonObjectText'));
  }
  return parsed as Record<string, any>;
}

// cloneJSONObject 克隆 JSON 对象，避免原地修改输入对象。
function cloneJSONObject(data: Record<string, any>) {
  return structuredClone(data);
}

// encodeCipherHeaderText 生成与 X-Cipher 完全兼容的头值。
function encodeCipherHeaderText(fields: string[]) {
  const normalized = [
    ...new Set(fields.map((item) => item.trim()).filter(Boolean)),
  ];
  if (normalized.length === 0) {
    return '';
  }
  if (normalized.some((field) => field.toLowerCase() === 'cipher')) {
    throw new Error($t('business.message.wholeBodyCipherForbidden'));
  }
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(normalized)));
}

// splitFieldPath 拆分 user.buildMFAURL 这类字段路径。
function splitFieldPath(fieldPath: string) {
  return String(fieldPath || '')
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean);
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
    return false;
  }
  let current: Record<string, any> = data;
  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      current[part] = value;
      return true;
    }
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return false;
    }
    current = next as Record<string, any>;
  }
  return false;
}

// signTextLocally 在浏览器端模拟前端请求签名。
async function signTextLocally(text: string, type: DebugSignatureType) {
  if (type === 'A') {
    const { iv, key } = getAESConfig();
    return aesCbcSign(text, key, iv);
  }
  return rsaPkcs1Sign(text, getRequestPrivateKey());
}

// verifyTextLocally 在浏览器端模拟前端收到响应后的本地验签。
async function verifyTextLocally(
  text: string,
  sign: string,
  type: DebugSignatureType,
) {
  if (type === 'A') {
    const { iv, key } = getAESConfig();
    return (await aesCbcSign(text, key, iv)) === sign;
  }
  return rsaPkcs1Verify(text, sign, getResponseVerifyPublicKey());
}

// encryptRequestLocally 在浏览器端模拟前端请求加密。
async function encryptRequestLocally(): Promise<SystemSecurityDebugApi.CipherResult> {
  if (cryptoType.value !== 'A') {
    throw new Error($t('business.message.frontendRequestOnlyAesEncrypt'));
  }
  ensureCipherFields();
  const { iv, key } = getAESConfig();
  const cipherFields = normalizedCipherFields.value;
  const result: SystemSecurityDebugApi.CipherResult = {
    appId: appId.value.trim(),
    cipherFields,
    cipherHeader: encodeCipherHeaderText(cipherFields),
    cryptoType: cryptoType.value,
    payloadText: payloadText.value,
  };
  const payload = parseJSONObjectText(payloadText.value);
  const encryptedPayload = cloneJSONObject(payload);
  for (const field of cipherFields) {
    const fieldPath = String(field || '')
      .replace(CIPHER_JSON_PREFIX, '')
      .trim();
    const current = getNestedFieldValue(encryptedPayload, fieldPath);
    if (current === undefined || current === null || current === '') {
      continue;
    }
    const plainText =
      typeof current === 'string' ? current : JSON.stringify(current);
    const ciphertext = await aesCbcEncrypt(plainText, key, iv);
    setNestedFieldValue(encryptedPayload, fieldPath, ciphertext);
  }
  result.payload = payload;
  result.resultPayload = encryptedPayload;
  result.resultPayloadText = formatJsonText(encryptedPayload);
  return result;
}

// decryptResponseLocally 在浏览器端模拟前端收到响应后的本地解密。
async function decryptResponseLocally(): Promise<SystemSecurityDebugApi.CipherResult> {
  if (cryptoType.value !== 'A') {
    throw new Error($t('business.message.frontendResponseOnlyAesDecrypt'));
  }
  ensureCipherFields();
  const { iv, key } = getAESConfig();
  const cipherFields = normalizedCipherFields.value;
  const result: SystemSecurityDebugApi.CipherResult = {
    appId: appId.value.trim(),
    cipherFields,
    cipherHeader: encodeCipherHeaderText(cipherFields),
    cryptoType: cryptoType.value,
    payloadText: '',
  };
  const payload = parseJSONObjectText(fieldCipherPayloadText.value);
  const decryptedPayload = cloneJSONObject(payload);
  for (const field of cipherFields) {
    const fieldPath = String(field || '')
      .replace(CIPHER_JSON_PREFIX, '')
      .trim();
    const current = getNestedFieldValue(decryptedPayload, fieldPath);
    if (typeof current !== 'string' || !current.trim()) {
      continue;
    }
    const plaintext = await aesCbcDecrypt(
      normalizeCiphertextText(current),
      key,
      iv,
    );
    let nextValue: any = plaintext;
    try {
      nextValue = JSON.parse(plaintext);
    } catch {
      nextValue = plaintext;
    }
    setNestedFieldValue(decryptedPayload, fieldPath, nextValue);
  }
  result.payload = payload;
  result.payloadText = formatJsonText(payload);
  result.resultPayload = decryptedPayload;
  result.resultPayloadText = formatJsonText(decryptedPayload);
  return result;
}

// signRequestLocally 在浏览器端模拟前端请求签名。
async function signRequestLocally(): Promise<SystemSecurityDebugApi.SignResult> {
  const payload = parseJSONObjectText(payloadText.value);
  const currentTraceId = resolveActionTraceId();
  const currentTimestamp = resolveActionTimestamp();
  const signText = buildSignString(
    payload,
    effectiveSignFields.value,
    currentTraceId,
    currentTimestamp,
    appId.value.trim(),
  );
  const sign = await signTextLocally(signText, signatureType.value);
  return {
    appId: appId.value.trim(),
    payload,
    payloadText: formatJsonText(payload),
    requestId: currentTraceId,
    traceId: currentTraceId,
    timestamp: currentTimestamp,
    sign,
    signFields: effectiveSignFields.value,
    signText,
    signatureType: signatureType.value,
  };
}

// verifyResponseLocally 在浏览器端模拟前端收到响应后的验签。
async function verifyResponseLocally(): Promise<SystemSecurityDebugApi.VerifyResult> {
  const currentTraceId = traceId.value.trim();
  if (!currentTraceId) {
    throw new Error($t('business.message.responseTraceIdRequiredForVerify'));
  }
  const currentTimestamp = signatureTimestamp.value.trim();
  if (!currentTimestamp) {
    throw new Error($t('business.message.responseTimestampRequiredForVerify'));
  }
  const currentSign = signValue.value.trim();
  if (!currentSign) {
    throw new Error($t('business.message.signValueRequired'));
  }
  const payload = parseJSONObjectText(payloadText.value);
  const signText = buildSignString(
    payload,
    effectiveSignFields.value,
    currentTraceId,
    currentTimestamp,
    appId.value.trim(),
  );
  return {
    appId: appId.value.trim(),
    payload,
    payloadText: formatJsonText(payload),
    requestId: currentTraceId,
    traceId: currentTraceId,
    timestamp: currentTimestamp,
    sign: currentSign,
    signFields: effectiveSignFields.value,
    signText,
    signatureType: signatureType.value,
    verified: await verifyTextLocally(
      signText,
      currentSign,
      signatureType.value,
    ),
  };
}

// handleSign 根据当前模式执行签名调试。
async function handleSign() {
  return executeAction(async () => {
    signResult.value =
      flowMode.value === 'request'
        ? await signRequestLocally()
        : await debugSecuritySign({
            appId: appId.value.trim(),
            payloadText: payloadText.value,
            requestId: traceId.value.trim() || undefined,
            timestamp: signatureTimestamp.value.trim() || undefined,
            signFields: effectiveSignFields.value,
            signatureType: signatureType.value,
          });
    traceId.value = resolveResultTraceId(signResult.value) || traceId.value;
    signatureTimestamp.value =
      resolveResultTimestamp(signResult.value) || signatureTimestamp.value;
    signValue.value = signResult.value?.sign || '';
    message.success(
      $t('business.message.signDebugCompleted', [currentFlowTitle.value]),
    );
  });
}

// handleVerify 根据当前模式执行验签调试。
async function handleVerify() {
  return executeAction(async () => {
    if (!traceId.value.trim() && signValue.value.trim()) {
      throw new Error($t('business.message.traceIdRequiredForVerify'));
    }
    if (!signatureTimestamp.value.trim() && signValue.value.trim()) {
      throw new Error($t('business.message.timestampRequiredForVerify'));
    }
    verifyResult.value =
      flowMode.value === 'request'
        ? await debugSecurityVerify({
            appId: appId.value.trim(),
            payloadText: payloadText.value,
            requestId: traceId.value.trim() || undefined,
            timestamp: signatureTimestamp.value.trim() || undefined,
            sign: signValue.value.trim(),
            signFields: effectiveSignFields.value,
            signatureType: signatureType.value,
          })
        : await verifyResponseLocally();
    traceId.value = resolveResultTraceId(verifyResult.value) || traceId.value;
    signatureTimestamp.value =
      resolveResultTimestamp(verifyResult.value) || signatureTimestamp.value;
    message.success(
      verifyResult.value?.verified
        ? $t('business.message.verifySucceeded')
        : $t('business.message.verifyFailed'),
    );
  });
}

// handleSignAndVerify 适用于“先签名再立即验签”的常用联调路径。
async function handleSignAndVerify() {
  const signed = await handleSign();
  if (!signed) {
    return;
  }
  await handleVerify();
}

// handleEncrypt 根据当前模式执行加密调试。
async function handleEncrypt() {
  return executeAction(async () => {
    encryptResult.value =
      flowMode.value === 'request'
        ? await encryptRequestLocally()
        : await debugSecurityEncrypt({
            appId: appId.value.trim(),
            cipherFields: normalizedCipherFields.value,
            cryptoType: cryptoType.value,
            payloadText: payloadText.value,
          });
    fieldCipherPayloadText.value = encryptResult.value?.resultPayloadText || '';
    message.success(
      $t('business.message.encryptDebugCompleted', [currentFlowTitle.value]),
    );
  });
}

// handleDecrypt 根据当前模式执行解密调试。
async function handleDecrypt() {
  return executeAction(async () => {
    decryptResult.value =
      flowMode.value === 'request'
        ? await debugSecurityDecrypt({
            appId: appId.value.trim(),
            cipherFields: normalizedCipherFields.value,
            cryptoType: cryptoType.value,
            payloadText: fieldCipherPayloadText.value,
          })
        : await decryptResponseLocally();
    message.success(
      $t('business.message.decryptDebugCompleted', [currentFlowTitle.value]),
    );
  });
}

// normalizeCiphertextText 兼容去掉换行、URL 安全 base64 和缺失 padding 的情况。
function normalizeCiphertextText(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }
  let current = trimmed.replaceAll(/\r?\n/g, '').trim();
  if (
    (current.startsWith('"') && current.endsWith('"')) ||
    (current.startsWith("'") && current.endsWith("'"))
  ) {
    current = current.slice(1, -1).trim();
  }
  if (!/^[\w+/=-]+$/.test(current)) {
    return '';
  }
  current = current.replaceAll('-', '+').replaceAll('_', '/');
  const padding = current.length % 4;
  if (padding !== 0) {
    current = current.padEnd(current.length + (4 - padding), '=');
  }
  return current;
}

// decodeBase64Text 尝试把普通 base64 头值解码为 UTF-8 文本。
function decodeBase64Text(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }
  const normalized = normalizeCiphertextText(trimmed);
  try {
    const bytes = Uint8Array.from(
      atob(normalized),
      (item) => item.codePointAt(0) ?? 0,
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return trimmed;
  }
}

// decodeCipherHeaderText 把 X-Cipher 请求头还原为字段列表。
function decodeCipherHeaderText(cipherHeader: string) {
  const text = String(cipherHeader || '').trim();
  if (!text) {
    return [];
  }
  if (text.toLowerCase() === 'cipher') {
    message.warning($t('business.message.wholeBodyCipherForbidden'));
    return [];
  }
  try {
    const decoded = decodeBase64Text(text);
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [
      ...new Set(
        parsed.map((item) => String(item ?? '').trim()).filter(Boolean),
      ),
    ];
  } catch {
    return [];
  }
}

// parseHeadersFromText 从原始粘贴文本中提取头部键值。
function parseHeadersFromText(text: string) {
  const headers: Record<string, string> = {};
  const raw = String(text || '');

  function parseHeaderLine(line: string) {
    const index = line.indexOf(':');
    if (index <= 0) {
      return null;
    }
    const key = line.slice(0, index).trim();
    if (!/^[A-Z0-9-]+$/i.test(key)) {
      return null;
    }
    const value = line.slice(index + 1).trim();
    return { key: key.toLowerCase(), value };
  }

  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseHeaderLine(line);
    if (parsed) {
      headers[parsed.key] = parsed.value;
    }
  }
  const curlHeaderRegex = /(?:^|\s)-(?:H|header)\s+(["'])([^"']+)\1/g;
  for (const match of raw.matchAll(curlHeaderRegex)) {
    const headerLine = match[2] || '';
    const parsed = parseHeaderLine(headerLine);
    if (parsed) {
      headers[parsed.key] = parsed.value;
    }
  }
  return headers;
}

type PasteSegment = {
  requestText: string;
  responseText: string;
};

function splitPasteSegments(text: string): PasteSegment[] {
  const raw = String(text || '').replaceAll('\r', '');
  const matches = [...raw.matchAll(/(^|\n)\s*curl\b/g)];
  if (matches.length === 0) {
    return [{ requestText: raw.trim(), responseText: '' }];
  }
  const segments: PasteSegment[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = (matches[i]?.index ?? 0) + (matches[i]?.[1]?.length ?? 0);
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]?.index ?? raw.length)
        : raw.length;
    const block = raw.slice(start, end).trim();
    if (!block) {
      continue;
    }
    const respMatch = block.match(/\n\s*HTTP\/\d/i);
    if (typeof respMatch?.index === 'number' && respMatch.index >= 0) {
      const idx = respMatch.index + 1;
      segments.push({
        requestText: block.slice(0, idx).trim(),
        responseText: block.slice(idx).trim(),
      });
      continue;
    }
    segments.push({ requestText: block, responseText: '' });
  }
  return segments.length > 0
    ? segments
    : [{ requestText: raw.trim(), responseText: '' }];
}

const pasteSegments = computed(() => splitPasteSegments(rawPasteText.value));
const pasteSegmentOptions = computed(() =>
  pasteSegments.value.map((segment, index) => {
    const url = extractUrlFromRaw(segment.requestText);
    const method = extractMethodFromRaw(segment.requestText);
    const path = (() => {
      try {
        const base = globalThis.location?.origin || 'http://localhost';
        const parsed = new URL(url, base);
        return parsed.pathname || url;
      } catch {
        return url;
      }
    })();
    return {
      label: $t('business.message.securityPasteSegmentLabel', [
        index + 1,
        method || 'AUTO',
        path || '',
      ]).trim(),
      value: index,
    };
  }),
);

function resolveCurrentSegment() {
  const segments = pasteSegments.value;
  const index = pasteSegmentIndex.value;
  if (segments.length === 0) {
    return { requestText: rawPasteText.value, responseText: '' };
  }
  if (index < 0 || index >= segments.length) {
    pasteSegmentIndex.value = 0;
    return segments[0]!;
  }
  return segments[index]!;
}

// extractJsonTextFromRaw 从 Network 面板文本或 curl 中提取 JSON 片段。
function extractJsonTextFromRaw(text: string) {
  const raw = String(text || '').trim();
  if (!raw) {
    return '';
  }
  const direct = raw;
  try {
    JSON.parse(direct);
    return direct;
  } catch {
    // continue
  }

  function readQuotedValue(source: string, startIndex: number) {
    let index = startIndex;
    while (index < source.length && /\s/.test(source[index] || '')) {
      index += 1;
    }
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      return null;
    }
    index += 1;
    let value = '';
    while (index < source.length) {
      const char = source[index];
      if (char === '\\' && index + 1 < source.length) {
        value += source[index + 1];
        index += 2;
        continue;
      }
      if (char === quote) {
        return value;
      }
      value += char;
      index += 1;
    }
    return null;
  }

  const dataFlagRegex = /(?:^|\s)(?:-d|--data|--data-raw|--data-binary)\s+/g;
  for (const match of raw.matchAll(dataFlagRegex)) {
    const startIndex = (match.index ?? -1) + match[0].length;
    if (startIndex < 0) {
      continue;
    }
    const candidate = readQuotedValue(raw, startIndex);
    if (!candidate) {
      continue;
    }
    const trimmed = candidate.trim();
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // continue
    }
  }
  const left = raw.indexOf('{');
  const right = raw.lastIndexOf('}');
  if (left !== -1 && right > left) {
    const candidate = raw.slice(left, right + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return candidate;
    }
  }
  return '';
}

// tryParseJson 尝试解析 JSON；失败时返回 undefined，方便做兜底分支。
function tryParseJson(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

// formatJsonText 按统一缩进格式输出 JSON，方便直接复制或继续编辑。
function formatJsonText(value: any) {
  return JSON.stringify(value, null, 2);
}

// extractUrlFromRaw 从 curl 或 Network 文本里提取请求 URL。
function extractUrlFromRaw(text: string) {
  const raw = String(text || '').trim();
  if (!raw) {
    return '';
  }
  const curlUrlRegex =
    /(?:^|\s)curl(?:\s+--location)?(?:\s+-X\s+\w+)?\s+(?:(["'])(https?:\/\/[^"']+)\1|(https?:\/\/\S+))/;
  const curlMatch = raw.match(curlUrlRegex);
  const curlUrl = String(curlMatch?.[2] || curlMatch?.[3] || '').trim();
  if (curlUrl) {
    return curlUrl;
  }
  const urlMatch = raw.match(/https?:\/\/[^\s'"]+/);
  return String(urlMatch?.[0] || '').trim();
}

// extractMethodFromRaw 从原始粘贴文本中提取 HTTP Method。
function extractMethodFromRaw(text: string) {
  const raw = String(text || '');
  const requestMethodMatch = raw.match(
    /Request Method:\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/i,
  );
  if (requestMethodMatch?.[1]) {
    return requestMethodMatch[1].toUpperCase();
  }
  const curlMethodMatch = raw.match(
    /(?:^|\s)(?:-X|--request)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)(?:\s|$)/i,
  );
  if (curlMethodMatch?.[1]) {
    return curlMethodMatch[1].toUpperCase();
  }
  const startLineMatch = raw.match(
    /(?:^|\n)(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\S+/i,
  );
  if (startLineMatch?.[1]) {
    return startLineMatch[1].toUpperCase();
  }
  if (/(?:^|\s)(?:-d|--data|--data-raw|--data-binary)\s+/i.test(raw)) {
    return 'POST';
  }
  if (/(?:^|\s)curl\b/i.test(raw)) {
    return 'GET';
  }
  return '';
}

// parseQueryParamsFromUrl 提取 GET 场景 URL 上的 query 参数和 sign。
function parseQueryParamsFromUrl(urlText: string) {
  const text = String(urlText || '').trim();
  if (!text) {
    return { params: {} as Record<string, any>, sign: '' };
  }
  try {
    const base = globalThis.location?.origin || 'http://localhost';
    const url = new URL(text, base);
    const params: Record<string, any> = {};
    let sign = '';
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'sign') {
        sign = value;
        continue;
      }
      const current = params[key];
      if (current === undefined) {
        params[key] = value;
        continue;
      }
      if (Array.isArray(current)) {
        current.push(value);
        continue;
      }
      params[key] = [current, value];
    }
    return { params, sign };
  } catch {
    return { params: {} as Record<string, any>, sign: '' };
  }
}

// extractSignFromPayload 尝试从当前明文 JSON 中提取 sign 字段。
function extractSignFromPayload() {
  const parsed = tryParseJson(payloadText.value);
  const sign = parsed?.sign;
  if (typeof sign === 'string' && sign.trim()) {
    signValue.value = sign.trim();
    return true;
  }
  return false;
}

// applyRoutePolicyByRaw 按粘贴内容里的 method/url 自动回填签名和加密字段。
function applyRoutePolicyByRaw(text: string, mode: DebugFlowMode) {
  const url = extractUrlFromRaw(text);
  const method = extractMethodFromRaw(text) || 'POST';
  const routeRule = resolveRouteSecurityRule(method, url);
  if (!routeRule) {
    return;
  }
  const policy = resolvePolicyForAlias(routeRule.alias);
  const signFields =
    mode === 'request' ? policy.requestSign : policy.responseSign;
  if (signFields && signFields.length > 0) {
    signFieldsText.value = signFields.join(',');
  }
  const cipherFields =
    mode === 'request' ? policy.requestCipher : policy.responseCipher;
  if (cipherFields && cipherFields.length > 0) {
    cipherFieldsText.value = cipherFields.join(',');
  }
}

// applyHeadersToForm 把复制文本中的安全头回填到调试表单。
function applyHeadersToForm(headers: Record<string, string>) {
  const appIdHeader = headers['x-app-id'] || '';
  if (appIdHeader) {
    const decoded = decodeBase64Text(appIdHeader);
    appId.value = decoded || appId.value;
  }
  const traceIdHeader = headers['x-trace-id'] || '';
  if (traceIdHeader) {
    traceId.value = String(traceIdHeader).trim();
  }
  const timestampHeader = headers['x-timestamp'] || '';
  if (timestampHeader) {
    signatureTimestamp.value = String(timestampHeader).trim();
  }
  const signatureHeader = headers['x-signature'] || '';
  if (signatureHeader) {
    signatureType.value = resolveSignatureType(signatureHeader);
  }
  const cryptoHeader = headers['x-crypto'] || '';
  if (cryptoHeader) {
    const type = String(cryptoHeader).trim().toUpperCase();
    if (type === 'A' || type === 'R') {
      cryptoType.value = type;
    }
  }
  const cipherHeader = headers['x-cipher'] || '';
  if (cipherHeader) {
    const fields = decodeCipherHeaderText(cipherHeader);
    if (fields.length > 0) {
      cipherFieldsText.value = fields.join(',');
    }
  }
}

// resolveResponsePayloadTarget 把标准响应包裹中的 data 提取出来，便于直接做解密与验签。
function resolveResponsePayloadTarget(parsed: unknown) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }
  const payload = parsed as Record<string, unknown>;
  const data = payload.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }
  return parsed;
}

// parseAsRequest 把粘贴内容识别为前端请求，并自动回填表单。
function parseAsRequest() {
  flowMode.value = 'request';
  traceId.value = '';
  signatureTimestamp.value = '';
  signValue.value = '';
  fieldCipherPayloadText.value = '';
  signResult.value = null;
  verifyResult.value = null;
  encryptResult.value = null;
  decryptResult.value = null;
  const segment = resolveCurrentSegment();
  const sourceText = segment.requestText || rawPasteText.value;
  applyRoutePolicyByRaw(sourceText, 'request');
  const headers = parseHeadersFromText(sourceText);
  applyHeadersToForm(headers);
  const jsonText = extractJsonTextFromRaw(sourceText);
  const parsed = tryParseJson(jsonText);
  if (parsed && typeof parsed === 'object') {
    const payload = parsed as Record<string, unknown>;
    const sign = payload.sign;
    if (typeof sign === 'string' && sign.trim()) {
      signValue.value = sign.trim();
      delete payload.sign;
    }
    payloadText.value = formatJsonText(payload);
    fieldCipherPayloadText.value = formatJsonText(payload);
    return;
  }
  const urlText = extractUrlFromRaw(sourceText);
  const { params, sign } = parseQueryParamsFromUrl(urlText);
  if (sign) {
    signValue.value = sign.trim();
  }
  const hasParams = Object.keys(params).length > 0;
  if (hasParams || sign) {
    payloadText.value = formatJsonText(hasParams ? params : {});
  }
}

// parseAsResponse 把粘贴内容识别为后端响应，并自动回填表单。
function parseAsResponse() {
  flowMode.value = 'response';
  traceId.value = '';
  signatureTimestamp.value = '';
  signValue.value = '';
  fieldCipherPayloadText.value = '';
  signResult.value = null;
  verifyResult.value = null;
  encryptResult.value = null;
  decryptResult.value = null;
  const segment = resolveCurrentSegment();
  const requestText = segment.requestText || rawPasteText.value;
  const responseText = segment.responseText || rawPasteText.value;
  applyRoutePolicyByRaw(requestText, 'response');
  const headers = parseHeadersFromText(responseText);
  applyHeadersToForm(headers);
  const jsonText = extractJsonTextFromRaw(responseText);
  const parsed = tryParseJson(jsonText);
  if (parsed && typeof parsed === 'object') {
    const target = resolveResponsePayloadTarget(parsed);
    fieldCipherPayloadText.value = formatJsonText(target);
    payloadText.value = formatJsonText(target);
    extractSignFromPayload();
  }
}

function clearInputs() {
  rawPasteText.value = '';
  traceId.value = '';
  signatureTimestamp.value = '';
  signValue.value = '';
  fieldCipherPayloadText.value = '';
  payloadText.value = '{}';
  signResult.value = null;
  verifyResult.value = null;
  encryptResult.value = null;
  decryptResult.value = null;
  pasteSegmentIndex.value = 0;
}

// injectSignIntoPayload 把当前 sign 值写回 payload，便于继续做字段级加密模拟。
function injectSignIntoPayload() {
  const currentSign = signValue.value.trim() || signResult.value?.sign || '';
  if (!currentSign) {
    message.warning($t('business.message.signValueUnavailable'));
    return;
  }
  const payload = parseJSONObjectText(payloadText.value);
  payload.sign = currentSign;
  payloadText.value = formatJsonText(payload);
  message.success($t('business.message.signWrittenToPlainJson'));
}

// handleDecryptToPayload 先执行解密，再把结果自动回填到明文区域。
async function handleDecryptToPayload() {
  const ok = await handleDecrypt();
  if (!ok) {
    return;
  }
  const resultText =
    decryptResult.value?.resultPayloadText ||
    decryptResult.value?.payloadText ||
    '';
  if (!resultText) {
    return;
  }
  const parsed = tryParseJson(resultText);
  if (parsed && typeof parsed === 'object') {
    const target =
      flowMode.value === 'response'
        ? resolveResponsePayloadTarget(parsed)
        : parsed;
    payloadText.value = formatJsonText(target);
    extractSignFromPayload();
    return;
  }
  payloadText.value = resultText;
}

// handleDecryptAndVerify 适用于“先解密再验签”的常用联调路径。
async function handleDecryptAndVerify() {
  await handleDecryptToPayload();
  if (!signValue.value.trim()) {
    extractSignFromPayload();
  }
  if (!signValue.value.trim()) {
    message.warning($t('business.message.signExtractFailedFromDecrypt'));
    return;
  }
  await handleVerify();
}

// fillVerifyFromSign 使用最近一次签名结果自动回填验签参数。
function fillVerifyFromSign() {
  if (!signResult.value) {
    message.warning($t('business.message.runSignDebugFirst'));
    return;
  }
  payloadText.value = signResult.value.payloadText;
  traceId.value = resolveResultTraceId(signResult.value);
  signatureTimestamp.value = resolveResultTimestamp(signResult.value);
  signValue.value = signResult.value.sign;
  signFieldsText.value = signResult.value.signFields.join(',');
}

// fillDecryptFromEncrypt 使用最近一次加密结果自动回填解密参数。
function fillDecryptFromEncrypt() {
  if (!encryptResult.value) {
    message.warning($t('business.message.runEncryptDebugFirst'));
    return;
  }
  cipherFieldsText.value = encryptResult.value.cipherFields.join(',');
  fieldCipherPayloadText.value = encryptResult.value.resultPayloadText || '';
}
</script>

<template>
  <Page auto-content-height>
    <div class="security-debug-page-stack">
      <Card size="small" :title="$t('business.message.securityFrontendConfig')">
        <div class="security-debug-section">
          <Alert
            :message="$t('business.message.securityFrontendConfigDesc')"
            show-icon
            type="info"
          />
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="item in frontendSecurityConfigItems"
              :key="item.envName"
              class="border-[var(--vben-border-color)]/80 rounded border px-3 py-2"
            >
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-[var(--vben-text-color)]">
                  {{ item.label }}
                </span>
                <Tag :color="item.configured ? 'success' : 'warning'">
                  {{
                    item.configured
                      ? $t('business.message.ready')
                      : $t('business.message.notConfigured')
                  }}
                </Tag>
              </div>
              <div class="text-xs text-[var(--vben-text-color-secondary)]">
                {{ item.envName }}
              </div>
              <div class="mt-1 text-sm text-[var(--vben-text-color)]">
                {{ item.value }}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card size="small" :title="$t('business.message.securityPasteParse')">
        <div class="security-debug-section">
          <Alert
            :message="$t('business.message.securityPasteParseDesc')"
            show-icon
            type="info"
          />
          <div class="grid gap-3">
            <Input.TextArea
              v-model:value="rawPasteText"
              id="security-debug-raw-paste"
              name="security-debug-raw-paste"
              autocomplete="off"
              :rows="6"
              :placeholder="$t('business.message.securityPastePlaceholder')"
            />
            <Select
              v-if="pasteSegments.length > 1"
              v-model:value="pasteSegmentIndex"
              :options="pasteSegmentOptions"
              :placeholder="$t('business.message.securitySegmentPlaceholder')"
            />
            <Space wrap>
              <VbenButton
                :disabled="busy"
                type="primary"
                @click="parseAsRequest"
              >
                {{ $t('business.message.parseAsRequest') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="parseAsResponse">
                {{ $t('business.message.parseAsResponse') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="handleDecryptToPayload">
                {{ $t('business.message.decryptFillPlain') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="handleDecryptAndVerify">
                {{ $t('business.message.decryptAndVerify') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="clearInputs">
                {{ $t('business.message.clearAll') }}
              </VbenButton>
            </Space>
          </div>
        </div>
      </Card>

      <Card size="small" :title="$t('business.message.debugParams')">
        <div class="security-debug-section">
          <Alert :message="flowSummaryText" show-icon type="info" />
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Select
              v-model:value="flowMode"
              :options="flowOptions"
              :placeholder="$t('business.message.selectDebugDirection')"
            />
            <Input
              v-model:value="appId"
              id="security-debug-app-id"
              name="security-debug-app-id"
              autocomplete="off"
              :placeholder="$t('business.message.enterAppId')"
            />
            <Input
              v-model:value="traceId"
              id="security-debug-trace-id"
              name="security-debug-trace-id"
              autocomplete="off"
              :placeholder="$t('business.message.optionalTraceId')"
            />
            <Input
              v-model:value="signatureTimestamp"
              id="security-debug-signature-timestamp"
              name="security-debug-signature-timestamp"
              autocomplete="off"
              :placeholder="$t('business.message.optionalTimestamp')"
            />
            <Select
              v-model:value="signatureType"
              :options="signatureOptions"
              :placeholder="$t('business.message.selectSignatureType')"
            />
            <Select
              v-model:value="cryptoType"
              :options="cryptoOptions"
              :placeholder="$t('business.message.selectCryptoType')"
            />
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <Input
              v-model:value="signFieldsText"
              id="security-debug-sign-fields"
              name="security-debug-sign-fields"
              autocomplete="off"
              :placeholder="$t('business.message.signFieldsPlaceholder')"
            />
            <Input
              v-model:value="cipherFieldsText"
              id="security-debug-cipher-fields"
              name="security-debug-cipher-fields"
              autocomplete="off"
              :placeholder="$t('business.message.cipherFieldsPlaceholder')"
            />
          </div>
        </div>
      </Card>

      <div class="grid gap-2 xl:grid-cols-2">
        <Card size="small" :title="$t('business.message.signVerifyDebug')">
          <div class="grid gap-3">
            <Input.TextArea
              v-model:value="payloadText"
              id="security-debug-payload"
              name="security-debug-payload"
              autocomplete="off"
              :rows="8"
              :placeholder="$t('business.message.payloadJsonPlaceholder')"
            />
            <InputPassword
              v-model:value="signValue"
              id="security-debug-signature-value"
              name="security-debug-signature-value"
              autocomplete="off"
              :placeholder="$t('business.message.signValuePlaceholder')"
            />
            <Space wrap>
              <VbenButton
                v-access="
                  asActionPermission(
                    SYSTEM_ACTION_PERMISSION_CODES.SECURITY_DEBUG_SIGN,
                  )
                "
                :disabled="busy"
                type="primary"
                @click="handleSign"
              >
                {{ currentSignActionText }}
              </VbenButton>
              <VbenButton
                v-access="
                  asActionPermission(
                    SYSTEM_ACTION_PERMISSION_CODES.SECURITY_DEBUG_VERIFY,
                  )
                "
                :disabled="busy"
                @click="handleVerify"
              >
                {{ currentVerifyActionText }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="handleSignAndVerify">
                {{ $t('business.message.signAndVerify') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="fillVerifyFromSign">
                {{ $t('business.message.fillFromSignResult') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="injectSignIntoPayload">
                {{ $t('business.message.injectSignToPayload') }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="extractSignFromPayload">
                {{ $t('business.message.extractSignFromPayload') }}
              </VbenButton>
            </Space>
            <Input.TextArea
              id="security-debug-sign-result"
              name="security-debug-sign-result"
              autocomplete="off"
              :rows="8"
              :value="JSON.stringify(signResult || verifyResult || {}, null, 2)"
              readonly
            />
          </div>
        </Card>

        <Card size="small" :title="$t('business.message.encryptDecryptDebug')">
          <div class="grid gap-3">
            <Input.TextArea
              v-model:value="cipherInputText"
              id="security-debug-cipher-input"
              name="security-debug-cipher-input"
              autocomplete="off"
              :rows="8"
              :placeholder="$t('business.message.cipherInputPlaceholder')"
            />
            <Space wrap>
              <VbenButton
                v-access="
                  asActionPermission(
                    SYSTEM_ACTION_PERMISSION_CODES.SECURITY_DEBUG_ENCRYPT,
                  )
                "
                :disabled="busy"
                type="primary"
                @click="handleEncrypt"
              >
                {{ currentEncryptActionText }}
              </VbenButton>
              <VbenButton
                v-access="
                  asActionPermission(
                    SYSTEM_ACTION_PERMISSION_CODES.SECURITY_DEBUG_DECRYPT,
                  )
                "
                :disabled="busy"
                @click="handleDecrypt"
              >
                {{ currentDecryptActionText }}
              </VbenButton>
              <VbenButton :disabled="busy" @click="fillDecryptFromEncrypt">
                {{ $t('business.message.fillFromEncryptResult') }}
              </VbenButton>
            </Space>
            <Input.TextArea
              id="security-debug-cipher-result"
              name="security-debug-cipher-result"
              autocomplete="off"
              :rows="8"
              :value="
                JSON.stringify(encryptResult || decryptResult || {}, null, 2)
              "
              readonly
            />
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.security-debug-page-stack {
  display: grid;
  gap: 12px;
}

.security-debug-section {
  display: grid;
  gap: 14px;
}
</style>
