<script lang="ts" setup>
// ================= 类型与依赖引入 =================
import type { TaskApi } from '#/api/cron/task';

import { computed, onMounted, ref } from 'vue';

import { Page, VbenButton } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  CopyOutlined,
  FileTextOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  fetchConfigReloadItems,
  fetchConfigReloadStatus,
  runConfigReload,
} from '#/api/cron/task';
import {
  asActionPermission,
  CRON_ACTION_PERMISSION_CODES,
  hasAnyPermission,
} from '#/constants/permission-codes';
import { $t } from '#/locales';
import { copyTextToClipboard } from '#/utils/security/password';

import {
  buildHotReloadStatusLabel,
  buildHotReloadTriggerLabel,
  safePrettyJson,
} from '../shared';

type OverflowTooltipProps = InstanceType<typeof Tooltip>['$props'];
// ConfigItemTablePagination 表示 Ant Design 表格分页事件里需要的字段。
type ConfigItemTablePagination = {
  current?: number;
  pageSize?: number;
};
// ConfigItemViewMode 控制配置项结果在 YAML 与表格之间切换。
type ConfigItemViewMode = 'table' | 'yaml';
// ConfigYamlViewMode 控制 YAML 视图展示运行期结构或完整快照。
type ConfigYamlViewMode = 'runtime' | 'snapshot';
// ConfigYamlTokenType 表示 YAML 只读高亮视图中的词法类型。
type ConfigYamlTokenType =
  | 'boolean'
  | 'comment'
  | 'key'
  | 'null'
  | 'number'
  | 'plain'
  | 'punctuation'
  | 'string';
// ConfigYamlToken 表示一段可独立着色的 YAML 文本。
type ConfigYamlToken = {
  // text 保存原始 YAML 片段文本。
  text: string;
  // type 决定片段在只读视图里的高亮样式。
  type: ConfigYamlTokenType;
};
// ConfigYamlLine 表示带行号的一行 YAML。
type ConfigYamlLine = {
  // no 使用一基行号，便于排障时定位配置位置。
  no: number;
  // tokens 保存该行按 YAML 语义拆分后的高亮片段。
  tokens: ConfigYamlToken[];
};

// configYamlTokenClassMap 定义 YAML 高亮颜色类，避免使用 v-html 注入高亮片段。
const configYamlTokenClassMap: Record<ConfigYamlTokenType, string> = {
  boolean: 'config-yaml-token-boolean',
  comment: 'config-yaml-token-comment',
  key: 'config-yaml-token-key',
  null: 'config-yaml-token-null',
  number: 'config-yaml-token-number',
  plain: 'config-yaml-token-plain',
  punctuation: 'config-yaml-token-punctuation',
  string: 'config-yaml-token-string',
};

// ================= 页面状态 =================
// accessStore 保存当前登录账号的 uuid 权限码集合，用于判断是否自动拉取热加载状态。
const accessStore = useAccessStore();
// submitting 避免查询与执行热加载时重复点击。
const submitting = ref(false);
// configReloadStatusText 保存热加载接口原始响应，便于排障复制。
const configReloadStatusText = ref('');
// configReloadStatus 保存最近一次配置热加载状态对象。
const configReloadStatus = ref<null | TaskApi.TaskConfigReloadStatusResp>(null);
// showConfigReloadRaw 控制原始 JSON 回执是否展开。
const showConfigReloadRaw = ref(false);
// configItems 保存后端返回的运行态配置项，值已经在后端完成脱敏。
const configItems = ref<TaskApi.TaskConfigItem[]>([]);
// configItemResult 保存配置项查询完整响应，供统计和 YAML 视图共用。
const configItemResult = ref<null | TaskApi.TaskConfigItemQueryResp>(null);
// configItemsLoading 控制配置项查询按钮与表格加载状态。
const configItemsLoading = ref(false);
// configItemsLoaded 标记是否已经完成过一次配置项查询。
const configItemsLoaded = ref(false);
// configItemKeyword 保存配置项搜索关键字，只匹配路径和脱敏展示值。
const configItemKeyword = ref('');
// configItemSensitiveOnly 控制是否只查询后端判定的敏感配置项。
const configItemSensitiveOnly = ref(false);
// configItemPage 保存配置项表格当前页码。
const configItemPage = ref(1);
// configItemPageSize 保存配置项表格分页大小。
const configItemPageSize = ref(20);
// configItemTotal 保存当前筛选条件下的配置项总数。
const configItemTotal = ref(0);
// configItemViewMode 控制结果展示为 YAML 或表格。
const configItemViewMode = ref<ConfigItemViewMode>('yaml');
// configYamlViewMode 控制 YAML 视图展示完整快照或 runtime.yaml 原结构。
const configYamlViewMode = ref<ConfigYamlViewMode>('runtime');

