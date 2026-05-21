---
name: frontend-vben-precommit
description: "复现并修复 vben 前端提交检查。用于 pnpm、lefthook、pre-commit、commitlint、typecheck、lint、oxfmt 和排序规则失败。"
---

# Vben 前端提交前检查

## 工作流程

1. 先读取当前前端 `AGENTS.md` 和 `references/project-map.md`。
2. 修改前检查相关页面、组件、API wrapper、store、i18n 和 route 调用链。
3. 延续 vben 组件组合和现有项目风格；不要新增无必要框架，也不要硬编码业务文案。
4. 按问题选择验证命令：
   - 普通前端改动：`pnpm -F @vben/web-antd run typecheck`。
   - 提交失败：`pnpm exec lefthook run pre-commit`。
   - 提交信息失败：`pnpm exec commitlint --edit <tmp-message-file>`。
   - 格式或 lint 阻塞：运行 `pnpm lint`，再修复输出里明确指出的文件和规则。
5. 如果 staged 和 unstaged 内容不一致，先看 `git status --short`；避免覆盖用户改动，只在规则要求时重新 add 本轮交付文件。
6. 修复后重新运行失败的 hook，不绕过 hook。

## 常见仓库模式

很多 vben 仓库通过 `lefthook.yml` 执行提交检查：`pre-commit` 通常跑 lint/typecheck，`commit-msg` 通常跑 commitlint。先读当前仓库实际配置和 package scripts，不继承其它仓库假设。

## 交付检查

- 说明复现了哪个 hook 或检查命令。
- 说明修复了哪个 formatter/lint/type 错误。
- 说明是否需要后端契约同步或数据迁移。
