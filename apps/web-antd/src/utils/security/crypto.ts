/* eslint-disable unicorn/number-literal-case */
// 当前文件包含 ASN.1 DER 固定十六进制常量；oxfmt 会统一收敛字面量样式，
// 为避免与 ESLint 的 number-literal-case 规则反复冲突，这里按文件关闭该规则。

import { $t } from '#/locales';

// stringToBytes 将字符串转换为 UTF-8 字节，用于摘要、签名和加密。
function stringToBytes(text: string) {
  return new TextEncoder().encode(text);
}

// bytesToHex 将字节数组转换为小写十六进制字符串。
function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((item) => item.toString(16).padStart(2, '0')).join('');
}

// bytesToBase64 将字节数组转换为 base64 字符串。
export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const item of bytes) {
    binary += String.fromCodePoint(item);
  }
  return btoa(binary);
}

// base64ToBytes 将 base64 字符串转换为字节数组。
function base64ToBytes(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes;
}

// normalizePem 还原环境变量中的 PEM 换行，便于在 .env 中配置 RSA 私钥。
function normalizePem(pem: string) {
  const normalized = pem.replaceAll(String.raw`\n`, '\n').trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
}

// getSubtleCrypto 获取浏览器 WebCrypto SubtleCrypto；非安全上下文下浏览器会关闭该能力。
function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error($t('business.message.webCryptoUnavailable'));
  }
  return subtle;
}

// pemToArrayBuffer 提取 PEM 中的 DER 内容。
function pemToArrayBuffer(pem: string) {
  const base64 = normalizePem(pem)
    .replaceAll(/-----BEGIN [^-]+-----/g, '')
    .replaceAll(/-----END [^-]+-----/g, '')
    .replaceAll(/\s+/g, '');
  return base64ToBytes(base64).buffer;
}

// arrayBufferToPem 将浏览器导出的 DER 二进制数据编码为 PEM 文本。
function arrayBufferToPem(buffer: ArrayBuffer, label: string) {
  const base64 = bytesToBase64(new Uint8Array(buffer));
  const body = base64.match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

// concatBytes 将多个字节数组按顺序拼接。
function concatBytes(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// encodeDerLength 将长度编码为 DER 格式。
function encodeDerLength(length: number) {
  if (length < 0x80) {
    return Uint8Array.of(length);
  }
  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

// encodeDerNode 使用 tag + DER length + payload 组装 ASN.1 节点。
function encodeDerNode(tag: number, payload: Uint8Array) {
  return concatBytes(
    Uint8Array.of(tag),
    encodeDerLength(payload.length),
    payload,
  );
}

// DER_INTEGER_ZERO 表示 PKCS#8 包装时 ASN.1 version=0 的 DER 编码。
const DER_INTEGER_ZERO = Uint8Array.of(0x02, 0x01, 0x00);
// DER_RSA_ALGORITHM_IDENTIFIER 表示 RSA 算法标识的固定 ASN.1 DER 片段。
const DER_RSA_ALGORITHM_IDENTIFIER = Uint8Array.from([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  0x05, 0x00,
]);

// toPkcs8PrivateKeyDer 将浏览器不支持直接导入的 PKCS#1 RSA 私钥包装为 PKCS#8。
function toPkcs8PrivateKeyDer(privateKeyPem: string) {
  const normalizedPem = normalizePem(privateKeyPem);
  const der = new Uint8Array(pemToArrayBuffer(normalizedPem));
  if (!normalizedPem.includes('BEGIN RSA PRIVATE KEY')) {
    return der.buffer;
  }
  const privateKeyOctetString = encodeDerNode(0x04, der);
  const privateKeyInfo = encodeDerNode(
    0x30,
    concatBytes(
      DER_INTEGER_ZERO,
      DER_RSA_ALGORITHM_IDENTIFIER,
      privateKeyOctetString,
    ),
  );
  return privateKeyInfo.buffer;
}

// MD5_SHIFT 是 MD5 四轮变换的循环左移位数。
const MD5_SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
] as const;

// MD5_CONSTANT 是 RFC 1321 定义的 64 个轮常量。
const MD5_CONSTANT = Array.from(
  { length: 64 },
  (_, index) =>
    Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_00_00_00_00) >>> 0,
);

// add32 执行 MD5 需要的 32 位无符号加法。
function add32(left: number, right: number) {
  return (left + right) >>> 0;
}

// rotateLeft 执行 MD5 需要的循环左移。
function rotateLeft(value: number, shift: number) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

// wordToHexLE 将 32 位字按小端序输出为十六进制。
function wordToHexLE(word: number) {
  return bytesToHex(
    new Uint8Array([
      word & 0xff,
      (word >>> 8) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 24) & 0xff,
    ]),
  );
}

