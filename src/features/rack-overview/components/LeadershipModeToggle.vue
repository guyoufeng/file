<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    type="button"
    class="leadership-toggle"
    :class="{ active: modelValue }"
    :aria-pressed="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="indicator" />
    <span>领导展示</span>
  </button>
</template>

<style scoped>
.leadership-toggle {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(8, 17, 31, 0.86);
  cursor: pointer;
}

.leadership-toggle.active {
  color: var(--color-text);
  border-color: rgba(14, 165, 233, 0.62);
  background: rgba(14, 165, 233, 0.16);
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #64748b;
}

.leadership-toggle.active .indicator {
  background: #38bdf8;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.72);
}
</style>
