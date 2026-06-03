// TRACE_ID_HEADER 表示前后端统一约定的请求追踪头名称。
export const TRACE_ID_HEADER = 'X-Trace-Id';

// SPAN_ID_HEADER 表示后端可选回传的服务端 span 头名称。
export const SPAN_ID_HEADER = 'X-Span-Id';

// TRACEPARENT_HEADER 表示 W3C Trace Context 标准链路头名称。
export const TRACEPARENT_HEADER = 'traceparent';

// TRACE_ID_LENGTH 表示标准 OpenTelemetry trace_id 的十六进制长度。
const TRACE_ID_LENGTH = 32;

// SPAN_ID_LENGTH 表示标准 OpenTelemetry span_id 的十六进制长度。
const SPAN_ID_LENGTH = 16;

// TRACE_ID_UUID_PATTERN 用于判断浏览器生成的 UUID v4 是否可转换为标准 trace_id。
const TRACE_ID_UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

// TRACE_ID_HEX_PATTERN 用于判断字符串是否已经是标准 32 位十六进制 trace_id。
const TRACE_ID_HEX_PATTERN = /^[\da-f]{32}$/i;

// getRandomBytes 生成安全随机字节；极老环境无 crypto 时回退 Math.random，只用于本地调试兜底。
function getRandomBytes(size: number) {
  const bytes = new Uint8Array(size);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let index = 0; index < size; index++) {
    bytes[index] = Math.trunc(Math.random() * 256);
  }
  return bytes;
}

// createHexTraceId 创建标准 32 位十六进制 trace_id，保证后端可直接接入 OpenTelemetry。
function createHexTraceId() {
  const bytes = getRandomBytes(16);
  return [...bytes].map((item) => item.toString(16).padStart(2, '0')).join('');
}

// createSpanId 创建标准 16 位十六进制 span_id，用于浏览器侧 traceparent 父级片段。
function createSpanId() {
  const bytes = getRandomBytes(8);
  return [...bytes].map((item) => item.toString(16).padStart(2, '0')).join('');
}

// normalizeTraceId 把 UUID 或大小写混用的 trace_id 统一成后端日志使用的 32 位小写十六进制格式。
export function normalizeTraceId(raw?: null | string) {
  const traceId = String(raw || '').trim();
  if (!traceId) {
    return '';
  }
  if (TRACE_ID_HEX_PATTERN.test(traceId)) {
    return traceId.toLowerCase();
  }
  if (TRACE_ID_UUID_PATTERN.test(traceId)) {
    return traceId.replaceAll('-', '').toLowerCase();
  }
  return '';
}

// createTraceId 创建前端请求 trace_id；优先使用 crypto.randomUUID，再归一为后端可识别的标准格式。
export function createTraceId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  const normalized = normalizeTraceId(uuid);
  if (normalized.length === TRACE_ID_LENGTH) {
    return normalized;
  }
  return createHexTraceId();
}

// createTraceparent 基于 trace_id 创建 W3C traceparent，方便后端 OTel 优先继承标准链路头。
export function createTraceparent(rawTraceId?: null | string) {
  const traceId = normalizeTraceId(rawTraceId);
  if (traceId.length !== TRACE_ID_LENGTH) {
    return '';
  }
  const spanId = createSpanId();
  if (spanId.length !== SPAN_ID_LENGTH) {
    return '';
  }
  return `00-${traceId}-${spanId}-01`;
}

// readHeaderValue 从 headers 中读取大小写不敏感的响应头或请求头值。
function readHeaderValue(headers: any, key: string) {
  if (!headers) {
    return '';
  }
  const direct =
    headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()];
  if (direct) {
    return String(direct).trim();
  }
  if (typeof headers.get === 'function') {
    return String(
      headers.get(key) || headers.get(key.toLowerCase()) || '',
    ).trim();
  }
  return '';
}

// extractResponseTraceId 从错误对象、响应头和响应体中提取最终 trace_id。
export function extractResponseTraceId(error: any) {
  const response = error?.response;
  const headerTraceId = readHeaderValue(response?.headers, TRACE_ID_HEADER);
  const bodyTraceId = String(
    response?.data?.traceId || response?.data?.trace_id || '',
  ).trim();
  const requestTraceId = readHeaderValue(
    error?.config?.headers || response?.config?.headers,
    TRACE_ID_HEADER,
  );
  return normalizeTraceId(headerTraceId || bodyTraceId || requestTraceId);
}

// formatTraceErrorMessage 拼接全局错误提示，确保用户反馈截图里能直接带上可检索的 trace_id。
export function formatTraceErrorMessage(message: string, traceId?: string) {
  const cleanMessage = String(message || '').trim();
  const cleanTraceId = normalizeTraceId(traceId);
  if (!cleanTraceId) {
    return cleanMessage;
  }
  return cleanMessage
    ? `${cleanMessage}（Trace ID：${cleanTraceId}）`
    : `Trace ID：${cleanTraceId}`;
}
