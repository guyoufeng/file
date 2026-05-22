<script setup lang="ts">
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import MicroModuleLayout from './MicroModuleLayout.vue'
import SimpleRoomLayout from './SimpleRoomLayout.vue'

defineProps<{
  room: Room | undefined
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
  <div class="layout-overview">
    <MicroModuleLayout
      v-if="room?.layoutType === 'micro_module'"
      :room="room"
      :racks="racks"
      :devices="devices"
      :alerts="alerts"
      :selected-rack-id="selectedRackId"
      @select-rack="emit('selectRack', $event)"
    />
    <SimpleRoomLayout
      v-else
      :racks="racks"
      :devices="devices"
      :alerts="alerts"
      :selected-rack-id="selectedRackId"
      @select-rack="emit('selectRack', $event)"
    />
  </div>
</template>

<style scoped>
.layout-overview {
  min-width: 0;
}
</style>
