// RowFieldTask 表示单个表格行字段的异步提交逻辑。
export type RowFieldTask = () => Promise<void> | void;

// createRowFieldSingleFlight 为同一行同一字段合并并发提交，不向业务行写入临时状态。
export function createRowFieldSingleFlight() {
  const pendingFields = new WeakMap<object, Set<string>>();

  return async function runRowFieldTask(
    row: object,
    field: string,
    task: RowFieldTask,
  ) {
    let fields = pendingFields.get(row);
    if (!fields) {
      fields = new Set<string>();
      pendingFields.set(row, fields);
    }
    if (fields.has(field)) {
      return false;
    }

    fields.add(field);
    try {
      await task();
      return true;
    } finally {
      fields.delete(field);
      if (fields.size === 0) {
        pendingFields.delete(row);
      }
    }
  };
}