// canQueryConfigReloadStatus 判断当前账号是否可以查询热加载状态。
const canQueryConfigReloadStatus = computed(() =>
  hasAnyPermission(
    accessStore.accessCodes,
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
  ),
);

// canQueryConfigItems 判断当前账号是否可以查看运行态配置项。
const canQueryConfigItems = computed(() =>
  hasAnyPermission(
    accessStore.accessCodes,
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_ITEMS,
  ),
);

// canManageConfigReload 判断当前账号是否具备任一热加载相关操作权限。
const canManageConfigReload = computed(() =>
  hasAnyPermission(accessStore.accessCodes, [
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_ITEMS,
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_RUN,
    CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
  ]),
);

// configItemColumns 定义运行态配置项表格列。
const configItemColumns = computed(() => [
  {
    title: $t('business.message.configItemPath'),
    dataIndex: 'path',
    key: 'path',
    width: 320,
  },
  {
    title: $t('business.message.configItemValue'),
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: $t('business.message.configItemType'),
    dataIndex: 'valueType',
    key: 'valueType',
    width: 120,
  },
  {
    title: $t('business.message.configItemSensitive'),
    dataIndex: 'sensitive',
    key: 'sensitive',
    width: 120,
  },
]);

// configItemOverviewRows 生成配置项结果总览，帮助确认当前响应来自运行态快照。
const configItemOverviewRows = computed(() => {
  const result = configItemResult.value;
  if (!result) {
    return [];
  }
  return [
    {
      label: $t('business.message.configMatchedItems'),
      value: String(result.total || 0),
      description: result.keyword || $t('business.message.all'),
    },
    {
      label: $t('business.message.configTotalItems'),
      value: String(result.totalItems || 0),
      description: $t('business.message.configTotalItemsDesc'),
    },
    {
      label: $t('business.message.configSensitiveItems'),
      value: String(result.sensitiveTotal || 0),
      description: $t('business.message.configSensitiveItemsDesc'),
    },
    {
      label: $t('business.message.configSnapshotVersion'),
      value: result.source?.configVersion || '-',
      description: $t('business.message.configSnapshotVersionDesc'),
    },
  ];
});

// configItemSourceRows 展示热加载来源元信息，避免把 YAML 快照误认为磁盘原文件。
const configItemSourceRows = computed(() => {
  const source = configItemResult.value?.source;
  if (!source) {
    return [];
  }
  return [
    {
      label: $t('business.message.configSource'),
      value:
        source.source === 'runtime_snapshot'
          ? $t('business.message.configSourceRuntimeSnapshot')
          : source.source || '-',
    },
    {
      label: $t('business.message.configFile'),
      value: source.configFile || '-',
    },
    {
      label: $t('business.message.runtimeConfigFile'),
      value: source.runtimeFile || '-',
    },
    {
      label: $t('business.message.currentStatus'),
      value: buildHotReloadStatusLabel(source.lastStatus),
    },
    {
      label: $t('business.message.latestTriggerSource'),
      value: buildHotReloadTriggerLabel(source.lastTriggerSource),
    },
    {
      label: $t('business.message.latestReloadTime'),
      value: source.lastReloadAt || '-',
    },
    {
      label: $t('business.message.latestSuccessTime'),
      value: source.lastSuccessAt || '-',
    },
    {
      label: $t('business.message.restartRequired'),
      value: source.restartRequired
        ? $t('business.message.needRestartProcess')
        : $t('business.message.noRestartRequired'),
    },
  ];
});

// configItemSections 保存后端按顶层配置块汇总的数量和敏感项统计。
const configItemSections = computed(
  () => configItemResult.value?.sections || [],
);

