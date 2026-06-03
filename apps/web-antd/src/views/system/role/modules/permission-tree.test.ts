import { describe, expect, it } from 'vitest';

import { buildPermissionViewTree } from './permission-tree';

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
});
