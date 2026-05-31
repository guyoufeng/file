<script setup lang="ts">
import { computed, ref } from "vue";
import {
  clearAgentRunRecords,
  formatAgentElapsed,
  getAgentRunRecords,
  searchAgentRunRecords,
  type AgentRunRecord,
} from "../../../services/ai/agentRunStore";

const keyword = ref("");
const records = ref<AgentRunRecord[]>(getAgentRunRecords());
const selectedId = ref(records.value[0]?.id ?? "");
const filteredRecords = computed(() =>
  keyword.value.trim()
    ? searchAgentRunRecords(keyword.value)
    : records.value,
);
const selectedRecord = computed(
  () =>
    filteredRecords.value.find((record) => record.id === selectedId.value) ??
    filteredRecords.value[0],
);

function refresh() {
  records.value = getAgentRunRecords();
  selectedId.value = records.value[0]?.id ?? "";
}

function clearRecords() {
  clearAgentRunRecords();
  refresh();
}

function selectRecord(id: string) {
  selectedId.value = id;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <section class="agent-run-panel" aria-label="Agent 执行记录">
    <header>
      <div>
        <p class="eyebrow">Runs</p>
        <h3>Agent 执行记录</h3>
      </div>
      <div class="actions">
        <button type="button" @click="refresh">刷新</button>
        <button type="button" @click="clearRecords">清空</button>
      </div>
    </header>

    <div class="run-search">
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索问题、工具、模型、失败原因"
        aria-label="搜索 Agent 执行记录"
      />
    </div>

    <div class="run-layout">
      <div class="run-list" aria-label="Agent 执行记录列表">
        <button
          v-for="record in filteredRecords"
          :key="record.id"
          type="button"
          :class="{ active: selectedRecord?.id === record.id }"
          @click="selectRecord(record.id)"
        >
          <strong>{{ record.question }}</strong>
          <span>{{ record.toolName }} / {{ formatAgentElapsed(record.durationMs) }}</span>
        </button>
        <p v-if="filteredRecords.length === 0">暂无 Agent 执行记录。</p>
      </div>

      <article v-if="selectedRecord" class="run-detail" aria-label="Agent 执行详细页">
        <div class="detail-head">
          <div>
            <strong>{{ selectedRecord.question }}</strong>
            <span>
              {{ selectedRecord.toolName }} / {{ selectedRecord.usedModel || "本地工具" }}
            </span>
          </div>
          <small :class="selectedRecord.status">
            {{ selectedRecord.status === "success" ? "成功" : "需关注" }}
          </small>
        </div>
        <dl>
          <div>
            <dt>开始</dt>
            <dd>{{ formatTime(selectedRecord.startedAt) }}</dd>
          </div>
          <div>
            <dt>结束</dt>
            <dd>{{ formatTime(selectedRecord.endedAt) }}</dd>
          </div>
          <div>
            <dt>耗时</dt>
            <dd>{{ formatAgentElapsed(selectedRecord.durationMs) }}</dd>
          </div>
          <div>
            <dt>数据源</dt>
            <dd>{{ selectedRecord.dataSource }}</dd>
          </div>
          <div v-if="selectedRecord.fallbackReason">
            <dt>失败/降级</dt>
            <dd>{{ selectedRecord.fallbackReason }}</dd>
          </div>
        </dl>
        <p>{{ selectedRecord.answer }}</p>
        <ol>
          <li
            v-for="event in selectedRecord.events"
            :key="event.id"
            :class="event.status"
          >
            <strong>{{ event.label }}</strong>
            <span>{{ event.detail }}</span>
            <em>{{ event.durationLabel }}</em>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>

<style scoped>
.agent-run-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.46);
}

header,
.actions,
.detail-head,
dl {
  display: flex;
  gap: 10px;
}

header,
.detail-head {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
}

button,
input {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.84);
}

button {
  min-height: 32px;
  padding: 0 10px;
  cursor: pointer;
}

input {
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
}

.run-layout {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.4fr);
  gap: 12px;
}

.run-list {
  max-height: 360px;
  display: grid;
  align-content: start;
  gap: 8px;
  overflow: auto;
}

.run-list button {
  height: auto;
  display: grid;
  gap: 5px;
  padding: 10px;
  text-align: left;
}

.run-list button.active {
  border-color: rgba(14, 165, 233, 0.72);
  background: rgba(14, 165, 233, 0.14);
}

.run-list strong,
.run-list span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-list span,
.run-list p,
.run-detail span,
.run-detail dd,
.run-detail p {
  color: var(--color-text-muted);
}

.run-detail {
  min-height: 0;
  display: grid;
  align-items: stretch;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.66);
}

.detail-head > div {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.detail-head small {
  height: fit-content;
  padding: 4px 8px;
  border-radius: 999px;
  color: #bbf7d0;
  background: rgba(16, 185, 129, 0.12);
}

.detail-head small.warning {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.14);
}

dl {
  flex-wrap: wrap;
  margin: 0;
}

dl div {
  display: grid;
  gap: 3px;
  min-width: 130px;
}

dt {
  color: #bae6fd;
  font-size: 12px;
}

dd {
  margin: 0;
  font-size: 12px;
}

.run-detail p {
  max-height: 110px;
  margin: 0;
  overflow: auto;
  line-height: 1.55;
}

ol {
  max-height: 210px;
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

ol li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(56, 189, 248, 0.14);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(2, 6, 23, 0.42);
  font-size: 12px;
}

ol strong {
  color: #bae6fd;
}

ol em {
  color: #7dd3fc;
  font-style: normal;
}

@media (max-width: 920px) {
  .run-layout {
    grid-template-columns: 1fr;
  }
}
</style>
