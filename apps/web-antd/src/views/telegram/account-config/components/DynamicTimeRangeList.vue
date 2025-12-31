<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { ref, toRefs, watch } from 'vue';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Button, message, TimePicker } from 'ant-design-vue';
import dayjs from 'dayjs';

interface TimeRange {
  start: string;
  end: string;
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
}>();

const { modelValue } = toRefs(props);

/** 内部状态 */
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

/** HH:mm → 分钟，安全兜底 */
function toMinute(time?: string) {
  if (!time) return 0;
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** 分钟 → HH:mm */
function fromMinute(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 判断两个时间段是否重叠 */
function isOverlap(a: TimeRange, b: TimeRange) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return (
    Math.max(toMinute(a.start), toMinute(b.start)) <
    Math.min(toMinute(a.end), toMinute(b.end))
  );
}

/* ================= 核心逻辑 ================= */

function updateTime(
  idx: number,
  type: 'end' | 'start',
  value: Dayjs | null | string,
) {
  if (!timeRanges.value[idx]) return;

  let val = '';
  if (dayjs.isDayjs(value)) {
    val = value.format('HH:mm');
  } else if (typeof value === 'string') {
    val = value;
  }

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

  /** end 必须严格大于 start */
  if (
    current.start &&
    current.end &&
    toMinute(current.end) <= toMinute(current.start)
  ) {
    message.warning('结束时间必须大于开始时间');
    return;
  }

  /** 重叠校验（使用对象引用，避免索引错乱） */
  for (const r of ranges) {
    if (r === original) continue;
    if (isOverlap(current, r)) {
      message.warning('时间段不能重叠');
      return;
    }
  }

  /** 更新 + 自动排序 */
  ranges[idx] = current;
  ranges.sort((a, b) => toMinute(a.start) - toMinute(b.start));

  timeRanges.value = ranges;
  emit('update:modelValue', ranges);
}

function addTimeRange() {
  timeRanges.value.push({ start: '', end: '' });
  emit('update:modelValue', timeRanges.value);
}

function removeTimeRange(idx: number) {
  timeRanges.value.splice(idx, 1);
  emit('update:modelValue', timeRanges.value);
}
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

      <Button type="text" danger @click="removeTimeRange(idx)">
        <DeleteOutlined />
      </Button>
    </div>

    <Button type="dashed" class="mt-2" @click="addTimeRange">
      <PlusOutlined /> 添加时间段
    </Button>
  </div>
</template>

<style scoped>
.w-28 {
  width: 112px;
}
</style>
