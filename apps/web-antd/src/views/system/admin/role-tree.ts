import type { SystemRoleApi } from '#/api/system';

// AdminRoleTreeNode 表示管理员角色选择树节点。
export type AdminRoleTreeNode = Record<string, any>;

// buildAdminRoleTreeOptions 构造管理员角色树选择项。
export function buildAdminRoleTreeOptions(
  items: SystemRoleApi.Item[],
  titleBuilder?: (item: SystemRoleApi.Item) => unknown,
): AdminRoleTreeNode[] {
  return items.map((item) => ({
    children: item.children?.length
      ? buildAdminRoleTreeOptions(item.children, titleBuilder)
      : [],
    disableCheckbox: item.disableCheckbox,
    disabled: item.disabled,
    id: item.id,
    key: item.id,
    pids: item.pids,
    rawTitle: item.title,
    selectable: item.selectable,
    title: titleBuilder ? titleBuilder(item) : item.title,
  }));
}

// buildAdminRoleRelationMaps 构造角色树父子关系，用于自定义勾选规则。
export function buildAdminRoleRelationMaps(items: AdminRoleTreeNode[]) {
  const childrenById = new Map<number, number[]>();
  const nodeById = new Map<number, AdminRoleTreeNode>();
  const parentById = new Map<number, number>();
  const walk = (nodes: AdminRoleTreeNode[], parentID?: number) => {
    for (const item of nodes) {
      nodeById.set(item.id, item);
      if (parentID) {
        parentById.set(item.id, parentID);
      }
      const childIDs = (item.children || []).map(
        (child: AdminRoleTreeNode) => child.id,
      );
      childrenById.set(item.id, childIDs);
      if (item.children?.length) {
        walk(item.children, item.id);
      }
    }
  };
  walk(items);
  return { childrenById, nodeById, parentById };
}

// isAdminRoleNodeCheckable 判断角色节点当前是否允许勾选。
export function isAdminRoleNodeCheckable(node?: AdminRoleTreeNode) {
  return Boolean(
    node && !node.disableCheckbox && !node.disabled && Number(node.id) > 0,
  );
}

// collectAllAdminRoleNodeIds 收集整棵角色树节点 ID。
export function collectAllAdminRoleNodeIds(items: AdminRoleTreeNode[]) {
  const result: number[] = [];
  const walk = (nodes: AdminRoleTreeNode[]) => {
    for (const item of nodes) {
      result.push(item.id);
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(items);
  return result;
}

// collectAdminRoleIds 收集树中的全部可选角色 ID。
export function collectAdminRoleIds(items: AdminRoleTreeNode[]) {
  const result: number[] = [];
  const walk = (nodes: AdminRoleTreeNode[]) => {
    for (const item of nodes) {
      if (isAdminRoleNodeCheckable(item)) {
        result.push(item.id);
      }
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(items);
  return result;
}

// collectAdminRoleSubtreeIds 收集当前角色节点及其全部可勾选子节点。
export function collectAdminRoleSubtreeIds(
  nodeID: number,
  childrenById: Map<number, number[]>,
  nodeById: Map<number, AdminRoleTreeNode>,
) {
  const result: number[] = [];
  const walk = (currentID: number) => {
    const node = nodeById.get(currentID);
    if (isAdminRoleNodeCheckable(node)) {
      result.push(currentID);
    }
    for (const childID of childrenById.get(currentID) || []) {
      walk(childID);
    }
  };
  walk(nodeID);
  return result;
}

// pruneInheritedAdminRoleIds 过滤已被父角色覆盖的子角色。
export function pruneInheritedAdminRoleIds(
  roleIDs: number[],
  nodes: AdminRoleTreeNode[],
) {
  const uniqueRoleIDs = [
    ...new Set((roleIDs || []).map(Number).filter((item) => item > 0)),
  ];
  if (uniqueRoleIDs.length <= 1) {
    return uniqueRoleIDs;
  }
  const rolePidsMap = new Map<number, string>();
  const walk = (items: AdminRoleTreeNode[]) => {
    for (const item of items) {
      rolePidsMap.set(Number(item.id), String(item.pids || ''));
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(nodes);
  return uniqueRoleIDs.filter((roleID) => {
    const pids = rolePidsMap.get(roleID) || '';
    return !uniqueRoleIDs.some((parentRoleID) => {
      if (parentRoleID === roleID) {
        return false;
      }
      return pids.split(',').includes(String(parentRoleID));
    });
  });
}
