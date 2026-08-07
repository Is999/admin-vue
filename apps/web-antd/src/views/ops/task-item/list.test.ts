import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const listSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/views/ops/task-item/list.vue'),
  'utf8',
);
const workflowIdCellSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web-antd/src/views/ops/task-item/components/workflow-id-cell.vue',
  ),
  'utf8',
);

// sourceBetween 提取页面内相邻职责区块，避免测试依赖无关模板内容。
function sourceBetween(start: string, end: string) {
  const startIndex = listSource.indexOf(start);
  const endIndex = listSource.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return listSource.slice(startIndex, endIndex);
}

describe('task item detail request lifecycle', () => {
  it('rejects stale initial detail responses', () => {
    const querySource = sourceBetween(
      'async function queryTaskDetail(',
      '// queryExactTaskFromFilter',
    );

    expect(querySource).toContain('taskDetailRequestSeq.value = requestSeq');
    expect(querySource).toContain('requestSeq !== taskDetailRequestSeq.value');
    expect(querySource).toContain(
      'sourceSessionIdentity !== currentSessionStateIdentity()',
    );
    expect(querySource).toContain('return undefined');
  });

  it('invalidates pending details on search, session cleanup and close', () => {
    const resetSource = sourceBetween(
      'function resetTaskListSessionState()',
      '// hasLiveTask',
    );
    const searchSource = sourceBetween(
      'async function handleSearch(',
      'async function handleQuickStateFilter(',
    );
    const unmountSource = sourceBetween('onBeforeUnmount(() =>', '\n\nwatch(');

    expect(resetSource).toContain('invalidateTaskDetailRequest()');
    expect(searchSource).toContain('invalidateTaskDetailRequest()');
    expect(searchSource).toContain('await loadActiveTaskHistory()');
    expect(listSource).toContain('onCancel: invalidateTaskDetailRequest');
    expect(unmountSource).toContain('resetTaskListSessionState();');
  });

  it('routes exact task queries through the guarded detail loader', () => {
    const exactSource = sourceBetween(
      'async function queryExactTaskFromFilter()',
      'async function tryAutoOpenTaskDetail()',
    );

    expect(exactSource).toContain(
      'await queryTaskDetail({ queue, taskId }, { silent: true })',
    );
    expect(exactSource).toContain(
      'showTaskRunHistoryDetailByTask({ id: taskId, queue })',
    );
    expect(exactSource).not.toContain('getTaskInfo(');
  });

  it('falls back to database history when any terminal detail expires', () => {
    const detailSource = sourceBetween(
      'async function handleQueryTaskDetail(',
      'function canRunTask(',
    );

    expect(detailSource).toContain("['archived', 'completed']");
    expect(detailSource).not.toContain('!getTaskWorkflowId(row)');
    expect(detailSource).toContain('{ silent: true }');
    expect(detailSource).toContain('showTaskRunHistoryDetailByTask(row)');
  });

  it('silences the expected Redis miss before route history fallback', () => {
    const autoOpenSource = sourceBetween(
      'async function tryAutoOpenTaskDetail()',
      'function applyRouteQueryToFilters()',
    );

    expect(autoOpenSource).toContain('{ silent: true }');
    expect(autoOpenSource).toContain('showTaskRunHistoryDetailByTask({');
  });

  it('rejects stale database history details', () => {
    const fallbackSource = sourceBetween(
      'async function showTaskRunHistoryDetailByTask(',
      '// handleTaskRunHistoryDetail',
    );
    const rowDetailSource = sourceBetween(
      'async function handleTaskRunHistoryDetail(',
      '// loadActiveTaskHistory',
    );

    expect(fallbackSource).toContain('requestIsCurrent()');
    expect(fallbackSource).toContain('currentSessionStateIdentity()');
    expect(rowDetailSource).toContain(
      'requestSeq !== taskDetailRequestSeq.value',
    );
    expect(rowDetailSource).toContain('currentSessionStateIdentity()');
  });
});

