<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import { getRackTileStats } from '../layout'

const props = defineProps<{
  rack: Rack | null
  devices: Device[]
  alerts: Alert[]
}>()

const rackDevices = computed(() => props.devices.filter((device) => device.rackId === props.rack?.id))
const stats = computed(() =>
  props.rack ? getRackTileStats(props.rack, props.devices, props.alerts) : null,
)
</script>

<template>
  <aside class="detail-drawer">
    <template v-if="rack && stats">
      <p class="eyebrow">机柜详情</p>
      <h3>{{ rack.name }}</h3>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>{{ rack.status }}</dd>
        </div>
        <div>
          <dt>设备</dt>
          <dd>{{ stats.deviceCount }} 台</dd>
        </div>
        <div>
          <dt>容量</dt>
          <dd>{{ stats.capacityText }}</dd>
        </div>
        <div>
          <dt>告警</dt>
          <dd>{{ stats.alertCount }} 条</dd>
        </div>
      </dl>
      <div class="device-list">
        <strong>设备概览</strong>
        <p v-for="device in rackDevices.slice(0, 5)" :key="device.id">
          {{ device.computerName }} / {{ device.businessIp }} / {{ device.purpose }}
        </p>
      </div>
    </template>
    <template v-else>
      <p class="eyebrow">机柜详情</p>
      <h3>请选择一个机柜</h3>
      <p class="empty">点击布局中的机柜后，这里会显示设备、容量和告警摘要。</p>
    </template>
  </aside>
</template>

<style scoped>
.detail-drawer {
  min-height: 100%;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.88);
}

.eyebrow {
  margin: 0 0 8px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0 0 16px;
  font-size: 18px;
}

dl {
  display: grid;
  gap: 10px;
  margin: 0 0 18px;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

dt,
.empty,
.device-list p {
  color: var(--color-text-muted);
}

dd {
  margin: 0;
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
