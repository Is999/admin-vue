<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal, useVbenModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { LockKeyhole } from '@vben/icons';
import {
  BasicLayout,
  LockScreenModal,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  deleteAdminMessage,
  fetchAdminMessageNotifications,
  markAdminMessageRead,
} from '#/api/message';
import {
  ACCESS_SYNC_FORBIDDEN_EVENT,
  ACCESS_SYNC_INTERVAL_MS,
} from '#/constants/access-sync';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { refreshAccessState } from '#/utils/access-sync';
import LoginForm from '#/views/_core/authentication/login.vue';

import AppIdBadge from './components/app-id-badge.vue';
import AppLockScreen from './components/app-lock-screen.vue';

// notifications 保存顶部铃铛展示的通知列表。
const notifications = ref<NotificationItem[]>([]);
// notificationPoller 保存通知轮询定时器句柄。
let notificationPoller: null | number = null;
// accessSyncPoller 保存权限态同步定时器句柄，后端角色/权限变更后前端菜单可自动收敛。
let accessSyncPoller: null | number = null;

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const [LockModal, lockModalApi] = useVbenModal({
  connectedComponent: LockScreenModal,
});
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'SystemProfile' }).catch(() => undefined);
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

// handleOpenLock 打开锁屏临时密码设置弹窗。
function handleOpenLock() {
  lockModalApi.open();
}

// handleSubmitLock 提交锁屏临时密码并进入锁屏状态。
function handleSubmitLock(lockScreenPassword: string) {
  lockModalApi.close();
  accessStore.lockScreen(lockScreenPassword);
}

function handleNoticeClear() {
  const ids = notifications.value
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id));
  if (ids.length === 0) {
    notifications.value = [];
    return;
  }
  deleteAdminMessage({ ids }).finally(() => {
    notifications.value = [];
  });
}

function markRead(id: number | string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item) {
    item.isRead = true;
  }
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) {
    return;
  }
  markAdminMessageRead({ ids: [messageId] }).catch(() => undefined);
}

function remove(id: number | string) {
  const messageId = Number(id);
  notifications.value = notifications.value.filter((item) => item.id !== id);
  if (!Number.isFinite(messageId)) {
    return;
  }
  deleteAdminMessage({ ids: [messageId] }).catch(() => undefined);
}

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
  markAdminMessageRead({ all: true }).catch(() => undefined);
}

function handleViewAllNotifications() {
  router.push({ path: '/profile-manage/message' }).catch(() => undefined);
}

function handleClick(item: NotificationItem) {
  if (item.link) {
    navigateTo(item.link, item.query, item.state);
  }
}

function navigateTo(
  link: string,
  query?: Record<string, any>,
  state?: Record<string, any>,
) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    window.open(link, '_blank');
    return;
  }

  router
    .push({
      path: link,
      query: query || {},
      state,
    })
    .catch(() => undefined);
}

// refreshNotifications 拉取最新通知列表并刷新本地状态。
async function refreshNotifications() {
  try {
    const items = await fetchAdminMessageNotifications({ limit: 10 });
    notifications.value = (items || []).map((item) => ({
      id: item.id,
      avatar: preferences.app.defaultAvatar,
      date: item.createdAt || '',
      isRead: item.isRead,
      link: item.link || undefined,
      message: item.content || '',
      title: item.title || '',
    }));
  } catch {
    notifications.value = [];
  }
}

// refreshAccessSilently 静默同步当前登录账号角色与权限码，失败时不打扰正常页面操作。
function refreshAccessSilently(reason: 'forbidden' | 'interval') {
  refreshAccessState(router, { reason }).catch(() => undefined);
}

// handleAccessForbiddenSync 在业务请求遇到无权限响应时触发一次节流权限同步，避免旧权限码导致菜单长时间不更新。
function handleAccessForbiddenSync() {
  refreshAccessSilently('forbidden');
}

onMounted(async () => {
  await refreshNotifications();
  notificationPoller = window.setInterval(() => {
    refreshNotifications().catch(() => undefined);
  }, 30_000);
  window.addEventListener(
    ACCESS_SYNC_FORBIDDEN_EVENT,
    handleAccessForbiddenSync,
  );
  accessSyncPoller = window.setInterval(() => {
    refreshAccessSilently('interval');
  }, ACCESS_SYNC_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (notificationPoller) {
    window.clearInterval(notificationPoller);
    notificationPoller = null;
  }
  if (accessSyncPoller) {
    window.clearInterval(accessSyncPoller);
    accessSyncPoller = null;
  }
  window.removeEventListener(
    ACCESS_SYNC_FORBIDDEN_EVENT,
    handleAccessForbiddenSync,
  );
});
watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #logo-text>
      <span class="flex min-w-0 items-baseline gap-1.5">
        <span
          class="min-w-0 truncate text-nowrap font-semibold text-foreground"
        >
          {{ preferences.app.name }}
        </span>
        <AppIdBadge />
      </span>
    </template>
    <template #header-right-15>
      <LockModal
        :avatar
        :text="userStore.userInfo?.realName"
        @submit="handleSubmitLock"
      />
    </template>
    <template #user-dropdown>
      <div class="flex-center mr-2 h-full" @click.stop="handleOpenLock">
        <button
          type="button"
          :aria-label="$t('ui.widgets.lockScreen.title')"
          class="flex-center h-8 w-8 bg-transparent px-1 text-lg text-foreground/80 transition-colors hover:text-foreground"
        >
          <LockKeyhole class="size-4" />
        </button>
      </div>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.username"
        tag-text="Admin"
        @logout="handleLogout"
        @clear-preferences-and-logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="handleViewAllNotifications"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <AppLockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
