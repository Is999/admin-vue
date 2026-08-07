import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web-antd/src/views/ops/task-workflow-status/index.vue',
  ),
  'utf8',
);

describe('workflow history observability', () => {
  it('uses indexed history filters and keeps values copyable', () => {
    expect(workflowSource).toContain(
      'workflowId: workflowHistoryWorkflowID.value.trim() || undefined',
    );
    expect(workflowSource).toContain(
      'workflowName: workflowHistoryWorkflowName.value.trim() || undefined',
    );
    expect(workflowSource).toContain(
      'periodicName: workflowHistoryPeriodicName.value.trim() || undefined',
    );
    expect(workflowSource).toContain('<CopyableTextCell');
    expect(workflowSource).toContain(':text="record.workflowId"');
    expect(workflowSource).toContain(':text="record.periodicName"');
    expect(workflowSource).toContain('<BranchesOutlined />');
    expect(workflowSource).toContain(
      '@click.stop="openWorkflowHistoryItem(record)"',
    );
    expect(workflowSource).toContain(
      ':aria-label="$t(\'business.message.viewWorkflowStatus\')"',
    );
    expect(workflowSource).toContain(
      'v-model:value="workflowHistoryTimeRange"',
    );
    expect(workflowSource).toContain('id="workflow-detail-section"');
    expect(workflowSource).toContain(
      "document.querySelector('#workflow-detail-section')",
    );
    expect(workflowSource).toContain('await scrollToWorkflowDetail();');
    expect(workflowSource).toContain("behavior: 'smooth'");
    expect(workflowSource).toContain("block: 'start'");
  });

  it('gives every workflow history filter a stable form identifier', () => {
    expect(workflowSource).toContain('id="workflow-history-workflow-id"');
    expect(workflowSource).toContain('name="workflow-history-workflow-id"');
    expect(workflowSource).toContain('id="workflow-history-workflow-name"');
    expect(workflowSource).toContain('name="workflow-history-workflow-name"');
    expect(workflowSource).toContain('id="workflow-history-periodic-name"');
    expect(workflowSource).toContain('name="workflow-history-periodic-name"');
    expect(workflowSource).toContain(
      'v-workflow-history-time-range-identifiers',
    );
    expect(workflowSource).toContain("'workflow-history-time-range-start'");
    expect(workflowSource).toContain("'workflow-history-time-range-end'");
  });
});
