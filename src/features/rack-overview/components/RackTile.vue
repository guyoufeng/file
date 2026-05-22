<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import { getRackTileStats } from '../layout'

const props = defineProps<{
  rack: Rack
  devices: Device[]
  alerts: Alert[]
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [rack: Rack]
}>()

const rackTypeLabels: Record<string, string> = {
  server: '服务器柜',
  network: '网络柜',
  storage: '存储柜',
  patching: '配线柜',
  row_head: '列头柜',
  cooling: '精密空调',
  ups_pdu: '供电柜',
  empty: '空柜',
  other: '其他',
}

const stats = computed(() => getRackTileStats(props.rack, props.devices, props.alerts))
</script>

<template>
  <button
    type="button"
    class="rack-tile"
    :class="{ alert: stats.alertCount > 0, selected }"
    @click="emit('select', rack)"
  >
    <span class="rack-name">{{ rack.name }}</span>
    <span class="rack-type">{{ rackTypeLabels[rack.type] ?? rack.type }}</span>
    <span class="rack-meta">
      {{ stats.deviceCount }} 台 /
      {{ stats.capacityText }}
    </span>
    <span v-if="stats.alertCount > 0" class="alert-badge">
      告警 {{ stats.alertCount }}
    </span>
  </button>
</template>

<style scoped>
.rack-tile {
  min-width: 92px;
  min-height: 118px;
  display: grid;
  align-content: start;
  gap: 7px;
  padding: 10px;
  border: 1px solid rgba(38, 50, 71, 0.96);
  border-radius: 8px;
  text-align: left;
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(21, 28, 46, 0.96), rgba(10, 18, 32, 0.96));
  cursor: pointer;
}

.rack-tile:hover,
.rack-tile.selected {
  border-color: rgba(14, 165, 233, 0.78);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.16);
}

.rack-tile.alert {
  border-color: rgba(239, 68, 68, 0.82);
  box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.2);
}

.rack-name {
  font-weight: 700;
  font-size: 14px;
}

.rack-type,
.rack-meta {
  color: var(--color-text-muted);
  font-size: 12px;
}

.alert-badge {
  width: fit-content;
  padding: 3px 6px;
  border-radius: 999px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.18);
  font-size: 12px;
}
</style>
