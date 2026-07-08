// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { useFormSchema } from './data';

describe('permission form schema', () => {
  it('disables status in edit mode because status uses a dedicated endpoint', () => {
    const schema = useFormSchema([], true);
    expect(
      schema.find((item) => item.fieldName === 'status')?.componentProps,
    ).toMatchObject({ disabled: true });
  });
});
