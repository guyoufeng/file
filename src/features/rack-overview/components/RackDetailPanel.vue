<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack } from '../../../types/domain'
import { getRackTileStats } from '../layout'

const props = defineProps<{
  rack: Rack | null
  devices: Device[]
  alerts: Alert[]
}>()

const stats = computed(() => (props.rack ? getRackTileStats(props.rack, props.devices, props.alerts) : null))
</script>

<template>
  <section v-if="rack && stats" class="rack-detail">
    <p class="eyebrow">机柜详情</p>
    <h3>{{ rack.name }}</h3>
    <dl>
      <div><dt>状态</dt><dd>{{ rack.status }}</dd></div>
      <div><dt>设备</dt><dd>{{ stats.deviceCount }} 台</dd></div>
      <div><dt>容量</dt><dd>{{ stats.capacityText }}</dd></div>
      <div><dt>告警</dt><dd>{{ stats.alertCount }} 条</dd></div>
      <div><dt>功率容量</dt><dd>{{ rack.powerCapacityW ?? '-' }} W</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.rack-detail {
  display: grid;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
}

dl {
  display: grid;
  gap: 9px;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

dt {
  color: var(--color-text-muted);
}

dd {
  margin: 0;
}
</style>
