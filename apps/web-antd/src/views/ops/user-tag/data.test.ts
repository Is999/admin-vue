import { describe, expect, it } from 'vitest';

import {
  USER_TAG_FORM_LIMITS,
  useUserTagRecalculateSchema,
  useUserTagWorkflowSchema,
} from './data';

function findSchema(
  schemas: ReturnType<typeof useUserTagWorkflowSchema>,
  fieldName: string,
) {
  return schemas.find((schema) => schema.fieldName === fieldName);
}

describe('user tag form schema', () => {
  it.each([
    ['workflow', useUserTagWorkflowSchema()],
    ['recalculate', useUserTagRecalculateSchema()],
  ])('keeps %s retry and runtime limits aligned', (_name, schemas) => {
    expect(findSchema(schemas, 'retry')).toMatchObject({
      component: 'InputNumber',
      componentProps: { max: USER_TAG_FORM_LIMITS.retry, min: 0 },
    });
    expect(findSchema(schemas, 'timeoutSeconds')).toMatchObject({
      component: 'InputNumber',
      componentProps: {
        max: USER_TAG_FORM_LIMITS.timeoutSeconds,
        min: 1,
      },
    });
    expect(findSchema(schemas, 'dryRun')).toMatchObject({
      component: 'Switch',
      componentProps: { disabled: true },
      defaultValue: true,
    });
    expect(findSchema(schemas, 'shardTotal')?.componentProps).toMatchObject({
      max: USER_TAG_FORM_LIMITS.shardTotal,
    });
    expect(findSchema(schemas, 'batchSize')?.componentProps).toMatchObject({
      max: USER_TAG_FORM_LIMITS.batchSize,
    });
    expect(findSchema(schemas, 'workerCount')?.componentProps).toMatchObject({
      max: USER_TAG_FORM_LIMITS.workerCount,
    });
  });
});
