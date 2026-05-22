<script setup lang="ts">
defineProps<{
  counts: Record<string, number>
}>()
</script>

<template>
  <section class="panel">
    <h3>设备分类统计</h3>
    <div v-for="[category, count] in Object.entries(counts)" :key="category" class="row">
      <span>{{ category }}</span>
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
  background: rgba(17, 24, 39, 0.82);
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
