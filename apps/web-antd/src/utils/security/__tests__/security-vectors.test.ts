import { afterEach, describe, expect, it, vi } from 'vitest';

import { aesCbcEncrypt, aesCbcSign } from '../crypto';
import routeSecurityManifest from '../route-security-manifest.json';
import {
  buildSignString,
  buildSignStringByType,
  encodeCipherHeader,
  handleAdminSecurityResponse,
  resolvePolicyForAlias,
  resolveRouteSecurityRule,
  resolveSignatureType,
} from '../signature';
import securityVectors from './testdata/security-vectors.json';

interface SecurityVectorFile {
  version: number;
  signVectors: Array<{
    appID: string;
    data: Record<string, any>;
    expected: string;
    fields: string[];
    name: string;
    timestamp: string;
    traceID: string;
  }>;
  cipherHeaderVectors: Array<{
    expected: string;
    fields: string[];
    name: string;
  }>;
  fieldLimitVectors: Array<{
    fields: string[];
    name: string;
    shouldReject: boolean;
  }>;
}

// RouteSecurityManifestRoute 表示安全清单里当前测试需要使用的路由字段。
interface RouteSecurityManifestRoute {
  alias: string;
  method: string;
  path: string;
  requestCipher: string[];
  responseCipher: string[];
  responseSign: string[];
}

const requestOnlyCryptoRoutes = (
  routeSecurityManifest as { routes: RouteSecurityManifestRoute[] }
).routes.filter(
  (route) =>
    route.requestCipher.length > 0 && route.responseCipher.length === 0,
);

afterEach(() => {
  vi.unstubAllEnvs();
});

function loadSecurityVectors() {
  const vectors = securityVectors as SecurityVectorFile;
  expect(vectors.version).toBe(2);
  return vectors;
}

