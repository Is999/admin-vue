// taskConsoleDefaults 收口任务总控台表单默认值，避免 schema 和页面动作重复维护。
export const taskConsoleDefaults = {
  deadlineSeconds: 7200,
  grayPercent: 100,
  minimalPayloadText: '{\n  "appId": "203"\n}',
  processInSeconds: 0,
  queue: 'default',
  retry: 3,
  shardTotal: 1,
  timeoutSeconds: 120,
  uniqueTTLSeconds: 60,
} as const;

// TaskConsoleFormApi 描述总控台只依赖的表单写字段能力，避免 helper 绑定具体 vben 实现。
type TaskConsoleFormApi = {
  setFieldValue: (
    field: string,
    value: unknown,
    validate?: boolean,
  ) => Promise<void> | void;
};

// TaskConsoleDefaultField 表示一个可按需回填的默认字段。
type TaskConsoleDefaultField = {
  field: string;
  value: (() => unknown) | unknown;
};

// buildTaskConsoleTime 生成 RFC3339 时间文本，供绝对执行时间和 deadline 默认值复用。
export function buildTaskConsoleTime(addSeconds = 0) {
  return new Date(Date.now() + addSeconds * 1000).toISOString();
}

// shouldFillTaskConsoleValue 判断字段是否适合被默认值补齐。
export function shouldFillTaskConsoleValue(value: unknown, force = false) {
  return force || value === '' || value === null || value === undefined;
}

// fillTaskConsoleDelay 填写相对延迟时间，并清空绝对执行时间。
export async function fillTaskConsoleDelay(
  formApi: TaskConsoleFormApi,
  seconds: number,
) {
  await formApi.setFieldValue('processAt', '', false);
  await formApi.setFieldValue('processInSeconds', seconds, false);
}

// fillTaskConsoleProcessAt 填写绝对执行时间，并清空相对延迟。
export async function fillTaskConsoleProcessAt(
  formApi: TaskConsoleFormApi,
  addSeconds = 0,
) {
  await formApi.setFieldValue(
    'processAt',
    buildTaskConsoleTime(addSeconds),
    false,
  );
  await formApi.setFieldValue('processInSeconds', undefined, false);
}

// clearTaskConsoleSchedule 清空总控台调度时间字段。
export async function clearTaskConsoleSchedule(formApi: TaskConsoleFormApi) {
  await formApi.setFieldValue('processAt', '', false);
  await formApi.setFieldValue('processInSeconds', undefined, false);
  await formApi.setFieldValue('deadline', '', false);
}

// fillTaskConsoleFields 按字段清单补齐默认值，保留用户已填写内容。
export async function fillTaskConsoleFields(
  formApi: TaskConsoleFormApi,
  values: Record<string, any>,
  fields: TaskConsoleDefaultField[],
  force = false,
) {
  for (const item of fields) {
    if (!shouldFillTaskConsoleValue(values[item.field], force)) {
      continue;
    }
    const value = typeof item.value === 'function' ? item.value() : item.value;
    await formApi.setFieldValue(item.field, value, false);
  }
}
