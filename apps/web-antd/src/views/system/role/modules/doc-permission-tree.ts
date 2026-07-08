import type { SystemPermissionApi, SystemRoleApi } from '#/api/system';

interface MutableDocTreeNode extends SystemPermissionApi.Item {
  children: MutableDocTreeNode[];
}

// buildDocPermissionTree 把后端平铺的 site + path 文档权限转换成前端虚拟目录树。
export function buildDocPermissionTree(
  permissions: SystemRoleApi.DocPermissionItem[],
): SystemPermissionApi.Item[] {
  let virtualID = -1;
  const roots = new Map<string, MutableDocTreeNode>();
  const groups = new Map<string, MutableDocTreeNode>();

  const createGroup = (
    title: string,
    site: string,
    path: string,
    parentID: number,
  ): MutableDocTreeNode => ({
    canCreateChild: false,
    checked: false,
    children: [],
    createdAt: '',
    description: path,
    disableCheckbox: false,
    disabled: false,
    hasChild: true,
    id: virtualID--,
    manageable: false,
    module: '',
    path,
    pid: parentID,
    pids: '',
    selectable: true,
    site,
    status: 1,
    title,
    type: 8,
    updatedAt: '',
    uuid: '',
    virtual: true,
  });

  for (const permission of permissions) {
    const site = String(permission.site || '').trim();
    const pathParts = String(permission.path || '')
      .split('/')
      .filter(Boolean);
    if (!site || pathParts.length === 0) {
      continue;
    }
    let root = roots.get(site);
    if (!root) {
      root = createGroup(site === 'api' ? 'API' : 'Admin', site, '', 0);
      roots.set(site, root);
    }
    let parent = root;
    let currentPath = '';
    for (const directory of pathParts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${directory}` : directory;
      const groupKey = `${site}\0${currentPath}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = createGroup(directory, site, currentPath, parent.id);
        groups.set(groupKey, group);
        parent.children.push(group);
      }
      parent = group;
    }
    parent.children.push({
      ...permission,
      canCreateChild: false,
      children: [],
      createdAt: '',
      hasChild: false,
      manageable: false,
      module: `${permission.site}/${permission.path}`,
      pid: parent.id,
      pids: '',
      type: 8,
      updatedAt: '',
      uuid: '',
      virtual: false,
    });
  }

  const normalizeGroups = (nodes: MutableDocTreeNode[]) => {
    for (const node of nodes) {
      normalizeGroups(node.children);
      if (node.virtual) {
        const usable = node.children.some((child) => !child.disabled);
        node.disabled = !usable;
        node.disableCheckbox = !usable;
        node.selectable = usable;
      }
    }
  };
  const result = [...roots.values()];
  normalizeGroups(result);
  return result;
}
