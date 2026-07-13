// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { useGridFormSchema } from './data';

// userListPath 兼容从 monorepo 根目录或 web-antd 包目录执行 Vitest。
const userListPath = [
  resolve(process.cwd(), 'src/views/user/list.vue'),
  resolve(process.cwd(), 'apps/web-antd/src/views/user/list.vue'),
].find(existsSync);
if (!userListPath) {
  throw new Error('未找到用户列表页面源码');
}
// userListSource 保存用户列表页源码，用于校验游标分页的关键交互约束。
const userListSource = readFileSync(userListPath, 'utf8');
// userListQuerySource 限定列表请求逻辑，避免测试被页面其它同名状态干扰。
const userListQuerySource = userListSource.slice(
  userListSource.indexOf('// 查询用户列表'),
  userListSource.indexOf('// syncUserListCursor'),
);
// userListCursorSource 限定游标同步函数源码。
const userListCursorSource = userListSource.slice(
  userListSource.indexOf('// syncUserListCursor'),
  userListSource.indexOf('// normalizeListParams'),
);
// userListCapabilitiesSource 限定后端能力回执同步函数源码。
const userListCapabilitiesSource = userListSource.slice(
  userListSource.indexOf('// syncUserListCapabilities'),
  userListSource.indexOf('// syncUserListCursor'),
);

describe('user list cursor pagination', () => {
  it('resets to page one when the query changes or a cursor is missing', () => {
    expect(userListQuerySource).toMatch(
      /if \(queryKey !== userListCursorQueryKey\)[\s\S]*currentPage = 1;[\s\S]*page\.currentPage = 1;/,
    );
    expect(userListQuerySource).toContain(
      '!userListCursorByPage.has(currentPage)',
    );
    expect(userListQuerySource).toContain('page: currentPage');
  });

  it('drops deeper cursors before storing the latest next-page cursor', () => {
    const clearCursorIndex = userListCursorSource.indexOf(
      'if (pageNo >= nextPage)',
    );
    const setCursorIndex = userListCursorSource.indexOf(
      'userListCursorByPage.set(nextPage, nextCursor)',
    );

    expect(clearCursorIndex).toBeGreaterThan(0);
    expect(setCursorIndex).toBeGreaterThan(clearCursorIndex);
  });

  it('rejects combined email and phone filters with localized text', () => {
    expect(userListSource).toContain('if (email && phone)');
    expect(userListSource).toContain(
      "$t('business.message.userContactFilterExclusive')",
    );
  });

  it('disables the status filter after the backend reports shard mode', () => {
    const statusSchema = useGridFormSchema(false).find(
      (item) => item.fieldName === 'status',
    );

    expect(statusSchema?.componentProps).toMatchObject({ disabled: true });
    expect(userListQuerySource).toContain(
      'await syncUserListCapabilities(response.meta)',
    );
    expect(userListCapabilitiesSource).toContain(
      "setFieldValue('status', undefined)",
    );
    expect(userListCapabilitiesSource).toContain(
      'updateSchema(useGridFormSchema(supported))',
    );
  });
});
