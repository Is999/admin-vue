import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv } from 'vite';

// 本地联调默认直连当前 admin API 端口。
const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:8899';

// resolveProxyTarget 优先使用进程环境变量，其次读取当前 mode 的 .env*。
function resolveProxyTarget(mode: string) {
  const env = loadEnv(mode || 'development', process.cwd(), 'VITE_');
  return (
    String(
      process.env.VITE_PROXY_TARGET ||
        env.VITE_PROXY_TARGET ||
        DEFAULT_PROXY_TARGET,
    ).trim() || DEFAULT_PROXY_TARGET
  );
}

const appConfig: any = async ({ mode }: any) => {
  const proxyTarget = resolveProxyTarget(mode);
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            target: proxyTarget,
            ws: true,
          },
          '/docs': {
            changeOrigin: true,
            target: proxyTarget,
          },
        },
      },
    },
  };
};

const config: any = defineConfig(appConfig);

export default config;
