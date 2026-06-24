<script lang="ts" setup>
import { computed } from 'vue';

import { Alert, Card, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import { formatShortChecksum } from '../../shared';

type SnapshotDiffKind = 'added' | 'removed' | 'same';

// SnapshotDiffLine 描述快照对比中的一行展示状态。
type SnapshotDiffLine = {
  key: string;
  kind: SnapshotDiffKind;
  text: string;
};

// SnapshotDiffPanelProps 定义快照对比面板所需的纯展示数据。
type SnapshotDiffPanelProps = {
  // activeChecksum 当前运行态快照 checksum。
  activeChecksum?: string;
  // activeVersion 当前运行态版本号。
  activeVersion?: number;
  // currentSnapshotText 当前运行态快照文本。
  currentSnapshotText?: string;
  // draftSnapshotText 当前草稿快照文本。
  draftSnapshotText?: string;
  // releaseChecksum 选中发布快照 checksum。
  releaseChecksum?: string;
  // releaseLoading 发布快照详情加载状态。
  releaseLoading?: boolean;
  // releaseSelected 是否已选中发布历史。
  releaseSelected?: boolean;
  // releaseSnapshotText 选中发布快照文本。
  releaseSnapshotText?: string;
  // releaseVersion 选中发布快照版本号。
  releaseVersion?: number;
  // source 当前运行态来源。
  source?: string;
};

const props = withDefaults(defineProps<SnapshotDiffPanelProps>(), {
  activeChecksum: '',
  activeVersion: 0,
  currentSnapshotText: '',
  draftSnapshotText: '',
  releaseChecksum: '',
  releaseLoading: false,
  releaseSelected: false,
  releaseSnapshotText: '',
  releaseVersion: 0,
  source: '-',
});

const rt = (key: string) => $t(`admin.runtimeConfig.${key}`);

const sourceTone = computed(() =>
  props.source === 'database' ? 'processing' : 'default',
);
const snapshotChanged = computed(
  () => props.currentSnapshotText !== props.draftSnapshotText,
);
const snapshotDiffLines = computed(() =>
  buildSnapshotDiffLines(props.currentSnapshotText, props.draftSnapshotText),
);
const activeChecksumShort = computed(() =>
  formatShortChecksum(props.activeChecksum),
);
const releaseChecksumShort = computed(() =>
  formatShortChecksum(props.releaseChecksum),
);

function splitSnapshotLines(text: string) {
  return text ? text.split('\n') : [];
}

// buildSnapshotDiffLines 使用 LCS 生成左右快照行级差异，便于直接高亮新增和删除。
function buildSnapshotDiffLines(currentText: string, draftText: string) {
  const currentLines = splitSnapshotLines(currentText);
  const draftLines = splitSnapshotLines(draftText);
  const lcs = Array.from({ length: currentLines.length + 1 }, () =>
    Array.from({ length: draftLines.length + 1 }, () => 0),
  );
  const readLcs = (row: number, col: number) => lcs[row]?.[col] ?? 0;

  for (let i = currentLines.length - 1; i >= 0; i -= 1) {
    for (let j = draftLines.length - 1; j >= 0; j -= 1) {
      const currentLine = currentLines[i] ?? '';
      const draftLine = draftLines[j] ?? '';
      lcs[i]![j] =
        currentLine === draftLine
          ? readLcs(i + 1, j + 1) + 1
          : Math.max(readLcs(i + 1, j), readLcs(i, j + 1));
    }
  }

  const current: SnapshotDiffLine[] = [];
  const draft: SnapshotDiffLine[] = [];
  let currentIndex = 0;
  let draftIndex = 0;

  while (currentIndex < currentLines.length && draftIndex < draftLines.length) {
    const currentLine = currentLines[currentIndex] ?? '';
    const draftLine = draftLines[draftIndex] ?? '';

    if (currentLine === draftLine) {
      current.push({
        key: `current-${currentIndex}-draft-${draftIndex}`,
        kind: 'same',
        text: currentLine,
      });
      draft.push({
        key: `draft-${draftIndex}-current-${currentIndex}`,
        kind: 'same',
        text: draftLine,
      });
      currentIndex += 1;
      draftIndex += 1;
      continue;
    }

    if (
      readLcs(currentIndex + 1, draftIndex) >=
      readLcs(currentIndex, draftIndex + 1)
    ) {
      current.push({
        key: `current-${currentIndex}-removed`,
        kind: 'removed',
        text: currentLine,
      });
      currentIndex += 1;
      continue;
    }

    draft.push({
      key: `draft-${draftIndex}-added`,
      kind: 'added',
      text: draftLine,
    });
    draftIndex += 1;
  }

  while (currentIndex < currentLines.length) {
    current.push({
      key: `current-${currentIndex}-removed`,
      kind: 'removed',
      text: currentLines[currentIndex] ?? '',
    });
    currentIndex += 1;
  }

  while (draftIndex < draftLines.length) {
    draft.push({
      key: `draft-${draftIndex}-added`,
      kind: 'added',
      text: draftLines[draftIndex] ?? '',
    });
    draftIndex += 1;
  }

  return { current, draft };
}

function snapshotLineClass(kind: SnapshotDiffKind) {
  return `snapshot-diff-panel__line--${kind}`;
}

function snapshotLineMarker(kind: SnapshotDiffKind) {
  if (kind === 'added') {
    return '+';
  }
  if (kind === 'removed') {
    return '-';
  }
  return ' ';
}
</script>

<template>
  <div class="snapshot-diff-panel">
    <Alert
      class="snapshot-diff-panel__alert"
      :type="snapshotChanged ? 'warning' : 'success'"
      show-icon
      :message="snapshotChanged ? rt('snapshotChanged') : rt('snapshotSame')"
      :description="rt('snapshotPreviewDescription')"
    />
    <div class="snapshot-diff-panel__layout">
      <Card
        class="snapshot-diff-panel__card"
        size="small"
        :title="rt('currentSnapshot')"
      >
        <div class="snapshot-diff-panel__meta">
          <Tag :color="sourceTone">{{ source || '-' }}</Tag>
          <Tag>{{ rt('version') }} {{ activeVersion || 0 }}</Tag>
          <Tag>{{ activeChecksumShort }}</Tag>
        </div>
        <div class="snapshot-diff-panel__code snapshot-diff-panel__code--diff">
          <div
            v-for="line in snapshotDiffLines.current"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="snapshotLineClass(line.kind)"
          >
            <span class="snapshot-diff-panel__line-marker">
              {{ snapshotLineMarker(line.kind) }}
            </span>
            <span class="snapshot-diff-panel__line-text">
              {{ line.text || ' ' }}
            </span>
          </div>
        </div>
      </Card>

      <Card
        class="snapshot-diff-panel__card"
        size="small"
        :title="rt('draftDiffPreview')"
      >
        <div class="snapshot-diff-panel__code snapshot-diff-panel__code--diff">
          <div
            v-for="line in snapshotDiffLines.draft"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="snapshotLineClass(line.kind)"
          >
            <span class="snapshot-diff-panel__line-marker">
              {{ snapshotLineMarker(line.kind) }}
            </span>
            <span class="snapshot-diff-panel__line-text">
              {{ line.text || ' ' }}
            </span>
          </div>
        </div>
      </Card>

      <Card
        class="snapshot-diff-panel__card"
        size="small"
        :title="rt('releaseSnapshotDetail')"
      >
        <div class="snapshot-diff-panel__meta">
          <Tag v-if="releaseSelected">
            {{ rt('version') }} {{ releaseVersion || 0 }}
          </Tag>
          <Tag v-if="releaseSelected">{{ releaseChecksumShort }}</Tag>
        </div>
        <pre
          class="snapshot-diff-panel__code"
          :class="{ 'snapshot-diff-panel__code--loading': releaseLoading }"
          v-text="releaseSnapshotText || rt('selectReleaseHint')"
        ></pre>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.snapshot-diff-panel {
  display: grid;
  gap: 8px;
}

.snapshot-diff-panel__alert {
  padding: 10px 12px;
}

.snapshot-diff-panel__alert :deep(.ant-alert-message) {
  font-size: 14px;
  line-height: 1.35;
}

.snapshot-diff-panel__alert :deep(.ant-alert-description) {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
}

.snapshot-diff-panel__layout {
  display: grid;
  grid-template-columns: repeat(3, minmax(360px, 1fr));
  gap: 8px;
  align-items: start;
}

.snapshot-diff-panel__card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: min(66vh, 680px);
  overflow: hidden;
}

