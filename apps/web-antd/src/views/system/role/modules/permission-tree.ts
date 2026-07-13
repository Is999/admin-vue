import type { SystemPermissionApi } from '#/api/system';

// PermissionTreeNode 定义前端权限树展示节点。
export interface PermissionTreeNode {
  children?: PermissionTreeNode[];
  disableCheckbox?: boolean;
  description?: string;
  disabled?: boolean;
  id: number;
  key: number;
  module?: string;
  selectable?: boolean;
  title: any;
  type?: number;
  uuid?: string;
}

// collectPermissionState 从权限树提取已授权节点与可编辑节点。
export function collectPermissionState(items: SystemPermissionApi.Item[]) {
  const checkedIds: number[] = [];
  const enabledIds = new Set<number>();
  const readonlyCheckedIds: number[] = [];
  const walk = (nodes: SystemPermissionApi.Item[]) => {
    for (const item of nodes) {
      const checkable = isPermissionNodeCheckable(item);
      if (item.checked) {
        checkedIds.push(item.id);
        if (!checkable) {
          readonlyCheckedIds.push(item.id);
        }
      }
      if (checkable) {
        enabledIds.add(item.id);
      }
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(items);
  return {
    checkedIds,
    enabledIds,
    readonlyCheckedIds,
  };
}

interface PermissionTreeIDNode {
  children?: PermissionTreeIDNode[];
  id: number;
}

// collectPermissionIdsByDepth 按根节点为第 1 层收集指定深度范围内的权限节点 ID。
export function collectPermissionIdsByDepth(
  items: PermissionTreeIDNode[],
  minDepth = 1,
  maxDepth = Number.MAX_SAFE_INTEGER,
) {
  const safeMinDepth = Math.max(1, Math.trunc(Number(minDepth) || 1));
  const safeMaxDepth = Math.max(0, Math.trunc(Number(maxDepth) || 0));
  if (safeMaxDepth < safeMinDepth) {
    return [];
  }
  const result: number[] = [];
  const walk = (nodes: PermissionTreeIDNode[], depth: number) => {
    for (const item of nodes) {
      if (depth >= safeMinDepth && depth <= safeMaxDepth) {
        result.push(item.id);
      }
      if (item.children?.length) {
        walk(item.children, depth + 1);
      }
    }
  };
  walk(items, 1);
  return result;
}

// collectAllPermissionIds 收集整棵权限树的节点 ID，用于统一展开与收起。
export function collectAllPermissionIds(items: PermissionTreeIDNode[]) {
  return collectPermissionIdsByDepth(items);
}

// buildPermissionRelationMaps 构造权限树父子关系，用于自定义勾选联动逻辑。
export function buildPermissionRelationMaps(items: SystemPermissionApi.Item[]) {
  const childrenById = new Map<number, number[]>();
  const nodeById = new Map<number, SystemPermissionApi.Item>();
  const parentById = new Map<number, number>();
  const walk = (nodes: SystemPermissionApi.Item[], parentID?: number) => {
    for (const item of nodes) {
      nodeById.set(item.id, item);
      if (parentID) {
        parentById.set(item.id, parentID);
      }
      const childIDs = (item.children || []).map((child) => child.id);
      childrenById.set(item.id, childIDs);
      if (item.children?.length) {
        walk(item.children, item.id);
      }
    }
  };
  walk(items);
  return {
    childrenById,
    nodeById,
    parentById,
  };
}

// isPermissionNodeCheckable 判断权限节点当前是否允许勾选。
export function isPermissionNodeCheckable(node?: SystemPermissionApi.Item) {
  return Boolean(
    node && !node.disableCheckbox && !node.disabled && node.status === 1,
  );
}

// collectPermissionSubtreeIds 收集当前权限节点及其全部可勾选子节点。
export function collectPermissionSubtreeIds(
  nodeID: number,
  childrenById: Map<number, number[]>,
  nodeById: Map<number, SystemPermissionApi.Item>,
) {
  const result: number[] = [];
  const walk = (currentID: number) => {
    const node = nodeById.get(currentID);
    if (isPermissionNodeCheckable(node)) {
      result.push(currentID);
    }
    for (const childID of childrenById.get(currentID) || []) {
      walk(childID);
    }
  };
  walk(nodeID);
  return result;
}

// updateSelectedPermissionIds 按“子选父跟展示、父单击选自己/取消全子、父双击联动全子”规则更新实际提交集合。
export function updateSelectedPermissionIds(
  items: SystemPermissionApi.Item[],
  sourceSelectedIDs: number[],
  nodeID: number,
  nextChecked: boolean,
  cascadeChildren: boolean,
) {
  const { childrenById, nodeById } = buildPermissionRelationMaps(items);
  const selectedSet = new Set(sourceSelectedIDs);
  const addNode = (currentID: number) => {
    const currentNode = nodeById.get(currentID);
    if (!isPermissionNodeCheckable(currentNode)) {
      return;
    }
    selectedSet.add(currentID);
  };

  if (cascadeChildren) {
    const subtreeIDs = collectPermissionSubtreeIds(
      nodeID,
      childrenById,
      nodeById,
    );
    if (nextChecked) {
      subtreeIDs.forEach((item) => addNode(item));
    } else {
      subtreeIDs.forEach((item) => selectedSet.delete(item));
    }
  } else if (nextChecked) {
    addNode(nodeID);
  } else {
    const childIDs = childrenById.get(nodeID) || [];
    if (childIDs.length > 0) {
      collectPermissionSubtreeIds(nodeID, childrenById, nodeById).forEach(
        (item) => selectedSet.delete(item),
      );
    } else {
      selectedSet.delete(nodeID);
    }
  }

  return [...selectedSet].toSorted((a, b) => a - b);
}

// buildDisplayedPermissionCheckedIds 根据实际提交集合补齐父级展示勾选，避免“子选父不亮”影响阅读。
export function buildDisplayedPermissionCheckedIds(
  items: SystemPermissionApi.Item[],
  sourceSelectedIDs: number[],
) {
  const { nodeById, parentById } = buildPermissionRelationMaps(items);
  const checkedSet = new Set<number>();
  for (const currentID of sourceSelectedIDs) {
    const currentNode = nodeById.get(currentID);
    if (!currentNode) {
      continue;
    }
    checkedSet.add(currentID);
    let parentID = parentById.get(currentID);
    while (parentID) {
      const parentNode = nodeById.get(parentID);
      if (parentNode) {
        checkedSet.add(parentID);
      }
      parentID = parentById.get(parentID);
    }
  }
  return [...checkedSet].toSorted((a, b) => a - b);
}

// buildPermissionViewTree 根据关键字与只看已选条件生成前端展示树节点。
export function buildPermissionViewTree(
  items: SystemPermissionApi.Item[],
  options: {
    displayedPermissionIds: number[];
    keyword?: string;
    onlyShowChecked?: boolean;
    permissionType?: number;
    readOnly?: boolean;
    renderTitle: (item: SystemPermissionApi.Item) => any;
  },
): PermissionTreeNode[] {
  const keyword = String(options.keyword || '')
    .trim()
    .toLowerCase();
  // permissionType 表示当前筛选的权限类型；为空时不过滤类型，保留原始权限树。
  const permissionType =
    typeof options.permissionType === 'number' && options.permissionType >= 0
      ? options.permissionType
      : undefined;
  const readOnly = Boolean(options.readOnly);
  const checkedSet = new Set(options.displayedPermissionIds);
  const walk = (nodes: SystemPermissionApi.Item[]): PermissionTreeNode[] => {
    const result: PermissionTreeNode[] = [];
    for (const item of nodes) {
      const children = item.children?.length ? walk(item.children) : [];
      const matchedKeyword =
        keyword === '' ||
        [item.id, item.title, item.uuid, item.module, item.description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(keyword));
      const matchedType =
        permissionType === undefined || Number(item.type) === permissionType;
      const matchedChecked =
        !options.onlyShowChecked ||
        checkedSet.has(item.id) ||
        children.length > 0;
      if (
        ((matchedKeyword && matchedType) || children.length > 0) &&
        matchedChecked
      ) {
        result.push({
          children,
          disableCheckbox: readOnly || item.disableCheckbox,
          description: item.description,
          disabled: readOnly || item.disabled,
          id: item.id,
          key: item.id,
          module: item.module,
          selectable: readOnly ? false : item.selectable,
          title: options.renderTitle(item),
          type: item.type,
          uuid: item.uuid,
        });
      }
    }
    return result;
  };
  return walk(items);
}
