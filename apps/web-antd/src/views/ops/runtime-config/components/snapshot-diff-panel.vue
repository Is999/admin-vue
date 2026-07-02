<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Input,
  Modal,
  Radio,
  Switch,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import { formatShortChecksum } from '../../shared';

type SnapshotDiffKind = 'added' | 'removed' | 'same';
type SnapshotPanelKey = 'current' | 'draft' | 'release';
type SnapshotScrollGroup = 'fullscreen' | 'normal';
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

// SnapshotLineMatch 表示搜索或差异跳转命中的快照行。
type SnapshotLineMatch = {
  index: number;
  key: string;
  panel: SnapshotPanelKey;
};

// SnapshotDiffPanelProps 定义快照对比面板所需的纯展示数据。
type SnapshotDiffPanelProps = {
  // activeChecksum 当前运行态快照 checksum。
  activeChecksum?: string;
  // activeVersion 当前运行态版本号。
  activeVersion?: number;
  // currentSnapshotText 当前运行态快照文本。
  currentSnapshotText?: string;
  // draftChanged 后端按发布口径判断的草稿差异状态。
  draftChanged?: boolean;
  // draftChecksum 当前草稿快照 checksum。
  draftChecksum?: string;
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
  draftChanged: false,
  draftChecksum: '',
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
const searchKeyword = ref('');
const activeSearchIndex = ref(0);
// diffJumpStarted 避免空搜索时自动高亮第一处差异。
const diffJumpStarted = ref(false);
const scrollSyncEnabled = ref(true);
const fullscreenOpen = ref(false);
const fullscreenDarkTheme = ref(false);
const fullscreenMaskStyle = {
  background: 'var(--vben-background-color, hsl(var(--background, 0 0% 100%)))',
};
const currentCodeRef = ref<HTMLElement | null>(null);
const draftCodeRef = ref<HTMLElement | null>(null);
const releaseCodeRef = ref<HTMLElement | null>(null);
const fullscreenCurrentCodeRef = ref<HTMLElement | null>(null);
const fullscreenDraftCodeRef = ref<HTMLElement | null>(null);
let openedBrowserFullscreen = false;
let syncingScroll = false;

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
const snapshotChanged = computed(() => {
  if (props.activeChecksum || props.draftChecksum) {
    return props.draftChanged || props.activeChecksum !== props.draftChecksum;
  }
  return (
    props.draftChanged ||
    snapshotValueSignature(currentSnapshotValue.value) !==
      snapshotValueSignature(draftSnapshotValue.value)
  );
});
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
const draftChecksumShort = computed(() =>
  formatShortChecksum(props.draftChecksum),
);
const normalizedSearchKeyword = computed(() =>
  searchKeyword.value.trim().toLowerCase(),
);
const searchMatches = computed(() => {
  const keyword = normalizedSearchKeyword.value;
  const matches: SnapshotLineMatch[] = [];
  if (!keyword) {
    return matches;
  }
  appendSearchMatches(matches, 'current', currentTreeLines.value, keyword);
  appendSearchMatches(matches, 'draft', draftTreeLines.value, keyword);
  appendSearchMatches(matches, 'release', releaseTreeLines.value, keyword);
  return matches;
});
const diffMatches = computed(() => {
  const matches: SnapshotLineMatch[] = [];
  appendDiffMatches(matches, 'current', currentTreeLines.value);
  appendDiffMatches(matches, 'draft', draftTreeLines.value);
  appendDiffMatches(matches, 'release', releaseTreeLines.value);
  return matches;
});
const visibleSearchMatches = computed(() => {
  const panels = new Set(visibleSearchPanels());
  return searchMatches.value.filter((match) => panels.has(match.panel));
});
const visibleDiffMatches = computed(() => {
  const panels = new Set(visibleSearchPanels());
  return diffMatches.value.filter((match) => panels.has(match.panel));
});
const visibleJumpMatches = computed(() =>
  normalizedSearchKeyword.value
    ? visibleSearchMatches.value
    : visibleDiffMatches.value,
);
const activeJumpMatch = computed(() => {
  if (normalizedSearchKeyword.value) {
    return searchMatches.value[activeSearchIndex.value] || null;
  }
  if (!diffJumpStarted.value) {
    return null;
  }
  return diffMatches.value[activeSearchIndex.value] || null;
});
const jumpResultText = computed(() => {
  const hasKeyword = Boolean(normalizedSearchKeyword.value);
  const matches = visibleJumpMatches.value;
  const total = matches.length;
  if (!hasKeyword && !diffJumpStarted.value) {
    return '';
  }
  if (hasKeyword && total === 0) {
    return rt('snapshotSearchNoMatch');
  }
  if (total === 0) {
    return '';
  }
  const currentIndex = Math.max(
    matches.findIndex((match) => match.index === activeSearchIndex.value),
    0,
  );
  return `${currentIndex + 1}/${total}`;
});

watch(normalizedSearchKeyword, () => {
  activeSearchIndex.value = 0;
  diffJumpStarted.value = false;
});

watch(visibleSearchMatches, (matches) => {
  if (!normalizedSearchKeyword.value) {
    return;
  }
  if (
    matches.length > 0 &&
    !matches.some((match) => match.index === activeSearchIndex.value)
  ) {
    activeSearchIndex.value = matches[0]?.index || 0;
  }
  void nextTick(scrollPanelsToFirstSearchMatch);
});

watch(fullscreenOpen, (open) => {
  if (!open) {
    void exitBrowserFullscreen();
    return;
  }
  void nextTick(scrollPanelsToFirstSearchMatch);
});

function openFullscreenDiff() {
  syncFullscreenTheme();
  fullscreenOpen.value = true;
  void enterBrowserFullscreen();
}

function syncFullscreenTheme() {
  fullscreenDarkTheme.value = Boolean(
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    document.querySelector('.dark'),
  );
}

async function enterBrowserFullscreen() {
  if (
    document.fullscreenElement ||
    !document.documentElement.requestFullscreen
  ) {
    return;
  }
  try {
    await document.documentElement.requestFullscreen();
    openedBrowserFullscreen = true;
  } catch {
    openedBrowserFullscreen = false;
  }
}

async function exitBrowserFullscreen() {
  if (!openedBrowserFullscreen) {
    return;
  }
  openedBrowserFullscreen = false;
  if (!document.fullscreenElement || !document.exitFullscreen) {
    return;
  }
  try {
    await document.exitFullscreen();
  } catch {
    // 用户通过 Esc 或浏览器控件退出时，这里无需再打断关闭流程。
  }
}

function appendSearchMatches(
  matches: SnapshotLineMatch[],
  panel: SnapshotPanelKey,
  lines: SnapshotTreeLine[],
  keyword: string,
) {
  lines.forEach((line) => {
    if (!line.text.toLowerCase().includes(keyword)) {
      return;
    }
    matches.push({
      index: matches.length,
      key: line.key,
      panel,
    });
  });
}

// appendDiffMatches 收集当前可跳转的新增和删除差异行。
function appendDiffMatches(
  matches: SnapshotLineMatch[],
  panel: SnapshotPanelKey,
  lines: SnapshotTreeLine[],
) {
  lines.forEach((line) => {
    if (line.kind === 'same') {
      return;
    }
    matches.push({
      index: matches.length,
      key: line.key,
      panel,
    });
  });
}

function isSearchLine(line: SnapshotTreeLine) {
  const keyword = normalizedSearchKeyword.value;
  return Boolean(keyword && line.text.toLowerCase().includes(keyword));
}

function isActiveJumpLine(panel: SnapshotPanelKey, line: SnapshotTreeLine) {
  const active = activeJumpMatch.value;
  return Boolean(active && active.panel === panel && active.key === line.key);
}

function jumpLineIndex(panel: SnapshotPanelKey, line: SnapshotTreeLine) {
  const matches = normalizedSearchKeyword.value
    ? searchMatches.value
    : diffMatches.value;
  const match = matches.find(
    (item) => item.panel === panel && item.key === line.key,
  );
  return match?.index;
}

function submitSearchJump() {
  if (!normalizedSearchKeyword.value) {
    diffJumpStarted.value = false;
    moveJumpMatch(1);
    return;
  }
  activeSearchIndex.value = visibleSearchMatches.value[0]?.index || 0;
  void nextTick(scrollPanelsToFirstSearchMatch);
}

function moveJumpMatch(step: number) {
  const matches = visibleJumpMatches.value;
  const total = matches.length;
  if (total === 0) {
    return;
  }
  const currentIndex = matches.findIndex(
    (match) => match.index === activeSearchIndex.value,
  );
  let nextIndex = 0;
  if (!normalizedSearchKeyword.value && !diffJumpStarted.value) {
    nextIndex = step >= 0 ? 0 : total - 1;
  } else if (currentIndex === -1) {
    nextIndex = step >= 0 ? 0 : total - 1;
  } else {
    nextIndex = (currentIndex + step + total) % total;
  }
  const match = matches[nextIndex];
  if (!match) {
    return;
  }
  activeSearchIndex.value = match.index;
  diffJumpStarted.value = !normalizedSearchKeyword.value;
  void nextTick(() => {
    scrollJumpMatch(match, visibleScrollGroup());
  });
}

function visibleSearchPanels(): SnapshotPanelKey[] {
  if (fullscreenOpen.value) {
    return ['current', 'draft'];
  }
  return ['current', 'draft', 'release'];
}

function visibleScrollGroup(): SnapshotScrollGroup {
  return fullscreenOpen.value ? 'fullscreen' : 'normal';
}

function scrollPanelsToFirstSearchMatch() {
  if (!normalizedSearchKeyword.value || searchMatches.value.length === 0) {
    return;
  }
  const group = visibleScrollGroup();
  visibleSearchPanels().forEach((panel) => {
    const match = searchMatches.value.find((item) => item.panel === panel);
    if (match) {
      scrollJumpMatch(match, group);
    }
  });
}

function scrollJumpMatch(match: SnapshotLineMatch, group: SnapshotScrollGroup) {
  const container = codeContainerRef(group, match.panel);
  if (!container) {
    return;
  }
  const target = container.querySelector<HTMLElement>(
    `[data-jump-index="${match.index}"]`,
  );
  target?.scrollIntoView({ block: 'center' });
}

function codeContainerRef(group: SnapshotScrollGroup, panel: SnapshotPanelKey) {
  if (group === 'fullscreen') {
    if (panel === 'current') {
      return fullscreenCurrentCodeRef.value;
    }
    if (panel === 'draft') {
      return fullscreenDraftCodeRef.value;
    }
    return null;
  }
  if (panel === 'current') {
    return currentCodeRef.value;
  }
  if (panel === 'draft') {
    return draftCodeRef.value;
  }
  return releaseCodeRef.value;
}

function handleCodeScroll(
  group: SnapshotScrollGroup,
  panel: SnapshotPanelKey,
  event: Event,
) {
  if (!scrollSyncEnabled.value || syncingScroll) {
    return;
  }
  const source = event.currentTarget as HTMLElement | null;
  if (!source) {
    return;
  }
  const maxTop = Math.max(source.scrollHeight - source.clientHeight, 0);
  const maxLeft = Math.max(source.scrollWidth - source.clientWidth, 0);
  const topRatio = maxTop > 0 ? source.scrollTop / maxTop : 0;
  const leftRatio = maxLeft > 0 ? source.scrollLeft / maxLeft : 0;
  const panels: SnapshotPanelKey[] =
    group === 'fullscreen'
      ? ['current', 'draft']
      : ['current', 'draft', 'release'];

  syncingScroll = true;
  panels.forEach((targetPanel) => {
    if (targetPanel === panel) {
      return;
    }
    const target = codeContainerRef(group, targetPanel);
    if (!target) {
      return;
    }
    target.scrollTop =
      topRatio * Math.max(target.scrollHeight - target.clientHeight, 0);
    target.scrollLeft =
      leftRatio * Math.max(target.scrollWidth - target.clientWidth, 0);
  });
  window.requestAnimationFrame(() => {
    syncingScroll = false;
  });
}

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
    const keyCounts = new Map<string, number>();
    value.forEach((item, index) => {
      walkPathInfo(
        item,
        snapshotArrayItemPath(path, item, index, keyCounts),
        result,
      );
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
    const keyCounts = new Map<string, number>();
    value.forEach((item, index) => {
      collectCollapsiblePaths(
        item,
        result,
        snapshotArrayItemPath(path, item, index, keyCounts),
      );
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
    const arrayKeyCounts = new Map<string, number>();
    childItems.forEach(([index, entry]) => {
      if (isArray) {
        const item = entry as SnapshotValue;
        appendJsonLine(lines, item, compareInfo, changeKind, {
          depth: options.depth + 1,
          isLast: index === childItems.length - 1,
          path: snapshotArrayItemPath(
            options.path,
            item,
            index,
            arrayKeyCounts,
          ),
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
      const keyCounts = new Map<string, number>();
      value.forEach((item, index) => {
        appendYamlArrayItem(lines, item, compareInfo, changeKind, {
          depth: options.depth + 1,
          path: snapshotArrayItemPath(options.path, item, index, keyCounts),
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
      const keyCounts = new Map<string, number>();
      value.forEach((item, index) => {
        appendYamlArrayItem(lines, item, compareInfo, changeKind, {
          depth: options.depth + 1,
          path: snapshotArrayItemPath(options.path, item, index, keyCounts),
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

// snapshotArrayItemPath 用业务稳定键匹配数组对象，避免插入项导致后续下标错配。
function snapshotArrayItemPath(
  parentPath: string,
  value: SnapshotValue,
  index: number,
  keyCounts: Map<string, number>,
) {
  const stableKey = snapshotArrayItemStableKey(value);
  if (!stableKey) {
    return `${parentPath}[${index}]`;
  }
  const count = keyCounts.get(stableKey) || 0;
  keyCounts.set(stableKey, count + 1);
  const suffix = count > 0 ? `#${count}` : '';
  return `${parentPath}{${encodeURIComponent(stableKey)}${suffix}}`;
}

// snapshotArrayItemStableKey 提取运行配置列表项的稳定业务身份。
function snapshotArrayItemStableKey(value: SnapshotValue) {
  if (!isSnapshotRecord(value)) {
    return '';
  }
  return String(
    value.name || value.uniqueKey || value.workflow || value.tableName || '',
  ).trim();
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
      <div class="snapshot-diff-panel__toolbar-main">
        <Radio.Group v-model:value="viewMode" button-style="solid" size="small">
          <Radio.Button value="json">{{ rt('snapshotJsonView') }}</Radio.Button>
          <Radio.Button value="yaml">{{ rt('snapshotYamlView') }}</Radio.Button>
        </Radio.Group>
        <Input
          v-model:value="searchKeyword"
          allow-clear
          class="snapshot-diff-panel__search"
          :placeholder="rt('snapshotSearchPlaceholder')"
          size="small"
          @press-enter="submitSearchJump"
        />
        <span v-if="jumpResultText" class="snapshot-diff-panel__search-count">
          {{ jumpResultText }}
        </span>
        <Button
          size="small"
          :disabled="visibleJumpMatches.length === 0"
          @click="moveJumpMatch(-1)"
        >
          {{ rt('snapshotSearchPrev') }}
        </Button>
        <Button
          size="small"
          :disabled="visibleJumpMatches.length === 0"
          @click="moveJumpMatch(1)"
        >
          {{ rt('snapshotSearchNext') }}
        </Button>
      </div>
      <div class="snapshot-diff-panel__toolbar-actions">
        <label class="snapshot-diff-panel__sync-toggle">
          <Switch v-model:checked="scrollSyncEnabled" size="small" />
          <span>{{ rt('snapshotScrollSync') }}</span>
        </label>
        <Button size="small" @click="openFullscreenDiff">
          {{ rt('snapshotFullscreen') }}
        </Button>
        <Button size="small" @click="expandAllSnapshots">
          {{ rt('snapshotExpandAll') }}
        </Button>
        <Button size="small" @click="collapseAllSnapshots">
          {{ rt('snapshotCollapseAll') }}
        </Button>
      </div>
    </div>
    <div class="snapshot-diff-panel__layout">
      <section class="snapshot-diff-panel__card">
        <div class="snapshot-diff-panel__card-head">
          {{ rt('currentSnapshot') }}
        </div>
        <div class="snapshot-diff-panel__meta">
          <Tag :color="sourceTone">{{ source || '-' }}</Tag>
          <Tag>{{ rt('version') }} {{ activeVersion || 0 }}</Tag>
          <Tag>{{ activeChecksumShort }}</Tag>
        </div>
        <div
          ref="currentCodeRef"
          class="snapshot-diff-panel__code"
          @scroll="handleCodeScroll('normal', 'current', $event)"
        >
          <div
            v-for="line in currentTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="[
              treeLineClass(line.kind),
              {
                'snapshot-diff-panel__line--search': isSearchLine(line),
                'snapshot-diff-panel__line--active-search': isActiveJumpLine(
                  'current',
                  line,
                ),
              },
            ]"
            :data-jump-index="jumpLineIndex('current', line)"
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
      </section>

      <section class="snapshot-diff-panel__card">
        <div class="snapshot-diff-panel__card-head">
          {{ rt('draftDiffPreview') }}
        </div>
        <div class="snapshot-diff-panel__meta">
          <Tag>{{ draftChecksumShort }}</Tag>
        </div>
        <div
          ref="draftCodeRef"
          class="snapshot-diff-panel__code"
          @scroll="handleCodeScroll('normal', 'draft', $event)"
        >
          <div
            v-for="line in draftTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="[
              treeLineClass(line.kind),
              {
                'snapshot-diff-panel__line--search': isSearchLine(line),
                'snapshot-diff-panel__line--active-search': isActiveJumpLine(
                  'draft',
                  line,
                ),
              },
            ]"
            :data-jump-index="jumpLineIndex('draft', line)"
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
      </section>

      <section class="snapshot-diff-panel__card">
        <div class="snapshot-diff-panel__card-head">
          {{ rt('releaseSnapshotDetail') }}
        </div>
        <div class="snapshot-diff-panel__meta">
          <Tag v-if="releaseSelected">
            {{ rt('version') }} {{ releaseVersion || 0 }}
          </Tag>
          <Tag v-if="releaseSelected">{{ releaseChecksumShort }}</Tag>
        </div>
        <div
          v-if="releaseSelected && releaseTreeLines.length > 0"
          ref="releaseCodeRef"
          class="snapshot-diff-panel__code"
          :class="{ 'snapshot-diff-panel__code--loading': releaseLoading }"
          @scroll="handleCodeScroll('normal', 'release', $event)"
        >
          <div
            v-for="line in releaseTreeLines"
            :key="line.key"
            class="snapshot-diff-panel__line"
            :class="[
              treeLineClass(line.kind),
              {
                'snapshot-diff-panel__line--search': isSearchLine(line),
                'snapshot-diff-panel__line--active-search': isActiveJumpLine(
                  'release',
                  line,
                ),
              },
            ]"
            :data-jump-index="jumpLineIndex('release', line)"
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
          ref="releaseCodeRef"
          class="snapshot-diff-panel__code"
          :class="{ 'snapshot-diff-panel__code--loading': releaseLoading }"
          @scroll="handleCodeScroll('normal', 'release', $event)"
          v-text="releaseFallbackText || rt('selectReleaseHint')"
        ></pre>
      </section>
    </div>
    <Modal
      v-model:open="fullscreenOpen"
      :footer="null"
      :mask-style="fullscreenMaskStyle"
      :title="rt('snapshotFullscreen')"
      width="100vw"
      wrap-class-name="snapshot-diff-panel__fullscreen-wrap"
    >
      <div
        class="snapshot-diff-panel snapshot-diff-panel__fullscreen-shell"
        :class="{ 'snapshot-diff-panel--dark': fullscreenDarkTheme }"
      >
        <div class="snapshot-diff-panel__fullscreen-toolbar">
          <Input
            v-model:value="searchKeyword"
            allow-clear
            class="snapshot-diff-panel__search"
            :placeholder="rt('snapshotSearchPlaceholder')"
            size="small"
            @press-enter="submitSearchJump"
          />
          <span v-if="jumpResultText" class="snapshot-diff-panel__search-count">
            {{ jumpResultText }}
          </span>
          <Button
            size="small"
            :disabled="visibleJumpMatches.length === 0"
            @click="moveJumpMatch(-1)"
          >
            {{ rt('snapshotSearchPrev') }}
          </Button>
          <Button
            size="small"
            :disabled="visibleJumpMatches.length === 0"
            @click="moveJumpMatch(1)"
          >
            {{ rt('snapshotSearchNext') }}
          </Button>
          <label class="snapshot-diff-panel__sync-toggle">
            <Switch v-model:checked="scrollSyncEnabled" size="small" />
            <span>{{ rt('snapshotScrollSync') }}</span>
          </label>
        </div>
        <div class="snapshot-diff-panel__fullscreen-layout">
          <section
            class="snapshot-diff-panel__card snapshot-diff-panel__card--fullscreen"
          >
            <div class="snapshot-diff-panel__card-head">
              {{ rt('currentSnapshot') }}
            </div>
            <div class="snapshot-diff-panel__meta">
              <Tag :color="sourceTone">{{ source || '-' }}</Tag>
              <Tag>{{ rt('version') }} {{ activeVersion || 0 }}</Tag>
              <Tag>{{ activeChecksumShort }}</Tag>
            </div>
            <div
              ref="fullscreenCurrentCodeRef"
              class="snapshot-diff-panel__code"
              @scroll="handleCodeScroll('fullscreen', 'current', $event)"
            >
              <div
                v-for="line in currentTreeLines"
                :key="`fullscreen-current-${line.key}`"
                class="snapshot-diff-panel__line"
                :class="[
                  treeLineClass(line.kind),
                  {
                    'snapshot-diff-panel__line--search': isSearchLine(line),
                    'snapshot-diff-panel__line--active-search':
                      isActiveJumpLine('current', line),
                  },
                ]"
                :data-jump-index="jumpLineIndex('current', line)"
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
                <span
                  v-else
                  class="snapshot-diff-panel__node-toggle-spacer"
                ></span>
                <span class="snapshot-diff-panel__line-text">
                  <span
                    v-for="(token, tokenIndex) in line.tokens"
                    :key="`fullscreen-current-${line.key}-${tokenIndex}`"
                    :class="treeTokenClass(token.kind)"
                  >
                    {{ token.text }}
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section
            class="snapshot-diff-panel__card snapshot-diff-panel__card--fullscreen"
          >
            <div class="snapshot-diff-panel__card-head">
              {{ rt('draftDiffPreview') }}
            </div>
            <div class="snapshot-diff-panel__meta">
              <Tag>{{ draftChecksumShort }}</Tag>
            </div>
            <div
              ref="fullscreenDraftCodeRef"
              class="snapshot-diff-panel__code"
              @scroll="handleCodeScroll('fullscreen', 'draft', $event)"
            >
              <div
                v-for="line in draftTreeLines"
                :key="`fullscreen-draft-${line.key}`"
                class="snapshot-diff-panel__line"
                :class="[
                  treeLineClass(line.kind),
                  {
                    'snapshot-diff-panel__line--search': isSearchLine(line),
                    'snapshot-diff-panel__line--active-search':
                      isActiveJumpLine('draft', line),
                  },
                ]"
                :data-jump-index="jumpLineIndex('draft', line)"
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
                <span
                  v-else
                  class="snapshot-diff-panel__node-toggle-spacer"
                ></span>
                <span class="snapshot-diff-panel__line-text">
                  <span
                    v-for="(token, tokenIndex) in line.tokens"
                    :key="`fullscreen-draft-${line.key}-${tokenIndex}`"
                    :class="treeTokenClass(token.kind)"
                  >
                    {{ token.text }}
                  </span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.snapshot-diff-panel {
  --snapshot-diff-page-bg: var(
    --vben-background-color,
    hsl(var(--background, 0 0% 100%))
  );
  --snapshot-diff-soft-bg: var(
    --vben-background-soft,
    hsl(var(--background-deep, 216 20.11% 95.47%))
  );
  --snapshot-diff-panel-bg: hsl(var(--card, 0 0% 100%));
  --snapshot-diff-text: var(
    --vben-text-color,
    hsl(var(--foreground, 210 6% 21%))
  );
  --snapshot-diff-text-secondary: var(
    --vben-text-color-secondary,
    hsl(var(--muted-foreground, 240 3.8% 46.1%))
  );
  --snapshot-diff-border: var(
    --vben-border-color,
    hsl(var(--border, 240 5.9% 90%))
  );
  --snapshot-diff-primary: var(
    --ant-color-primary,
    var(--vben-primary-color, hsl(var(--primary, 212 100% 45%)))
  );
  --snapshot-diff-code-bg: hsl(var(--background, 0 0% 100%));
  --snapshot-diff-code-text: hsl(var(--foreground, 210 6% 21%));
  --snapshot-diff-token-boolean: #6d28d9;
  --snapshot-diff-token-key: #0369a1;
  --snapshot-diff-token-null: #dc2626;
  --snapshot-diff-token-number: #b45309;
  --snapshot-diff-token-plain: #334155;
  --snapshot-diff-token-punctuation: #64748b;
  --snapshot-diff-token-string: #047857;

  display: grid;
  gap: 8px;
}

:global(.dark) .snapshot-diff-panel,
.snapshot-diff-panel--dark {
  --snapshot-diff-page-bg: var(
    --vben-background-color,
    hsl(var(--background, 222.34deg 10.43% 12.27%))
  );
  --snapshot-diff-soft-bg: var(
    --vben-background-soft,
    hsl(var(--background-deep, 220deg 13.06% 9%))
  );
  --snapshot-diff-panel-bg: hsl(var(--card, 222.34deg 10.43% 12.27%));
  --snapshot-diff-code-bg: hsl(var(--background-deep, 220deg 13.06% 9%));
  --snapshot-diff-code-text: hsl(var(--foreground, 0 0% 95%));
  --snapshot-diff-token-boolean: #c4b5fd;
  --snapshot-diff-token-key: #7dd3fc;
  --snapshot-diff-token-null: #fca5a5;
  --snapshot-diff-token-number: #fbbf24;
  --snapshot-diff-token-plain: #cbd5e1;
  --snapshot-diff-token-punctuation: #94a3b8;
  --snapshot-diff-token-string: #a7f3d0;
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

.snapshot-diff-panel__toolbar-main {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.snapshot-diff-panel__toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.snapshot-diff-panel__search {
  width: min(280px, 100%);
}

.snapshot-diff-panel__search-count {
  min-width: 44px;
  font-size: 12px;
  line-height: 24px;
  color: var(--snapshot-diff-text-secondary);
}

.snapshot-diff-panel__sync-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 24px;
  font-size: 12px;
  color: var(--snapshot-diff-text-secondary);
}

.snapshot-diff-panel__layout {
  display: grid;
  grid-template-columns: repeat(3, minmax(320px, 1fr));
  gap: 6px;
  align-items: stretch;
  min-height: 0;
}

.snapshot-diff-panel__card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: min(74vh, 760px);
  overflow: hidden;
  color: var(--snapshot-diff-text);
  background: var(--snapshot-diff-panel-bg);
  border: 1px solid var(--snapshot-diff-border);
  border-radius: 6px;
}

.snapshot-diff-panel__card-head {
  flex: none;
  padding: 8px 10px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--snapshot-diff-text);
  white-space: nowrap;
}

.snapshot-diff-panel__meta {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 31px;
  padding: 0 10px 6px;
  margin-bottom: 0;
  border-bottom: 1px solid var(--snapshot-diff-border);
}

.snapshot-diff-panel__code {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  padding: 8px 10px 10px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--snapshot-diff-code-text);
  white-space: pre-wrap;
  background: var(--snapshot-diff-code-bg);
  border: 0;
  border-radius: 0;
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

.snapshot-diff-panel__line--search {
  background: hsl(45deg 93% 47% / 18%);
}

.snapshot-diff-panel__line--active-search {
  outline: 1px solid hsl(45deg 93% 47% / 86%);
  outline-offset: -1px;
  background: hsl(45deg 93% 47% / 28%);
}

.snapshot-diff-panel__line-marker {
  overflow: hidden;
  font-weight: 700;
  color: var(--snapshot-diff-text-secondary);
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
  color: var(--snapshot-diff-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.snapshot-diff-panel__node-toggle:hover {
  color: var(--snapshot-diff-text);
}

.snapshot-diff-panel__line-text {
  min-width: 0;
  white-space: pre-wrap;
}

.snapshot-diff-panel__token--key {
  font-weight: 600;
  color: var(--snapshot-diff-token-key);
}

.snapshot-diff-panel__token--punctuation {
  color: var(--snapshot-diff-token-punctuation);
}

.snapshot-diff-panel__token--string {
  color: var(--snapshot-diff-token-string);
}

.snapshot-diff-panel__token--number {
  color: var(--snapshot-diff-token-number);
}

.snapshot-diff-panel__token--boolean {
  color: var(--snapshot-diff-token-boolean);
}

.snapshot-diff-panel__token--null {
  color: var(--snapshot-diff-token-null);
}

.snapshot-diff-panel__token--plain {
  color: var(--snapshot-diff-token-plain);
}

.snapshot-diff-panel__fullscreen-layout {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--snapshot-diff-fullscreen-panel-gap);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.snapshot-diff-panel__fullscreen-shell {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--snapshot-diff-page-bg);
}

.snapshot-diff-panel__fullscreen-toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 0 0 var(--snapshot-diff-fullscreen-toolbar-gap);
  margin-bottom: var(--snapshot-diff-fullscreen-toolbar-gap);
  color: var(--snapshot-diff-text);
  background: transparent;
  border-bottom: 1px solid var(--snapshot-diff-border);
  box-shadow: none;
}

.snapshot-diff-panel__fullscreen-toolbar .snapshot-diff-panel__search {
  width: min(360px, 100%);
}

.snapshot-diff-panel__fullscreen-toolbar :deep(.ant-input-affix-wrapper),
.snapshot-diff-panel__fullscreen-toolbar :deep(.ant-btn) {
  color: var(--snapshot-diff-text);
  background: var(--snapshot-diff-page-bg);
  border-color: var(--snapshot-diff-border);
}

.snapshot-diff-panel__fullscreen-toolbar
  :deep(.ant-input-affix-wrapper-focused),
.snapshot-diff-panel__fullscreen-toolbar :deep(.ant-btn:hover) {
  border-color: var(--snapshot-diff-primary);
}

.snapshot-diff-panel__fullscreen-toolbar :deep(.ant-input::placeholder) {
  color: var(--snapshot-diff-text-secondary);
}

.snapshot-diff-panel__card--fullscreen {
  height: 100%;
}

:global(.snapshot-diff-panel__fullscreen-wrap) {
  --snapshot-diff-fullscreen-gap: 4px;
  --snapshot-diff-fullscreen-inset: 8px;
  --snapshot-diff-fullscreen-panel-gap: 6px;
  --snapshot-diff-fullscreen-toolbar-gap: 2px;

  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--vben-background-color, hsl(var(--background, 0 0% 100%)));
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal) {
  top: 0;
  width: 100vw !important;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  padding-bottom: 0;
  margin: 0;
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-content) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  padding: 0;
  overflow: hidden;
  background: var(--vben-background-color, hsl(var(--background, 0 0% 100%)));
  border-radius: 0;
  box-shadow: none;
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-header) {
  flex: none;
  padding: 8px var(--snapshot-diff-fullscreen-inset) 6px;
  margin-bottom: 0;
  background: var(--vben-background-color, hsl(var(--background, 0 0% 100%)));
  border-bottom: 1px solid
    var(--vben-border-color, hsl(var(--border, 240 5.9% 90%)));
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-title) {
  color: var(--vben-text-color, hsl(var(--foreground, 210 6% 21%)));
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: var(--snapshot-diff-fullscreen-gap)
    var(--snapshot-diff-fullscreen-inset) var(--snapshot-diff-fullscreen-inset);
  overflow: hidden;
  background: var(--vben-background-color, hsl(var(--background, 0 0% 100%)));
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-close) {
  inset-inline-end: 8px;
  top: 4px;
  color: var(
    --vben-text-color-secondary,
    hsl(var(--muted-foreground, 240 3.8% 46.1%))
  );
}

:global(.snapshot-diff-panel__fullscreen-wrap .ant-modal-close:hover) {
  color: var(--vben-text-color, hsl(var(--foreground, 210 6% 21%)));
  background: var(
    --vben-background-soft,
    hsl(var(--background-deep, 216 20.11% 95.47%))
  );
}

@media (max-width: 1200px) {
  .snapshot-diff-panel__layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .snapshot-diff-panel__fullscreen-layout {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .snapshot-diff-panel__card--fullscreen {
    height: min(58vh, 560px);
    min-height: 320px;
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

  .snapshot-diff-panel__toolbar-actions {
    justify-content: flex-start;
  }

  .snapshot-diff-panel__search {
    width: 100%;
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
