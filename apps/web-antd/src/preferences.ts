import {
  defineOverridesPreferences,
  definePreferencesExtension,
} from '@vben/preferences';

import { APP_DEFAULT_HOME_PATH } from '#/constants/app';

interface WebAntdPreferencesExtension {
  defaultTableSize: number;
  enableFormFullscreen: boolean;
  reportTitle: string;
  tenantMode: 'multi' | 'single';
}

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    // 业务头像和品牌资源只在应用层覆盖，避免修改 Vben 核心默认配置。
    defaultAvatar: '/favicon.svg',
    // 登录后默认进入个人信息管理页，避免普通用户误入任务中心。
    defaultHomePath: APP_DEFAULT_HOME_PATH,
    // 在 JWT 临期前主动续签；401 后仍必须重新认证，不启用失效令牌重放。
    enableRefreshToken: true,
    name: import.meta.env.VITE_APP_TITLE,
    // 固定使用官方可用的悬浮入口，避开 v5.7.0 顶栏自定义按钮缺少打开事件的问题。
    preferencesButtonPosition: 'fixed',
  },
  copyright: {
    companyName: 'Admin',
    companySiteLink: '/',
    date: '2026',
  },
  logo: {
    source: '/favicon.svg',
  },
  shortcutKeys: {
    // 强制启用全局锁屏快捷键，避免用户本地偏好缓存导致 Alt/Option + L 失效。
    globalLockScreen: true,
  },
  widget: {
    // 后台生产环境必须保留锁屏能力，避免精简 vben 代码后用户下拉菜单缺少锁屏入口。
    lockScreen: true,
  },
});

export const preferencesExtension =
  definePreferencesExtension<WebAntdPreferencesExtension>({
    tabLabel: 'preferences.antd.tabLabel',
    title: 'preferences.antd.title',
    fields: [
      {
        component: 'switch',
        defaultValue: true,
        key: 'enableFormFullscreen',
        label: 'preferences.antd.fields.enableFormFullscreen.label',
        tip: 'preferences.antd.fields.enableFormFullscreen.tip',
      },
      {
        component: 'select',
        defaultValue: 'single',
        key: 'tenantMode',
        label: 'preferences.antd.fields.tenantMode.label',
        options: [
          {
            label: 'preferences.antd.fields.tenantMode.options.single.label',
            value: 'single',
          },
          {
            label: 'preferences.antd.fields.tenantMode.options.multi.label',
            value: 'multi',
          },
        ],
      },
      {
        component: 'number',
        componentProps: {
          max: 200,
          min: 10,
          step: 10,
        },
        defaultValue: 20,
        key: 'defaultTableSize',
        label: 'preferences.antd.fields.defaultTableSize.label',
      },
      {
        component: 'input',
        defaultValue: '',
        key: 'reportTitle',
        label: 'preferences.antd.fields.reportTitle.label',
        placeholder: 'preferences.antd.fields.reportTitle.placeholder',
      },
    ],
  });
