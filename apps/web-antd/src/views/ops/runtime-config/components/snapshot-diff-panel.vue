<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Alert, Button, Card, Radio, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import { formatShortChecksum } from '../../shared';

type SnapshotDiffKind = 'added' | 'removed' | 'same';
type SnapshotTokenKind =
  | 'boolean'
  | 'key'
  | 'null'
  | 'number'
  | 'plain'
  | 'punctuation'
  | 'string';
type SnapshotViewMode = 'json' | 'yaml';
type SnapshotValue =
  | boolean
  | null
  | number
  | SnapshotValue[]
  | string
  | { [key: string]: SnapshotValue };

// SnapshotTreeToken 表示一段可独立着色的快照文本。
type SnapshotTreeToken = {
  kind: SnapshotTokenKind;
  text: string;
};

// SnapshotTreeLineBase 描述快照树中的一行原始展示状态。
type SnapshotTreeLineBase = {
  collapsed: boolean;
  collapsible: boolean;
  depth: number;
  key: string;
  kind: SnapshotDiffKind;
  path: string;
  text: string;
};

// SnapshotTreeLine 表示完成语法拆分后的快照行。
type SnapshotTreeLine = SnapshotTreeLineBase & {
  tokens: SnapshotTreeToken[];
};

type SnapshotPathInfo = {
  signature: string;
  type: string;
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
  // releaseSnapshotJson 选中发布快照 JSON 文本。
  releaseSnapshotJson?: string;
  // releaseSnapshotText 选中发布快照文本。
  releaseSnapshotText?: string;
  // releaseSnapshotYaml 选中发布快照 YAML 文本。
  releaseSnapshotYaml?: string;
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
  releaseSnapshotJson: '',
  releaseSnapshotText: '',
  releaseSnapshotYaml: '',
  releaseVersion: 0,
  source: '-',
});

const rt = (key: string) => $t(`admin.runtimeConfig.${key}`);

const viewMode = ref<SnapshotViewMode>('json');
const collapsedPaths = ref(new Set<string>());

const sourceTone = computed(() =>
  props.source === 'database' ? 'processing' : 'default',
);
const currentSnapshotValue = computed(() =>
  parseSnapshotText(props.currentSnapshotText),
);
const draftSnapshotValue = computed(() =>
  parseSnapshotText(props.draftSnapshotText),
);
const releaseSnapshotValue = computed(() =>
  parseSnapshotText(props.releaseSnapshotJson || props.releaseSnapshotText),
);
const snapshotChanged = computed(
  () =>
    snapshotValueSignature(currentSnapshotValue.value) !==
    snapshotValueSignature(draftSnapshotValue.value),
);
const currentPathInfo = computed(() =>
  buildPathInfoMap(currentSnapshotValue.value),
);
const draftPathInfo = computed(() =>
  buildPathInfoMap(draftSnapshotValue.value),
);
const currentTreeLines = computed(() =>
  buildSnapshotTreeLines(
    currentSnapshotValue.value,
    draftPathInfo.value,
    'removed',
  ),
);
const draftTreeLines = computed(() =>
  buildSnapshotTreeLines(
    draftSnapshotValue.value,
    currentPathInfo.value,
    'added',
  ),
);
const releaseTreeLines = computed(() =>
  buildSnapshotTreeLines(releaseSnapshotValue.value, new Map(), 'same'),
);
const collapsiblePaths = computed(() => {
  const paths = new Set<string>();
  collectCollapsiblePaths(currentSnapshotValue.value, paths);
  collectCollapsiblePaths(draftSnapshotValue.value, paths);
  collectCollapsiblePaths(releaseSnapshotValue.value, paths);
  return paths;
});
const releaseFallbackText = computed(
  () => props.releaseSnapshotYaml || props.releaseSnapshotText,
);
const activeChecksumShort = computed(() =>
  formatShortChecksum(props.activeChecksum),
);
const releaseChecksumShort = computed(() =>
  formatShortChecksum(props.releaseChecksum),
);

