/* eslint-disable unicorn/number-literal-case */
// 当前文件包含大量 MD5 与 ASN.1 DER 固定十六进制常量；oxfmt 会统一收敛字面量样式，
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

// add32 执行 MD5 需要的 32 位无符号加法。
function add32(a: number, b: number) {
  return (a + b) >>> 0;
}

// rotateLeft 执行 MD5 需要的循环左移。
function rotateLeft(value: number, shift: number) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

// md5Common 执行 MD5 四轮变换的公共步骤。
function md5Common(
  q: number,
  a: number,
  b: number,
  x: number,
  s: number,
  t: number,
) {
  return add32(rotateLeft(add32(add32(a, q), add32(x, t)), s), b);
}

// md5FF 执行 MD5 第一轮变换。
function md5FF(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  return md5Common((b & c) | (~b & d), a, b, x, s, t);
}

// md5GG 执行 MD5 第二轮变换。
function md5GG(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  return md5Common((b & d) | (c & ~d), a, b, x, s, t);
}

// md5HH 执行 MD5 第三轮变换。
function md5HH(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  return md5Common(b ^ c ^ d, a, b, x, s, t);
}

// md5II 执行 MD5 第四轮变换。
function md5II(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  return md5Common(c ^ (b | ~d), a, b, x, s, t);
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

// md5Hex 实现 laravel-admin 兼容的 MD5 十六进制摘要。
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

  let a = 0x67_45_23_01;
  let b = 0xef_cd_ab_89;
  let c = 0x98_ba_dc_fe;
  let d = 0x10_32_54_76;

  for (let i = 0; i < paddedLength; i += 64) {
    const x = Array.from({ length: 16 }, (_, index) =>
      view.getUint32(i + index * 4, true),
    );
    const xAt = (index: number) => x[index] ?? 0;
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;

    a = md5FF(a, b, c, d, xAt(0), 7, 0xd7_6a_a4_78);
    d = md5FF(d, a, b, c, xAt(1), 12, 0xe8_c7_b7_56);
    c = md5FF(c, d, a, b, xAt(2), 17, 0x24_20_70_db);
    b = md5FF(b, c, d, a, xAt(3), 22, 0xc1_bd_ce_ee);
    a = md5FF(a, b, c, d, xAt(4), 7, 0xf5_7c_0f_af);
    d = md5FF(d, a, b, c, xAt(5), 12, 0x47_87_c6_2a);
    c = md5FF(c, d, a, b, xAt(6), 17, 0xa8_30_46_13);
    b = md5FF(b, c, d, a, xAt(7), 22, 0xfd_46_95_01);
    a = md5FF(a, b, c, d, xAt(8), 7, 0x69_80_98_d8);
    d = md5FF(d, a, b, c, xAt(9), 12, 0x8b_44_f7_af);
    c = md5FF(c, d, a, b, xAt(10), 17, 0xff_ff_5b_b1);
    b = md5FF(b, c, d, a, xAt(11), 22, 0x89_5c_d7_be);
    a = md5FF(a, b, c, d, xAt(12), 7, 0x6b_90_11_22);
    d = md5FF(d, a, b, c, xAt(13), 12, 0xfd_98_71_93);
    c = md5FF(c, d, a, b, xAt(14), 17, 0xa6_79_43_8e);
    b = md5FF(b, c, d, a, xAt(15), 22, 0x49_b4_08_21);

    a = md5GG(a, b, c, d, xAt(1), 5, 0xf6_1e_25_62);
    d = md5GG(d, a, b, c, xAt(6), 9, 0xc0_40_b3_40);
    c = md5GG(c, d, a, b, xAt(11), 14, 0x26_5e_5a_51);
    b = md5GG(b, c, d, a, xAt(0), 20, 0xe9_b6_c7_aa);
    a = md5GG(a, b, c, d, xAt(5), 5, 0xd6_2f_10_5d);
    d = md5GG(d, a, b, c, xAt(10), 9, 0x02_44_14_53);
    c = md5GG(c, d, a, b, xAt(15), 14, 0xd8_a1_e6_81);
    b = md5GG(b, c, d, a, xAt(4), 20, 0xe7_d3_fb_c8);
    a = md5GG(a, b, c, d, xAt(9), 5, 0x21_e1_cd_e6);
    d = md5GG(d, a, b, c, xAt(14), 9, 0xc3_37_07_d6);
    c = md5GG(c, d, a, b, xAt(3), 14, 0xf4_d5_0d_87);
    b = md5GG(b, c, d, a, xAt(8), 20, 0x45_5a_14_ed);
    a = md5GG(a, b, c, d, xAt(13), 5, 0xa9_e3_e9_05);
    d = md5GG(d, a, b, c, xAt(2), 9, 0xfc_ef_a3_f8);
    c = md5GG(c, d, a, b, xAt(7), 14, 0x67_6f_02_d9);
    b = md5GG(b, c, d, a, xAt(12), 20, 0x8d_2a_4c_8a);

    a = md5HH(a, b, c, d, xAt(5), 4, 0xff_fa_39_42);
    d = md5HH(d, a, b, c, xAt(8), 11, 0x87_71_f6_81);
    c = md5HH(c, d, a, b, xAt(11), 16, 0x6d_9d_61_22);
    b = md5HH(b, c, d, a, xAt(14), 23, 0xfd_e5_38_0c);
    a = md5HH(a, b, c, d, xAt(1), 4, 0xa4_be_ea_44);
    d = md5HH(d, a, b, c, xAt(4), 11, 0x4b_de_cf_a9);
    c = md5HH(c, d, a, b, xAt(7), 16, 0xf6_bb_4b_60);
    b = md5HH(b, c, d, a, xAt(10), 23, 0xbe_bf_bc_70);
    a = md5HH(a, b, c, d, xAt(13), 4, 0x28_9b_7e_c6);
    d = md5HH(d, a, b, c, xAt(0), 11, 0xea_a1_27_fa);
    c = md5HH(c, d, a, b, xAt(3), 16, 0xd4_ef_30_85);
    b = md5HH(b, c, d, a, xAt(6), 23, 0x04_88_1d_05);
    a = md5HH(a, b, c, d, xAt(9), 4, 0xd9_d4_d0_39);
    d = md5HH(d, a, b, c, xAt(12), 11, 0xe6_db_99_e5);
    c = md5HH(c, d, a, b, xAt(15), 16, 0x1f_a2_7c_f8);
    b = md5HH(b, c, d, a, xAt(2), 23, 0xc4_ac_56_65);

    a = md5II(a, b, c, d, xAt(0), 6, 0xf4_29_22_44);
    d = md5II(d, a, b, c, xAt(7), 10, 0x43_2a_ff_97);
    c = md5II(c, d, a, b, xAt(14), 15, 0xab_94_23_a7);
    b = md5II(b, c, d, a, xAt(5), 21, 0xfc_93_a0_39);
    a = md5II(a, b, c, d, xAt(12), 6, 0x65_5b_59_c3);
    d = md5II(d, a, b, c, xAt(3), 10, 0x8f_0c_cc_92);
    c = md5II(c, d, a, b, xAt(10), 15, 0xff_ef_f4_7d);
    b = md5II(b, c, d, a, xAt(1), 21, 0x85_84_5d_d1);
    a = md5II(a, b, c, d, xAt(8), 6, 0x6f_a8_7e_4f);
    d = md5II(d, a, b, c, xAt(15), 10, 0xfe_2c_e6_e0);
    c = md5II(c, d, a, b, xAt(6), 15, 0xa3_01_43_14);
    b = md5II(b, c, d, a, xAt(13), 21, 0x4e_08_11_a1);
    a = md5II(a, b, c, d, xAt(4), 6, 0xf7_53_7e_82);
    d = md5II(d, a, b, c, xAt(11), 10, 0xbd_3a_f2_35);
    c = md5II(c, d, a, b, xAt(2), 15, 0x2a_d7_d2_bb);
    b = md5II(b, c, d, a, xAt(9), 21, 0xeb_86_d3_91);

    a = add32(a, oldA);
    b = add32(b, oldB);
    c = add32(c, oldC);
    d = add32(d, oldD);
  }

  return `${wordToHexLE(a)}${wordToHexLE(b)}${wordToHexLE(c)}${wordToHexLE(d)}`;
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
