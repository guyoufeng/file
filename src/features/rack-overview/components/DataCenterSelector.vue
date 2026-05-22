<script setup lang="ts">
import type { Room } from '../../../types/domain'

defineProps<{
  rooms: Room[]
  selectedRoomId: string | null
}>()

const emit = defineEmits<{
  select: [roomId: string]
}>()
</script>

<template>
  <div class="room-selector" aria-label="机房选择">
    <button
      v-for="room in rooms"
      :key="room.id"
      type="button"
      :class="{ active: room.id === selectedRoomId }"
      @click="emit('select', room.id)"
    >
      {{ room.name }}
    </button>
  </div>
</template>

<style scoped>
.room-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(17, 24, 39, 0.82);
  cursor: pointer;
}

button.active,
button:hover {
  border-color: rgba(14, 165, 233, 0.72);
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
}
</style>
