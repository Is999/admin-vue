import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

// 本地联调默认直连当前 admin API 端口。
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8999';

const appConfig: any = async () => {
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
