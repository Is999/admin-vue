// 消息内容允许的富文本标签，提交与详情展示共用同一套白名单。
const MESSAGE_CONTENT_ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
]);

const SAFE_URL_PATTERN = /^(?:https?:|mailto:|\/)/i;

function hasDOM() {
  return typeof document !== 'undefined';
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasHtmlTag(text: string) {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function sanitizeStyle(value: string) {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter((item) => {
      const [name, ...rest] = item.split(':');
      const normalizedName = String(name || '')
        .trim()
        .toLowerCase();
      const normalizedValue = rest.join(':').trim();
      if (
        !normalizedValue ||
        /expression|javascript:|url\(/i.test(normalizedValue)
      ) {
        return false;
      }
      if (normalizedName === 'text-align') {
        return /^(center|justify|left|right)$/i.test(normalizedValue);
      }
      if (normalizedName === 'color' || normalizedName === 'background-color') {
        return /^(#[\da-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\)|[a-z]+)$/i.test(
          normalizedValue,
        );
      }
      return false;
    })
    .join('; ');
}

function cleanElement(element: Element) {
  const tagName = element.tagName.toLowerCase();
  if (!MESSAGE_CONTENT_ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(document.createTextNode(element.textContent || ''));
    return;
  }

  for (const attr of element.attributes) {
    const name = attr.name.toLowerCase();
    const value = attr.value || '';
    const isEvent = name.startsWith('on');
    const isLinkAttr = tagName === 'a' && name === 'href';
    const isImageAttr = tagName === 'img' && name === 'src';
    const isSafeUrl = SAFE_URL_PATTERN.test(value);
    const isTextAttr = ['alt', 'title'].includes(name);
    const isStyle = name === 'style';

    if (isEvent) {
      element.removeAttribute(attr.name);
      continue;
    }
    if ((isLinkAttr || isImageAttr) && isSafeUrl) {
      continue;
    }
    if (tagName === 'a' && (name === 'target' || name === 'rel')) {
      continue;
    }
    if ((tagName === 'a' || tagName === 'img') && isTextAttr) {
      continue;
    }
    if (isStyle) {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) {
        element.setAttribute('style', safeStyle);
      } else {
        element.removeAttribute(attr.name);
      }
      continue;
    }
    element.removeAttribute(attr.name);
  }

  if (tagName === 'a') {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

// sanitizeMessageContentHtml 清洗站内信富文本，兼容历史纯文本内容。
export function sanitizeMessageContentHtml(content = '') {
  const rawText = String(content || '').trim();
  if (!rawText) {
    return '';
  }
  if (!hasDOM()) {
    return escapeHtml(rawText).replaceAll('\n', '<br>');
  }
  const template = document.createElement('template');
  template.innerHTML = hasHtmlTag(rawText)
    ? rawText
    : escapeHtml(rawText).replaceAll('\n', '<br>');

  for (const element of template.content.querySelectorAll('*')) {
    cleanElement(element);
  }
  return template.innerHTML.trim();
}

// messageContentText 提取富文本纯文本摘要，用于列表、铃铛通知和空内容校验。
export function messageContentText(content = '') {
  const safeHtml = sanitizeMessageContentHtml(content);
  if (!safeHtml) {
    return '';
  }
  if (!hasDOM()) {
    return safeHtml
      .replaceAll(/<[^>]*>/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim();
  }
  const container = document.createElement('div');
  container.innerHTML = safeHtml;
  return (container.textContent || '').replaceAll(/\s+/g, ' ').trim();
}

// normalizeMessageContentForSubmit 统一发送前内容格式，避免空段落或危险标签入库。
export function normalizeMessageContentForSubmit(content = '') {
  const safeHtml = sanitizeMessageContentHtml(content);
  return messageContentText(safeHtml) ? safeHtml : '';
}