describe('task item database history boundary', () => {
  it('keeps recent Redis completed tasks visible with explicit bounded degradation', () => {
    const querySource = sourceBetween(
      'async function queryTasksByFilters(',
      '// buildTaskTimeRangeParams',
    );

    expect(querySource).not.toContain('liveOnly: true');
    expect(listSource).toContain(
      'const taskStateOptions = computed(() => getTaskStateOptions())',
    );
    expect(querySource).toContain('scanLimited: !!responseData.scanLimited');
    expect(listSource).toContain('taskListScanLimitedDesc');
    expect(listSource).toContain('taskListAutoRefreshEnabled');
    expect(listSource).toContain(
      'const taskListAutoRefreshEnabled = ref(false)',
    );
    expect(listSource).toContain('taskListAutoRefreshDesc');
    expect(listSource).toContain('<template #toolbar-tools>');
    expect(listSource).toContain('@change="handleTaskListAutoRefreshChange"');
    expect(listSource).toContain('if (taskListAutoRefreshEnabled.value)');
    expect(listSource).toContain('await gridApi.query()');
    expect(listSource).toContain('showAllTerminalTaskHistory');
    expect(listSource).toContain('id="task-terminal-history"');
    expect(listSource).toContain("scrollIntoView({ behavior: 'smooth'");
  });

  it('keeps history identity columns aligned with the realtime task table', () => {
    const columnsSource = sourceBetween(
      'const taskRunHistoryColumns',
      '// failureHistoryColumns',
    );

    expect(columnsSource.indexOf("dataIndex: 'queue'")).toBeLessThan(
      columnsSource.indexOf("dataIndex: 'taskName'"),
    );
    expect(columnsSource).toContain("dataIndex: 'maxRetry'");
  });

  it('shows complete tooltips for truncated history descriptions', () => {
    expect(
      listSource.match(/\['taskName', 'periodicName'\]\.includes/g),
    ).toHaveLength(2);
    expect(
      listSource.match(/historyCellText\(record, column\.dataIndex\)/g),
    ).toHaveLength(6);
    expect(
      listSource.match(/cursor-help overflow-hidden text-ellipsis/g),
    ).toHaveLength(3);
    expect(listSource.match(/business\.message\.copyTaskName/g)).toHaveLength(
      2,
    );
    expect(
      listSource.match(/business\.message\.copyPeriodicTaskName/g),
    ).toHaveLength(2);
  });

  it('loads only the visible history view and keeps task details on demand', () => {
    const searchSource = sourceBetween(
      'async function handleSearch(',
      'async function handleQuickStateFilter(',
    );
    const activeHistorySource = sourceBetween(
      'function loadActiveTaskHistory(',
      '// handleHistoryViewChange',
    );

    expect(listSource).toContain(
      "const historyView = ref<TaskHistoryView>('runs')",
    );
    expect(searchSource).toContain('loadActiveTaskHistory()');
    expect(searchSource).not.toContain('loadFailureHistory()');
    expect(activeHistorySource).toContain("historyView.value === 'runs'");
    expect(listSource).toContain('await getTaskRunHistory(row.id)');
  });

  it('shows professional database details and complete failure reasons', () => {
    const runDetailSource = sourceBetween(
      '// showTaskRunHistoryDetail',
      '// showTaskFailureDetail',
    );
    const failureDetailSource = sourceBetween(
      '// showTaskFailureDetail',
      '// showTaskRunHistoryDetailByTask',
    );

    expect(runDetailSource).toContain('renderTaskHistoryHero(');
    expect(runDetailSource).toContain(
      'renderTaskFailureReasonSection(task.errorMessage)',
    );
    expect(runDetailSource).toContain('renderTaskHistorySnapshotGuide()');
    expect(listSource).toContain('taskHistoryDetailSnapshotGuide');
    expect(listSource).toContain('route.query.historyId');
    expect(listSource).toContain('getTaskRunHistory(historyId)');
    expect(listSource).toContain('showTaskRunHistoryDetailByTask({');
    expect(runDetailSource).toContain('footer: null');
    expect(failureDetailSource).toContain('renderTaskHistoryHero(');
    expect(failureDetailSource).toContain(
      'renderTaskFailureReasonSection(task.errorMessage)',
    );
    expect(failureDetailSource).toContain('renderTaskHistorySnapshotGuide()');
    expect(listSource).toContain('copyWorkflowId');
    expect(failureDetailSource).toContain('footer: null');
    expect(listSource).toContain("column.dataIndex === 'errorMessage'");
    expect(listSource).toContain('@click="showTaskFailureDetail(record)"');
  });

  it('hides empty task detail cards while preserving meaningful zero values', () => {
    const fieldSource = sourceBetween(
      '// hasTaskDetailValue',
      '// renderTaskHistoryHero',
    );
    const detailSource = sourceBetween(
      'function showTaskDetailModal(',
      'async function queryTaskDetail(',
    );

    expect(fieldSource).toContain("value !== '' && value !== '-'");
    expect(fieldSource).toContain('visibleTaskDetailRows(rows)');
    expect(fieldSource).not.toContain("value !== '0'");
    expect(detailSource).toContain('visibleTaskDetailRows([');
    expect(detailSource).toContain("task.nextProcessAt || '-'");
  });

  it('queries workflow terminal history but skips live states and partial IDs', () => {
    const filterSource = sourceBetween(
      'function taskRunHistoryFilter()',
      '// loadTaskRunHistory',
    );

    expect(filterSource).toContain(
      'workflowId: searchWorkflowId.value.trim() || undefined',
    );
    expect(filterSource).toContain("state !== 'archived'");
    expect(filterSource).toContain("state !== 'completed'");
    expect(filterSource).toContain('isExactTaskID(realtimeTaskId)');
  });

  it('keeps database history search independent from Redis list filters', () => {
    const searchSource = sourceBetween(
      'async function handleTaskHistorySearch()',
      'function handleDeleteTask(',
    );

    expect(searchSource).toContain('loadActiveTaskHistory()');
    expect(searchSource).toContain("taskHistoryTaskID.value = ''");
    expect(searchSource).toContain("taskHistoryTaskName.value = ''");
    expect(searchSource).toContain("taskHistoryPeriodicName.value = ''");
    expect(searchSource).toContain("failureHistoryTaskName.value = ''");
    expect(searchSource).toContain("failureHistoryPeriodicName.value = ''");
    expect(searchSource).toContain('taskHistoryTimeRange.value = undefined');
    expect(searchSource).not.toContain('gridApi.query()');
    expect(listSource).toContain('buildTaskHistoryTimeRangeParams()');
    expect(listSource).toContain('v-model:value="taskHistoryTimeRange"');
  });

  it('gives every database history filter a stable form identifier', () => {
    expect(listSource).toContain('id="task-history-task-id"');
    expect(listSource).toContain('name="task-history-task-id"');
    expect(listSource).toContain('id="task-history-task-name"');
    expect(listSource).toContain('name="task-history-task-name"');
    expect(listSource).toContain('id="task-history-periodic-name"');
    expect(listSource).toContain('name="task-history-periodic-name"');
    expect(listSource).toContain('id="task-history-failure-task-name"');
    expect(listSource).toContain('name="task-history-failure-task-name"');
    expect(listSource).toContain('id="task-history-failure-periodic-name"');
    expect(listSource).toContain('name="task-history-failure-periodic-name"');
    expect(listSource).toContain('v-task-history-time-range-identifiers');
    expect(listSource).toContain("'task-history-time-range-start'");
    expect(listSource).toContain("'task-history-time-range-end'");
  });

  it('sends separate indexed name filters to the terminal task API', () => {
    const taskRunSource = sourceBetween(
      'async function loadTaskRunHistory(',
      'async function loadFailureHistory(',
    );

    expect(taskRunSource).toContain(
      'taskName: taskHistoryTaskName.value.trim() || undefined',
    );
    expect(taskRunSource).toContain(
      'periodicName: taskHistoryPeriodicName.value.trim() || undefined',
    );
    expect(taskRunSource).not.toContain('searchTaskName.value.trim()');
  });

  it('sends task and periodic names to the failure history API', () => {
    const failureSource = sourceBetween(
      'async function loadFailureHistory(',
      'async function queryTasksByFilters(',
    );

    expect(failureSource).toContain(
      'taskName: failureHistoryTaskName.value.trim() || undefined',
    );
    expect(failureSource).toContain(
      'periodicName: failureHistoryPeriodicName.value.trim() || undefined',
    );
  });

  it('keeps history IDs observable and links workflow history consistently', () => {
    expect(listSource).toContain(
      "import CopyableTextCell from '../runtime-config/components/copyable-text-cell.vue'",
    );
    expect(listSource.match(/:text="record\.taskId"/g)).toHaveLength(2);
    expect(listSource).toContain(':text="record.workflowId"');
    expect(listSource).toContain(
      '@open="openWorkflowStatusFromHistory(record)"',
    );
    expect(workflowIdCellSource).toContain('<Tooltip');
    expect(workflowIdCellSource).toContain('<LinkOutlined />');
    expect(workflowIdCellSource).toContain('<CopyOutlined />');
    expect(workflowIdCellSource).toContain("emit('open', workflowID)");
    expect(workflowIdCellSource).toContain('copyTextToClipboard(');
    expect(
      listSource.match(/business\.message\.copyTaskId/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(listSource).toContain('business.message.taskHistoryScopeDesc');
  });
});
