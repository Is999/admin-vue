// ACCESS_SYNC_INTERVAL_MS 表示前端登录态权限自动同步间隔，避免权限变更后长期使用旧菜单。
export const ACCESS_SYNC_INTERVAL_MS = 60_000;

// ACCESS_SYNC_THROTTLE_MS 表示权限同步最小间隔；403 触发和定时器共享节流，防止接口异常时刷屏请求。
export const ACCESS_SYNC_THROTTLE_MS = 55_000;

// ACCESS_SYNC_FORBIDDEN_EVENT 表示请求层遇到无权限响应后通知布局层刷新权限态的浏览器事件名。
export const ACCESS_SYNC_FORBIDDEN_EVENT = 'admin-access-forbidden';
