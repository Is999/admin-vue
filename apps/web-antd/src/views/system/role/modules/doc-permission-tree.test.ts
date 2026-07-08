import { describe, expect, it } from 'vitest';

import { buildDocPermissionTree } from './doc-permission-tree';
import {
  collectPermissionState,
  updateSelectedPermissionIds,
} from './permission-tree';

describe('document permission tree builder', () => {
  it('groups by site and path while submitting only real document IDs', () => {
    const tree = buildDocPermissionTree([
      {
        checked: true,
        description: '',
        disableCheckbox: false,
        disabled: false,
        id: 1,
        path: '功能模块/任务系统/任务系统首页.md',
        selectable: true,
        site: 'admin',
        status: 1,
        title: '任务系统首页',
      },
      {
        checked: false,
        description: '',
        disableCheckbox: false,
        disabled: false,
        id: 53,
        path: '接口文档/前台系统/健康检查接口.md',
        selectable: true,
        site: 'api',
        status: 1,
        title: '健康检查接口',
      },
    ]);

    expect(tree.map((item) => item.title)).toEqual(['Admin', 'API']);
    const state = collectPermissionState(tree);
    expect(state.checkedIds).toEqual([1]);
    expect([...state.enabledIds].toSorted((a, b) => a - b)).toEqual([1, 53]);

    const apiRoot = tree[1];
    expect(apiRoot?.virtual).toBe(true);
    expect(
      updateSelectedPermissionIds(tree, [], apiRoot?.id || 0, true, true),
    ).toEqual([53]);
  });
});
