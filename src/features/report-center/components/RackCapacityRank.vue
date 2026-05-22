<script setup lang="ts">
import type { RackCapacityMetric } from '../../../services/report/reportMetrics'

defineProps<{
  ranks: RackCapacityMetric[]
}>()
</script>

<template>
  <section class="panel">
    <h3>机柜容量排行</h3>
    <article v-for="rack in ranks.slice(0, 10)" :key="rack.rackId">
      <div>
        <strong>{{ rack.rackName }}</strong>
        <span>{{ rack.usedU }}U / {{ rack.totalU }}U</span>
      </div>
      <progress :value="rack.usageRate" max="1" />
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
  background: rgba(17, 24, 39, 0.82);
}

h3 {
  margin: 0;
}

article,
article div {
  display: grid;
  gap: 6px;
}

article div {
  grid-template-columns: 1fr auto;
}

span {
  color: var(--color-text-muted);
}

progress {
  width: 100%;
  height: 8px;
}
</style>
