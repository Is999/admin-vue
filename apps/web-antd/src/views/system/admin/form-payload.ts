import type { SystemAdminApi } from '#/api/system';

// AdminFormValues 表示管理员抽屉内部表单字段，状态仅用于编辑时调用专用接口。
export interface AdminFormValues {
  avatar?: string; // 头像地址
  description?: string; // 备注说明
  email?: string; // 邮箱
  mfaStatus?: SystemAdminApi.Status; // MFA 启用状态
  password?: string; // 登录密码
  phone?: string; // 手机号
  realName?: string; // 真实姓名
  status?: SystemAdminApi.Status; // 账号启用状态
  username?: string; // 登录用户名
}

// buildCreateAdminParams 只组装新增接口真实接收的字段。
export function buildCreateAdminParams(
  values: AdminFormValues,
  roleIDs: number[],
): SystemAdminApi.CreateParams {
  return {
    avatar: String(values.avatar || ''),
    description: String(values.description || ''),
    email: String(values.email || ''),
    password: String(values.password || ''),
    phone: String(values.phone || ''),
    realName: String(values.realName || ''),
    roleIDs: [...roleIDs],
    username: String(values.username || '').trim(),
  };
}

// buildUpdateAdminParams 只组装基础资料和角色字段，账号与 MFA 状态由专用接口处理。
export function buildUpdateAdminParams(
  values: AdminFormValues,
  roleIDs: number[],
): SystemAdminApi.UpdateParams {
  const payload: SystemAdminApi.UpdateParams = {
    avatar: String(values.avatar || ''),
    description: String(values.description || ''),
    email: String(values.email || ''),
    isUpdateRoles: true,
    phone: String(values.phone || ''),
    realName: String(values.realName || ''),
    roleIDs: [...roleIDs],
  };
  if (String(values.password || '').trim()) {
    payload.password = String(values.password);
  }
  return payload;
}
