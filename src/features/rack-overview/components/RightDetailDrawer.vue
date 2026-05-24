<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import AlertDetailPanel from './AlertDetailPanel.vue'
import DeviceDetailPanel from './DeviceDetailPanel.vue'
import { getRackTileStats } from '../layout'

const props = defineProps<{
  rack: Rack | null
  device: Device | null
  devices: Device[]
  alerts: Alert[]
}>()

const emit = defineEmits<{
  editDevice: [device: Device]
  close: []
}>()

const rackDevices = computed(() => props.devices.filter((device) => device.rackId === props.rack?.id))
const rackStats = computed(() => props.rack ? getRackTileStats(props.rack, props.devices, props.alerts) : null)
const rackDeviceIds = computed(() => new Set(rackDevices.value.map((device) => device.id)))
const relatedAlerts = computed(() =>
  props.alerts.filter((alert) => {
    if (props.device) {
      return alert.deviceId === props.device.id && alert.status !== 'recovered'
    }
    return rackDeviceIds.value.has(alert.deviceId) && alert.status !== 'recovered'
  }),
)

const windowRect = ref({ x: Math.max(window.innerWidth - 330, 860), y: 108, width: 300, height: 440 })
let dragState: { kind: 'move' | 'resize'; startX: number; startY: number; rect: typeof windowRect.value } | null = null

onBeforeUnmount(() => {
  stopPointerTracking()
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
})

onMounted(async () => {
  await nextTick()
  document.addEventListener('pointerdown', handleOutsidePointerDown)
})

function startMove(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  dragState = { kind: 'move', startX: event.clientX, startY: event.clientY, rect: { ...windowRect.value } }
  startPointerTracking()
}

function startResize(event: PointerEvent) {
  event.stopPropagation()
  dragState = { kind: 'resize', startX: event.clientX, startY: event.clientY, rect: { ...windowRect.value } }
  startPointerTracking()
}

function handleOutsidePointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (
    !target?.closest('[data-testid="rack-detail-floating-window"]') &&
    !target?.closest('.drawer')
  ) {
    emit('close')
  }
}

function startPointerTracking() {
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopPointerTracking, { once: true })
}

function stopPointerTracking() {
  window.removeEventListener('pointermove', handlePointerMove)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (dragState.kind === 'move') {
    windowRect.value = { ...dragState.rect, x: dragState.rect.x + dx, y: dragState.rect.y + dy }
  } else {
    windowRect.value = {
      ...dragState.rect,
      width: Math.max(280, dragState.rect.width + dx),
      height: Math.max(340, dragState.rect.height + dy),
    }
  }
  clampWindow()
}

function clampWindow() {
  const margin = 12
  windowRect.value = {
    ...windowRect.value,
    x: Math.min(Math.max(margin, windowRect.value.x), Math.max(margin, window.innerWidth - windowRect.value.width - margin)),
    y: Math.min(Math.max(76, windowRect.value.y), Math.max(76, window.innerHeight - 140)),
  }
}
</script>

<template>
  <aside
    class="detail-drawer"
    data-testid="rack-detail-floating-window"
    :style="{ left: `${windowRect.x}px`, top: `${windowRect.y}px`, width: `${windowRect.width}px`, height: `${windowRect.height}px` }"
  >
    <header class="drawer-header" @pointerdown="startMove">
      <div>
        <p class="eyebrow">机柜详情</p>
        <h3 data-testid="selected-rack-detail-title">{{ rack?.name ?? '请选择一个机柜' }}</h3>
      </div>
      <div class="drawer-actions">
        <button type="button" @click="emit('close')">收起</button>
      </div>
    </header>
    <template v-if="rack">
      <DeviceDetailPanel :device="device" />
      <section v-if="!device && rackStats" class="compact-summary">
        <p class="eyebrow">机柜详情</p>
        <div class="summary-rows">
          <div><span>状态</span><strong>{{ rack.status }}</strong></div>
          <div><span>设备</span><strong>{{ rackStats.deviceCount }} 台</strong></div>
          <div><span>容量</span><strong>{{ rackStats.capacityText }}</strong></div>
          <div><span>告警</span><strong>{{ rackStats.alertCount }} 条</strong></div>
          <div><span>功率容量</span><strong>{{ rack.powerCapacityW ?? '-' }} W</strong></div>
        </div>
      </section>
      <div class="device-list">
        <strong>设备概览</strong>
        <article v-for="device in rackDevices.slice(0, 5)" :key="device.id" class="device-summary">
          <p>{{ device.computerName }} / {{ device.businessIp }} / {{ device.purpose }}</p>
          <button type="button" :aria-label="`编辑 ${device.computerName || device.name}`" @click="emit('editDevice', device)">
            编辑
          </button>
        </article>
      </div>
      <AlertDetailPanel :alerts="relatedAlerts" />
    </template>
    <template v-else>
      <p class="empty">点击布局中的机柜后，这里会显示设备、容量和告警摘要。</p>
    </template>
    <span class="resize-handle" aria-hidden="true" @pointerdown="startResize" />
  </aside>
</template>

<style scoped>
.detail-drawer {
  position: fixed;
  z-index: 45;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: auto;
  padding: 12px;
  padding-bottom: 48px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(14, 165, 233, 0.08), transparent 180px),
    rgba(8, 17, 31, 0.94);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(56, 189, 248, 0.08);
  backdrop-filter: blur(14px);
}

.drawer-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
  user-select: none;
}

.eyebrow {
  margin: 0 0 8px;
  color: #38bdf8;
  font-size: 11px;
}

h3 {
  margin: 0;
  font-size: 15px;
}

.drawer-actions {
  display: flex;
  align-items: center;
  padding-top: 1px;
}

.drawer-actions button {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

.empty,
.device-summary p {
  color: var(--color-text-muted);
}

.device-list {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}

.device-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.device-summary p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

.device-summary button {
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid rgba(56, 189, 248, 0.34);
  border-radius: 6px;
  color: #7dd3fc;
  background: rgba(14, 165, 233, 0.08);
  cursor: pointer;
}

.compact-summary {
  display: grid;
  gap: 7px;
}

.summary-rows {
  display: grid;
  gap: 6px;
}

.summary-rows div {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 10px;
  font-size: 12px;
}

.summary-rows span {
  color: var(--color-text-muted);
}

.summary-rows strong {
  justify-self: end;
  text-align: right;
  word-break: break-word;
}

.resize-handle {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 18px;
  height: 18px;
  border-right: 2px solid rgba(56, 189, 248, 0.7);
  border-bottom: 2px solid rgba(56, 189, 248, 0.7);
  cursor: nwse-resize;
}
</style>
