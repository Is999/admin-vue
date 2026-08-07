import type { TaskApi } from '#/api/ops/task';

import { describe, expect, it } from 'vitest';

import {
  formatTaskTraceOverview,
  getTaskStateOptions,
  isExactTaskID,
} from './data';

describe('task item exact query', () => {
  it('recognizes generated task IDs', () => {
    expect(isExactTaskID('52f2fd4d-405f-4708-85da-f334a5e822fd')).toBe(true);
    expect(
      isExactTaskID('52f2fd4d-405f-4708-85da-f334a5e822fd:recalc_cross_day:15'),
    ).toBe(true);
    expect(
      isExactTaskID('52f2fd4d-405f-4708-85da-f334a5e822fd:group:recalc:15'),
    ).toBe(true);
  });

  it('keeps task ID fragments on the bounded list query', () => {
    expect(isExactTaskID('52f2fd4d')).toBe(false);
    expect(isExactTaskID('task-name-fragment')).toBe(false);
    expect(isExactTaskID('52f2fd4d-405f-4708-85da-f334a5e822fd:node')).toBe(
      false,
    );
  });

  it('builds task state labels on demand instead of freezing a startup locale', () => {
    expect(getTaskStateOptions).toBeTypeOf('function');
    expect(getTaskStateOptions().map((item) => item.value)).toEqual([
      '',
      'pending',
      'active',
      'scheduled',
      'retry',
      'archived',
      'completed',
      'aggregating',
    ]);
  });

  it('keeps only meaningful task trace metrics in the list summary', () => {
    const overview = formatTaskTraceOverview({
      executionTrace: {
        deleteCount: 0,
        details: [
          { action: 'read', count: 0, name: 'empty', times: 1 },
          { action: 'read', count: 1, name: 'visible', times: 1 },
        ],
        durationMs: 28,
        errorCount: 0,
        readCount: 1,
        totalCount: 1,
      },
    } as TaskApi.TaskItem);

    expect(overview).not.toContain(': 0');
    expect(overview).toContain('28ms');
  });
});
