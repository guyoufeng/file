<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import AlertDetailPanel from './AlertDetailPanel.vue'
import DeviceDetailPanel from './DeviceDetailPanel.vue'
import RackDetailPanel from './RackDetailPanel.vue'

const props = defineProps<{
  rack: Rack | null
  device: Device | null
  devices: Device[]
  alerts: Alert[]
  mode: 'normal' | 'wide'
}>()

const emit = defineEmits<{
  'update:mode': [mode: 'normal' | 'wide']
  close: []
}>()

const rackDevices = computed(() => props.devices.filter((device) => device.rackId === props.rack?.id))
const rackDeviceIds = computed(() => new Set(rackDevices.value.map((device) => device.id)))
const relatedAlerts = computed(() =>
  props.alerts.filter((alert) => {
    if (props.device) {
      return alert.deviceId === props.device.id && alert.status !== 'recovered'
    }
    return rackDeviceIds.value.has(alert.deviceId) && alert.status !== 'recovered'
  }),
)
</script>

<template>
  <aside class="detail-drawer">
    <header class="drawer-header">
      <div>
        <p class="eyebrow">机柜详情</p>
        <h3 data-testid="selected-rack-detail-title">{{ rack?.name ?? '请选择一个机柜' }}</h3>
      </div>
      <div class="drawer-actions">
        <button type="button" :class="{ active: mode === 'normal' }" @click="emit('update:mode', 'normal')">标准</button>
        <button type="button" :class="{ active: mode === 'wide' }" @click="emit('update:mode', 'wide')">放大</button>
        <button type="button" @click="emit('close')">收起</button>
      </div>
    </header>
    <template v-if="rack">
      <DeviceDetailPanel :device="device" />
      <RackDetailPanel v-if="!device" :rack="rack" :devices="devices" :alerts="alerts" />
      <div class="device-list">
        <strong>设备概览</strong>
        <p v-for="device in rackDevices.slice(0, 5)" :key="device.id">
          {{ device.computerName }} / {{ device.businessIp }} / {{ device.purpose }}
        </p>
      </div>
      <AlertDetailPanel :alerts="relatedAlerts" />
    </template>
    <template v-else>
      <p class="empty">点击布局中的机柜后，这里会显示设备、容量和告警摘要。</p>
    </template>
  </aside>
</template>

<style scoped>
.detail-drawer {
  max-height: calc(100vh - 128px);
  display: grid;
  gap: 18px;
  align-content: start;
  overflow: auto;
  padding: 16px;
  padding-bottom: 84px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.88);
}

.drawer-header {
  display: grid;
  gap: 10px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 17px;
}

.drawer-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.drawer-actions button {
  min-height: 30px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

.drawer-actions button.active {
  border-color: rgba(56, 189, 248, 0.72);
  background: rgba(14, 165, 233, 0.16);
}

.empty,
.device-list p {
  color: var(--color-text-muted);
}

.device-list {
  display: grid;
  gap: 8px;
}

.device-list p {
  margin: 0;
  line-height: 1.6;
}
</style>
