import { describe, expect, it } from 'vitest';

import {
  buildTaskTraceDetailRows,
  buildTaskTraceMetricItems,
  buildTaskTraceSummaryRows,
  formatTaskTraceDetails,
  hasTaskExecutionTrace,
} from './task-trace';

describe('task trace visibility', () => {
  const trace = {
    deleteCount: 0,
    details: [
      {
        action: 'delete',
        count: 0,
        name: 'empty',
        times: 3,
      },
      {
        action: 'read',
        count: 2,
        name: 'visible',
        times: 1,
      },
    ],
    durationMs: 28,
    errorCount: 0,
    readCount: 2,
    totalCount: 2,
  };

  it('keeps positive summary metrics and hides zero metrics', () => {
    expect(buildTaskTraceMetricItems(trace).map((item) => item.value)).toEqual([
      2,
      2,
      '28ms',
    ]);
    expect(buildTaskTraceSummaryRows(trace).map((row) => row[1])).toEqual([
      2,
      2,
      '28ms',
      1,
    ]);
  });

  it('keeps only positive action details', () => {
    expect(buildTaskTraceDetailRows(trace)).toHaveLength(1);
    expect(formatTaskTraceDetails(trace.details)).not.toContain('empty');
    expect(formatTaskTraceDetails(trace.details)).toContain('visible');
  });

  it('does not treat zero-only details as observable data', () => {
    expect(
      hasTaskExecutionTrace({
        details: [
          {
            action: 'read',
            count: 0,
            name: 'empty',
            times: 1,
          },
        ],
      }),
    ).toBe(false);
    expect(hasTaskExecutionTrace({ durationMs: 1 })).toBe(true);
  });
});
