// @vitest-environment happy-dom

import type { SystemAdminApi } from '#/api/system';

import { describe, expect, it } from 'vitest';

import { useColumns, useFormSchema } from './data';

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

  it('disables password and security statuses while editing the current account', () => {
    const schema = useFormSchema(true, true);
    expect(
      schema.find((item) => item.fieldName === 'password')?.componentProps,
    ).toMatchObject({ disabled: true });
    expect(
      schema.find((item) => item.fieldName === 'status')?.componentProps,
    ).toMatchObject({ disabled: true });
    expect(
      schema.find((item) => item.fieldName === 'mfaStatus')?.componentProps,
    ).toMatchObject({ disabled: true });
  });
});

describe('admin row access', () => {
  it('uses backend row flags for status and destructive actions', () => {
    const columns = useColumns(
      () => undefined,
      async () => true,
    ) as any[];
    const statusColumn = columns.find((item) => item.field === 'status');
    const operationColumn = columns.find((item) => item.field === 'operation');
    const options = operationColumn.cellRender.options as Array<any>;
    const selfRow = {
      manageable: true,
      self: true,
    } as SystemAdminApi.Item;
    const otherRow = {
      manageable: true,
      self: false,
    } as SystemAdminApi.Item;
    const outOfScopeRow = {
      manageable: false,
      self: false,
    } as SystemAdminApi.Item;

    expect(statusColumn.cellRender.attrs.disabled(selfRow)).toBe(true);
    expect(statusColumn.cellRender.attrs.disabled(otherRow)).toBe(false);
    expect(
      options.find((item) => item.code === 'edit').visible(outOfScopeRow),
    ).toBe(false);
    for (const code of ['delete', 'resetPassword', 'resetUser', 'roleConfig']) {
      const visible = options.find((item) => item.code === code).visible;
      expect(visible(selfRow)).toBe(false);
      expect(visible(otherRow)).toBe(true);
    }
  });
});