.snapshot-diff-panel__card :deep(.ant-card-head) {
  flex: none;
}

.snapshot-diff-panel__card :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.snapshot-diff-panel__meta {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.snapshot-diff-panel__code {
  flex: 1;
  min-height: 0;
  max-height: none;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vben-text-color);
  white-space: pre-wrap;
  background: var(--vben-background-soft);
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

.snapshot-diff-panel__code--loading {
  opacity: 0.65;
}

.snapshot-diff-panel__code--diff {
  display: block;
}

.snapshot-diff-panel__line {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 6px;
  min-height: 19px;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: 4px;
}

.snapshot-diff-panel__line--added {
  background: hsl(142deg 76% 36% / 14%);
  box-shadow: inset 3px 0 0 hsl(142deg 76% 36% / 72%);
}

.snapshot-diff-panel__line--removed {
  background: hsl(0deg 84% 60% / 14%);
  box-shadow: inset 3px 0 0 hsl(0deg 84% 60% / 72%);
}

.snapshot-diff-panel__line-marker {
  overflow: hidden;
  font-weight: 700;
  color: var(--vben-text-color-secondary);
  text-align: center;
  user-select: none;
}

.snapshot-diff-panel__line--added .snapshot-diff-panel__line-marker {
  color: hsl(142deg 76% 45%);
}

.snapshot-diff-panel__line--removed .snapshot-diff-panel__line-marker {
  color: hsl(0deg 84% 66%);
}

.snapshot-diff-panel__line-text {
  min-width: 0;
  white-space: pre-wrap;
}

@media (max-width: 1200px) {
  .snapshot-diff-panel__layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .snapshot-diff-panel__layout {
    grid-template-columns: 1fr;
  }

  .snapshot-diff-panel__card {
    height: auto;
  }

  .snapshot-diff-panel__code {
    min-height: 260px;
    max-height: 520px;
  }
}
</style>
