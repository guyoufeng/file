<script setup lang="ts">
import { computed } from "vue";
import { pageSizeOptions } from "../services/pagination";

const props = defineProps<{
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}>();

const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();

const pages = computed(() =>
  Array.from({ length: props.pageCount }, (_, index) => index + 1),
);

function updatePageSize(event: Event) {
  emit("update:pageSize", Number((event.target as HTMLSelectElement).value));
  emit("update:page", 1);
}
</script>

<template>
  <div class="pagination-controls">
    <span>共 {{ total }} 条</span>
    <label>
      每页
      <select :value="pageSize" @change="updatePageSize">
        <option v-for="option in pageSizeOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
      条
    </label>
    <div class="page-buttons" aria-label="分页">
      <button
        type="button"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        上一页
      </button>
      <button
        v-for="item in pages"
        :key="item"
        type="button"
        :class="{ active: item === page }"
        @click="emit('update:page', item)"
      >
        {{ item }}
      </button>
      <button
        type="button"
        :disabled="page >= pageCount"
        @click="emit('update:page', page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
  flex-wrap: wrap;
}

label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

select,
button {
  min-height: 30px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}

select {
  padding: 0 8px;
}

.page-buttons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

button {
  min-width: 32px;
  padding: 0 9px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

button.active {
  border-color: rgba(14, 165, 233, 0.72);
  color: #e0f2fe;
  background: rgba(14, 165, 233, 0.2);
}
</style>
