/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    if (!resp.isRefresh) {
      return resp.token;
    }
    const newToken = resp.token;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 生成 UUID v4 的小型回退实现（当环境没有 crypto.randomUUID 时使用）
  function generateTraceId() {
    // 浏览器或 Node 的 crypto.randomUUID 优先
    const rndUUID = (globalThis as any)?.crypto?.randomUUID?.();
    if (rndUUID) return rndUUID;

    // 优先使用 crypto.getRandomValues 生成更安全的随机字节
    const getRandomBytes = (n: number) => {
      const bytes = new Uint8Array(n);
      if ((globalThis as any)?.crypto?.getRandomValues) {
        (globalThis as any).crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < n; i++) {
          bytes[i] = Math.trunc(Math.random() * 256);
        }
      }
      return bytes;
    };

    const bytes = getRandomBytes(16);
    // Per RFC 4122 v4
    const b6 = bytes[6] ?? 0;
    const b8 = bytes[8] ?? 0;
    // 0x0f => 15, 0x40 => 64, 0x3f => 63, 0x80 => 128
    bytes[6] = (b6 & 15) | 64;
    bytes[8] = (b8 & 63) | 128;

    const hex: string[] = [];
    for (let i = 0; i < 16; i++) {
      const v = bytes[i] ?? 0;
      hex.push(v.toString(16).padStart(2, '0'));
    }

    // format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return `${hex.slice(0, 4).join('')}${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}-${hex.slice(12, 16).join('')}`;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      // 为每个请求添加 X-Trace-Id，用于链路/请求追踪
      // 如果调用方已传入，则保留原值
      if (!config.headers['X-Trace-Id'] && !config.headers['x-trace-id']) {
        config.headers['X-Trace-Id'] = generateTraceId();
      }
      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      // 后端返回格式: { status: true, code: 1, message: '成功', data: {...} }
      // 使用 `status` 字段作为成功标识，successCode 为 true
      codeField: 'status',
      dataField: 'data',
      successCode: (v: any) => v === true,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const respCode = responseData?.code ?? '';
      const respMessage = responseData?.message ?? responseData?.error ?? '';

      // 拼接 code 与 message
      let errorMessage = '';
      if (respCode && respMessage) {
        errorMessage = `code: ${respCode} ${respMessage}`;
      } else if (respMessage) {
        errorMessage = respMessage;
      } else if (respCode) {
        errorMessage = `code: ${respCode}`;
      }

      // 如果没有任何后端错误信息，则使用通用 msg
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