// md5Hex 实现现有客户端协议使用的 MD5 十六进制摘要。
export function md5Hex(text: string) {
  const input = stringToBytes(text);
  const paddedLength = Math.trunc((input.length + 72) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = input.length * 8;
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(
    paddedLength - 4,
    Math.floor(bitLength / 0x1_00_00_00_00),
    true,
  );

  let stateA = 0x67_45_23_01;
  let stateB = 0xef_cd_ab_89;
  let stateC = 0x98_ba_dc_fe;
  let stateD = 0x10_32_54_76;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) =>
      view.getUint32(offset + index * 4, true),
    );
    let a = stateA;
    let b = stateB;
    let c = stateC;
    let d = stateD;

    for (let round = 0; round < 64; round++) {
      let value = 0;
      let wordIndex = 0;
      if (round < 16) {
        value = (b & c) | (~b & d);
        wordIndex = round;
      } else if (round < 32) {
        value = (d & b) | (~d & c);
        wordIndex = (5 * round + 1) % 16;
      } else if (round < 48) {
        value = b ^ c ^ d;
        wordIndex = (3 * round + 5) % 16;
      } else {
        value = c ^ (b | ~d);
        wordIndex = (7 * round) % 16;
      }
      const previousD = d;
      d = c;
      c = b;
      b = add32(
        b,
        rotateLeft(
          add32(
            add32(a, value),
            add32(MD5_CONSTANT[round] ?? 0, words[wordIndex] ?? 0),
          ),
          MD5_SHIFT[round] ?? 0,
        ),
      );
      a = previousD;
    }

    stateA = add32(stateA, a);
    stateB = add32(stateB, b);
    stateC = add32(stateC, c);
    stateD = add32(stateD, d);
  }

  return `${wordToHexLE(stateA)}${wordToHexLE(stateB)}${wordToHexLE(stateC)}${wordToHexLE(stateD)}`;
}

// sha256Hex 计算 SHA-256 十六进制摘要，用于 AES/RSA 签名。
export async function sha256Hex(text: string) {
  const digest = await getSubtleCrypto().digest('SHA-256', stringToBytes(text));
  return bytesToHex(new Uint8Array(digest));
}

// aesCbcEncrypt 使用 AES-CBC 加密明文，后端按 PKCS7 解密。
export async function aesCbcEncrypt(text: string, key: string, iv: string) {
  const subtle = getSubtleCrypto();
  const cryptoKey = await subtle.importKey(
    'raw',
    stringToBytes(key),
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const encrypted = await subtle.encrypt(
    { iv: stringToBytes(iv), name: 'AES-CBC' },
    cryptoKey,
    stringToBytes(text),
  );
  return bytesToBase64(new Uint8Array(encrypted));
}

// aesCbcDecrypt 使用 AES-CBC 解密 base64 密文，保持与后端 PKCS7 解密兼容。
export async function aesCbcDecrypt(
  ciphertext: string,
  key: string,
  iv: string,
) {
  const subtle = getSubtleCrypto();
  const cryptoKey = await subtle.importKey(
    'raw',
    stringToBytes(key),
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  const decrypted = await subtle.decrypt(
    { iv: stringToBytes(iv), name: 'AES-CBC' },
    cryptoKey,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

// aesCbcSign 先计算 SHA256 摘要，再 AES-CBC 加密摘要字符串。
export async function aesCbcSign(text: string, key: string, iv: string) {
  return aesCbcEncrypt(await sha256Hex(text), key, iv);
}

// rsaPkcs1Sign 使用 RSA-SHA256 对请求签名，兼容 PKCS#8 与 PKCS#1 PEM 私钥。
export async function rsaPkcs1Sign(text: string, privateKeyPem: string) {
  const subtle = getSubtleCrypto();
  const key = await subtle.importKey(
    'pkcs8',
    toPkcs8PrivateKeyDer(privateKeyPem),
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    stringToBytes(text),
  );
  return bytesToBase64(new Uint8Array(signature));
}

// rsaPkcs1Verify 使用 RSA-SHA256 校验签名，公钥必须是 SPKI PEM。
export async function rsaPkcs1Verify(
  text: string,
  signature: string,
  publicKeyPem: string,
) {
  const subtle = getSubtleCrypto();
  const key = await subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['verify'],
  );
  return subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64ToBytes(signature),
    stringToBytes(text),
  );
}

// generateLocalRSAPemPair 在浏览器本地生成一组 RSA 公私钥 PEM，不依赖后端或服务端落盘。
export async function generateLocalRSAPemPair() {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      hash: 'SHA-256',
      modulusLength: 2048,
      name: 'RSASSA-PKCS1-v1_5',
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ['sign', 'verify'],
  );
  const [publicKeyDer, privateKeyDer] = await Promise.all([
    subtle.exportKey('spki', keyPair.publicKey),
    subtle.exportKey('pkcs8', keyPair.privateKey),
  ]);
  return {
    privateKeyPem: arrayBufferToPem(privateKeyDer, 'PRIVATE KEY'),
    publicKeyPem: arrayBufferToPem(publicKeyDer, 'PUBLIC KEY'),
  };
}
