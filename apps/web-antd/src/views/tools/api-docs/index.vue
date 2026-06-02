<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';

import { Alert, Spin } from 'ant-design-vue';

import { createDocsSession } from '#/api/docs';
import { $t } from '#/locales';

interface DocsPageProps {
  docsHash?: string; // docsify hash 路径，不含 /api/docs 前缀
  titleKey?: string; // iframe title 使用的 i18n key
}

defineOptions({ name: 'OpsApiDocsPage' });

const props = withDefaults(defineProps<DocsPageProps>(), {
  docsHash: '/',
  titleKey: 'admin.route.apiDocs',
});

// docsUrl 指向后端文档站入口；加载前必须先创建文档会话 cookie。
const docsUrl = computed(() => `/api/docs#${props.docsHash}`);
// docsReadyPollIntervalMs 控制检查 iframe 内文档渲染完成的频率。
const docsReadyPollIntervalMs = 120;
// docsReadyTimeoutMs 避免文档资源异常时 loading 一直停留。
const docsReadyTimeoutMs = 30_000;
// docsFrameRef 指向文档 iframe，用于判断 docsify 菜单和正文是否渲染完成。
const docsFrameRef = ref<HTMLIFrameElement | null>(null);
// frameSrc 为空时不渲染 iframe，避免未拿到 cookie 就触发 401。
const frameSrc = ref('');
// loading 表示当前是否正在创建文档会话或等待文档站渲染完成。
const loading = ref(false);
// loadFailed 表示文档会话创建失败或当前账号无文档权限。
const loadFailed = ref(false);
// docsReadyTimer 保存 iframe 文档渲染完成检查的定时器。
let docsReadyTimer: number | undefined;
// docsReadyStartedAt 保存本轮文档渲染等待开始时间。
let docsReadyStartedAt = 0;

// clearDocsReadyTimer 清理文档渲染完成检查定时器。
function clearDocsReadyTimer() {
  if (!docsReadyTimer) {
    return;
  }
  window.clearTimeout(docsReadyTimer);
  docsReadyTimer = undefined;
}

// markDocsLoaded 在 iframe 内菜单和正文都渲染完成后关闭 loading。
function markDocsLoaded() {
  if (!frameSrc.value || loadFailed.value) {
    return;
  }
  clearDocsReadyTimer();
  loading.value = false;
}

// markDocsLoadFailed 统一处理文档会话或文档 iframe 加载失败。
function markDocsLoadFailed() {
  clearDocsReadyTimer();
  frameSrc.value = '';
  loading.value = false;
  loadFailed.value = true;
}

// isDocsFrameReady 判断 docsify 侧边菜单和正文是否已经渲染到 iframe 中。
function isDocsFrameReady() {
  try {
    const frameDoc = docsFrameRef.value?.contentDocument;
    const markdownText = frameDoc
      ?.querySelector('.markdown-section')
      ?.textContent?.trim();
    const sidebarReady = Boolean(frameDoc?.querySelector('.sidebar-nav a'));
    return Boolean(markdownText && sidebarReady);
  } catch {
    return false;
  }
}

// waitDocsFrameReady 持续等待 iframe 内文档站真正渲染完成。
function waitDocsFrameReady() {
  clearDocsReadyTimer();
  if (isDocsFrameReady()) {
    markDocsLoaded();
    return;
  }
  if (Date.now() - docsReadyStartedAt >= docsReadyTimeoutMs) {
    markDocsLoadFailed();
    return;
  }
  docsReadyTimer = window.setTimeout(
    waitDocsFrameReady,
    docsReadyPollIntervalMs,
  );
}

// handleFrameLoad 在 iframe HTML 加载后继续等待 docsify 菜单和正文渲染。
function handleFrameLoad() {
  docsReadyStartedAt = Date.now();
  waitDocsFrameReady();
}

// loadDocs 先通过后台鉴权接口写入文档 cookie，再加载文档站。
async function loadDocs() {
  clearDocsReadyTimer();
  docsReadyStartedAt = 0;
  loading.value = true;
  loadFailed.value = false;
  frameSrc.value = '';
  try {
    await createDocsSession();
    frameSrc.value = docsUrl.value;
  } catch {
    markDocsLoadFailed();
  }
}

onMounted(loadDocs);
onBeforeUnmount(clearDocsReadyTimer);
</script>

<template>
  <Page auto-content-height>
    <div
      class="relative flex h-full min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-background"
      :aria-busy="loading"
    >
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-background text-muted-foreground"
      >
        <Spin :tip="$t('admin.apiDocs.loading')" />
      </div>

      <div
        v-if="loadFailed"
        class="flex flex-1 items-center justify-center px-6"
      >
        <div class="w-full max-w-[560px] space-y-4">
          <Alert
            show-icon
            type="error"
            :description="$t('admin.apiDocs.loadFailedDesc')"
            :message="$t('admin.apiDocs.loadFailedTitle')"
          />
          <VbenButton type="primary" @click="loadDocs">
            {{ $t('admin.apiDocs.retry') }}
          </VbenButton>
        </div>
      </div>

      <iframe
        v-if="frameSrc && !loadFailed"
        ref="docsFrameRef"
        class="h-full min-h-[620px] w-full border-0 transition-opacity"
        :class="loading ? 'opacity-0' : 'opacity-100'"
        :src="frameSrc"
        :title="$t(props.titleKey)"
        @error="markDocsLoadFailed"
        @load="handleFrameLoad"
      ></iframe>
    </div>
  </Page>
</template>
