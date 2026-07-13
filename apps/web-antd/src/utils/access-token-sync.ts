import { useAccessStore } from '@vben/stores';

import { destroyAllMfaOverlayDialogs } from '#/utils/security/mfa-overlay';
import { runSessionStateMutation } from '#/utils/session-state-gate';

// AccessTokenRotation 表示同一登录身份在其他标签页完成的 token 轮换。
interface AccessTokenRotation {
  nextToken: string;
  sourceToken: string;
  type: 'rotate';
}

// ACCESS_TOKEN_SYNC_CHANNEL 是多标签页 token 轮换广播通道。
const ACCESS_TOKEN_SYNC_CHANNEL = 'admin:access-token-sync';
// ACCESS_TOKEN_SYNC_STORAGE_KEY 为不支持 BroadcastChannel 的浏览器提供 storage 事件回退。
const ACCESS_TOKEN_SYNC_STORAGE_KEY = 'admin:access-token-rotation';

let accessTokenChannel: BroadcastChannel | null = null;
let accessTokenSyncInitialized = false;

// setupAccessTokenSync 启动当前标签页监听；重复调用不会注册多份事件。
export function setupAccessTokenSync() {
  if (accessTokenSyncInitialized || typeof window === 'undefined') {
    return;
  }
  accessTokenSyncInitialized = true;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      accessTokenChannel = new BroadcastChannel(ACCESS_TOKEN_SYNC_CHANNEL);
      accessTokenChannel.addEventListener('message', (event) => {
        void applyAccessTokenRotation(event.data);
      });
    } catch {
      accessTokenChannel = null;
    }
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== ACCESS_TOKEN_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      void applyAccessTokenRotation(JSON.parse(event.newValue));
    } catch {
      // 非法跨标签页消息直接忽略，不能影响当前登录态。
    }
  });
}

// publishAccessTokenRotation 广播同一账号的 token 轮换，其他账号标签页会按 sourceToken 自动忽略。
export function publishAccessTokenRotation(
  sourceToken: string,
  nextToken: string,
) {
  const rotation = normalizeAccessTokenRotation({
    nextToken,
    sourceToken,
    type: 'rotate',
  });
  if (!rotation || rotation.sourceToken === rotation.nextToken) {
    return;
  }
  if (accessTokenChannel) {
    const broadcast = accessTokenChannel.postMessage.bind(accessTokenChannel);
    broadcast(rotation);
  }
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(
      ACCESS_TOKEN_SYNC_STORAGE_KEY,
      JSON.stringify(rotation),
    );
    localStorage.removeItem(ACCESS_TOKEN_SYNC_STORAGE_KEY);
  } catch {
    // 存储不可用时仍保留 BroadcastChannel 主路径。
  }
}

// applyAccessTokenRotation 仅在本标签页仍持有来源 token 时更新，防止旧账号广播覆盖新登录。
export async function applyAccessTokenRotation(value: unknown) {
  const rotation = normalizeAccessTokenRotation(value);
  if (!rotation) {
    return false;
  }
  return runSessionStateMutation(() => {
    const accessStore = useAccessStore();
    const currentToken = String(accessStore.accessToken || '');
    if (currentToken === rotation.nextToken) {
      return true;
    }
    if (!currentToken || currentToken !== rotation.sourceToken) {
      return false;
    }
    destroyAllMfaOverlayDialogs();
    accessStore.setAccessToken(rotation.nextToken);
    return true;
  });
}

// normalizeAccessTokenRotation 校验跨标签页消息结构，避免异常值污染当前 store。
function normalizeAccessTokenRotation(
  value: unknown,
): AccessTokenRotation | null {
  const rotation = value as null | Partial<AccessTokenRotation>;
  const sourceToken = String(rotation?.sourceToken || '').trim();
  const nextToken = String(rotation?.nextToken || '').trim();
  if (rotation?.type !== 'rotate' || !sourceToken || !nextToken) {
    return null;
  }
  return { nextToken, sourceToken, type: 'rotate' };
}
