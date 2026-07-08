import { Buffer } from 'node:buffer';
import process from 'node:process';

// resolveEnvValue 优先读取 CI/CD 注入值，其次读取当前 mode 的环境文件。
function resolveEnvValue(env: Record<string, string>, name: string) {
  return String(process.env[name] || env[name] || '').trim();
}

// assertProductionSecurityEnv 按已启用能力校验生产安全配置。
export function assertProductionSecurityEnv(
  mode: string,
  env: Record<string, string>,
) {
  if (mode !== 'production') {
    return;
  }

  const errors: string[] = [];
  const appId = resolveEnvValue(env, 'VITE_ADMIN_SECURITY_APP_ID');
  const signatureEnabled =
    resolveEnvValue(env, 'VITE_ADMIN_SIGNATURE_ENABLED').toLowerCase() ===
    'true';
  const cryptoEnabled =
    resolveEnvValue(env, 'VITE_ADMIN_CRYPTO_ENABLED').toLowerCase() === 'true';
  const signatureType = (
    resolveEnvValue(env, 'VITE_ADMIN_SIGNATURE_TYPE') || 'R'
  ).toUpperCase();
  const cryptoType = (
    resolveEnvValue(env, 'VITE_ADMIN_CRYPTO_TYPE') || 'A'
  ).toUpperCase();
  const aesKey = resolveEnvValue(env, 'VITE_ADMIN_SECURITY_AES_KEY');
  const aesIv = resolveEnvValue(env, 'VITE_ADMIN_SECURITY_AES_IV');
  const privateKey = resolveEnvValue(env, 'VITE_ADMIN_SIGNATURE_PRIVATE_KEY');
  const publicKey = resolveEnvValue(env, 'VITE_ADMIN_SIGNATURE_PUBLIC_KEY');

  if ((signatureEnabled || cryptoEnabled) && !appId) {
    errors.push('缺少 VITE_ADMIN_SECURITY_APP_ID');
  }
  if (signatureEnabled && !['A', 'R'].includes(signatureType)) {
    errors.push('VITE_ADMIN_SIGNATURE_TYPE 仅允许 A 或 R');
  }
  if (cryptoEnabled && cryptoType !== 'A') {
    errors.push('VITE_ADMIN_CRYPTO_TYPE 必须为 A');
  }
  const aesRequired =
    cryptoEnabled || (signatureEnabled && signatureType === 'A');
  if (
    aesRequired &&
    ![16, 24, 32].includes(Buffer.byteLength(aesKey, 'utf8'))
  ) {
    errors.push('VITE_ADMIN_SECURITY_AES_KEY 必须为 16、24 或 32 字节');
  }
  if (aesRequired && Buffer.byteLength(aesIv, 'utf8') !== 16) {
    errors.push('VITE_ADMIN_SECURITY_AES_IV 必须为 16 字节');
  }
  if (
    signatureEnabled &&
    signatureType === 'R' &&
    !/-----BEGIN (?:RSA )?PRIVATE KEY-----/u.test(privateKey)
  ) {
    errors.push('VITE_ADMIN_SIGNATURE_PRIVATE_KEY 不是有效 PEM 私钥');
  }
  if (
    signatureEnabled &&
    signatureType === 'R' &&
    !/-----BEGIN (?:RSA )?PUBLIC KEY-----/u.test(publicKey)
  ) {
    errors.push('VITE_ADMIN_SIGNATURE_PUBLIC_KEY 不是有效 PEM 公钥');
  }

  if (errors.length > 0) {
    throw new Error(`生产安全配置不完整：${errors.join('；')}`);
  }
}
