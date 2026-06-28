<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import type { DrawerProps, ExtendedDrawerApi } from './drawer';

import {
  computed,
  onBeforeUnmount,
  onDeactivated,
  provide,
  ref,
  unref,
  useId,
  watch,
} from 'vue';

import {
  useIsMobile,
  usePriorityValues,
  useSimpleLocale,
} from '@vben-core/composables';
import { Expand, Shrink, X } from '@vben-core/icons';
import {
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  VbenButton,
  VbenHelpTooltip,
  VbenIconButton,
  VbenLoading,
  VisuallyHidden,
} from '@vben-core/shadcn-ui';
import { ELEMENT_ID_MAIN_CONTENT } from '@vben-core/shared/constants';
import { globalShareState } from '@vben-core/shared/global-state';
import { cn } from '@vben-core/shared/utils';

interface Props extends DrawerProps {
  drawerApi?: ExtendedDrawerApi;
}

const props = withDefaults(defineProps<Props>(), {
  appendToMain: false,
  closeIconPlacement: 'right',
  destroyOnClose: false,
  drawerApi: undefined,
  submitting: false,
  zIndex: 1000,
});

const components = globalShareState.getComponents();

const id = useId();
provide('DISMISSABLE_DRAWER_ID', id);

// @ts-expect-error unused
const wrapperRef = ref<HTMLElement>();
const { $t } = useSimpleLocale();
const { isMobile } = useIsMobile();

const state = props.drawerApi?.useStore?.();

const {
  appendToMain,
  cancelText,
  class: drawerClass,
  closable,
  closeIconPlacement,
  closeOnClickModal,
  closeOnPressEscape,
  confirmLoading,
  confirmText,
  contentClass,
  description,
  destroyOnClose,
  footer: showFooter,
  footerClass,
  fullscreen,
  fullscreenButton,
  header: showHeader,
  headerClass,
  loading: showLoading,
  modal,
  openAutoFocus,
  overlayBlur,
  placement,
  resizable,
  resizeMaxWidth,
  resizeMinWidth,
  showCancelButton,
  showConfirmButton,
  submitting,
  title,
  titleTooltip,
  width,
  zIndex,
} = usePriorityValues(props, state);

// watch(
//   () => showLoading.value,
//   (v) => {
//     if (v && wrapperRef.value) {
//       wrapperRef.value.scrollTo({
//         // behavior: 'smooth',
//         top: 0,
//       });
//     }
//   },
// );

/**
 * 在开启keepAlive情况下 直接通过浏览器按钮/手势等返回 不会关闭弹窗
 */
onDeactivated(() => {
  // 如果弹窗没有被挂载到内容区域，则关闭弹窗
  if (!appendToMain.value) {
    props.drawerApi?.close();
  }
});

function interactOutside(e: Event) {
  if (!closeOnClickModal.value || submitting.value) {
    e.preventDefault();
  }
}
function escapeKeyDown(e: KeyboardEvent) {
  if (!closeOnPressEscape.value || submitting.value) {
    e.preventDefault();
  }
}
// pointer-down-outside
function pointerDownOutside(e: Event) {
  const target = e.target as HTMLElement;
  const dismissableDrawer = target?.dataset.dismissableDrawer;
  if (
    submitting.value ||
    !closeOnClickModal.value ||
    dismissableDrawer !== id
  ) {
    e.preventDefault();
  }
}

function handerOpenAutoFocus(e: Event) {
  if (!openAutoFocus.value) {
    e?.preventDefault();
  }
}

function handleFocusOutside(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

const getAppendTo = computed(() => {
  return appendToMain.value
    ? `#${ELEMENT_ID_MAIN_CONTENT}>div:not(.absolute)>div`
    : undefined;
});

// 只在右侧桌面抽屉显示铺满按钮，避免顶部/底部抽屉出现无效控制。
const canToggleFullscreen = computed(
  () =>
    fullscreenButton.value && placement.value === 'right' && !isMobile.value,
);

function handleFullscreen() {
  props.drawerApi?.setState((prev) => ({
    ...prev,
    fullscreen: !fullscreen.value,
  }));
}

const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);

// 仅右侧桌面抽屉支持拖拽宽度，移动端和铺满状态保持原有全宽布局。
const canResize = computed(
  () =>
    resizable.value &&
    placement.value === 'right' &&
    !isMobile.value &&
    !fullscreen.value,
);

const getDrawerStyle = computed<CSSProperties | undefined>(() => {
  if (
    fullscreen.value ||
    isMobile.value ||
    placement.value === 'bottom' ||
    placement.value === 'top' ||
    width.value === undefined ||
    width.value === ''
  ) {
    return undefined;
  }

  return {
    maxWidth: getResizeMaxStyle(),
    width: formatDrawerWidth(width.value),
  };
});