// configSnapshotYaml 保存完整运行态配置快照，字段值已由后端脱敏。
const configSnapshotYaml = computed(
  () => configItemResult.value?.snapshotYaml || '',
);
// configRuntimeYaml 保存 runtime.yaml 顶层结构视图，便于确认外部配置已生效。
const configRuntimeYaml = computed(
  () => configItemResult.value?.runtimeYaml || '',
);
// activeConfigYaml 返回当前选中的 YAML 文本，供复制和预览共用。
const activeConfigYaml = computed(() =>
  configYamlViewMode.value === 'runtime'
    ? configRuntimeYaml.value
    : configSnapshotYaml.value,
);
// activeConfigYamlLines 将当前 YAML 文本拆成带高亮 token 的只读行数据。
const activeConfigYamlLines = computed(() =>
  buildConfigYamlLines(activeConfigYaml.value),
);

// hotReloadSummaryRows 生成“热加载状态总览”区域所需字段。
const hotReloadSummaryRows = computed(() => {
  const status = configReloadStatus.value;
  if (!status) {
    return [];
  }
  return [
    {
      label: $t('business.message.currentStatus'),
      value: buildHotReloadStatusLabel(status.lastStatus),
      description: $t('business.message.hotReloadCurrentStatusDesc'),
    },
    {
      label: $t('business.message.isEnabled'),
      value: status.enabled
        ? $t('business.message.enabled')
        : $t('business.message.disabled'),
      description: $t('business.message.hotReloadEnabledDesc'),
    },
    {
      label: $t('business.message.isWatching'),
      value: status.watching
        ? $t('business.message.backgroundWatching')
        : $t('business.message.notWatching'),
      description: $t('business.message.hotReloadWatchingDesc'),
    },
    {
      label: $t('business.message.latestTriggerSource'),
      value: buildHotReloadTriggerLabel(status.lastTriggerSource),
      description: $t('business.message.latestTriggerSourceDesc'),
    },
    {
      label: $t('business.message.configFile'),
      value: status.configFile || '-',
      description: $t('business.message.configFileDesc'),
    },
    {
      label: $t('business.message.pollInterval'),
      value: $t('business.message.secondsValue', [
        status.checkIntervalSeconds || 0,
      ]),
      description: $t('business.message.pollIntervalDesc'),
    },
    {
      label: $t('business.message.configVersion'),
      value: status.configVersion || '-',
      description: $t('business.message.configVersionDesc'),
    },
    {
      label: $t('business.message.restartRequired'),
      value: status.restartRequired
        ? $t('business.message.needRestartProcess')
        : $t('business.message.noRestartRequired'),
      description: $t('business.message.restartRequiredDesc'),
    },
    {
      label: $t('business.message.restartReason'),
      value: status.restartReason || '-',
      description: $t('business.message.restartReasonDesc'),
    },
    {
      label: $t('business.message.latestResultMessage'),
      value: status.lastMessage || '-',
      description: $t('business.message.latestResultMessageDesc'),
    },
    {
      label: $t('business.message.latestFailureCategory'),
      value: status.lastFailureCategory || '-',
      description: $t('business.message.latestFailureCategoryDesc'),
    },
    {
      label: $t('business.message.successCount'),
      value: $t('business.message.timesValue', [status.reloadCount || 0]),
      description: $t('business.message.successCountDesc'),
    },
    {
      label: $t('business.message.suppressedFailureCount'),
      value: $t('business.message.timesValue', [
        status.suppressedFailureCount || 0,
      ]),
      description: $t('business.message.suppressedFailureCountDesc'),
    },
  ];
});

// hotReloadTimeRows 生成“热加载时间轴”区域所需字段。
const hotReloadTimeRows = computed(() => {
  const status = configReloadStatus.value;
  if (!status) {
    return [];
  }
  return [
    {
      label: $t('business.message.latestCheckTime'),
      value: status.lastCheckedAt || '-',
      description: $t('business.message.latestCheckTimeDesc'),
    },
    {
      label: $t('business.message.latestReloadTime'),
      value: status.lastReloadAt || '-',
      description: $t('business.message.latestReloadTimeDesc'),
    },
    {
      label: $t('business.message.latestSuccessTime'),
      value: status.lastSuccessAt || '-',
      description: $t('business.message.latestSuccessTimeDesc'),
    },
    {
      label: $t('business.message.latestFailureTime'),
      value: status.lastFailureAt || '-',
      description: $t('business.message.latestFailureTimeDesc'),
    },
  ];
});