function parseSnapshotText(text: string): SnapshotValue {
  if (!String(text || '').trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as SnapshotValue;
  } catch {
    return null;
  }
}

function isSnapshotRecord(
  value: SnapshotValue,
): value is { [key: string]: SnapshotValue } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSnapshotContainer(value: SnapshotValue) {
  return Array.isArray(value) || isSnapshotRecord(value);
}

function snapshotValueType(value: SnapshotValue) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (isSnapshotRecord(value)) {
    return 'object';
  }
  return 'scalar';
}

function snapshotValueSignature(value: SnapshotValue): string {
  return JSON.stringify(value);
}

function buildPathInfoMap(value: SnapshotValue) {
  const result = new Map<string, SnapshotPathInfo>();
  walkPathInfo(value, 'root', result);
  return result;
}

function walkPathInfo(
  value: SnapshotValue,
  path: string,
  result: Map<string, SnapshotPathInfo>,
) {
  result.set(path, {
    signature: snapshotValueSignature(value),
    type: snapshotValueType(value),
  });
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkPathInfo(item, `${path}[${index}]`, result);
    });
    return;
  }
  if (isSnapshotRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      walkPathInfo(item, `${path}.${key}`, result);
    });
  }
}

function collectCollapsiblePaths(
  value: SnapshotValue,
  result: Set<string>,
  path = 'root',
) {
  if (!isSnapshotContainer(value)) {
    return;
  }
  result.add(path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectCollapsiblePaths(item, result, `${path}[${index}]`);
    });
    return;
  }
  Object.entries(value).forEach(([key, item]) => {
    collectCollapsiblePaths(item, result, `${path}.${key}`);
  });
}

function snapshotTreeKind(
  value: SnapshotValue,
  path: string,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
): SnapshotDiffKind {
  if (compareInfo.size === 0) {
    return 'same';
  }
  const matched = compareInfo.get(path);
  if (!matched) {
    return changeKind;
  }
  const type = snapshotValueType(value);
  if (matched.type !== type) {
    return changeKind;
  }
  if (
    !isSnapshotContainer(value) &&
    matched.signature !== snapshotValueSignature(value)
  ) {
    return changeKind;
  }
  return 'same';
}

function buildSnapshotTreeLines(
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
): SnapshotTreeLine[] {
  const lines =
    viewMode.value === 'yaml'
      ? buildYamlTreeLines(value, compareInfo, changeKind)
      : buildJsonTreeLines(value, compareInfo, changeKind);
  return lines.map((line) => ({
    ...line,
    tokens: tokenizeSnapshotLine(line.text, viewMode.value),
  }));
}

function buildJsonTreeLines(
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
) {
  const lines: SnapshotTreeLineBase[] = [];
  appendJsonLine(lines, value, compareInfo, changeKind, {
    depth: 0,
    isLast: true,
    path: 'root',
  });
  return lines;
}