function formatDrawerWidth(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value;
}

function getResizeBounds() {
  const minWidth = Math.max(320, Number(resizeMinWidth.value) || 420);
  const viewportMax =
    typeof window === 'undefined'
      ? Number.POSITIVE_INFINITY
      : Math.max(minWidth, window.innerWidth - 16);
  const maxWidth = Number(resizeMaxWidth.value) || viewportMax;

  return {
    maxWidth: Math.max(minWidth, Math.min(maxWidth, viewportMax)),
    minWidth,
  };
}

function getResizeMaxStyle() {
  const maxWidth = Number(resizeMaxWidth.value);

  return maxWidth > 0
    ? `min(${maxWidth}px, calc(100vw - 16px))`
    : 'calc(100vw - 16px)';
}

function getResizeHost(target: EventTarget | null) {
  return target instanceof HTMLElement ? target.parentElement : undefined;
}

function setDrawerWidth(nextWidth: number) {
  const { maxWidth, minWidth } = getResizeBounds();
  const drawerWidth = Math.round(
    Math.min(maxWidth, Math.max(minWidth, nextWidth)),
  );

  props.drawerApi?.setState((prev) => ({
    ...prev,
    width: drawerWidth,
  }));
}

function handleResizePointerDown(event: PointerEvent) {
  if (!canResize.value || event.button !== 0) {
    return;
  }

  const host = getResizeHost(event.currentTarget);
  if (!host) {
    return;
  }

  event.preventDefault();
  resizeStartX.value = event.clientX;
  resizeStartWidth.value = host.getBoundingClientRect().width;
  isResizing.value = true;

  if (typeof document !== 'undefined') {
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', handleResizePointerMove);
    document.addEventListener('pointerup', stopResize, { once: true });
    document.addEventListener('pointercancel', stopResize, { once: true });
  }
}

function handleResizePointerMove(event: PointerEvent) {
  if (!isResizing.value) {
    return;
  }

  setDrawerWidth(resizeStartWidth.value + resizeStartX.value - event.clientX);
}

function handleResizeKeydown(event: KeyboardEvent) {
  if (!canResize.value) {
    return;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }

  const host = getResizeHost(event.currentTarget);
  if (!host) {
    return;
  }

  event.preventDefault();
  const step = event.shiftKey ? 80 : 24;
  const direction = event.key === 'ArrowLeft' ? 1 : -1;
  setDrawerWidth(host.getBoundingClientRect().width + step * direction);
}

function stopResize() {
  if (!isResizing.value) {
    return;
  }

  isResizing.value = false;

  if (typeof document !== 'undefined') {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', stopResize);
    document.removeEventListener('pointercancel', stopResize);
  }
}

onBeforeUnmount(stopResize);

/**
 * destroyOnClose功能完善
 */
