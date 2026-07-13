import { describe, expect, it, vi } from 'vitest';

import { OPS_ACTION_PERMISSION_CODES } from '#/constants/permission-codes';

import { useColumns } from './data';

describe('task queue operation permissions', () => {
  it('shows every queue state returned by the backend', () => {
    const fields = (useColumns(vi.fn()) || []).map(
      (column: any) => column.field,
    );

    expect(fields).toEqual(
      expect.arrayContaining(['archived', 'aggregating', 'processed']),
    );
  });

  it('binds pause and resume to their exact permission and row state', () => {
    const operation = (useColumns(vi.fn()) || []).find(
      (column: any) => column.field === 'operation',
    ) as any;
    const options = operation.cellRender.options as any[];
    const pause = options.find((option) => option.code === 'pauseConsume');
    const resume = options.find((option) => option.code === 'resumeConsume');

    expect(pause.auth).toEqual([
      String(OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_PAUSE),
    ]);
    expect(resume.auth).toEqual([
      String(OPS_ACTION_PERMISSION_CODES.TASK_QUEUE_RESUME),
    ]);
    expect(pause.visible({ paused: false })).toBe(true);
    expect(pause.visible({ paused: true })).toBe(false);
    expect(resume.visible({ paused: false })).toBe(false);
    expect(resume.visible({ paused: true })).toBe(true);
  });
});