function appendJsonLine(
  lines: SnapshotTreeLineBase[],
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
  options: { depth: number; isLast: boolean; keyName?: string; path: string },
) {
  const kind = snapshotTreeKind(value, options.path, compareInfo, changeKind);
  const comma = options.isLast ? '' : ',';
  const keyPrefix = options.keyName ? `"${options.keyName}": ` : '';

  if (Array.isArray(value) || isSnapshotRecord(value)) {
    const isArray = Array.isArray(value);
    const collapsed = collapsedPaths.value.has(options.path);
    const opener = isArray ? '[' : '{';
    const closer = isArray ? ']' : '}';
    lines.push({
      collapsed,
      collapsible: true,
      depth: options.depth,
      key: `${options.path}-open-${viewMode.value}`,
      kind,
      path: options.path,
      text: collapsed
        ? `${keyPrefix}${opener} ... ${closer}${comma}`
        : `${keyPrefix}${opener}`,
    });
    if (collapsed) {
      return;
    }
    const entries = isArray ? value.entries() : Object.entries(value).entries();
    const childItems = [...entries];
    childItems.forEach(([index, entry]) => {
      if (isArray) {
        appendJsonLine(lines, entry as SnapshotValue, compareInfo, changeKind, {
          depth: options.depth + 1,
          isLast: index === childItems.length - 1,
          path: `${options.path}[${index}]`,
        });
        return;
      }
      const [key, item] = entry as [string, SnapshotValue];
      appendJsonLine(lines, item, compareInfo, changeKind, {
        depth: options.depth + 1,
        isLast: index === childItems.length - 1,
        keyName: key,
        path: `${options.path}.${key}`,
      });
    });
    lines.push({
      collapsed: false,
      collapsible: false,
      depth: options.depth,
      key: `${options.path}-close-${viewMode.value}`,
      kind,
      path: options.path,
      text: `${closer}${comma}`,
    });
    return;
  }

  lines.push({
    collapsed: false,
    collapsible: false,
    depth: options.depth,
    key: `${options.path}-value-${viewMode.value}`,
    kind,
    path: options.path,
    text: `${keyPrefix}${jsonScalarText(value)}${comma}`,
  });
}

function buildYamlTreeLines(
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
) {
  const lines: SnapshotTreeLineBase[] = [];
  if (isSnapshotRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      appendYamlLine(lines, item, compareInfo, changeKind, {
        depth: 0,
        keyName: key,
        path: `root.${key}`,
      });
    });
    return lines;
  }
  appendYamlLine(lines, value, compareInfo, changeKind, {
    depth: 0,
    path: 'root',
  });
  return lines;
}

function appendYamlLine(
  lines: SnapshotTreeLineBase[],
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
  options: { depth: number; keyName?: string; path: string },
) {
  const kind = snapshotTreeKind(value, options.path, compareInfo, changeKind);
  if (Array.isArray(value) || isSnapshotRecord(value)) {
    const collapsed = collapsedPaths.value.has(options.path);
    lines.push({
      collapsed,
      collapsible: true,
      depth: options.depth,
      key: `${options.path}-node-${viewMode.value}`,
      kind,
      path: options.path,
      text: options.keyName
        ? `${options.keyName}:${collapsed ? ' ...' : ''}`
        : `-${collapsed ? ' ...' : ''}`,
    });
    if (collapsed) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        appendYamlArrayItem(lines, item, compareInfo, changeKind, {
          depth: options.depth + 1,
          path: `${options.path}[${index}]`,
        });
      });
      return;
    }
    Object.entries(value).forEach(([key, item]) => {
      appendYamlLine(lines, item, compareInfo, changeKind, {
        depth: options.depth + 1,
        keyName: key,
        path: `${options.path}.${key}`,
      });
    });
    return;
  }
  lines.push({
    collapsed: false,
    collapsible: false,
    depth: options.depth,
    key: `${options.path}-value-${viewMode.value}`,
    kind,
    path: options.path,
    text: options.keyName
      ? `${options.keyName}: ${yamlScalarText(value)}`
      : yamlScalarText(value),
  });
}

