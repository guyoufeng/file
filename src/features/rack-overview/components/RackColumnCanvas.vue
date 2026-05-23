<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import { categoryColors } from '../../../constants/colors'
import { getDeviceBlockHeight, getDeviceBlockY } from '../../../services/rack/uPosition'

const props = defineProps<{
  rack: Rack
  devices: Device[]
  alerts?: Alert[]
  zoom: number
  highlightDeviceId?: string | null
}>()

const rackWidth = 300
const labelWidth = 44
const rackPadding = 8
const baseRowHeight = 14

const rowHeight = computed(() => Math.round(baseRowHeight * props.zoom))
const stageHeight = computed(() => props.rack.heightU * rowHeight.value)
const rackBodyWidth = rackWidth - labelWidth - rackPadding
const rackDevices = computed(() =>
  props.devices
    .filter((device) => device.rackId === props.rack.id && device.side === 'front')
    .sort((a, b) => b.startU - a.startU),
)

function deviceText(device: Device): string {
  const lines = [device.computerName || device.name, device.businessIp]
  if (props.zoom >= 1) {
    lines.push(device.purpose)
  }
  return lines.filter(Boolean).join('\n')
}

function deviceColor(device: Device): string {
  const activeAlert = props.alerts?.find((alert) => alert.deviceId === device.id && alert.status !== 'recovered')
  if (activeAlert?.level === 'critical') return '#EF4444'
  if (activeAlert?.level === 'warning') return '#F59E0B'
  return categoryColors[device.categoryId as keyof typeof categoryColors] ?? categoryColors.other
}
</script>

<template>
  <div class="rack-canvas">
    <v-stage :config="{ width: rackWidth, height: stageHeight }">
      <v-layer>
        <template v-for="u in rack.heightU" :key="u">
          <v-rect
            :config="{
              x: labelWidth,
              y: (rack.heightU - u) * rowHeight,
              width: rackBodyWidth,
              height: rowHeight,
              fill: u % 2 === 0 ? '#0B1220' : '#101827',
              stroke: '#263247',
              strokeWidth: 0.5,
            }"
          />
          <v-text
            :config="{
              x: 0,
              y: (rack.heightU - u) * rowHeight + 2,
              width: labelWidth - 8,
              text: `${u}U`,
              align: 'right',
              fontSize: Math.max(9, rowHeight * 0.45),
              fill: '#94A3B8',
            }"
          />
        </template>

        <template v-for="device in rackDevices" :key="device.id">
          <v-rect
            :config="{
              x: labelWidth + 6,
              y: getDeviceBlockY(device.startU, device.heightU, rack.heightU, rowHeight) + 3,
              width: rackBodyWidth - 12,
              height: getDeviceBlockHeight(device.heightU, rowHeight) - 6,
              fill: deviceColor(device),
              opacity: 0.86,
              cornerRadius: 4,
              stroke: device.id === highlightDeviceId ? '#FDE68A' : '#E5EEFB',
              strokeWidth: device.id === highlightDeviceId ? 2 : props.alerts?.some((alert) => alert.deviceId === device.id && alert.status !== 'recovered') ? 1.5 : 0.6,
            }"
          />
          <v-text
            :config="{
              x: labelWidth + 14,
              y: getDeviceBlockY(device.startU, device.heightU, rack.heightU, rowHeight) + 8,
              width: rackBodyWidth - 28,
              height: getDeviceBlockHeight(device.heightU, rowHeight) - 12,
              text: deviceText(device),
              fontSize: props.zoom >= 1 ? 12 : 10,
              lineHeight: 1.25,
              fill: '#F8FAFC',
              ellipsis: true,
            }"
          />
        </template>
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.rack-canvas {
  width: 300px;
  padding: 10px;
  border: 1px solid rgba(71, 85, 105, 0.78);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.1), transparent 8%, transparent 92%, rgba(148, 163, 184, 0.1)),
    rgba(8, 17, 31, 0.92);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.9);
}
</style>