// 是否打开过
const hasOpened = ref(false);
const isClosed = ref(true);
watch(
  () => state?.value?.isOpen,
  (value) => {
    if (!value) {
      stopResize();
    }
    isClosed.value = false;
    if (value && !unref(hasOpened)) {
      hasOpened.value = true;
    }
  },
);
function handleClosed() {
  isClosed.value = true;
  props.drawerApi?.onClosed();
}
const getForceMount = computed(() => {
  return !unref(destroyOnClose) && unref(hasOpened);
});
</script>
<template>
  <Sheet
    :modal="false"
    :open="state?.isOpen"
    @update:open="() => drawerApi?.close()"
  >
    <SheetContent
      :append-to="getAppendTo"
      :class="
        cn('relative flex w-130 flex-col', drawerClass, {
          'w-full! max-w-full!':
            fullscreen ||
            isMobile ||
            placement === 'bottom' ||
            placement === 'top',
          'max-h-screen': placement === 'bottom' || placement === 'top',
          hidden: isClosed,
        })
      "
      :style="getDrawerStyle"
      :modal="modal"
      :open="state?.isOpen"
      :side="placement"
      :z-index="zIndex"
      :force-mount="getForceMount"
      :overlay-blur="overlayBlur"
      @close-auto-focus="handleFocusOutside"
      @closed="handleClosed"
      @escape-key-down="escapeKeyDown"
      @focus-outside="handleFocusOutside"
      @interact-outside="interactOutside"
      @open-auto-focus="handerOpenAutoFocus"
      @opened="() => drawerApi?.onOpened()"
      @pointer-down-outside="pointerDownOutside"
    >
      <div
        v-if="canResize"
        role="separator"
        tabindex="0"
        :aria-label="$t('resizeDrawer')"
        :class="
          cn('drawer-resize-handle', {
            'drawer-resize-handle--active': isResizing,
          })
        "
        @keydown="handleResizeKeydown"
        @pointerdown="handleResizePointerDown"
      ></div>
      <SheetHeader
        v-if="showHeader"
        :class="
          cn(
            'flex! flex-row items-center justify-between border-b px-6 py-5',
            headerClass,
            {
              'px-4 py-3': closable,
              'pl-2': closable && closeIconPlacement === 'left',
            },
          )
        "
      >
        <div class="flex items-center">
          <SheetClose
            v-if="closable && closeIconPlacement === 'left'"
            as-child
            :disabled="submitting"
            class="ml-0.5 cursor-pointer rounded-full opacity-80 transition-opacity hover:opacity-100 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary"
          >
            <slot name="close-icon">
              <VbenIconButton>
                <X class="size-4" />
              </VbenIconButton>
            </slot>
          </SheetClose>
          <Separator
            v-if="closable && closeIconPlacement === 'left'"
            class="mr-2 ml-1 h-8"
            decorative
            orientation="vertical"
          />
          <SheetTitle v-if="title" class="text-left">
            <slot name="title">
              {{ title }}

              <VbenHelpTooltip v-if="titleTooltip" trigger-class="pb-1">
                {{ titleTooltip }}
              </VbenHelpTooltip>
            </slot>
          </SheetTitle>
          <SheetDescription v-if="description" class="mt-1 text-xs">
            <slot name="description">
              {{ description }}
            </slot>
          </SheetDescription>
        </div>

        <VisuallyHidden v-if="!title || !description">
          <SheetTitle v-if="!title" />
          <SheetDescription v-if="!description" />
        </VisuallyHidden>

        <div class="flex-center">
          <slot name="extra"></slot>
          <VbenIconButton
            v-if="canToggleFullscreen"
            class="mx-0.5 size-7 text-foreground/80 opacity-70 transition-opacity hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus:outline-hidden disabled:pointer-events-none"
            :disabled="submitting"
            :tooltip="fullscreen ? $t('restore') : $t('maximize')"
            @click="handleFullscreen"
          >
            <Shrink v-if="fullscreen" class="size-3.5" />
            <Expand v-else class="size-3.5" />
          </VbenIconButton>
          <SheetClose
            v-if="closable && closeIconPlacement === 'right'"
            as-child
            :disabled="submitting"
            class="ml-0.5 cursor-pointer rounded-full opacity-80 transition-opacity hover:opacity-100 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary"
          >
            <slot name="close-icon">
              <VbenIconButton>
                <X class="size-4" />
              </VbenIconButton>
            </slot>
          </SheetClose>
        </div>
      </SheetHeader>
      <template v-else>
        <VisuallyHidden>
          <SheetTitle />
          <SheetDescription />
        </VisuallyHidden>
      </template>
      <div
        ref="wrapperRef"
        :class="
          cn('relative flex-1 overflow-y-auto p-3', contentClass, {
            'pointer-events-none': showLoading || submitting,
          })
        "
      >
        <slot></slot>
      </div>
      <VbenLoading v-if="showLoading || submitting" spinning />
      <SheetFooter
        v-if="showFooter"
        :class="
          cn(
            'w-full flex-row items-center justify-end border-t p-2 px-3',
            footerClass,
          )
        "
      >
        <slot name="prepend-footer"></slot>
        <slot name="footer">
          <component
            :is="components.DefaultButton || VbenButton"
            v-if="showCancelButton"
            variant="ghost"
            :disabled="submitting"
            @click="() => drawerApi?.onCancel()"
          >
            <slot name="cancelText">
              {{ cancelText || $t('cancel') }}
            </slot>
          </component>
          <slot name="center-footer"></slot>
          <component
            :is="components.PrimaryButton || VbenButton"
            v-if="showConfirmButton"
            :loading="confirmLoading || submitting"
            @click="() => drawerApi?.onConfirm()"
          >
            <slot name="confirmText">
              {{ confirmText || $t('confirm') }}
            </slot>
          </component>
        </slot>
        <slot name="append-footer"></slot>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.drawer-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  z-index: 20;
  width: 10px;
  touch-action: none;
  cursor: col-resize;
}

.drawer-resize-handle::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 56px;
  content: '';
  background: hsl(var(--border));
  border-radius: 999px;
  opacity: 0;
  transform: translate(-50%, -50%);
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.drawer-resize-handle:hover::after,
.drawer-resize-handle:focus-visible::after,
.drawer-resize-handle--active::after {
  background: hsl(var(--primary));
  opacity: 0.75;
}
</style>