function appendYamlArrayItem(
  lines: SnapshotTreeLineBase[],
  value: SnapshotValue,
  compareInfo: Map<string, SnapshotPathInfo>,
  changeKind: SnapshotDiffKind,
  options: { depth: number; path: string },
) {
  const kind = snapshotTreeKind(value, options.path, compareInfo, changeKind);
  if (isSnapshotContainer(value)) {
    const collapsed = collapsedPaths.value.has(options.path);
    lines.push({
      collapsed,
      collapsible: true,
      depth: options.depth,
      key: `${options.path}-item-${viewMode.value}`,
      kind,
      path: options.path,
      text: `-${collapsed ? ' ...' : ''}`,
    });
    if (collapsed) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        appendYamlArrayItem(lines, item, compareInfo, changeKind, {
          depth: options.depth + 1,
          path: `${options.path}[${index}]`,
        });
      });
      return;
    }
    Object.entries(value).forEach(([key, item]) => {
      appendYamlLine(lines, item, compareInfo, changeKind, {
        depth: options.depth + 1,
        keyName: key,
        path: `${options.path}.${key}`,
      });
    });
    return;
  }
  lines.push({
    collapsed: false,
    collapsible: false,
    depth: options.depth,
    key: `${options.path}-value-${viewMode.value}`,
    kind,
    path: options.path,
    text: `- ${yamlScalarText(value)}`,
  });
}

function jsonScalarText(value: SnapshotValue) {
  return JSON.stringify(value);
}

function yamlScalarText(value: SnapshotValue) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value === '' ? '""' : JSON.stringify(value);
  }
  return String(value);
}

function tokenizeSnapshotLine(
  text: string,
  mode: SnapshotViewMode,
): SnapshotTreeToken[] {
  if (!text) {
    return [{ kind: 'plain', text: ' ' }];
  }
  return mode === 'yaml' ? tokenizeYamlLine(text) : tokenizeJsonLine(text);
}

function tokenizeJsonLine(text: string): SnapshotTreeToken[] {
  const tokens: SnapshotTreeToken[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index] || '';
    if (char === '"') {
      const quoted = readQuotedText(text, index);
      const nextIndex = nextNonSpaceIndex(text, quoted.end);
      tokens.push({
        kind: text[nextIndex] === ':' ? 'key' : 'string',
        text: quoted.text,
      });
      index = quoted.end;
      continue;
    }
    if ('{}[]:,'.includes(char)) {
      tokens.push({ kind: 'punctuation', text: char });
      index += 1;
      continue;
    }
    const scalar = readJsonScalarText(text.slice(index));
    if (scalar) {
      tokens.push({
        kind: snapshotScalarTokenKind(scalar),
        text: scalar,
      });
      index += scalar.length;
      continue;
    }
    tokens.push({ kind: 'plain', text: char });
    index += 1;
  }
  return tokens;
}

function tokenizeYamlLine(text: string): SnapshotTreeToken[] {
  const firstVisibleIndex = text.search(/\S/);
  if (firstVisibleIndex < 0) {
    return [{ kind: 'plain', text }];
  }

  const tokens: SnapshotTreeToken[] = [];
  if (firstVisibleIndex > 0) {
    tokens.push({ kind: 'plain', text: text.slice(0, firstVisibleIndex) });
  }

  let cursor = firstVisibleIndex;
  if (text[cursor] === '-') {
    tokens.push({ kind: 'punctuation', text: '-' });
    cursor += 1;
    if (text[cursor] === ' ') {
      tokens.push({ kind: 'plain', text: ' ' });
      cursor += 1;
    }
  }

  const colonIndex = text.indexOf(':', cursor);
  if (colonIndex >= cursor) {
    tokens.push(
      { kind: 'key', text: text.slice(cursor, colonIndex) },
      { kind: 'punctuation', text: ':' },
      ...tokenizeYamlScalarText(text.slice(colonIndex + 1)),
    );
    return tokens;
  }

  tokens.push(...tokenizeYamlScalarText(text.slice(cursor)));
  return tokens;
}

function tokenizeYamlScalarText(text: string): SnapshotTreeToken[] {
  if (!text) {
    return [];
  }
  const leadingMatch = /^\s+/.exec(text);
  const leadingText = leadingMatch?.[0] || '';
  const bodyStart = leadingText.length;
  const bodyText = text.slice(bodyStart);
  const trailingMatch = /\s+$/.exec(bodyText);
  const trailingText = trailingMatch?.[0] || '';
  const scalarText = bodyText.slice(0, bodyText.length - trailingText.length);
  const tokens: SnapshotTreeToken[] = [];

  if (leadingText) {
    tokens.push({ kind: 'plain', text: leadingText });
  }
  if (scalarText) {
    tokens.push({
      kind: snapshotScalarTokenKind(scalarText),
      text: scalarText,
    });
  }
  if (trailingText) {
    tokens.push({ kind: 'plain', text: trailingText });
  }
  return tokens;
}

