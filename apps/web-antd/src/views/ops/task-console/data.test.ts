import { describe, expect, it } from 'vitest';

import {
  TASK_FORM_LIMITS,
  useEnqueueTaskSchema,
  useTriggerWorkflowSchema,
} from './data';

describe('task console form limits', () => {
  it.each([
    ['workflow', useTriggerWorkflowSchema()],
    ['task', useEnqueueTaskSchema()],
  ])(
    'keeps %s retry and timeout aligned with backend limits',
    (_name, schema) => {
      expect(schema.find((item) => item.fieldName === 'retry')).toMatchObject({
        componentProps: { max: TASK_FORM_LIMITS.retry, min: 0 },
      });
      expect(
        schema.find((item) => item.fieldName === 'timeoutSeconds'),
      ).toMatchObject({
        componentProps: {
          max: TASK_FORM_LIMITS.timeoutSeconds,
          min: 1,
        },
      });
    },
  );
});
