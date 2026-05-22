<script setup lang="ts">
import type { Alert } from '../../../types/domain'

defineProps<{
  alerts: Alert[]
}>()
</script>

<template>
  <section class="alert-detail">
    <p class="eyebrow">告警摘要</p>
    <div v-if="alerts.length === 0" class="empty">暂无活动告警</div>
    <article v-for="alert in alerts.slice(0, 4)" :key="alert.id" :class="['alert-item', alert.level]">
      <strong>{{ alert.title }}</strong>
      <span>{{ alert.level }} / {{ alert.status }}</span>
      <small>{{ alert.startedAt }}</small>
    </article>
  </section>
</template>

<style scoped>
.alert-detail {
  display: grid;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  font-size: 12px;
}

.empty,
.alert-item span,
.alert-item small {
  color: var(--color-text-muted);
}

.alert-item {
  display: grid;
  gap: 3px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.72);
}

.alert-item.critical {
  border-color: rgba(239, 68, 68, 0.7);
}
</style>
