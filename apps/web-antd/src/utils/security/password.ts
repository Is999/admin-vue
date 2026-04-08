import { message } from 'ant-design-vue';

import { $t } from '#/locales';

// PASSWORD_MIN_LENGTH 表示随机密码与强密码校验允许的最短长度。
export const PASSWORD_MIN_LENGTH = 8;
// PASSWORD_MAX_LENGTH 表示随机密码与强密码校验允许的最长长度。
export const PASSWORD_MAX_LENGTH = 12;

// PASSWORD_LOWER_CHARS 表示随机密码可选的小写字母字符集，排除易混淆字符。
const PASSWORD_LOWER_CHARS = 'abcdefghijkmnopqrstuvwxyz';
// PASSWORD_UPPER_CHARS 表示随机密码可选的大写字母字符集，排除易混淆字符。
const PASSWORD_UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// PASSWORD_NUMBER_CHARS 表示随机密码可选的数字字符集，排除易混淆字符。
const PASSWORD_NUMBER_CHARS = '23456789';
// PASSWORD_SYMBOL_CHARS 表示随机密码可选的特殊字符集合。
const PASSWORD_SYMBOL_CHARS = '!@#$%^&*_-+=?';
// STRONG_PASSWORD_PATTERN 表示前端强密码正则，要求大小写字母与数字同时存在。
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,12}$/;

// isPrintablePasswordChar 判断字符是否属于允许的可打印 ASCII 范围。
function isPrintablePasswordChar(char: string) {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint >= 33 && codePoint <= 126;
}

// getPasswordRuleMessage 返回统一的强密码校验提示文案。
export function getPasswordRuleMessage(
  label = $t('business.message.password'),
) {
  return $t('business.message.passwordRuleMessage', [label]);
}

// isValidStrongPassword 按 PassWord3 规则校验前端密码格式。
export function isValidStrongPassword(password = '') {
  const value = String(password || '').trim();
  return (
    STRONG_PASSWORD_PATTERN.test(value) &&
    [...value].every((char) => isPrintablePasswordChar(char))
  );
}

// validateStrongPassword 返回统一的前端强密码校验结果。
export function validateStrongPassword(
  password = '',
  label = $t('business.message.password'),
) {
  const value = String(password || '').trim();
  if (!value) {
    return $t('business.message.requiredField', [label]);
  }
  if (!isValidStrongPassword(value)) {
    return getPasswordRuleMessage(label);
  }
  return '';
}

// secureRandomInt 返回 [0,max) 范围内的随机整数，优先使用浏览器安全随机源。
function secureRandomInt(max: number) {
  if (max <= 1) {
    return 0;
  }
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return (values[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

// randomChar 从指定字符集中随机取一个字符。
function randomChar(pool: string) {
  return pool.charAt(secureRandomInt(pool.length));
}

// shuffleChars 原地打乱字符顺序，避免固定复杂度字符总出现在前几位。
function shuffleChars(chars: string[]) {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1);
    const currentChar = chars[index] ?? '';
    const swapChar = chars[swapIndex] ?? '';
    chars[index] = swapChar;
    chars[swapIndex] = currentChar;
  }
  return chars;
}

// generateRandomPassword 生成包含大小写、数字和特殊字符的随机密码。
export function generateRandomPassword(length = PASSWORD_MAX_LENGTH) {
  const normalizedLength = Number(length) || PASSWORD_MAX_LENGTH;
  const passwordLength = Math.min(
    PASSWORD_MAX_LENGTH,
    Math.max(PASSWORD_MIN_LENGTH, normalizedLength),
  );
  const passwordChars = [
    randomChar(PASSWORD_LOWER_CHARS),
    randomChar(PASSWORD_UPPER_CHARS),
    randomChar(PASSWORD_NUMBER_CHARS),
    randomChar(PASSWORD_SYMBOL_CHARS),
  ];
  const allChars =
    PASSWORD_LOWER_CHARS +
    PASSWORD_UPPER_CHARS +
    PASSWORD_NUMBER_CHARS +
    PASSWORD_SYMBOL_CHARS;
  while (passwordChars.length < passwordLength) {
    passwordChars.push(randomChar(allChars));
  }
  return shuffleChars(passwordChars).join('');
}

// copyTextToClipboard 复制文本到系统剪贴板，并统一处理成功与失败提示。
export async function copyTextToClipboard(
  text = '',
  successMessage = $t('business.message.contentCopied'),
  emptyMessage = $t('business.message.emptyCopyContent'),
) {
  const value = String(text || '').trim();
  if (!value) {
    message.warning(emptyMessage);
    return false;
  }
  if (!navigator.clipboard?.writeText) {
    message.error($t('business.message.clipboardUnsupported'));
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    message.success(successMessage);
    return true;
  } catch {
    message.error($t('business.message.copyFailedManual'));
    return false;
  }
}
