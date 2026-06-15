# 仓库检查面

按当前前端仓库真实存在的页面、路由、组件、API、类型、权限和 i18n 检查，不要求仓库具备后端技术面。

## Vben 前端

声明前端需求已闭环前，检查当前仓库实际存在且受影响的面：

- Page、route、component、drawer/modal、table action、form schema、store/composable、API wrapper 和 TypeScript type。
- 中英文 i18n key，不硬编码业务文案。
- 现有 MFA、signature、encryption、permission 和 route guard 行为。
- 相关时覆盖 loading、empty、error、disabled、pagination 和重复点击状态。
- `pnpm -F @vben/web-antd run typecheck`；需要提交就绪时运行 `pnpm exec lefthook run pre-commit`。

## 跨仓库工作

- 传播模式前，逐文件比较兄弟仓库。
- 重新扫描当前仓库，不假设兄弟 worktree 或复制模块完全一致。
- 除非用户明确要求拆分，保留共享 cache/API 契约。
