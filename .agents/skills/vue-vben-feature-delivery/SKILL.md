---
name: vue-vben-feature-delivery
description: "完整交付 Vue/vben 管理后台功能。用于 page、route、menu、table/form、drawer/modal、action、store、API wrapper、i18n、permission、状态收口。"
---

# Vue Vben 功能交付

## 工作流程

1. 修改前先读当前页面模式：route、menu、component 布局、table/form schema、API wrapper、type、store/composable、i18n、permission 和现有 action 风格。
2. 闭合完整用户流程，不只改可见组件。需求暗含列表、详情、新增、编辑、删除、导出、drawer/modal、分页、刷新、重复点击时，要一起接好。
3. 使用现有 vben 组件、hooks、icons、table action、请求 helper、权限 gate 和布局约定。
4. 前端业务文案进入 i18n 文件。除非仓库已有明确模式，不要硬编码业务文案。
5. 补齐用户自然预期的 loading、empty、error、disabled、confirm、success、retry 状态。
6. 敏感操作要对齐后端 MFA、签名、加密、权限和业务码行为。
7. 管理后台保持紧凑、可扫读、工作导向，不做装饰性落地页。

## 验证

- 运行仓库的 typecheck 命令，通常是 `pnpm -F @vben/web-antd run typecheck`。
- 仓库启用 lint、排序或 pre-commit 时，运行对应检查。
- 可见流程或布局敏感改动使用 `$vue-e2e-smoke-browser` 做浏览器冒烟。
- 运行 `git diff --check` 并检查 `git status --short`。

## 交付证据

交付时说明改动的页面、路由、组件，API/type/i18n/permission 是否同步，覆盖了哪些状态，运行了哪些命令，是否跳过浏览器检查，以及还依赖哪些后端条件。