function readQuotedText(text: string, start: number) {
  let escaped = false;
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      index += 1;
      break;
    }
    index += 1;
  }
  return {
    end: index,
    text: text.slice(start, index),
  };
}

function nextNonSpaceIndex(text: string, start: number) {
  let index = start;
  while (index < text.length && /\s/.test(text[index] || '')) {
    index += 1;
  }
  return index;
}

function readJsonScalarText(text: string) {
  return (
    /^(?:false|null|true|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i.exec(text)?.[0] || ''
  );
}

function snapshotScalarTokenKind(text: string): SnapshotTokenKind {
  if (/^".*"$/.test(text) || /^'.*'$/.test(text)) {
    return 'string';
  }
  if (/^(?:false|true)$/i.test(text)) {
    return 'boolean';
  }
  if (/^null$/i.test(text)) {
    return 'null';
  }
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) {
    return 'number';
  }
  return 'plain';
}

function treeLineClass(kind: SnapshotDiffKind) {
  return `snapshot-diff-panel__line--${kind}`;
}

function treeTokenClass(kind: SnapshotTokenKind) {
  return `snapshot-diff-panel__token--${kind}`;
}

function treeLineMarker(kind: SnapshotDiffKind) {
  if (kind === 'added') {
    return '+';
  }
  if (kind === 'removed') {
    return '-';
  }
  return ' ';
}

function treeLinePadding(depth: number) {
  return `${depth * 16 + 6}px`;
}

