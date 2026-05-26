<script setup lang="ts">
defineProps<{
  search: string;
  category: string;
  categories: { id: string; label: string; count: number }[];
}>();

const emit = defineEmits<{
  "update:search": [value: string];
  "update:category": [value: string];
  add: [];
  import: [];
  cmdbSync: [];
  mcpSync: [];
  export: [];
}>();
</script>

<template>
  <div class="asset-toolbar">
    <div class="filter-tabs" aria-label="资产分类筛选">
      <button
        v-for="item in categories"
        :key="item.id"
        type="button"
        class="filter-tab"
        :class="{ active: item.id === category }"
        :aria-pressed="item.id === category"
        @click="emit('update:category', item.id)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
      </button>
    </div>
    <input
      :value="search"
      type="search"
      placeholder="搜索计算机名、业务IP、资产编号、SN号、责任人"
      @input="emit('update:search', ($event.target as HTMLInputElement).value)"
    />
    <div class="actions">
      <button type="button" @click="emit('import')">导入Excel</button>
      <button type="button" @click="emit('cmdbSync')">CMDB同步</button>
      <button type="button" @click="emit('mcpSync')">MCP同步</button>
      <button type="button" @click="emit('export')">导出设备</button>
      <button type="button" @click="emit('add')">新增设备</button>
    </div>
  </div>
</template>

<style scoped>
.asset-toolbar {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
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

.filter-tab {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-color: var(--color-border);
  background: rgba(8, 17, 31, 0.78);
}

.filter-tab strong {
  min-width: 22px;
  padding: 2px 6px;
  border-radius: 999px;
  color: #bae6fd;
  background: rgba(14, 165, 233, 0.16);
  font-size: 11px;
}

.filter-tab.active {
  border-color: rgba(56, 189, 248, 0.72);
  background: rgba(14, 165, 233, 0.18);
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
