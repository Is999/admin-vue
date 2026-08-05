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
      expect(
        schema.find((item) => item.fieldName === 'uniqueTTLSeconds'),
      ).toMatchObject({
        componentProps: {
          max: TASK_API_LIMITS.uniqueTTLSeconds,
          min: 1,
        },
      });
      expect(
        schema.find((item) => item.fieldName === 'processInSeconds'),
      ).toMatchObject({
        componentProps: {
          max: TASK_API_LIMITS.scheduleDelaySeconds,
          min: 0,
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
    expect(
      useTriggerWorkflowSchema().find(
        (item) => item.fieldName === 'targetsText',
      ),
    ).toMatchObject({
      componentProps: {
        maxLength: TASK_API_LIMITS.workflowTargetsBytes,
      },
    });
    expect(
      useTriggerWorkflowSchema().find((item) => item.fieldName === 'uniqueKey'),
    ).toMatchObject({
      componentProps: {
        maxLength: TASK_API_LIMITS.uniqueKeyBytes,
      },
    });
  });

  it('keeps manual task payload aligned with backend limit', () => {
    expect(
      useEnqueueTaskSchema().find((item) => item.fieldName === 'payloadText'),
    ).toMatchObject({
      componentProps: {
        maxLength: TASK_API_LIMITS.payloadBytes,
      },
    });
  });
});
