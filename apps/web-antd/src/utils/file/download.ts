import { $t } from '#/locales';

// downloadBlobFile 把后端返回的 Blob 对象保存为本地文件。
export function downloadBlobFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// ensureDownloadBlobSuccess 校验下载返回的 Blob 是否实际为后端错误 JSON，避免把业务错误内容落成本地文件。
export async function ensureDownloadBlobSuccess(
  blob: Blob,
  fallback = $t('business.message.downloadFailed'),
) {
  const errorMessage = await detectBlobErrorMessage(blob);
  if (errorMessage) {
    throw new Error(errorMessage || fallback);
  }
  return blob;
}

// resolveRequestErrorMessage 解析下载/上传场景里的错误对象，避免直接显示 `[object Blob]`。
export async function resolveRequestErrorMessage(
  error: unknown,
  fallback = $t('business.message.requestFailed'),
) {
  if (!error) {
    return fallback;
  }
  if (error instanceof Blob) {
    return await resolveBlobErrorMessage(error, fallback);
  }
  if (error instanceof Error) {
    if (error.message === '[object Blob]') {
      return fallback;
    }
    return error.message || fallback;
  }
  if (typeof error === 'string') {
    return error.trim() || fallback;
  }
  if (typeof error === 'object') {
    const message = extractMessageFromObject(error);
    if (message) {
      return message;
    }
  }
  return fallback;
}

async function resolveBlobErrorMessage(blob: Blob, fallback: string) {
  try {
    const blobText = await blob.text();
    const text = blobText.trim();
    if (!text) {
      return fallback;
    }
    const parsed = safeParseJSON(text);
    if (parsed) {
      const message = extractMessageFromObject(parsed);
      if (message) {
        return message;
      }
    }
    return text;
  } catch {
    return fallback;
  }
}

async function detectBlobErrorMessage(blob: Blob) {
  const contentType = String(blob.type || '').toLowerCase();
  if (isJSONContentType(contentType)) {
    return await resolveBlobErrorMessage(blob, '');
  }
  const previewText = await resolveBlobPreviewText(blob);
  const trimmedPreview = previewText.trim();
  if (
    !trimmedPreview ||
    (!trimmedPreview.startsWith('{') && !trimmedPreview.startsWith('['))
  ) {
    return '';
  }
  const parsed = safeParseJSON(trimmedPreview);
  if (!parsed) {
    return '';
  }
  return extractMessageFromObject(parsed) || trimmedPreview;
}

async function resolveBlobPreviewText(blob: Blob) {
  try {
    return await blob.slice(0, 4096).text();
  } catch {
    return '';
  }
}

function isJSONContentType(contentType: string) {
  return contentType.includes('/json') || contentType.includes('+json');
}

function extractMessageFromObject(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const source = value as Record<string, unknown>;
  const directKeys = ['message', 'msg', 'error', 'err'];
  for (const key of directKeys) {
    const text = normalizeMessageValue(source[key]);
    if (text) {
      return text;
    }
  }
  const nestedKeys = ['data', 'response'];
  for (const key of nestedKeys) {
    const nested = extractMessageFromObject(source[key]);
    if (nested) {
      return nested;
    }
  }
  return '';
}

function normalizeMessageValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const text = value.trim();
  if (!text || text === '[object Blob]') {
    return '';
  }
  return text;
}

function safeParseJSON(text: string): null | Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
