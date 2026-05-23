<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import RackColumnCanvas from './RackColumnCanvas.vue'
import ZoomToolbar from './ZoomToolbar.vue'

const props = defineProps<{
  rack: Rack | null
  racks?: Rack[]
  devices: Device[]
  alerts?: Alert[]
  highlightDeviceId?: string | null
}>()

const emit = defineEmits<{
  selectRack: [rack: Rack]
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

const zoom = ref(1)
const visibleRacks = computed(() => props.racks?.length ? props.racks : props.rack ? [props.rack] : [])
const rackDevices = computed(() => props.devices.filter((device) => device.rackId === props.rack?.id))
const activeHighlightDeviceId = computed(() => props.highlightDeviceId ?? rackDevices.value[0]?.id ?? null)
</script>

<template>
  <div class="rack-u-view">
    <header>
      <div>
        <p class="eyebrow">U位大图</p>
        <h3>{{ visibleRacks.length > 1 ? '多柜 U 位总览' : rack?.name ?? '请选择机柜' }}</h3>
        <span v-if="visibleRacks.length > 1" class="hint">横向查看当前机房多个 48U 机柜，点击机柜标题同步右侧详情。</span>
      </div>
      <ZoomToolbar v-model="zoom" />
    </header>

    <div v-if="visibleRacks.length > 0" class="rack-u-scroll" data-testid="rack-u-overview">
      <section
        v-for="item in visibleRacks"
        :key="item.id"
        class="rack-u-column"
        :class="{ active: item.id === rack?.id }"
      >
        <button type="button" class="rack-u-title" @click="emit('selectRack', item)">
          <strong>{{ item.name }}</strong>
          <span>{{ rackTypeLabels[item.type] ?? item.type }} / {{ item.heightU }}U</span>
        </button>
        <RackColumnCanvas
          :rack="item"
          :devices="devices"
          :alerts="alerts"
          :zoom="zoom"
          :highlight-device-id="item.id === rack?.id ? activeHighlightDeviceId : null"
        />
      </section>
    </div>
    <div v-else class="empty-panel">
      <div class="empty-panel-inner">
        <h2>请选择一个机柜</h2>
        <p>选择机柜后显示 48U 编号、设备块和缩放视图。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rack-u-view {
  display: grid;
  gap: 12px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
}

.hint {
  display: block;
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.rack-u-scroll {
  max-width: 100%;
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 2px 2px 14px;
}

.rack-u-column {
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
}

.rack-u-title {
  min-height: 50px;
  display: grid;
  gap: 3px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  text-align: left;
  background: rgba(8, 17, 31, 0.9);
  cursor: pointer;
}

.rack-u-title span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.rack-u-title strong {
  white-space: nowrap;
}

.rack-u-column.active .rack-u-title {
  border-color: rgba(56, 189, 248, 0.72);
  background: rgba(14, 165, 233, 0.14);
}
</style>
