<script setup lang="ts">
import type { ReportMetrics } from '../../../services/report/reportMetrics'

defineProps<{
  metrics: ReportMetrics
}>()
</script>

<template>
  <div class="metric-cards">
    <article><strong>{{ metrics.roomCount }}</strong><span>机房</span></article>
    <article><strong>{{ metrics.rackCount }}</strong><span>机柜</span></article>
    <article><strong>{{ metrics.deviceCount }}</strong><span>设备</span></article>
    <article><strong>{{ metrics.alertCount }}</strong><span>活动告警</span></article>
    <article><strong>{{ metrics.offlineCount }}</strong><span>离线设备</span></article>
    <article><strong>{{ metrics.expiringWarrantyCount }}</strong><span>一年内维保到期</span></article>
  </div>
</template>

<style scoped>
.metric-cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

article {
  min-height: 92px;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

strong {
  font-size: 28px;
}

span {
  color: var(--color-text-muted);
}
</style>