describe('security vectors', () => {
  const vectors = loadSecurityVectors();

  it.each(vectors.signVectors)(
    'builds backend-compatible sign string: $name',
    (vector) => {
      expect(
        buildSignString(
          vector.data,
          vector.fields,
          vector.traceID,
          vector.timestamp,
          vector.appID,
        ),
      ).toBe(vector.expected);
    },
  );

  it.each(vectors.cipherHeaderVectors)(
    'encodes backend-compatible X-Cipher header: $name',
    (vector) => {
      expect(encodeCipherHeader(vector.fields)).toBe(vector.expected);
    },
  );

  it.each(vectors.fieldLimitVectors)(
    'keeps field count limit vector: $name',
    (vector) => {
      const run = () => encodeCipherHeader(vector.fields);
      if (vector.shouldReject) {
        expect(run).toThrow(/securityFieldCountTooLarge/);
      } else {
        expect(run).not.toThrow();
      }
    },
  );

  it('keeps admin role assignment array out of request sign policy', () => {
    expect(resolvePolicyForAlias('admin.role.update').requestSign).toEqual([
      'twoStepKey',
      'twoStepValue',
    ]);
  });

  it('keeps admin update policy limited to effective fields', () => {
    const policy = resolvePolicyForAlias('admin.update');
    expect(policy.requestSign).toEqual([
      'realName',
      'email',
      'phone',
      'avatar',
      'description',
      'password',
      'isUpdateRoles',
      'twoStepKey',
      'twoStepValue',
    ]);
    expect(policy.requestCipher).toEqual([
      'password',
      'twoStepKey',
      'twoStepValue',
    ]);
  });

  it('maps API config reload items route without implicit request signing', () => {
    const rule = resolveRouteSecurityRule(
      'GET',
      '/api-runtime/config-reload/items',
    );
    expect(rule?.alias).toBe('api_runtime.config_reload.items');
    expect(resolvePolicyForAlias(rule?.alias).requestSign || []).toEqual([]);
  });

  it('accepts MD5, AES and RSA signature configuration', () => {
    expect(resolveSignatureType('a')).toBe('A');
    expect(resolveSignatureType('R')).toBe('R');
    expect(resolveSignatureType('M')).toBe('M');
    expect(resolveSignatureType('md5')).toBe('M');
    expect(resolveSignatureType('')).toBe('R');
    expect(() => resolveSignatureType('unknown')).toThrow(
      /unsupportedSignatureType/,
    );
  });

  it('keeps the legacy MD5 sign string compatible with the backend', () => {
    expect(
      buildSignStringByType(
        {
          token: 'token-value',
          user: { phone: '138****0000' },
        },
        ['token', 'user.phone'],
        'req',
        '1700000000',
        'app',
        'M',
      ),
    ).toBe(
      'token=token-value&user.phone=138****0000&key=27a7b5b98263d73425f421dbfd16de41',
    );
  });

  it('keeps delimiter-bearing values collision free', () => {
    const left = buildSignString(
      { a: '1&b=2', b: '3' },
      ['a', 'b'],
      'trace',
      '1700000000',
      'app',
    );
    const right = buildSignString(
      { a: '1', b: '2&b=3' },
      ['a', 'b'],
      'trace',
      '1700000000',
      'app',
    );
    expect(left).not.toBe(right);
  });

  it('decrypts server-declared response fields even when request crypto is disabled', async () => {
    const key = '1234567890abcdef';
    const iv = 'abcdef1234567890';
    const traceID = '0123456789abcdef0123456789abcdef';
    const timestamp = '1700000000';
    const buildMfaUrl =
      'otpauth://totp/admin-1%3Asuper888?secret=RCABDVITFNQJJ4VJ&issuer=admin-1';
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
    vi.stubEnv('VITE_ADMIN_CRYPTO_ENABLED', 'false');
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_KEY', key);
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_IV', iv);

    const plainData = {
      buildMFAURL: buildMfaUrl,
      phone: '13800138000',
    };
    const sign = await aesCbcSign(
      buildSignString(
        plainData,
        ['phone', 'buildMFAURL'],
        traceID,
        timestamp,
        '1',
      ),
      key,
      iv,
    );
    const response = await handleAdminSecurityResponse({
      config: {
        headers: {
          'X-Timestamp': timestamp,
          'X-Trace-Id': traceID,
        },
        method: 'get',
        url: '/profile',
      },
      data: {
        code: 1,
        data: {
          buildMFAURL: await aesCbcEncrypt(buildMfaUrl, key, iv),
          phone: await aesCbcEncrypt('13800138000', key, iv),
          sign,
        },
        status: true,
      },
      headers: {
        'X-Cipher': encodeCipherHeader(['phone', 'buildMFAURL']),
        'X-Crypto': 'A',
        'X-Signature': 'A',
        'X-Timestamp': timestamp,
        'X-Trace-Id': traceID,
      },
    });

    expect(response.data.data).toMatchObject({
      buildMFAURL: buildMfaUrl,
      phone: '13800138000',
    });
  });

  it('rejects a signed response replayed into another request context', async () => {
    const key = '1234567890abcdef';
    const iv = 'abcdef1234567890';
    const oldTraceID = '0123456789abcdef0123456789abcdef';
    const newTraceID = 'fedcba9876543210fedcba9876543210';
    const oldTimestamp = '1700000000';
    const newTimestamp = '1700000001';
    const data = { token: 'replayed-token' };
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_KEY', key);
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_IV', iv);
    vi.stubEnv('VITE_ADMIN_SIGNATURE_ENABLED', 'true');

    const sign = await aesCbcSign(
      buildSignString(data, ['token'], oldTraceID, oldTimestamp, '1'),
      key,
      iv,
    );
    await expect(
      handleAdminSecurityResponse({
        config: {
          headers: {
            'X-Timestamp': newTimestamp,
            'X-Trace-Id': newTraceID,
          },
          method: 'post',
          url: '/auth/refresh',
        },
        data: { code: 1, data: { ...data, sign }, status: true },
        headers: {
          'X-Signature': 'A',
          'X-Timestamp': oldTimestamp,
          'X-Trace-Id': oldTraceID,
        },
      }),
    ).rejects.toThrow(/responseSignVerifyFailed/);
  });

  it('rejects encrypted responses when the local AES material is missing', async () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
    vi.stubEnv('VITE_ADMIN_CRYPTO_ENABLED', 'false');
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_KEY', '');
    vi.stubEnv('VITE_ADMIN_SECURITY_AES_IV', '');

    await expect(
      handleAdminSecurityResponse({
        config: { method: 'get', url: '/profile' },
        data: {
          code: 1,
          data: { buildMFAURL: 'ciphertext' },
          status: true,
        },
        headers: {
          'X-Cipher': encodeCipherHeader(['buildMFAURL']),
          'X-Crypto': 'A',
        },
      }),
    ).rejects.toThrow(/missingFrontendAesConfig/);
  });

  it('fails closed when a successful policy response is missing its signature', async () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
    vi.stubEnv('VITE_ADMIN_SIGNATURE_ENABLED', 'true');

    await expect(
      handleAdminSecurityResponse({
        config: { method: 'post', url: '/auth/refresh' },
        data: {
          code: 1,
          data: { isRefresh: true, token: 'unsigned-token' },
          status: true,
        },
        headers: {},
      }),
    ).rejects.toThrow(/responseSignMissing/);
  });

  it('keeps unsigned business errors and routes without response policy compatible', async () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
    vi.stubEnv('VITE_ADMIN_SIGNATURE_ENABLED', 'true');
    const businessError = {
      config: { method: 'post', url: '/auth/refresh' },
      data: { code: 401, message: 'expired', status: false },
      headers: {},
    };
    const publicResponse = {
      config: { method: 'get', url: '/healthz' },
      data: { data: { ok: true }, status: true },
      headers: {},
    };

    await expect(handleAdminSecurityResponse(businessError)).resolves.toBe(
      businessError,
    );
    await expect(handleAdminSecurityResponse(publicResponse)).resolves.toBe(
      publicResponse,
    );
  });

  it('keeps request-only crypto responses without response cipher compatible', async () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');

    const response = {
      config: { method: 'patch', url: '/profile' },
      data: { code: 1, data: { updated: true }, status: true },
      headers: { 'X-Crypto': 'A' },
    };

    await expect(handleAdminSecurityResponse(response)).resolves.toBe(response);
  });

  it.each(requestOnlyCryptoRoutes)(
    'keeps request-only crypto route $alias compatible without response cipher',
    async (route) => {
      const key = '1234567890abcdef';
      const iv = 'abcdef1234567890';
      const traceID = '0123456789abcdef0123456789abcdef';
      const timestamp = '1700000000';
      vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
      vi.stubEnv('VITE_ADMIN_SECURITY_AES_KEY', key);
      vi.stubEnv('VITE_ADMIN_SECURITY_AES_IV', iv);

      const data = Object.fromEntries(
        route.responseSign.map((field) => [field, `${field}-value`]),
      );
      if (route.responseSign.length > 0) {
        data.sign = await aesCbcSign(
          buildSignString(data, route.responseSign, traceID, timestamp, '1'),
          key,
          iv,
        );
      }
      const response = {
        config: {
          headers: {
            'X-Timestamp': timestamp,
            'X-Trace-Id': traceID,
          },
          method: route.method,
          url: route.path,
        },
        data: { code: 1, data, status: true },
        headers: {
          ...(route.responseSign.length > 0 ? { 'X-Signature': 'A' } : {}),
          'X-Crypto': 'A',
          'X-Timestamp': timestamp,
          'X-Trace-Id': traceID,
        },
      };

      await expect(handleAdminSecurityResponse(response)).resolves.toBe(
        response,
      );
    },
  );

  it.each([
    ['malformed field header', 'not-base64'],
    ['empty field list', btoa('[]')],
    ['unsafe field path', encodeCipherHeader(['__proto__.polluted'])],
  ])(
    'fails closed for encrypted responses with %s',
    async (_name, cipherHeader) => {
      vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '1');
      vi.stubEnv('VITE_ADMIN_SECURITY_AES_KEY', '1234567890abcdef');
      vi.stubEnv('VITE_ADMIN_SECURITY_AES_IV', 'abcdef1234567890');

      await expect(
        handleAdminSecurityResponse({
          config: { method: 'get', url: '/healthz' },
          data: { data: { value: 'ciphertext' }, status: true },
          headers: {
            ...(cipherHeader === undefined ? {} : { 'X-Cipher': cipherHeader }),
            'X-Crypto': 'A',
          },
        }),
      ).rejects.toThrow(/responseCipherHeaderInvalid/);
    },
  );

  it('rejects encrypted response markers when the frontend AppID is missing', async () => {
    vi.stubEnv('VITE_ADMIN_SECURITY_APP_ID', '');

    await expect(
      handleAdminSecurityResponse({
        config: { method: 'get', url: '/healthz' },
        data: { data: { value: 'ciphertext' }, status: true },
        headers: {
          'X-Cipher': encodeCipherHeader(['value']),
          'X-Crypto': 'A',
        },
      }),
    ).rejects.toThrow(/missingFrontendSecurityAppId/);
  });
});
