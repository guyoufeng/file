<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Device, Rack } from '../../../types/domain'
import RackColumnCanvas from './RackColumnCanvas.vue'
import ZoomToolbar from './ZoomToolbar.vue'

const props = defineProps<{
  rack: Rack | null
  devices: Device[]
}>()

const zoom = ref(1)
const rackDevices = computed(() => props.devices.filter((device) => device.rackId === props.rack?.id))
const highlightDeviceId = computed(() => rackDevices.value[0]?.id ?? null)
</script>

<template>
  <div class="rack-u-view">
    <header>
      <div>
        <p class="eyebrow">U位大图</p>
        <h3>{{ rack?.name ?? '请选择机柜' }}</h3>
      </div>
      <ZoomToolbar v-model="zoom" />
    </header>

    <RackColumnCanvas
      v-if="rack"
      :rack="rack"
      :devices="devices"
      :zoom="zoom"
      :highlight-device-id="highlightDeviceId"
    />
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
</style>
