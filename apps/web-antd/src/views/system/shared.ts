import { $t, $te } from '#/locales';

// resolveBackendMessage 优先翻译后端返回的多语言 key，否则展示原始消息或本地兜底文案。
export function resolveBackendMessage(
  message: string | undefined,
  fallbackKey: string,
) {
  const text = String(message || '').trim();
  if (!text) {
    return $t(fallbackKey);
  }
  return $te(text) ? $t(text) : text;
}
