import { describe, expect, it } from 'vitest';

import {
  buildDisplayedPermissionCheckedIds,
  buildPermissionViewTree,
  collectPermissionState,
} from './permission-tree';

// renderTitle 返回测试用标题，不依赖 Vue 渲染，专注验证权限树过滤逻辑。
const renderTitle = (item: { title: string }) => item.title;

describe('permission tree view builder', () => {
  it('filters permission nodes by type while keeping matched ancestors', () => {
    const tree = [
      {
        checked: false,
        children: [
          {
            checked: false,
            description: '',
            disableCheckbox: false,
            disabled: false,
            id: 2,
            module: 'role.add',
            pid: 1,
            pids: '1',
            selectable: true,
            status: 1,
            title: '新增角色',
            type: 1,
            uuid: '100002',
          },
          {
            checked: false,
            description: '',
            disableCheckbox: false,
            disabled: false,
            id: 3,
            module: 'role.delete',
            pid: 1,
            pids: '1',
            selectable: true,
            status: 1,
            title: '删除角色',
            type: 3,
            uuid: '100003',
          },
        ],
        description: '',
        disableCheckbox: false,
        disabled: false,
        id: 1,
        module: '',
        pid: 0,
        pids: '',
        selectable: true,
        status: 1,
        title: '角色管理',
        type: 5,
        uuid: '100001',
      },
    ] as any;

    const result = buildPermissionViewTree(tree, {
      displayedPermissionIds: [],
      permissionType: 3,
      renderTitle,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.children?.map((item) => item.id)).toEqual([3]);
  });

  it('keeps readonly checked permission nodes visible', () => {
    const tree = [
      {
        checked: false,
        children: [
          {
            checked: true,
            description: '',
            disableCheckbox: true,
            disabled: true,
            id: 2,
            module: 'role.update',
            pid: 1,
            pids: '1',
            selectable: false,
            status: 1,
            title: '编辑角色',
            type: 2,
            uuid: '100002',
          },
        ],
        description: '',
        disableCheckbox: true,
        disabled: true,
        id: 1,
        module: '',
        pid: 0,
        pids: '',
        selectable: false,
        status: 1,
        title: '角色管理',
        type: 5,
        uuid: '100001',
      },
    ] as any;

    const state = collectPermissionState(tree);

    expect(state.checkedIds).toEqual([2]);
    expect(state.readonlyCheckedIds).toEqual([2]);
    expect([...state.enabledIds]).toEqual([]);
    expect(buildDisplayedPermissionCheckedIds(tree, state.checkedIds)).toEqual([
      1, 2,
    ]);
  });

  it('marks the view tree readonly without losing checked nodes', () => {
    const tree = [
      {
        checked: true,
        children: [],
        description: '',
        disableCheckbox: false,
        disabled: false,
        id: 1,
        module: 'role.list',
        pid: 0,
        pids: '',
        selectable: true,
        status: 1,
        title: '查询角色',
        type: 0,
        uuid: '100001',
      },
    ] as any;

    const state = collectPermissionState(tree);
    const result = buildPermissionViewTree(tree, {
      displayedPermissionIds: state.checkedIds,
      readOnly: true,
      renderTitle,
    });

    expect(result[0]?.id).toBe(1);
    expect(result[0]?.disabled).toBe(true);
    expect(result[0]?.disableCheckbox).toBe(true);
    expect(result[0]?.selectable).toBe(false);
  });
});