// hotReloadDetailRows 合并状态与时间字段，用紧凑描述表展示。
const hotReloadDetailRows = computed(() => [
  ...hotReloadSummaryRows.value,
  ...hotReloadTimeRows.value,
]);

// buildOverflowTooltipProps 返回统一的长文本悬浮展示配置。
function buildOverflowTooltipProps(text: string): OverflowTooltipProps {
  return {
    overlayStyle: {
      maxWidth: '720px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    },
    placement: 'topLeft' as const,
    title: text,
  };
}

// buildConfigYamlLines 生成 YAML 行号和 token，避免在模板中做字符串解析。
function buildConfigYamlLines(yamlText: string): ConfigYamlLine[] {
  const normalized = String(yamlText || '')
    .replaceAll('\r\n', '\n')
    .replace(/\n$/, '');
  if (!normalized) {
    return [];
  }
  return normalized.split('\n').map((line, index) => ({
    no: index + 1,
    tokens: tokenizeConfigYamlLine(line),
  }));
}

// tokenizeConfigYamlLine 对单行 YAML 做轻量词法拆分，覆盖配置预览常见结构。
function tokenizeConfigYamlLine(line: string): ConfigYamlToken[] {
  const leading = line.match(/^\s*/)?.[0] || '';
  const rest = line.slice(leading.length);
  if (!rest) {
    return [{ text: leading || ' ', type: 'plain' }];
  }
  const tokens = leading ? [{ text: leading, type: 'plain' as const }] : [];
  if (rest.startsWith('#')) {
    return [...tokens, { text: rest, type: 'comment' }];
  }
  if (rest.startsWith('- ')) {
    return [
      ...tokens,
      { text: '- ', type: 'punctuation' },
      ...tokenizeConfigYamlContent(rest.slice(2)),
    ];
  }
  return [...tokens, ...tokenizeConfigYamlContent(rest)];
}

// tokenizeConfigYamlContent 识别 key/value 或普通值。
function tokenizeConfigYamlContent(content: string): ConfigYamlToken[] {
  const colonIndex = findConfigYamlKeyColon(content);
  if (colonIndex < 0) {
    return tokenizeConfigYamlValue(content);
  }

  const keyText = content.slice(0, colonIndex);
  const valueText = content.slice(colonIndex + 1);
  const keyTrailing = keyText.match(/\s*$/)?.[0] || '';
  const keyName = keyText.slice(0, keyText.length - keyTrailing.length);
  const tokens: ConfigYamlToken[] = [];
  if (keyName) {
    tokens.push({ text: keyName, type: 'key' });
  }
  if (keyTrailing) {
    tokens.push({ text: keyTrailing, type: 'plain' });
  }
  tokens.push({ text: ':', type: 'punctuation' });
  return [...tokens, ...tokenizeConfigYamlValue(valueText)];
}

// findConfigYamlKeyColon 查找未被引号包裹的 key 分隔冒号。
function findConfigYamlKeyColon(content: string): number {
  let quote: null | string = null;
  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const previous = content[index - 1];
    if (quote) {
      if (current === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }
    if (
      current === ':' &&
      (index === content.length - 1 || /\s/.test(content[index + 1] || ''))
    ) {
      return index;
    }
  }
  return -1;
}

// tokenizeConfigYamlValue 标记 YAML 标量值；敏感值仍来自后端脱敏结果。
function tokenizeConfigYamlValue(valueText: string): ConfigYamlToken[] {
  if (!valueText) {
    return [];
  }
  const leading = valueText.match(/^\s*/)?.[0] || '';
  const body = valueText.slice(leading.length);
  const tokens: ConfigYamlToken[] = leading
    ? [{ text: leading, type: 'plain' }]
    : [];
  if (!body) {
    return tokens;
  }
  if (body.startsWith('#')) {
    return [...tokens, { text: body, type: 'comment' }];
  }

  const commentIndex = findConfigYamlInlineComment(body);
  const valuePart = commentIndex >= 0 ? body.slice(0, commentIndex) : body;
  const commentPart = commentIndex >= 0 ? body.slice(commentIndex) : '';
  const valueTrailing = valuePart.match(/\s*$/)?.[0] || '';
  const valueCore = valuePart.slice(0, valuePart.length - valueTrailing.length);

  if (valueCore) {
    tokens.push({ text: valueCore, type: configYamlValueType(valueCore) });
  }
  if (valueTrailing) {
    tokens.push({ text: valueTrailing, type: 'plain' });
  }
  if (commentPart) {
    tokens.push({ text: commentPart, type: 'comment' });
  }
  return tokens;
}

// findConfigYamlInlineComment 查找值后的行内注释起点。
function findConfigYamlInlineComment(text: string): number {
  let quote: null | string = null;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const previous = text[index - 1];
    if (quote) {
      if (current === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }
    if (current === '#' && (index === 0 || /\s/.test(previous || ''))) {
      return index;
    }
  }
  return -1;
}

// configYamlValueType 返回 YAML 标量值对应的高亮类型。
function configYamlValueType(value: string): ConfigYamlTokenType {
  const trimmed = value.trim();
  if (/^(false|true)$/i.test(trimmed)) {
    return 'boolean';
  }
  if (/^(null|~)$/i.test(trimmed)) {
    return 'null';
  }
  if (/^[-+]?\d+(?:\.\d+)?$/.test(trimmed)) {
    return 'number';
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return 'string';
  }
  if (
    trimmed === '[' ||
    trimmed === ']' ||
    trimmed === '{' ||
    trimmed === '}'
  ) {
    return 'punctuation';
  }
  return 'string';
}

// handleFetchConfigReloadStatus 查询配置热加载状态。
async function handleFetchConfigReloadStatus() {
  submitting.value = true;
  try {
    const responseData = await fetchConfigReloadStatus();
    configReloadStatus.value = responseData;
    configReloadStatusText.value = safePrettyJson(responseData);
    message.success($t('business.message.configHotReloadStatusQueried'));
  } catch (error) {
    configReloadStatus.value = null;
    configReloadStatusText.value = $t('business.message.queryFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

// handleRunConfigReload 手动触发配置热加载。
async function handleRunConfigReload() {
  submitting.value = true;
  try {
    const responseData = await runConfigReload();
    configReloadStatus.value = responseData;
    configReloadStatusText.value = safePrettyJson(responseData);
    if (configItemsLoaded.value && canQueryConfigItems.value) {
      await handleFetchConfigItems(false, false);
    }
    message.success($t('business.message.configHotReloadExecuted'));
  } catch (error) {
    configReloadStatus.value = null;
    configReloadStatusText.value = $t('business.message.runFailed', [
      String(error),
    ]);
  } finally {
    submitting.value = false;
  }
}

// handleFetchConfigItems 查询当前运行态配置项；后端只返回脱敏后的展示值。
async function handleFetchConfigItems(resetPage = true, showToast = true) {
  if (!canQueryConfigItems.value) {
    return;
  }
  if (resetPage) {
    configItemPage.value = 1;
  }
  configItemsLoading.value = true;
  try {
    const responseData = await fetchConfigReloadItems({
      keyword: configItemKeyword.value.trim(),
      page: configItemPage.value,
      pageSize: configItemPageSize.value,
      sensitiveOnly: configItemSensitiveOnly.value,
    });
    const firstLoad = !configItemsLoaded.value;
    configItemResult.value = responseData;
    configItems.value = responseData.items || [];
    configItemTotal.value = Number(responseData.total || 0);
    configItemPage.value = Number(responseData.page || 1);
    configItemPageSize.value = Number(responseData.pageSize || 20);
    configItemsLoaded.value = true;
    if (firstLoad) {
      configItemViewMode.value = 'yaml';
      configYamlViewMode.value = responseData.runtimeYaml
        ? 'runtime'
        : 'snapshot';
    } else if (
      !responseData.runtimeYaml &&
      configYamlViewMode.value === 'runtime'
    ) {
      configYamlViewMode.value = 'snapshot';
    }
    if (showToast) {
      message.success($t('business.message.configItemsQueried'));
    }
  } catch (error) {
    configItemResult.value = null;
    configItems.value = [];
    configItemTotal.value = 0;
    message.error($t('business.message.queryFailed', [String(error)]));
  } finally {
    configItemsLoading.value = false;
  }
}

// handleConfigItemTableChange 同步分页变化后重新查询当前筛选条件。
function handleConfigItemTableChange(pagination: ConfigItemTablePagination) {
  configItemPage.value = Number(pagination.current || 1);
  configItemPageSize.value = Number(pagination.pageSize || 20);
  void handleFetchConfigItems(false, false);
}

// handleCopyConfigYaml 复制当前选中的脱敏 YAML，便于排障时保留可读快照。
async function handleCopyConfigYaml() {
  await copyTextToClipboard(
    activeConfigYaml.value,
    $t('business.message.configYamlCopied'),
    $t('business.message.noConfigYamlToCopy'),
  );
}

onMounted(() => {
  if (canQueryConfigReloadStatus.value) {
    void handleFetchConfigReloadStatus();
  }
});
</script>

<template>
  <Page :title="$t('business.message.configHotReload')">
    <div class="space-y-5">
      <Alert
        v-if="!canManageConfigReload"
        :message="$t('business.message.noConfigHotReloadPermission')"
        :description="$t('business.message.noConfigHotReloadPermissionDesc')"
        show-icon
        type="warning"
      />
      <Card
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.configHotReload')"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div
            class="min-w-0 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-300"
          >
            {{ $t('business.message.configHotReloadGuide') }}
          </div>
          <Space class="shrink-0" :size="8" wrap>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_STATUS,
                )
              "
              :disabled="submitting"
              @click="handleFetchConfigReloadStatus"
            >
              {{ $t('business.message.queryHotReloadStatus') }}
            </VbenButton>
            <VbenButton
              v-access="
                asActionPermission(
                  CRON_ACTION_PERMISSION_CODES.TASK_CONFIG_RELOAD_RUN,
                )
              "
              type="primary"
              :disabled="submitting"
              @click="handleRunConfigReload"
            >
              {{ $t('business.message.triggerHotReload') }}
            </VbenButton>
            <VbenButton
              v-if="configReloadStatusText"
              :disabled="submitting"
              @click="showConfigReloadRaw = !showConfigReloadRaw"
            >
              {{
                showConfigReloadRaw
                  ? $t('business.message.closeRawReceipt')
                  : $t('business.message.viewRawReceipt')
              }}
            </VbenButton>
          </Space>
        </div>
        <div
          v-if="hotReloadDetailRows.length > 0"
          class="mt-4 overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/30"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="item in hotReloadDetailRows"
              :key="item.label"
              class="min-w-0 border-b border-slate-200 px-4 py-3 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(4n)]:border-r-0 dark:border-slate-700"
            >
              <div class="truncate text-xs font-medium text-slate-400">
                {{ item.label }}
              </div>
              <Tooltip
                v-if="String(item.value || '').trim()"
                v-bind="buildOverflowTooltipProps(String(item.value))"
              >
                <div
                  class="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                  :title="String(item.value)"
                >
                  {{ item.value }}
                </div>
              </Tooltip>
              <div
                v-else
                class="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ item.value }}
              </div>
              <Tooltip v-bind="buildOverflowTooltipProps(item.description)">
                <div class="mt-2 truncate text-xs text-slate-500">
                  {{ item.description }}
                </div>
              </Tooltip>
            </div>
          </div>
        </div>
        <pre
          v-if="showConfigReloadRaw && configReloadStatusText"
          class="mt-4 overflow-auto rounded-2xl border border-amber-500/20 bg-slate-950 px-4 py-4 text-sm text-amber-100 shadow-inner"
          v-text="configReloadStatusText"
        ></pre>
      </Card>

      <Card
        v-if="canQueryConfigItems"
        class="border border-slate-200/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
        :title="$t('business.message.configRuntimeItems')"
      >
        <div
          class="config-query-panel border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30"
        >
          <div
            class="grid gap-3 xl:grid-cols-[minmax(360px,1fr)_auto] xl:items-center"
          >
            <Input
              v-model:value="configItemKeyword"
              allow-clear
              class="config-query-input w-full"
              :maxlength="128"
              :placeholder="$t('business.message.configItemSearchPlaceholder')"
              size="large"
              @press-enter="() => handleFetchConfigItems(true)"
            />
            <div
              class="flex min-w-0 flex-wrap items-center gap-3 xl:justify-end"
            >
              <Switch
                v-model:checked="configItemSensitiveOnly"
                class="config-query-switch"
                :checked-children="$t('business.message.sensitiveOnly')"
                :un-checked-children="$t('business.message.all')"
                @change="() => handleFetchConfigItems(true, false)"
              />
              <Button
                class="config-query-button"
                :disabled="configItemsLoading"
                :loading="configItemsLoading"
                size="large"
                type="primary"
                @click="handleFetchConfigItems(true)"
              >
                <template #icon>
                  <SearchOutlined />
                </template>
                {{ $t('business.message.searchConfigItems') }}
              </Button>
            </div>
          </div>

          <Alert
            v-if="!configItemsLoaded"
            class="config-query-alert mt-3"
            :message="$t('business.message.configRuntimeItemsGuide')"
            show-icon
            type="info"
          />
        </div>

        <template v-if="configItemsLoaded">
          <div
            class="mt-5 overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/30"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="item in configItemOverviewRows"
                :key="item.label"
                class="min-w-0 border-b border-slate-200 px-4 py-3 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(4n)]:border-r-0 dark:border-slate-700"
              >
                <div class="truncate text-xs font-medium text-slate-500">
                  {{ item.label }}
                </div>
                <Tooltip v-bind="buildOverflowTooltipProps(String(item.value))">
                  <div
                    class="mt-1 truncate text-base font-semibold text-slate-950 dark:text-slate-50"
                  >
                    {{ item.value }}
                  </div>
                </Tooltip>
                <Tooltip v-bind="buildOverflowTooltipProps(item.description)">
                  <div class="mt-1 truncate text-xs text-slate-400">
                    {{ item.description }}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          <div
            class="mt-5 overflow-hidden border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/30"
          >
            <div
              class="border-b border-slate-200 px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700"
            >
              {{ $t('business.message.configSourceMeta') }}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="item in configItemSourceRows"
                :key="item.label"
                class="min-w-0 border-b border-slate-200 px-4 py-3 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(4n)]:border-r-0 dark:border-slate-700"
              >
                <div class="truncate text-xs text-slate-400">
                  {{ item.label }}
                </div>
                <Tooltip v-bind="buildOverflowTooltipProps(String(item.value))">
                  <div
                    class="mt-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    {{ item.value }}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          <div
            v-if="configItemSections.length > 0"
            class="mt-5 border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/30"
          >
            <div class="mb-2 text-xs font-medium text-slate-500">
              {{ $t('business.message.configTopSections') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="section in configItemSections"
                :key="section.name"
                :color="section.sensitiveTotal > 0 ? 'warning' : 'default'"
              >
                {{ section.name }} · {{ section.total }} /
                {{ section.sensitiveTotal }}
              </Tag>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <Radio.Group
                v-model:value="configItemViewMode"
                button-style="solid"
              >
                <Radio.Button value="yaml">
                  <FileTextOutlined />
                  {{ $t('business.message.yamlView') }}
                </Radio.Button>
                <Radio.Button value="table">
                  <TableOutlined />
                  {{ $t('business.message.tableView') }}
                </Radio.Button>
              </Radio.Group>
              <Radio.Group
                v-if="configItemViewMode === 'yaml'"
                v-model:value="configYamlViewMode"
                button-style="solid"
              >
                <Radio.Button value="runtime" :disabled="!configRuntimeYaml">
                  {{ $t('business.message.runtimeYamlView') }}
                </Radio.Button>
                <Radio.Button value="snapshot">
                  {{ $t('business.message.snapshotYamlView') }}
                </Radio.Button>
              </Radio.Group>
            </div>
            <Button
              v-if="configItemViewMode === 'yaml'"
              class="shrink-0"
              size="small"
              :disabled="!activeConfigYaml"
              @click="handleCopyConfigYaml"
            >
              <template #icon>
                <CopyOutlined />
              </template>
              {{ $t('business.message.copyConfigYaml') }}
            </Button>
          </div>

          <div
            v-if="configItemViewMode === 'yaml'"
            :aria-label="$t('business.message.yamlView')"
            class="config-yaml-view mt-4 max-h-[640px] overflow-auto border border-slate-200 bg-slate-950 font-mono text-[13px] leading-5 shadow-inner dark:border-slate-700"
            role="region"
          >
            <div v-if="activeConfigYamlLines.length > 0" class="min-w-max py-3">
              <div
                v-for="line in activeConfigYamlLines"
                :key="line.no"
                class="config-yaml-line grid min-w-max"
              >
                <span
                  class="config-yaml-line-no sticky left-0 select-none border-r border-slate-800 bg-slate-950 px-3 text-right text-slate-500"
                >
                  {{ line.no }}
                </span>
                <code class="whitespace-pre px-3">
                  <span
                    v-for="(token, tokenIndex) in line.tokens"
                    :key="`${line.no}-${tokenIndex}`"
                    :class="configYamlTokenClassMap[token.type]"
                  >
                    {{ token.text }}
                  </span>
                </code>
              </div>
            </div>
            <div v-else class="px-4 py-4 text-slate-400">-</div>
          </div>

          <Table
            v-else
            class="mt-4"
            :columns="configItemColumns"
            :data-source="configItems"
            :loading="configItemsLoading"
            :pagination="{
              current: configItemPage,
              pageSize: configItemPageSize,
              showSizeChanger: true,
              total: configItemTotal,
            }"
            :scroll="{ x: 960 }"
            row-key="path"
            size="small"
            @change="handleConfigItemTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'path'">
                <Tooltip
                  v-bind="buildOverflowTooltipProps(String(record.path || '-'))"
                >
                  <span
                    class="block max-w-full truncate font-mono text-xs text-slate-700 dark:text-slate-200"
                  >
                    {{ record.path || '-' }}
                  </span>
                </Tooltip>
              </template>
              <template v-else-if="column.key === 'value'">
                <Tooltip
                  v-bind="
                    buildOverflowTooltipProps(String(record.value || '-'))
                  "
                >
                  <span
                    class="block max-w-full truncate font-mono text-xs"
                    :class="
                      record.sensitive
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-700 dark:text-slate-200'
                    "
                  >
                    {{ record.value || '-' }}
                  </span>
                </Tooltip>
              </template>
              <template v-else-if="column.key === 'valueType'">
                <Tag color="processing">
                  {{ record.valueType || '-' }}
                </Tag>
              </template>
              <template v-else-if="column.key === 'sensitive'">
                <Tag :color="record.sensitive ? 'warning' : 'default'">
                  {{
                    record.sensitive
                      ? $t('business.message.masked')
                      : $t('business.message.plain')
                  }}
                </Tag>
              </template>
            </template>
          </Table>
        </template>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.config-query-panel {
  border-radius: 8px;
}

.config-query-button {
  min-width: 136px;
  height: 40px;
}

:deep(.config-query-switch.ant-switch) {
  min-width: 108px;
  height: 40px;
  line-height: 40px;
}

:deep(.config-query-switch.ant-switch .ant-switch-handle) {
  inset-inline-start: 4px;
  top: 4px;
  width: 32px;
  height: 32px;
}

:deep(.config-query-switch.ant-switch .ant-switch-handle::before) {
  border-radius: 50%;
}

:deep(.config-query-switch.ant-switch.ant-switch-checked .ant-switch-handle) {
  inset-inline-start: calc(100% - 36px);
}

:deep(.config-query-switch.ant-switch .ant-switch-inner) {
  display: grid;
  place-items: center;
  height: 100%;
  padding-inline: 42px 12px;
}

:deep(.config-query-switch.ant-switch.ant-switch-checked .ant-switch-inner) {
  padding-inline: 12px 42px;
}

:deep(.config-query-switch.ant-switch .ant-switch-inner-checked),
:deep(.config-query-switch.ant-switch .ant-switch-inner-unchecked) {
  grid-area: 1 / 1;
  height: auto;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

:deep(
  .config-query-switch.ant-switch:not(.ant-switch-checked)
    .ant-switch-inner-checked
) {
  display: none;
}

:deep(
  .config-query-switch.ant-switch.ant-switch-checked .ant-switch-inner-unchecked
) {
  display: none;
}

.config-yaml-view {
  color: #dbeafe;
}

.config-yaml-line {
  grid-template-columns: 3.25rem minmax(0, 1fr);
}

.config-yaml-line:hover {
  background: rgb(30 64 175 / 16%);
}

.config-yaml-line-no {
  z-index: 1;
  font-variant-numeric: tabular-nums;
}

.config-yaml-token-key {
  font-weight: 600;
  color: #7dd3fc;
}

.config-yaml-token-punctuation {
  color: #94a3b8;
}

.config-yaml-token-string {
  color: #a7f3d0;
}

.config-yaml-token-number {
  color: #fbbf24;
}

.config-yaml-token-boolean {
  color: #c4b5fd;
}

.config-yaml-token-null {
  color: #fca5a5;
}

.config-yaml-token-comment {
  font-style: italic;
  color: #64748b;
}

.config-yaml-token-plain {
  color: #cbd5e1;
}
</style>
