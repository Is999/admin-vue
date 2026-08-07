import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const detailSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web-antd/src/views/ops/runtime-config/components/periodic-task-detail-drawer.vue',
  ),
  'utf8',
);

describe('periodic task detail history boundary', () => {
  it('queries Redis hot states and database terminal history independently', () => {
    expect(detailSource).toContain('liveOnly: true');
    expect(detailSource).toContain('fetchTaskRuns({');
    expect(detailSource).toContain('periodicName: name');
    expect(detailSource).toContain('mergePeriodicRecentTasks(');
    expect(detailSource).toContain('recentLiveTasksLoadFailed');
    expect(detailSource).toContain('recentTaskHistoryLoadFailed');
    expect(detailSource).toContain(
      'query.historyId = String(record.historyId)',
    );
    expect(detailSource).toContain('@click="openTaskList(record)"');
    expect(detailSource).toContain("dataIndex: 'traceTotal'");
    expect(detailSource).toContain("dataIndex: 'id', key: 'id', width: 190");
    expect(detailSource).toContain('white-space: nowrap;');
  });
});
