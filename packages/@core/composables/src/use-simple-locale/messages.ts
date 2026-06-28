export type Locale = 'en-US' | 'zh-CN';

export const messages: Record<Locale, Record<string, string>> = {
  'en-US': {
    cancel: 'Cancel',
    collapse: 'Collapse',
    confirm: 'Confirm',
    expand: 'Expand',
    maximize: 'Maximize',
    prompt: 'Prompt',
    reset: 'Reset',
    resizeDrawer: 'Resize drawer',
    restore: 'Restore',
    submit: 'Submit',
  },
  'zh-CN': {
    cancel: '取消',
    collapse: '收起',
    confirm: '确认',
    expand: '展开',
    maximize: '最大化',
    prompt: '提示',
    reset: '重置',
    resizeDrawer: '调整抽屉宽度',
    restore: '还原',
    submit: '提交',
  },
};

export const getMessages = (locale: Locale) => messages[locale];
