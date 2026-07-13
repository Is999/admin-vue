// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { useFormSchema } from './data';

function schemaFields(isEdit: boolean) {
  return useFormSchema(isEdit).map((item) => item.fieldName);
}

describe('admin form schema', () => {
  it('hides dedicated status fields while creating an account', () => {
    const fields = schemaFields(false);
    expect(fields).not.toContain('status');
    expect(fields).not.toContain('mfaStatus');
  });

  it('shows dedicated status fields and locks username while editing', () => {
    const schema = useFormSchema(true);
    expect(schema.map((item) => item.fieldName)).toEqual(
      expect.arrayContaining(['status', 'mfaStatus']),
    );
    expect(
      schema.find((item) => item.fieldName === 'username')?.componentProps,
    ).toMatchObject({ disabled: true });
  });
});
