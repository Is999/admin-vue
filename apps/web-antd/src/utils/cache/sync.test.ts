import { beforeEach, describe, expect, it, vi } from 'vitest';

import { showCacheSyncResult } from './sync';

// messageMock 记录成功与警告提示，验证待同步状态不会误报成功。
const messageMock = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('ant-design-vue', () => ({ message: messageMock }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));

describe('showCacheSyncResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缓存待同步时只显示统一警告', () => {
    showCacheSyncResult({ syncPending: true }, '保存成功');

    expect(messageMock.warning).toHaveBeenCalledWith(
      'business.message.cacheSyncPendingWarning',
    );
    expect(messageMock.success).not.toHaveBeenCalled();
  });

  it('缓存同步正常时显示业务成功文案', () => {
    showCacheSyncResult(undefined, '保存成功');

    expect(messageMock.success).toHaveBeenCalledWith('保存成功');
    expect(messageMock.warning).not.toHaveBeenCalled();
  });
});
