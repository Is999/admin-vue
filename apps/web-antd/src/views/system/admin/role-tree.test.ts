import { describe, expect, it } from 'vitest';

import {
  buildAdminRoleRelationMaps,
  buildAdminRoleTreeOptions,
  collectAdminRoleIds,
  collectAdminRoleSubtreeIds,
  collectAllAdminRoleNodeIds,
  isAdminRoleNodeCheckable,
  pruneInheritedAdminRoleIds,
} from './role-tree';

const roles = [
  {
    children: [
      {
        children: [],
        disableCheckbox: false,
        disabled: false,
        id: 2,
        pids: '1',
        selectable: true,
        title: '运营主管',
      },
      {
        children: [],
        disableCheckbox: true,
        disabled: true,
        id: 3,
        pids: '1',
        selectable: false,
        title: '停用角色',
      },
    ],
    disableCheckbox: false,
    disabled: false,
    id: 1,
    pids: '',
    selectable: true,
    title: '运营管理员',
  },
] as any;

describe('admin role tree helpers', () => {
  it('builds role tree options with custom title renderer', () => {
    const tree = buildAdminRoleTreeOptions(
      roles,
      (item) => `角色:${item.title}`,
    );

    expect(tree[0]?.title).toBe('角色:运营管理员');
    expect(tree[0]?.rawTitle).toBe('运营管理员');
    expect(tree[0]?.children?.[0]?.title).toBe('角色:运营主管');
  });

  it('collects relation maps and checkable ids consistently', () => {
    const tree = buildAdminRoleTreeOptions(roles);
    const { childrenById, nodeById, parentById } =
      buildAdminRoleRelationMaps(tree);

    expect(childrenById.get(1)).toEqual([2, 3]);
    expect(parentById.get(2)).toBe(1);
    expect(isAdminRoleNodeCheckable(nodeById.get(2))).toBe(true);
    expect(isAdminRoleNodeCheckable(nodeById.get(3))).toBe(false);
    expect(collectAllAdminRoleNodeIds(tree)).toEqual([1, 2, 3]);
    expect(collectAdminRoleIds(tree)).toEqual([1, 2]);
    expect(collectAdminRoleSubtreeIds(1, childrenById, nodeById)).toEqual([
      1, 2,
    ]);
  });

  it('prunes child role ids when parent role is already selected', () => {
    const tree = buildAdminRoleTreeOptions(roles);

    expect(pruneInheritedAdminRoleIds([2, 1, 3], tree)).toEqual([1]);
    expect(pruneInheritedAdminRoleIds([2, 3], tree)).toEqual([2, 3]);
  });
});
