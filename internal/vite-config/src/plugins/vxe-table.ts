import type { PluginOption } from 'vite';

import { lazyImport, VxeResolver } from 'vite-plugin-lazy-import';

async function viteVxeTableImportsPlugin(): Promise<PluginOption[]> {
  return [
    // pnpm peer 依赖可能解析出不同 Vite 类型实例，这里只在插件出口收敛为当前包的 PluginOption。
    lazyImport({
      resolvers: [
        VxeResolver({
          libraryName: 'vxe-table',
        }),
        VxeResolver({
          libraryName: 'vxe-pc-ui',
        }),
      ],
    }) as unknown as PluginOption,
  ];
}

export { viteVxeTableImportsPlugin };
