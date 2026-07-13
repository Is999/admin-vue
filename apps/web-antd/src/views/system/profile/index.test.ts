import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// profilePath 兼容从 monorepo 根目录或 web-antd 包目录执行 Vitest。
const profilePath = [
  resolve(process.cwd(), 'src/views/system/profile/index.vue'),
  resolve(process.cwd(), 'apps/web-antd/src/views/system/profile/index.vue'),
].find(existsSync);
if (!profilePath) {
  throw new Error('未找到个人资料页面源码');
}
// profileSource 保存个人资料页源码，用于校验 Blob URL 的释放时机。
const profileSource = readFileSync(profilePath, 'utf8');
// loadProfileSource 限定资料加载函数源码。
const loadProfileSource = profileSource.slice(
  profileSource.indexOf('// loadProfile'),
  profileSource.indexOf('// onSaveProfile'),
);

describe('profile avatar preview', () => {
  it('keeps the local Blob URL until fresh profile data is ready', () => {
    const fetchIndex = loadProfileSource.indexOf('await fetchProfileInfo()');
    const resolveIndex = loadProfileSource.indexOf(
      'const nextAvatarPreviewURL = resolveDisplayFileURL',
    );
    const revokeIndex = loadProfileSource.indexOf(
      'clearAvatarLocalPreviewURL()',
    );

    expect(fetchIndex).toBeGreaterThan(0);
    expect(resolveIndex).toBeGreaterThan(fetchIndex);
    expect(revokeIndex).toBeGreaterThan(resolveIndex);
  });
});
