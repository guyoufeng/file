<script setup lang="ts">
import type { Device } from '../../../types/domain'

defineProps<{
  devices: Device[]
}>()
</script>

<template>
  <section class="panel">
    <h3>维保提醒</h3>
    <p v-if="devices.length === 0">暂无一年内维保到期设备。</p>
    <article v-for="device in devices.slice(0, 10)" :key="device.id">
      <strong>{{ device.computerName || device.name }}</strong>
      <span>{{ device.businessIp }} / {{ device.warrantyExpireAt }}</span>
    </article>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

h3,
p {
  margin: 0;
}

p,
span {
  color: var(--color-text-muted);
}

article {
  display: grid;
  gap: 4px;
}
</style>
