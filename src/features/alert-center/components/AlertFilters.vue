<script setup lang="ts">
import type { AlertLevel, AlertStatus, Device, Rack, Room } from '../../../types/domain'
import type { AlertFilters } from '../../../services/alerts/alertFilters'
import { alertStatusOptions } from '../../../services/alerts/alertWorkflow'

defineProps<{
  filters: AlertFilters
  rooms: Room[]
  racks: Rack[]
  devices: Device[]
}>()

const emit = defineEmits<{
  'update:filters': [filters: AlertFilters]
}>()

function update(filters: AlertFilters, patch: AlertFilters) {
  emit('update:filters', { ...filters, ...patch })
}
</script>

<template>
  <div class="alert-filters">
    <select :value="filters.roomId ?? ''" @change="update(filters, { roomId: ($event.target as HTMLSelectElement).value || undefined })">
      <option value="">全部机房</option>
      <option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name }}</option>
    </select>
    <select :value="filters.rackId ?? ''" @change="update(filters, { rackId: ($event.target as HTMLSelectElement).value || undefined })">
      <option value="">全部机柜</option>
      <option v-for="rack in racks" :key="rack.id" :value="rack.id">{{ rack.name }}</option>
    </select>
    <select :value="filters.deviceId ?? ''" @change="update(filters, { deviceId: ($event.target as HTMLSelectElement).value || undefined })">
      <option value="">全部设备</option>
      <option v-for="device in devices.slice(0, 200)" :key="device.id" :value="device.id">{{ device.computerName }}</option>
    </select>
    <select :value="filters.level ?? 'all'" @change="update(filters, { level: (($event.target as HTMLSelectElement).value as AlertLevel | 'all') })">
      <option value="all">全部级别</option>
      <option value="info">信息</option>
      <option value="warning">警告</option>
      <option value="critical">严重</option>
    </select>
    <select :value="filters.status ?? 'all'" @change="update(filters, { status: (($event.target as HTMLSelectElement).value as AlertStatus | 'all') })">
      <option value="all">全部状态</option>
      <option v-for="option in alertStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      <option value="closed">已关闭</option>
    </select>
  </div>
</template>

<style scoped>
.alert-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

select {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}
</style>
