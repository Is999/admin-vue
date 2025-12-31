<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { computed, ref, toRefs, watch } from 'vue';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Button, TimePicker } from 'ant-design-vue';
import dayjs from 'dayjs';

/** 时间段类型 */
interface TimeRange {
  start: string;
  end: string;
}
interface TimeRangeError {
  index: number;
  message: string;
}

const props = defineProps({
  modelValue: {
    type: Array as () => TimeRange[],
    default: () => [],
  },
  name: {
    type: String,
    default: '',
  },
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: TimeRange[]): void;
  (e: 'validChange', value: boolean): void;
}>();

// 内部 state，保证一定是数组
const { modelValue } = toRefs(props);
const timeRanges = ref<TimeRange[]>([]);

/** 同步外部 v-model */
watch(
  () => modelValue.value,
  (val) => {
    timeRanges.value = Array.isArray(val) ? [...val] : [];
  },
  { immediate: true },
);

/* ================= 工具函数 ================= */
function toMinute(time?: string): number {
  if (!time) return 0;
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if ([h, m].some((n) => Number.isNaN(n) || n < 0)) return 0;
  if (h > 23 || m > 59) return 0;
  return h * 60 + m;
}

/** 分钟 → HH:mm */
function fromMinute(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ================= 核心逻辑 ================= */

function updateTime(
  idx: number,
  type: 'end' | 'start',
  value: Dayjs | null | string,
) {
  if (!timeRanges.value[idx]) return;

  const val = dayjs.isDayjs(value) ? value.format('HH:mm') : (value as string);

  const ranges = [...timeRanges.value];
  const original = ranges[idx];
  if (!original) return;

  const current: TimeRange = {
    start: original.start,
    end: original.end,
  };

  current[type] = val;

  /** 自动补齐 1 小时 */
  if (type === 'start' && current.start && !current.end) {
    const startMin = toMinute(current.start);
    const endMin = Math.min(startMin + 60, 23 * 60 + 59);
    current.end = fromMinute(endMin);
  }
  /** 更新 + 自动排序 */
  ranges[idx] = current;
  ranges.sort((a, b) => toMinute(a.start) - toMinute(b.start));

  timeRanges.value = ranges;
  emit('update:modelValue', ranges);
}

/** 添加时间 */
function addTimeRange() {
  // 如果当前有错误，不允许新增
  if (errors.value.length > 0) return;
  let newStart = '';
  let newEnd = '';
  let last: TimeRange | undefined;
  if (timeRanges.value.length > 0) {
    last = timeRanges.value[timeRanges.value.length - 1];
  }
  if (last && last.end) {
    newStart = last.end;
    // 默认持续1小时，且不超过23:59
    const startMin = toMinute(newStart);
    const endMin = Math.min(startMin + 60, 23 * 60 + 59);
    newEnd = fromMinute(endMin);
  }
  timeRanges.value.push({ start: newStart, end: newEnd });
  emit('update:modelValue', timeRanges.value);
}

/** 移除时间 */
function removeTimeRange(idx: number) {
  timeRanges.value.splice(idx, 1);
  emit('update:modelValue', timeRanges.value);
}

/* ================= 校验逻辑 ================= */

/** 校验函数 */
function validate(ranges: TimeRange[]): TimeRangeError[] {
  if (ranges.length === 0) return [];
  const errors: TimeRangeError[] = [];
  const parsed: { end: number; index: number; start: number }[] = [];

  ranges.forEach((r, index) => {
    const start = toMinute(r.start);
    const end = toMinute(r.end);

    // 检查是否填写完整
    if (!r.start || !r.end) {
      errors.push({ index, message: '请填写完整时间段' });
      return;
    }

    // 检查时间格式是否合法
    if (start === 0 && r.start !== '00:00') {
      errors.push({ index, message: '开始时间格式不正确' });
      return;
    }
    if (end === 0 && r.end !== '00:00') {
      errors.push({ index, message: '结束时间格式不正确' });
      return;
    }

    // 检查结束时间不能等于或小于开始时间（不允许跨天）
    if (end <= start) {
      errors.push({ index, message: '结束时间必须大于开始时间' });
      return;
    }

    parsed.push({ index, start, end });
  });
  // 重叠校验
  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr && prev && curr.start < prev.end) {
      errors.push({ index: curr.index, message: '时间段与前一个重叠' });
    }
  }

  return errors;
}

/** 响应式错误 & 状态 */
const errors = computed(() => validate(timeRanges.value));
</script>

<template>
  <div>
    <div
      v-for="(range, idx) in timeRanges"
      :key="idx"
      class="mb-2 flex items-center rounded px-2 py-1"
    >
      <span class="mr-2">开始时间:</span>
      <TimePicker
        v-model:value="range.start"
        format="HH:mm"
        value-format="HH:mm"
        placeholder="开始时间"
        @change="(val) => updateTime(idx, 'start', val)"
        class="mr-2 w-28"
      />

      <span class="mr-2">结束时间:</span>
      <TimePicker
        v-model:value="range.end"
        format="HH:mm"
        value-format="HH:mm"
        placeholder="结束时间"
        @change="(val) => updateTime(idx, 'end', val)"
        class="mr-2 w-28"
      />

      <Button :danger="true" type="text" @click="removeTimeRange(idx)">
        <DeleteOutlined />
      </Button>
      <!-- 每行对应的错误提示，使用 block 元素分行显示 -->
      <div class="ml-2">
        <template
          v-for="err in errors.filter((e) => e.index === idx)"
          :key="err.message"
        >
          <div class="text-xs text-red-500">
            {{ err.message }}
          </div>
        </template>
      </div>
    </div>

    <Button type="default" class="mt-2" @click="addTimeRange">
      <PlusOutlined /> 添加时间段
    </Button>
  </div>
</template>

<style scoped>
.w-28 {
  width: 112px;
}
</style>
