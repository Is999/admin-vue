# locale

每个app使用的国际化可能不同，这里用于扩展国际化的功能，例如扩展 dayjs、antd组件库的多语言切换，以及app本身的国际化文件。

## 业务文案

业务页面、message、modal 等管理后台文案统一放在 `src/locales/langs/{locale}` 下。通用框架文案继续放在 `@vben/locales`，业务文案不要写入公共包，避免不同应用之间互相污染。

- `cron.json`：路由、菜单等 cron 管理后台入口文案。
- `business.json`：按钮反馈、弹窗提示、错误兜底等业务提示文案。

脚本和模板统一从 `#/locales` 引入 `$t`；新增业务文案必须同时补齐 `zh-CN` 和 `en-US` 两份语言包，例如 `$t('business.message.deleteSucceeded')`。
