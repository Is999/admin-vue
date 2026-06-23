<script lang="ts" setup>
import type { NotificationItem } from './types';

import { Bell, CircleCheckBig, CircleX, MailCheck } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { useToggle } from '@vueuse/core';

defineOptions({ name: 'NotificationPopup' });

withDefaults(
  defineProps<{
    /** 显示圆点 */
    dot?: boolean;
    /** 消息列表 */
    notifications?: NotificationItem[];
  }>(),
  {
    dot: false,
    notifications: () => [],
  },
);

const emit = defineEmits<{
  clear: [];
  makeAll: [];
  onClick: [NotificationItem];
  read: [NotificationItem];
  remove: [NotificationItem];
  viewAll: [];
}>();

const [open, toggle] = useToggle();

const close = () => {
  open.value = false;
};

const handleViewAll = () => {
  emit('viewAll');
  close();
};

const handleMakeAll = () => {
  emit('makeAll');
};

const handleClear = () => {
  emit('clear');
};
</script>
<template>
  <VbenPopover
    v-model:open="open"
    content-class="relative right-2 w-[420px] max-w-[calc(100vw-24px)] p-0"
  >
    <template #trigger>
      <div class="mr-2 flex-center h-full" @click.stop="toggle()">
        <VbenIconButton class="bell-button relative text-foreground">
          <span
            v-if="dot"
            class="absolute top-0.5 right-0.5 size-2 rounded-sm bg-primary"
          ></span>
          <Bell class="size-4" />
        </VbenIconButton>
      </div>
    </template>

    <div class="notification-popup__panel">
      <div class="notification-popup__header">
        <div class="notification-popup__title">
          {{ $t('ui.widgets.notifications') }}
        </div>
        <VbenIconButton
          :disabled="notifications.length <= 0"
          :tooltip="$t('ui.widgets.markAllAsRead')"
          @click="handleMakeAll"
        >
          <MailCheck class="size-4" />
        </VbenIconButton>
      </div>
      <VbenScrollbar v-if="notifications.length > 0">
        <ul class="notification-popup__list">
          <template v-for="item in notifications" :key="item.id ?? item.title">
            <li
              class="notification-card"
              :class="{ 'notification-card--unread': !item.isRead }"
              @click="emit('onClick', item)"
            >
              <slot name="content" :item="item">
                <span class="notification-card__avatar">
                  <img
                    :src="item.avatar"
                    class="aspect-square size-full object-cover"
                  />
                  <span
                    v-if="!item.isRead"
                    class="notification-card__status"
                  ></span>
                </span>
                <div class="notification-card__body">
                  <p class="notification-card__title">{{ item.title }}</p>
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    v-if="item.messageHtml"
                    class="notification-card__message"
                    v-html="item.messageHtml"
                  ></div>
                  <!-- eslint-enable vue/no-v-html -->
                  <p v-else class="notification-card__message">
                    {{ item.message }}
                  </p>
                  <p class="notification-card__date">{{ item.date }}</p>
                </div>
                <div class="notification-card__actions">
                  <slot name="action" :item="item">
                    <slot name="action-prepend" :item="item"></slot>
                    <VbenIconButton
                      v-if="!item.isRead"
                      size="xs"
                      variant="ghost"
                      class="notification-card__action"
                      :tooltip="$t('common.confirm')"
                      @click.stop="emit('read', item)"
                    >
                      <CircleCheckBig class="size-4" />
                    </VbenIconButton>
                    <VbenIconButton
                      v-if="item.isRead"
                      size="xs"
                      variant="ghost"
                      class="notification-card__action notification-card__action--danger"
                      :tooltip="$t('common.delete')"
                      @click.stop="emit('remove', item)"
                    >
                      <CircleX class="size-4" />
                    </VbenIconButton>
                    <slot name="action-append" :item="item"></slot>
                  </slot>
                </div>
              </slot>
            </li>
          </template>
        </ul>
      </VbenScrollbar>

      <template v-else>
        <div class="notification-popup__empty">
          {{ $t('common.noData') }}
        </div>
      </template>

      <div class="notification-popup__footer">
        <VbenButton
          :disabled="notifications.length <= 0"
          size="sm"
          variant="ghost"
          @click="handleClear"
        >
          {{ $t('ui.widgets.clearNotifications') }}
        </VbenButton>
        <VbenButton size="sm" @click="handleViewAll">
          {{ $t('ui.widgets.viewAll') }}
        </VbenButton>
      </div>
    </div>
  </VbenPopover>
</template>

<style scoped>
:deep(.bell-button) {
  &:hover {
    svg {
      animation: bell-ring 1s both;
    }
  }
}

.notification-popup__panel {
  box-sizing: border-box;
  width: 420px;
  max-width: calc(100vw - 24px);
  overflow: hidden;
}

.notification-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.notification-popup__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.notification-popup__list {
  display: flex !important;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-height: 360px;
  padding: 10px;
}

.notification-card {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 32px;
  gap: 12px;
  align-items: flex-start;
  padding: 10px;
  cursor: pointer;
  background: hsl(var(--accent) / 18%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.notification-card:hover {
  background: hsl(var(--accent) / 38%);
}

.notification-card--unread {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 22%);
}

.notification-card__avatar {
  position: relative;
  display: flex;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.notification-card__status {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  background: hsl(var(--primary));
  border: 2px solid hsl(var(--popover));
  border-radius: 999px;
}

.notification-card__body {
  min-width: 0;
  padding-top: 1px;
}

.notification-card__title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.notification-card__message {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.notification-card__message :deep(*) {
  display: inline;
  padding: 0;
  margin: 0;
  font-size: inherit;
  line-height: inherit;
}

.notification-card__message :deep(br),
.notification-card__message :deep(img) {
  display: none;
}

.notification-card__message :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}

.notification-card__date {
  margin: 8px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 1.3;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.notification-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  padding-top: 2px;
}

.notification-card__action {
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
}

.notification-card__action:hover {
  color: hsl(var(--foreground));
}

.notification-card__action--danger {
  color: hsl(var(--destructive));
}

.notification-popup__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 150px;
  color: hsl(var(--muted-foreground));
}

.notification-popup__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid hsl(var(--border));
}

@keyframes bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}
</style>
