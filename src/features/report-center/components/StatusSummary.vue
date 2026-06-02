<script setup lang="ts">
defineProps<{
  counts: Record<string, number>
}>()
</script>

<template>
  <section class="panel">
    <h3>设备状态统计</h3>
    <div v-for="[status, count] in Object.entries(counts)" :key="status" class="row">
      <span>{{ status }}</span>
      <strong>{{ count }}</strong>
    </div>
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

h3 {
  margin: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-muted);
}
</style>
