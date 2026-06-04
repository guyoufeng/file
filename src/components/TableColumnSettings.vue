<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  moveTableColumn,
  resetTableColumns,
  resolveTableColumns,
  toggleTableColumn,
  type DataTableColumn,
  type ResolvedDataTableColumn,
} from "../services/table/tableColumnPreferences";

const props = defineProps<{
  tableId: string;
  columns: DataTableColumn[];
}>();

const emit = defineEmits<{
  "update:columns": [columns: ResolvedDataTableColumn[]];
}>();

const resolved = ref<ResolvedDataTableColumn[]>([]);
const open = ref(false);

onMounted(refresh);

watch(
  () => props.columns,
  () => refresh(),
  { deep: true },
);

function refresh() {
  resolved.value = resolveTableColumns(props.tableId, props.columns);
  emit("update:columns", resolved.value);
}

function toggle(column: ResolvedDataTableColumn, visible: boolean) {
  resolved.value = toggleTableColumn(props.tableId, props.columns, column.id, visible);
  emit("update:columns", resolved.value);
}

function handleToggle(column: ResolvedDataTableColumn, event: Event) {
  toggle(column, (event.target as HTMLInputElement).checked);
}

function move(column: ResolvedDataTableColumn, direction: "left" | "right") {
  resolved.value = moveTableColumn(props.tableId, props.columns, column.id, direction);
  emit("update:columns", resolved.value);
}

function reset() {
  resetTableColumns(props.tableId);
  refresh();
}
</script>

<template>
  <div class="table-column-settings">
    <button type="button" @click="open = !open">列设置</button>
    <div v-if="open" class="settings-popover">
      <header>
        <strong>表格列</strong>
        <button type="button" @click="reset">恢复默认</button>
      </header>
      <ul>
        <li v-for="column in resolved" :key="column.id">
          <label>
            <input
              type="checkbox"
              :checked="column.visible"
              :disabled="column.locked"
              @change="handleToggle(column, $event)"
            />
            {{ column.label }}
          </label>
          <div>
            <button type="button" aria-label="左移列" @click="move(column, 'left')">←</button>
            <button type="button" aria-label="右移列" @click="move(column, 'right')">→</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.table-column-settings {
  position: relative;
  display: inline-flex;
}

button {
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
  cursor: pointer;
}

.settings-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 70;
  width: 280px;
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
}

header,
li,
li div {
  display: flex;
  align-items: center;
  gap: 8px;
}

header,
li {
  justify-content: space-between;
}

header button,
li button {
  min-height: 28px;
  padding: 0 8px;
}

ul {
  max-height: 280px;
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

label {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-muted);
}
</style>
