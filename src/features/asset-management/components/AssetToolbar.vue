<script setup lang="ts">
defineProps<{
  search: string
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  add: []
}>()
</script>

<template>
  <div class="asset-toolbar">
    <input
      :value="search"
      type="search"
      placeholder="搜索计算机名、业务IP、资产编号、SN号、责任人"
      @input="emit('update:search', ($event.target as HTMLInputElement).value)"
    />
    <button type="button" @click="emit('add')">新增设备</button>
  </div>
</template>

<style scoped>
.asset-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

input {
  width: min(520px, 100%);
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.92);
}

button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.64);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}
</style>
