<script setup lang="ts">
defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5]
</script>

<template>
  <div class="zoom-toolbar" aria-label="缩放">
    <button
      v-for="level in zoomLevels"
      :key="level"
      type="button"
      :class="{ active: level === modelValue }"
      @click="emit('update:modelValue', level)"
    >
      {{ Math.round(level * 100) }}%
    </button>
  </div>
</template>

<style scoped>
.zoom-toolbar {
  display: flex;
  gap: 6px;
}

button {
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(8, 17, 31, 0.88);
  cursor: pointer;
}

button.active,
button:hover {
  border-color: rgba(14, 165, 233, 0.7);
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
}
</style>
