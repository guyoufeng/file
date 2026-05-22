<script setup lang="ts">
import type { Alert, Device, Rack } from '../../../types/domain'
import RackTile from './RackTile.vue'

defineProps<{
  racks: Rack[]
  devices: Device[]
  alerts: Alert[]
  selectedRackId: string | null
}>()

const emit = defineEmits<{
  selectRack: [rack: Rack]
}>()
</script>

<template>
  <div class="simple-layout">
    <RackTile
      v-for="rack in racks"
      :key="rack.id"
      :rack="rack"
      :devices="devices"
      :alerts="alerts"
      :selected="rack.id === selectedRackId"
      @select="emit('selectRack', rack)"
    />
  </div>
</template>

<style scoped>
.simple-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 160px));
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.72);
}
</style>
