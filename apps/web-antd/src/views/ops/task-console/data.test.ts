import { describe, expect, it } from 'vitest';

import { TASK_API_LIMITS } from '#/api/ops/task-types';

import { useEnqueueTaskSchema, useTriggerWorkflowSchema } from './data';

describe('task console form limits', () => {
  it.each([
    ['workflow', useTriggerWorkflowSchema()],
    ['task', useEnqueueTaskSchema()],
  ])(
    'keeps %s retry and timeout aligned with backend limits',
    (_name, schema) => {
      expect(schema.find((item) => item.fieldName === 'retry')).toMatchObject({
        componentProps: { max: TASK_API_LIMITS.retry, min: 0 },
      });
      expect(
        schema.find((item) => item.fieldName === 'timeoutSeconds'),
      ).toMatchObject({
        componentProps: {
          max: TASK_API_LIMITS.timeoutSeconds,
          min: 1,
        },
      });
    },
  );

  it('keeps workflow shard total aligned with backend limit', () => {
    expect(
      useTriggerWorkflowSchema().find(
        (item) => item.fieldName === 'shardTotal',
      ),
    ).toMatchObject({
      componentProps: {
        max: TASK_API_LIMITS.shardTotal,
        min: 1,
      },
    });
  });
});
