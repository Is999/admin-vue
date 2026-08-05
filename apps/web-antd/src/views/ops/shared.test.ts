import { describe, expect, it, vi } from 'vitest';

const localeState = vi.hoisted(() => ({ current: 'zh-CN' }));

vi.mock('#/locales', () => ({
  $t: (key: string) => `${localeState.current}:${key}`,
}));

describe('task queue locale text', () => {
  it('uses the active locale instead of cached module text', async () => {
    const { getTaskQueueDescription, getTaskQueueOptions } =
      await import('./shared');

    localeState.current = 'en-US';
    expect(getTaskQueueDescription('default')).toBe(
      'en-US:business.message.queueDefaultDesc',
    );

    localeState.current = 'zh-CN';
    expect(getTaskQueueOptions()[1]?.label).toBe(
      'zh-CN:business.message.queueDefaultLabel',
    );
  });
});

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes instead of JavaScript characters', async () => {
    const { utf8ByteLength } = await import('./shared');

    expect(utf8ByteLength('task')).toBe(4);
    expect(utf8ByteLength('任务')).toBe(6);
  });
});
