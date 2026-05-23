<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AuditLog } from "../../../types/domain";
import { getLocalAiAuditLogs } from "../../../services/backend/ai";
import { getAuditLogs } from "../../../services/backend/settings";

const keyword = ref("");
const systemLogs = ref<AuditLog[]>([]);
const logs = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  const all = [...getLocalAiAuditLogs(), ...systemLogs.value].sort(
    (first, second) => second.createdAt.localeCompare(first.createdAt),
  );
  if (!text) return all;
  return all.filter((log) =>
    `${log.summary} ${JSON.stringify(log.metadata)}`
      .toLowerCase()
      .includes(text),
  );
});

onMounted(async () => {
  systemLogs.value = await getAuditLogs(200);
});
</script>

<template>
  <section class="audit-panel">
    <header>
      <div>
        <p class="eyebrow">审计日志</p>
        <h3>AI 查询与系统变更</h3>
      </div>
      <input
        v-model="keyword"
        type="search"
        placeholder="搜索问题、设备、机柜、操作记录"
      />
    </header>
    <div v-if="logs.length === 0" class="empty">暂无审计记录。</div>
    <article v-for="log in logs" :key="log.id">
      <strong>{{ log.summary }}</strong>
      <span>{{ log.createdAt }} / {{ log.action }}</span>
    </article>
  </section>
</template>

<style scoped>
.audit-panel {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow,
h3 {
  margin: 0;
}

.eyebrow {
  color: #38bdf8;
  font-size: 12px;
}

input {
  height: 34px;
  width: min(360px, 100%);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.9);
}

article {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.72);
}

span,
.empty {
  color: var(--color-text-muted);
}
</style>
