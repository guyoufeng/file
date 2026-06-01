<script setup lang="ts">
export type ViewMode = 'layout' | 'u-view' | 'three'

defineProps<{
  modelValue: ViewMode
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ViewMode]
}>()

const tabs: Array<{ value: ViewMode; label: string }> = [
  { value: 'layout', label: '布局总览' },
  { value: 'u-view', label: 'U位大图' },
  { value: 'three', label: '3D轻量视图' },
]
</script>

<template>
  <div class="view-tabs" aria-label="视图切换">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      :class="{ active: tab.value === modelValue }"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.view-tabs {
  display: inline-flex;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

button {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}

button.active {
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.18);
}
</style>
