import { describe, expect, it, vi } from 'vitest';

import { createRowFieldSingleFlight } from './row-field-single-flight';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('row field single flight', () => {
  it('merges concurrent work for the same row field and releases after completion', async () => {
    const run = createRowFieldSingleFlight();
    const row = {};
    const first = deferred();
    const task = vi.fn(() => first.promise);

    const firstRun = run(row, 'status', task);
    await expect(run(row, 'status', task)).resolves.toBe(false);
    expect(task).toHaveBeenCalledTimes(1);

    first.resolve();
    await expect(firstRun).resolves.toBe(true);
    await expect(run(row, 'status', task)).resolves.toBe(true);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not block different rows or fields', async () => {
    const run = createRowFieldSingleFlight();
    const task = vi.fn(async () => undefined);
    const firstRow = {};

    await Promise.all([
      run(firstRow, 'status', task),
      run(firstRow, 'enabled', task),
      run({}, 'status', task),
    ]);
    expect(task).toHaveBeenCalledTimes(3);
  });
});
