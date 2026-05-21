---
name: vue-monorepo-ci-guard
description: "诊断 Vue/vben monorepo 工具链失败。用于 pnpm install、lockfile、postinstall、Node/pnpm、CI、lefthook、formatter、import-order 和依赖漂移。"
---

# Vue Monorepo CI 护栏

## 工作流程

1. 复现准确失败命令：install、postinstall、typecheck、lint、pre-commit、build 或 CI script。
2. 检查根 `package.json`、`pnpm-workspace.yaml`、lockfile、Node/pnpm 版本约束、env 文件和 CI 配置。
3. 兄弟仓库不一致时，先并排比较同名文件，再选择版本或 workaround。
4. 从源头修复 dependency 物化、catalog 顺序、lockfile 漂移、env 不匹配、formatter、import order 或排序规则失败。
5. 除非用户明确要求，不要绕过 lefthook、lint、commitlint 或 frozen-lockfile 约束。
6. formatting 或 lockfile 变化后重新暂存，确保验证内容与待提交内容一致。

## 验证

- 重新运行最初失败的命令。
- 需要提交就绪时，有条件则运行 `pnpm exec lefthook run pre-commit`。
- 按仓库和范围运行 typecheck/lint/build。
- 运行 `git diff --check`、`git diff --cached --check` 并检查 `git status --short`。

## 交付证据

交付时说明失败命令、根因、改动文件、版本选择、重跑命令、兄弟仓库比较结果，以及剩余 CI-only 风险。
