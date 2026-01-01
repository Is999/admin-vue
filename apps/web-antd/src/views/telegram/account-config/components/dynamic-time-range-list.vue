<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { computed, nextTick, ref, toRefs, watch } from 'vue';

import {
  DeleteOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue';
import { Button, message, TimePicker } from 'ant-design-vue';
import dayjs from 'dayjs';

// Props 和 Emits
const props = defineProps({
  modelValue: {
    type: Array as () => TimeRange[],
    default: () => [],
  },
  name: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  // 最大时间段数量
  maxCount: {
    type: Number,
    default: 6, // 默认值设为6，向后兼容
  },
  // 是否立即验证（用于表单验证）
  validateOnChange: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: TimeRange[]): void;
  (e: 'validChange', value: boolean): void;
  (e: 'change', value: TimeRange[]): void;
  // 新增：用于同步表单验证
  (e: 'validate', isValid: boolean, errorMessages: string[]): void;
}>();

// 类型定义
interface TimeRange {
  start: string;
  end: string;
}

interface TimeRangeError {
  index: number;
  message: string;
}

type TimeRangeUpdateType = 'end' | 'start';

// 响应式数据
const { modelValue } = toRefs(props);
const timeRanges = ref<TimeRange[]>([]);
const errors = ref<TimeRangeError[]>([]);
const isDirty = ref(false); // 标记用户是否已修改

// 工具函数
const useTimeRangeUtils = () => {
  const toMinute = (time?: string): number => {
    if (!time) return 0;
    const parts = time.split(':');
    if (parts.length !== 2) return 0;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if ([h, m].some((n) => Number.isNaN(n) || n < 0)) return 0;
    if (h > 23 || m > 59) return 0;
    return h * 60 + m;
  };

  const fromMinute = (min: number): string => {
    const hour = Math.floor(min / 60); // 修正2：去掉 x:
    const minute = min % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; // 修正3：使用反引号
  };

  const isValidTimeFormat = (time: string): boolean => {
    return dayjs(time, 'HH:mm').isValid(); // 修正4：修正正则表达式
  };

  return { toMinute, fromMinute, isValidTimeFormat };
};

const { toMinute, fromMinute, isValidTimeFormat } = useTimeRangeUtils();

// 监听外部值变化
watch(
  () => modelValue.value,
  (val) => {
    timeRanges.value = Array.isArray(val) ? [...val] : [];
  },
  { immediate: true },
);

// 触发验证事件
const triggerValidate = () => {
  const isValid = errors.value.length === 0;
  const errorMessages = errors.value.map((err) => err.message);
  emit('validate', isValid, errorMessages);
  emit('validChange', isValid);
};

// 核心方法
const updateTime = (
  idx: number,
  type: TimeRangeUpdateType,
  value: Dayjs | null | string,
) => {
  if (!timeRanges.value[idx] || props.disabled) return;

  isDirty.value = true;

  const val = dayjs.isDayjs(value) ? value.format('HH:mm') : (value as string);
  const current = timeRanges.value[idx];

  // 如果值没有变化，不做处理
  if (current[type] === val) return;

  current[type] = val;

  // 自动补齐结束时间
  if (type === 'start' && current.start && !current.end) {
    const startMin = toMinute(current.start);
    const endMin = Math.min(startMin + 60, 23 * 60 + 59);
    current.end = fromMinute(endMin);
  }

  // 延迟排序（只在需要时）
  nextTick(() => {
    if (timeRanges.value.length > 1) {
      timeRanges.value.sort((a, b) => toMinute(a.start) - toMinute(b.start));
    }

    // 触发验证
    if (props.validateOnChange) {
      validateTimeRanges();
    }
  });

  emit('update:modelValue', [...timeRanges.value]);
  emit('change', [...timeRanges.value]);
};

const addTimeRange = () => {
  if (props.disabled) return;

  // 检查是否有错误
  if (timeRanges.value.length > 0 && errors.value.length > 0) {
    message.warning('请先修正当前时间段的错误');
    return;
  }

  if (timeRanges.value.length >= props.maxCount) {
    message.warning(`最多只能添加 ${props.maxCount} 个时间段`);
    return;
  }

  isDirty.value = true;

  let newStart = '08:00';
  let newEnd = '09:00';

  if (timeRanges.value.length > 0) {
    const last = timeRanges.value[timeRanges.value.length - 1];
    if (last && last.end) {
      newStart = last.end;
      const startMin = toMinute(newStart);
      const endMin = Math.min(startMin + 60, 23 * 60 + 59);
      newEnd = fromMinute(endMin);
    }
  }

  timeRanges.value.push({ start: newStart, end: newEnd });
  emit('update:modelValue', [...timeRanges.value]);
  emit('change', [...timeRanges.value]);

  // 触发验证
  if (props.validateOnChange) {
    validateTimeRanges();
  }
};

const removeTimeRange = (idx: number) => {
  if (props.disabled) return;
  if (timeRanges.value.length <= 1) {
    message.warning('至少需要保留一个时间段');
    return;
  }

  isDirty.value = true;

  timeRanges.value.splice(idx, 1);
  emit('update:modelValue', [...timeRanges.value]);
  emit('change', [...timeRanges.value]);

  // 触发验证
  if (props.validateOnChange) {
    validateTimeRanges();
  }
};

// 校验逻辑
const validateTimeRanges = (): TimeRangeError[] => {
  if (timeRanges.value.length === 0) {
    const emptyError = [{ index: -1, message: '请至少添加一个时间段' }];
    errors.value = emptyError;
    triggerValidate();
    return emptyError;
  }

  const newErrors: TimeRangeError[] = [];
  const parsed: { end: number; index: number; start: number }[] = [];

  timeRanges.value.forEach((r, index) => {
    const start = toMinute(r.start);
    const end = toMinute(r.end);

    // 检查是否填写完整
    if (!r.start || !r.end) {
      newErrors.push({ index, message: '请填写完整时间段' });
      return;
    }

    // 检查时间格式
    if (!isValidTimeFormat(r.start)) {
      newErrors.push({ index, message: '开始时间格式不正确' });
      return;
    }
    if (!isValidTimeFormat(r.end)) {
      newErrors.push({ index, message: '结束时间格式不正确' });
      return;
    }

    // 检查时间逻辑
    if (end <= start) {
      newErrors.push({ index, message: '结束时间必须大于开始时间' });
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
      newErrors.push({ index: curr.index, message: '时间段与前一个重叠' });
    }
  }

  errors.value = newErrors;
  triggerValidate();
  return newErrors;
};

// 公开的验证方法（供父组件调用）
const validate = (): {
  errorMessages: string[];
  errors: TimeRangeError[];
  isValid: boolean;
} => {
  const validationErrors = validateTimeRanges();
  const isValid = validationErrors.length === 0;
  const errorMessages = validationErrors.map((err) => err.message);

  return {
    isValid,
    errors: validationErrors,
    errorMessages,
  };
};

// 重置验证状态
const resetValidation = () => {
  errors.value = [];
  isDirty.value = false;
  triggerValidate();
};

// 监听时间范围变化并自动验证
watch(
  () => timeRanges.value,
  () => {
    if (props.validateOnChange && isDirty.value) {
      validateTimeRanges();
    }
  },
  { deep: true },
);

// 计算总时长
const totalMinutes = computed(() => {
  // eslint-disable-next-line unicorn/no-array-reduce
  return timeRanges.value.reduce((total, range) => {
    const startMin = toMinute(range.start);
    const endMin = toMinute(range.end);
    return total + (endMin - startMin);
  }, 0);
});

// 辅助函数
const hasErrorForIndex = (index: number) => {
  return errors.value.some((err) => err.index === index);
};

const getErrorsForIndex = (index: number) => {
  return errors.value.filter((err) => err.index === index);
};

// 计算覆盖比例
const coverageRatio = computed(() => {
  const totalDayMinutes = 24 * 60;
  return Math.round((totalMinutes.value / totalDayMinutes) * 100);
});

// 检查是否可以添加新时间段
const canAddTimeRange = computed(() => {
  return (
    !props.disabled &&
    timeRanges.value.length < props.maxCount &&
    (errors.value.length === 0 || timeRanges.value.length === 0)
  );
});

// 暴露给父组件的方法和属性
defineExpose({
  validate,
  resetValidation,
  hasErrors: computed(() => errors.value.length > 0),
  totalMinutes,
  coverageRatio,
  errors: computed(() => errors.value),
});
</script>

<template>
  <div class="dynamic-time-range-list">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm font-medium">时间段设置</span>
      <span class="text-xs text-gray-500">
        {{ timeRanges.length }}/{{ props.maxCount }}
      </span>
    </div>

    <!-- 全局错误提示（如果有非字段特定的错误） -->
    <div
      v-if="errors.some((err) => err.index === -1)"
      class="mb-3 flex items-start rounded border border-red-300 p-3"
    >
      <WarningOutlined class="mr-2 mt-0.5 text-red-500" />
      <div class="text-sm text-red-600">
        <div
          v-for="err in errors.filter((e) => e.index === -1)"
          :key="err.message"
        >
          {{ err.message }}
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div
        v-for="(range, idx) in timeRanges"
        :key="idx"
        class="rounded-lg border p-3 transition-colors"
        :class="{
          'border-red-300': hasErrorForIndex(idx),
          'border-gray-400': !hasErrorForIndex(idx),
          'opacity-50': disabled,
        }"
      >
        <div class="flex items-center gap-3">
          <div class="flex flex-1 items-center gap-2">
            <!-- 开始时间 -->
            <div class="w-24">
              <div class="mb-1 text-xs text-gray-500">开始时间</div>
              <TimePicker
                v-model:value="range.start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="09:00"
                @change="(val) => updateTime(idx, 'start', val)"
                @blur="validateTimeRanges"
                :status="hasErrorForIndex(idx) ? 'error' : ''"
                class="w-full"
                :disabled="disabled"
              />
            </div>

            <!-- 分隔符 -->
            <div class="mt-5 text-gray-400">-</div>

            <!-- 结束时间 -->
            <div class="w-24">
              <div class="mb-1 text-xs text-gray-500">结束时间</div>
              <TimePicker
                v-model:value="range.end"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="12:00"
                @change="(val) => updateTime(idx, 'end', val)"
                @blur="validateTimeRanges"
                :status="hasErrorForIndex(idx) ? 'error' : ''"
                class="w-full"
                :disabled="disabled"
              />
            </div>

            <!-- 删除按钮 -->
            <Button
              :danger="true"
              type="text"
              size="small"
              @click="removeTimeRange(idx)"
              :disabled="disabled || timeRanges.length <= 1"
              class="mt-5"
              title="删除"
            >
              <DeleteOutlined />
            </Button>
          </div>
        </div>

        <!-- 字段级错误提示 -->
        <div v-if="getErrorsForIndex(idx).length > 0" class="mt-2">
          <div
            v-for="err in getErrorsForIndex(idx)"
            :key="err.message"
            class="flex items-center text-xs text-red-500"
          >
            <WarningOutlined class="mr-1 text-xs" />
            <span>{{ err.message }}</span>
          </div>
        </div>

        <!-- 时长显示 -->
        <div class="mt-2 text-xs text-gray-500">
          时长：{{ toMinute(range.end) - toMinute(range.start) }} 分钟
        </div>
      </div>
    </div>

    <!-- 添加按钮 -->
    <Button
      type="dashed"
      class="mt-3 w-full"
      @click="addTimeRange"
      :disabled="!canAddTimeRange"
      :title="
        !canAddTimeRange
          ? disabled
            ? '已禁用'
            : timeRanges.length >= props.maxCount
              ? '已达到最大数量'
              : errors.length > 0 && timeRanges.length > 0
                ? '请先修正当前错误'
                : ''
          : '添加时间段'
      "
    >
      <PlusOutlined /> 添加时间段
    </Button>

    <!-- 统计信息 -->
    <div v-if="timeRanges.length > 0" class="mt-3 text-xs text-gray-500">
      <div>
        总计 {{ totalMinutes }} 分钟（{{ (totalMinutes / 60).toFixed(1) }}
        小时）
      </div>
      <div>每日覆盖：{{ coverageRatio }}%</div>
      <div v-if="totalMinutes < 60" class="flex items-center text-yellow-600">
        <WarningOutlined class="mr-1" />
        ⚠️ 总时长不足1小时
      </div>
      <div
        v-else-if="coverageRatio >= 100"
        class="flex items-center text-green-600"
      >
        ✅ 已覆盖全天
      </div>
      <div v-else-if="coverageRatio >= 80" class="text-green-600">
        ✅ 覆盖良好
      </div>
      <div v-else-if="coverageRatio >= 50" class="text-blue-600">
        ℹ️ 覆盖一般
      </div>
    </div>

    <!-- 验证状态指示器 -->
    <div v-if="isDirty" class="mt-2 flex items-center justify-end">
      <div
        class="inline-flex items-center rounded-full px-2 py-1 text-xs"
        :class="errors.length > 0 ? 'text-red-600' : 'text-green-600'"
      >
        <span class="mr-1">{{ errors.length > 0 ? '⚠️' : '✓' }}</span>
        <span>{{
          errors.length > 0 ? `${errors.length} 个问题待解决` : '验证通过'
        }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dynamic-time-range-list {
  @apply rounded-lg border border-gray-300 p-2;
}
</style>
