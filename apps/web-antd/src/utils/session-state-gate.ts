// sessionStateTail 串行化会改写登录态、权限仓库或动态路由的异步临界区。
let sessionStateTail: Promise<void> = Promise.resolve();
// sessionStateVersion 只在账号建立、清理或失效时递增，token 续签不改变账号身份版本。
let sessionStateVersion = 0;
// sessionStateIdentity 标记当前页面运行期的登录身份，刷新 token 时保持不变。
let sessionStateIdentity = createSessionStateIdentity();
// sessionStateCleanups 保存账号切换时必须同步清理的会话级缓存回调。
const sessionStateCleanups = new Set<() => void>();

// SESSION_STATE_CHANGED 表示异步结果所属账号已经失效。
export const SESSION_STATE_CHANGED = 'SESSION_STATE_CHANGED';

// runSessionStateMutation 保证账号切换与动态路由重建不会交叉提交全局状态。
export async function runSessionStateMutation<T>(
  mutation: () => Promise<T> | T,
): Promise<T> {
  const previous = sessionStateTail;
  let release = () => {};
  sessionStateTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await mutation();
  } finally {
    release();
  }
}

// currentSessionStateVersion 返回当前账号身份版本，供异步读取结果在提交前校验。
export function currentSessionStateVersion() {
  return sessionStateVersion;
}

// currentSessionStateIdentity 返回当前登录身份标记，用于隔离 MFA 票据等会话级缓存。
export function currentSessionStateIdentity() {
  return sessionStateIdentity;
}

// registerSessionStateCleanup 注册账号切换清理回调，避免敏感会话缓存残留到下一账号。
export function registerSessionStateCleanup(cleanup: () => void) {
  sessionStateCleanups.add(cleanup);
  return () => sessionStateCleanups.delete(cleanup);
}

// runSessionTransition 串行提交账号身份切换，并让旧异步任务在写全局状态前可识别失效。
export function runSessionTransition<T>(
  transition: () => Promise<T> | T,
): Promise<T> {
  return runSessionStateMutation(async () => {
    advanceSessionStateIdentity();
    return await transition();
  });
}

// runSessionTransitionIf 在串行锁内复检来源会话，仅允许仍有效的异步分支提交身份切换。
export function runSessionTransitionIf(
  isCurrent: () => boolean,
  transition: () => Promise<unknown> | unknown,
): Promise<boolean> {
  return runSessionStateMutation(async () => {
    if (!isCurrent()) {
      return false;
    }
    advanceSessionStateIdentity();
    await transition();
    return true;
  });
}

// advanceSessionStateIdentity 推进账号版本并废弃上一身份的会话级缓存。
function advanceSessionStateIdentity() {
  for (const cleanup of sessionStateCleanups) {
    try {
      cleanup();
    } catch {
      // 单个缓存清理失败不能阻断退出或账号切换主流程。
    }
  }
  sessionStateVersion += 1;
  sessionStateIdentity = createSessionStateIdentity();
}

// createSessionStateIdentity 创建仅用于前端状态隔离的运行期标记，不参与后端鉴权。
function createSessionStateIdentity() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
