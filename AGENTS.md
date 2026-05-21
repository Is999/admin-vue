# AGENTS.md

## 必须遵守

1. 改代码前先读相关页面、组件、接口封装和现有调用链；涉及后端契约时同步参考 `../admin/docs/site/角色文档/后端开发/AI开发提示词.md`。
2. 功能开发、问题修复、重构、生产级复核和交付前检查必须优先使用 `$standard-development-flow`，再按场景调用专项 skill。
3. 需求或问题表述不充分、存在多种解释、目标页面/接口入口不清或涉及权限、安全、接口契约、数据迁移时，必须先结合代码和文档说明理解、证据、待确认点和执行边界，未经确认不得直接落代码。
4. 延续 vbenjs/vue-vben-admin 与当前项目风格，不新增无必要框架、目录、依赖或抽象。
5. 需求必须按页面入口、组件链路、接口封装、状态流和交付面逐项闭环；禁止只实现基础 UI、样例、单一分支或 happy path 后伪装已完成。
6. AI 实现的代码必须简洁、易读、易维护；落地代码是给开发人员审阅和长期维护的，不是给机器看的，禁止用过度抽象、隐式魔法或复杂堆叠牺牲可读性。
7. 目录、变量、方法、常量、类型、接口和字段命名必须短而准确、贴合业务职责；禁止泛名、错名、过长命名或实现职责变化后沿用旧名。
8. 每轮落代码前、中、后都必须持续对照工作区 AI 开发规范和本文件；新增或重构的类型、接口封装、状态结构、复杂条件、关键交互和安全边界必须补简洁说明，避免多轮实现后变成难以审阅维护的无说明代码堆叠。
9. 需求意图不清、问题需先分析、可能存在理解偏差或需要确认执行边界时使用 `$requirement-intent-gate`。
10. 需求实现、收口、闭环、命名审查或交付前完整性复核时使用 `$implementation-closure-review`。
11. vben 页面、路由、菜单、表格、表单、弹窗、状态和完整前端工作流时使用 `$vue-vben-feature-delivery`。
12. 前端 API wrapper、TypeScript 类型、业务码、权限、安全字段或 i18n 与后端契约同步时使用 `$vue-api-contract-client-sync`。
13. 需要浏览器打开、点击、截图、响应式或可视化冒烟时使用 `$vue-e2e-smoke-browser`。
14. pnpm、lockfile、Node/pnpm、postinstall、CI、依赖或 monorepo 工具链失败时使用 `$vue-monorepo-ci-guard`。
15. 路由/按钮权限、禁用态、重复点击、MFA/签名/加密 UI 流程时使用 `$vue-permission-state-audit`。
16. 处理 typecheck、lint、lefthook、commitlint 或提交失败时使用 `$frontend-vben-precommit`。
17. 多个兄弟仓库需要对齐、同步修复或比较同类文件时使用 `$sibling-repo-sync-review`。
18. 交付前 staged 文件、验证结果、后端联动或数据迁移说明收口时使用 `$release-handoff-guard`。
19. 前端业务文案必须支持中英文，优先使用现有 i18n 或 `tBizDynamic`。
20. 敏感操作必须复用既有 MFA、签名、加密和权限能力，不绕过安全校验。
21. 改动后至少执行 `pnpm -F @vben/web-antd run typecheck`；提交失败或大范围改动必须执行 `pnpm exec lefthook run pre-commit`。
22. 交付必须说明修改文件、改动原因、执行检查、未通过项和是否需要后端联动或数据迁移。
23. 每次任务结束前必须检查 `git status --short`；本轮新增且属于交付范围的文件必须执行 `git add` 加入本地仓库索引，不能让应提交文件停留在未跟踪状态，也不能添加无关历史未跟踪文件或本地数据目录。
