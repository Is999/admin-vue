# gozero-admin-vue

`gozero-admin-vue` 是基于 Vben 5.x 的后台管理前端工程，保留 Ant Design Vue 应用、共享包、构建脚本和项目内开发约定。本文只说明工程框架与协作边界，不展开功能细节。

> **AI 开发必读**：使用 AI 修改前端或联动后端接口前，必须先阅读 [admin AI开发规范](../admin/docs/site/角色文档/后端开发/AI开发规范.md)。前端文案必须走中英文国际化，敏感操作复用既有 MFA、签名和加密链路。

## 工程定位

- 使用 pnpm workspace 管理应用、共享包和内部工具。
- `apps/web-antd` 是当前交付应用，基于 Vue 3、Vite、TypeScript、Ant Design Vue 和 Vben 应用内核开发。
- `packages` 存放跨应用复用能力，`internal` 存放构建、lint、tsconfig、vite 等工程配置。
- 页面、接口、路由、状态和国际化资源按 Vben 推荐结构放在应用目录内维护。

## 快速开始

```bash
pnpm install
pnpm dev:antd
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run build
```

根工作区也保留聚合命令：

```bash
pnpm check:type
pnpm build:antd
```

## 目录结构

- `apps/web-antd/src/api`: 请求声明和接口适配。
- `apps/web-antd/src/views`: 页面入口、页面内组件和页面状态。
- `apps/web-antd/src/router`: 路由声明、路由元信息和访问控制配置。
- `apps/web-antd/src/locales`: 中文、英文和包级国际化资源。
- `apps/web-antd/src/constants`: 前端常量、枚举和跨页面配置。
- `apps/web-antd/src/utils`: 请求、安全、格式化等应用级工具。
- `packages`: Vben 共享能力和跨应用复用包。
- `internal`: 工程脚本、构建配置、lint 配置和 TypeScript 配置。
- `scripts`: 本地开发、构建和发布辅助脚本。
- `docs`: 前端架构、联调、发布和协作文档。

## 开发约定

- 页面与组件延续 Vben 目录和命名风格，避免为单个页面引入新的工程分层。
- 前端展示文案必须进入 `src/locales`，同时维护中文和英文翻译。
- 请求统一走项目请求封装，错误提示优先使用后端错误码和国际化消息。
- 路由访问控制、按钮控制和敏感操作接入现有元信息与安全工具，不在页面内硬编码判断。
- 页面内公共逻辑优先收敛到当前页面目录或已有工具包，确有跨页面复用价值时再进入 `packages`。
- 提交前按影响范围运行 `typecheck`、`lint`、`build` 或项目已有等价命令。

## 常用命令

```bash
pnpm dev:antd
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run build
pnpm lint
pnpm check:type
```

## 文档索引

- `docs/架构说明.md`
- `docs/安全配置说明.md`
- `docs/质量审计.md`

## License

Internal use only.