function toggleCollapsedPath(path: string) {
  const next = new Set(collapsedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  collapsedPaths.value = next;
}

function expandAllSnapshots() {
  collapsedPaths.value = new Set();
}

function collapseAllSnapshots() {
  collapsedPaths.value = new Set(collapsiblePaths.value);
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
    <div class="snapshot-diff-panel__toolbar">
      <Radio.Group v-model:value="viewMode" button-style="solid" size="small">
        <Radio.Button value="json">{{ rt('snapshotJsonView') }}</Radio.Button>
        <Radio.Button value="yaml">{{ rt('snapshotYamlView') }}</Radio.Button>
      </Radio.Group>
      <div class="snapshot-diff-panel__toolbar-actions">
        <Button size="small" @click="expandAllSnapshots">
          {{ rt('snapshotExpandAll') }}
        </Button>
        <Button size="small" @click="collapseAllSnapshots">
          {{ rt('snapshotCollapseAll') }}
        </Button>
      </div>
    </div>
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
        <div class="snapshot-diff-panel__code">
          <div
            v-for="line in currentTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="treeLineClass(line.kind)"
            :style="{ paddingLeft: treeLinePadding(line.depth) }"
          >
            <span class="snapshot-diff-panel__line-marker">
              {{ treeLineMarker(line.kind) }}
            </span>
            <button
              v-if="line.collapsible"
              class="snapshot-diff-panel__node-toggle"
              type="button"
              @click="toggleCollapsedPath(line.path)"
            >
              {{ line.collapsed ? '›' : '⌄' }}
            </button>
            <span v-else class="snapshot-diff-panel__node-toggle-spacer"></span>
            <span class="snapshot-diff-panel__line-text">
              <span
                v-for="(token, tokenIndex) in line.tokens"
                :key="`${line.key}-${tokenIndex}`"
                :class="treeTokenClass(token.kind)"
              >
                {{ token.text }}
              </span>
            </span>
          </div>
        </div>
      </Card>

      <Card
        class="snapshot-diff-panel__card"
        size="small"
        :title="rt('draftDiffPreview')"
      >
        <div class="snapshot-diff-panel__code">
          <div
            v-for="line in draftTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="treeLineClass(line.kind)"
            :style="{ paddingLeft: treeLinePadding(line.depth) }"
          >
            <span class="snapshot-diff-panel__line-marker">
              {{ treeLineMarker(line.kind) }}
            </span>
            <button
              v-if="line.collapsible"
              class="snapshot-diff-panel__node-toggle"
              type="button"
              @click="toggleCollapsedPath(line.path)"
            >
              {{ line.collapsed ? '›' : '⌄' }}
            </button>
            <span v-else class="snapshot-diff-panel__node-toggle-spacer"></span>
            <span class="snapshot-diff-panel__line-text">
              <span
                v-for="(token, tokenIndex) in line.tokens"
                :key="`${line.key}-${tokenIndex}`"
                :class="treeTokenClass(token.kind)"
              >
                {{ token.text }}
              </span>
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
        <div
          v-if="releaseSelected && releaseTreeLines.length > 0"
          class="snapshot-diff-panel__code"
          :class="{ 'snapshot-diff-panel__code--loading': releaseLoading }"
        >
          <div
            v-for="line in releaseTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="treeLineClass(line.kind)"
            :style="{ paddingLeft: treeLinePadding(line.depth) }"
          >
            <span class="snapshot-diff-panel__line-marker">
              {{ treeLineMarker(line.kind) }}
            </span>
            <button
              v-if="line.collapsible"
              class="snapshot-diff-panel__node-toggle"
              type="button"
              @click="toggleCollapsedPath(line.path)"
            >
              {{ line.collapsed ? '›' : '⌄' }}
            </button>
            <span v-else class="snapshot-diff-panel__node-toggle-spacer"></span>
            <span class="snapshot-diff-panel__line-text">
              <span
                v-for="(token, tokenIndex) in line.tokens"
                :key="`${line.key}-${tokenIndex}`"
                :class="treeTokenClass(token.kind)"
              >
                {{ token.text }}
              </span>
            </span>
          </div>
        </div>
        <pre
          v-else
          class="snapshot-diff-panel__code"
          :class="{ 'snapshot-diff-panel__code--loading': releaseLoading }"
          v-text="releaseFallbackText || rt('selectReleaseHint')"
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

.snapshot-diff-panel__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.snapshot-diff-panel__toolbar-actions {
  display: flex;
  gap: 6px;
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

.snapshot-diff-panel__line {
  display: grid;
  grid-template-columns: 18px 16px minmax(0, 1fr);
  gap: 4px;
  align-items: start;
  min-height: 19px;
  padding-top: 0;
  padding-right: 6px;
  padding-bottom: 0;
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

.snapshot-diff-panel__node-toggle,
.snapshot-diff-panel__node-toggle-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 19px;
  padding: 0;
}

.snapshot-diff-panel__node-toggle {
  color: var(--vben-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.snapshot-diff-panel__node-toggle:hover {
  color: var(--vben-text-color);
}

.snapshot-diff-panel__line-text {
  min-width: 0;
  white-space: pre-wrap;
}

.snapshot-diff-panel__token--key {
  font-weight: 600;
  color: #7dd3fc;
}

.snapshot-diff-panel__token--punctuation {
  color: #94a3b8;
}

.snapshot-diff-panel__token--string {
  color: #a7f3d0;
}

.snapshot-diff-panel__token--number {
  color: #fbbf24;
}

.snapshot-diff-panel__token--boolean {
  color: #c4b5fd;
}

.snapshot-diff-panel__token--null {
  color: #fca5a5;
}

.snapshot-diff-panel__token--plain {
  color: #cbd5e1;
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

  .snapshot-diff-panel__toolbar {
    flex-direction: column;
    align-items: flex-start;
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
