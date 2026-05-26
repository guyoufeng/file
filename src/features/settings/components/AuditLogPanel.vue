<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import PaginationControls from "../../../components/PaginationControls.vue";
import {
  buildAuditLogPage,
  getAuditActionLabel,
} from "../../../services/audit/auditLogView";
import type { AuditLog } from "../../../types/domain";
import { getLocalAiAuditLogs } from "../../../services/backend/ai";
import { getAuditLogs } from "../../../services/backend/settings";

const keyword = ref("");
const actionFilter = ref("all");
const statusFilter = ref("all");
const page = ref(1);
const pageSize = ref(20);
const systemLogs = ref<AuditLog[]>([]);

const allLogs = computed(() =>
  [...getLocalAiAuditLogs(), ...systemLogs.value].sort(
    (first, second) => second.createdAt.localeCompare(first.createdAt),
  ),
);

const actionOptions = computed(() => {
  const actions = new Set(allLogs.value.map((log) => log.action));
  return [...actions].sort();
});

const pagedLogs = computed(() =>
  buildAuditLogPage(allLogs.value, {
    keyword: keyword.value,
    action: actionFilter.value,
    status: statusFilter.value,
    page: page.value,
    pageSize: pageSize.value,
  }),
);

watch([keyword, actionFilter, statusFilter, pageSize], () => {
  page.value = 1;
});

onMounted(async () => {
  systemLogs.value = await getAuditLogs(200);
});

function getMetadataText(log: AuditLog, key: string): string {
  const value = log.metadata?.[key];
  if (Array.isArray(value)) return value.join("、");
  return typeof value === "string" ? value : "";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getToolContext(log: AuditLog): string {
  const tool = getMetadataText(log, "toolName") || getMetadataText(log, "tools") || log.targetType;
  const source = getMetadataText(log, "source");
  const duration = log.metadata?.durationMs;
  const durationText = typeof duration === "number" ? `${duration}ms` : "";
  return [tool, source, durationText].filter(Boolean).join(" / ");
}

function getRelatedObject(log: AuditLog): string {
  return (
    getMetadataText(log, "relatedObject") ||
    getMetadataText(log, "inputSummary") ||
    log.targetId ||
    "无关联对象"
  );
}
</script>

<template>
  <section class="audit-panel">
    <header>
      <div>
        <p class="eyebrow">审计日志</p>
        <h3>AI 查询与系统变更</h3>
      </div>
      <div class="filters">
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索问题、设备、机柜、操作记录"
        />
        <select v-model="actionFilter">
          <option value="all">全部操作</option>
          <option v-for="action in actionOptions" :key="action" :value="action">
            {{ action }}
          </option>
        </select>
        <select v-model="statusFilter">
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
      </div>
    </header>
    <div v-if="pagedLogs.total === 0" class="empty">暂无审计记录。</div>
    <div v-else class="audit-table">
      <div class="table-head">
        <span>时间</span>
        <span>操作</span>
        <span>问题 / 结果</span>
        <span>工具与对象</span>
        <span>状态</span>
      </div>
      <article v-for="log in pagedLogs.items" :key="log.id" class="table-row">
        <span class="time">{{ formatTime(log.createdAt) }}</span>
        <span class="pill">{{ getAuditActionLabel(log.action) }}</span>
        <div class="summary">
          <strong>{{ getMetadataText(log, "question") || log.summary }}</strong>
          <small>{{ log.summary }}</small>
        </div>
        <div class="target">
          <span>{{ getToolContext(log) }}</span>
          <small>{{ getRelatedObject(log) }}</small>
        </div>
        <span :class="['status', getMetadataText(log, 'status') || 'success']">
          {{ getMetadataText(log, "status") === "failed" ? "失败" : "成功" }}
        </span>
      </article>
    </div>
    <PaginationControls
      v-if="pagedLogs.total > 0"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="pagedLogs.total"
      :page-count="pagedLogs.pageCount"
    />
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
  flex-wrap: wrap;
}

.eyebrow,
h3 {
  margin: 0;
}

.eyebrow {
  color: #38bdf8;
  font-size: 12px;
}

.filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

input,
select {
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.9);
}

input {
  width: min(340px, 100%);
  padding: 0 10px;
}

select {
  padding: 0 8px;
}

.audit-table {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(8, 17, 31, 0.72);
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 96px 128px minmax(220px, 1.3fr) minmax(180px, 0.9fr) 70px;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
}

.table-head {
  color: #8fb6d8;
  font-size: 12px;
  background: rgba(14, 165, 233, 0.08);
}

.table-row + .table-row {
  border-top: 1px solid rgba(38, 50, 71, 0.72);
}

.summary,
.target {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.summary strong,
.target span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time,
small,
.empty {
  color: var(--color-text-muted);
}

.pill,
.status {
  width: fit-content;
  min-width: 52px;
  padding: 4px 8px;
  border-radius: 999px;
  text-align: center;
  font-size: 12px;
}

.pill {
  border: 1px solid rgba(14, 165, 233, 0.45);
  color: #bae6fd;
  background: rgba(14, 165, 233, 0.12);
}

.status {
  border: 1px solid rgba(16, 185, 129, 0.44);
  color: #bbf7d0;
  background: rgba(16, 185, 129, 0.12);
}

.status.failed {
  border-color: rgba(239, 68, 68, 0.52);
  color: #fecaca;
  background: rgba(239, 68, 68, 0.12);
}

@media (max-width: 960px) {
  .table-head {
    display: none;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
