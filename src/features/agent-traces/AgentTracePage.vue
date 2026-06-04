<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  buildAgentRunSummary,
  filterAgentTraceRecords,
  type AgentTraceStatusFilter,
} from "../../services/ai/agentTraceView";
import {
  clearAgentRunRecords,
  getAgentRunRecords,
  type AgentRunRecord,
} from "../../services/ai/agentRunStore";
import type { AiToolName } from "../../services/ai/aiTools";

const router = useRouter();
const records = ref<AgentRunRecord[]>([]);
const keyword = ref("");
const statusFilter = ref<AgentTraceStatusFilter>("all");
const toolFilter = ref<AiToolName | "all">("all");
const selectedId = ref("");

const filteredRecords = computed(() =>
  filterAgentTraceRecords(records.value, {
    keyword: keyword.value,
    status: statusFilter.value,
    toolName: toolFilter.value,
  }),
);
const selectedRecord = computed(
  () =>
    filteredRecords.value.find((record) => record.id === selectedId.value) ??
    filteredRecords.value[0],
);
const selectedSummary = computed(() =>
  selectedRecord.value ? buildAgentRunSummary(selectedRecord.value) : undefined,
);
const toolOptions = computed(() =>
  [...new Set(records.value.map((record) => record.toolName))].sort(),
);
const counts = computed(() => ({
  total: records.value.length,
  warning: records.value.filter((record) => record.status === "warning").length,
  attachments: records.value.reduce((sum, record) => sum + (record.attachments?.length ?? 0), 0),
  events: records.value.reduce((sum, record) => sum + record.events.length, 0),
}));

onMounted(refreshRecords);

function refreshRecords() {
  records.value = getAgentRunRecords();
  selectedId.value = records.value[0]?.id ?? "";
}

function selectRecord(record: AgentRunRecord) {
  selectedId.value = record.id;
}

function clearRecords() {
  clearAgentRunRecords();
  refreshRecords();
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function locateTarget(record: AgentRunRecord) {
  if (!record.target) return;
  router.push({
    path: "/rack-overview",
    query: {
      roomId: record.target.roomId,
      rackId: record.target.rackId,
      deviceId: record.target.deviceId,
      focus: Date.now().toString(),
      view: "u-view",
    },
  });
}
</script>

<template>
  <section class="page trace-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">Agent Trace</p>
        <h2 class="page-title">AI Agent 执行轨迹</h2>
        <p class="page-subtitle">集中查看 AI 助手每次问答、工具调用、证据链、附件分析和定位动作。</p>
      </div>
      <div class="header-actions">
        <button type="button" @click="refreshRecords">刷新</button>
        <button type="button" @click="clearRecords">清空轨迹</button>
      </div>
    </div>

    <div class="trace-metrics" aria-label="Agent 轨迹统计">
      <article>
        <strong>{{ counts.total }}</strong>
        <span>总执行</span>
      </article>
      <article>
        <strong>{{ counts.warning }}</strong>
        <span>需关注</span>
      </article>
      <article>
        <strong>{{ counts.events }}</strong>
        <span>执行步骤</span>
      </article>
      <article>
        <strong>{{ counts.attachments }}</strong>
        <span>附件证据</span>
      </article>
    </div>

    <div class="trace-filters">
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索问题、回答、工具、模型、附件、定位目标"
        aria-label="搜索 Agent 轨迹"
      />
      <select v-model="statusFilter" aria-label="筛选状态">
        <option value="all">全部状态</option>
        <option value="success">正常</option>
        <option value="warning">需关注</option>
      </select>
      <select v-model="toolFilter" aria-label="筛选工具">
        <option value="all">全部工具</option>
        <option v-for="tool in toolOptions" :key="tool" :value="tool">{{ tool }}</option>
      </select>
    </div>

    <div class="trace-layout">
      <aside class="trace-list" aria-label="Agent 执行列表">
        <button
          v-for="record in filteredRecords"
          :key="record.id"
          type="button"
          :class="{ active: selectedRecord?.id === record.id }"
          @click="selectRecord(record)"
        >
          <span :class="['status-dot', record.status]" />
          <strong>{{ record.question }}</strong>
          <small>{{ record.toolName }} · {{ formatTime(record.startedAt) }}</small>
        </button>
        <p v-if="filteredRecords.length === 0">暂无符合条件的 Agent 执行轨迹。</p>
      </aside>

      <article v-if="selectedRecord && selectedSummary" class="trace-detail" aria-label="Agent 执行详情">
        <header>
          <div>
            <span :class="['status-pill', selectedRecord.status]">{{ selectedSummary.riskLabel }}</span>
            <h3>{{ selectedRecord.question }}</h3>
            <p>{{ selectedRecord.toolName }} / {{ selectedRecord.usedModel || "本地工具链" }}</p>
          </div>
          <button
            v-if="selectedSummary.hasNavigationTarget"
            type="button"
            @click="locateTarget(selectedRecord)"
          >
            定位到对象
          </button>
        </header>

        <dl class="detail-grid">
          <div>
            <dt>开始时间</dt>
            <dd>{{ formatTime(selectedRecord.startedAt) }}</dd>
          </div>
          <div>
            <dt>结束时间</dt>
            <dd>{{ formatTime(selectedRecord.endedAt) }}</dd>
          </div>
          <div>
            <dt>总耗时</dt>
            <dd>{{ selectedSummary.durationLabel }}</dd>
          </div>
          <div>
            <dt>数据来源</dt>
            <dd>{{ selectedRecord.dataSource }}</dd>
          </div>
          <div>
            <dt>执行步骤</dt>
            <dd>{{ selectedSummary.eventCount }} 步</dd>
          </div>
          <div>
            <dt>附件</dt>
            <dd>{{ selectedSummary.attachmentCount }} 个</dd>
          </div>
        </dl>

        <section v-if="selectedRecord.fallbackReason" class="warning-box">
          <strong>降级/异常原因</strong>
          <span>{{ selectedRecord.fallbackReason }}</span>
        </section>

        <section class="answer-box">
          <strong>最终回答</strong>
          <p>{{ selectedRecord.answer }}</p>
        </section>

        <section v-if="selectedRecord.target" class="target-box">
          <strong>关联对象</strong>
          <span>机房：{{ selectedRecord.target.roomId || "无" }}</span>
          <span>机柜：{{ selectedRecord.target.rackId || "无" }}</span>
          <span>设备：{{ selectedRecord.target.deviceId || "无" }}</span>
        </section>

        <section v-if="selectedRecord.attachments?.length" class="attachment-box">
          <strong>附件证据</strong>
          <ul>
            <li v-for="attachment in selectedRecord.attachments" :key="`${selectedRecord.id}-${attachment.name}`">
              {{ attachment.name }} / {{ attachment.type }} / {{ formatSize(attachment.size) }}
            </li>
          </ul>
        </section>

        <section class="timeline-box">
          <strong>执行时间线</strong>
          <ol>
            <li
              v-for="event in selectedRecord.events"
              :key="event.id"
              :class="event.status"
            >
              <em>{{ event.durationLabel }}</em>
              <div>
                <strong>{{ event.label }}</strong>
                <span>{{ event.detail }}</span>
              </div>
            </li>
          </ol>
        </section>
      </article>

      <article v-else class="empty-detail">
        <h3>暂无执行轨迹</h3>
        <p>打开 AI 助手提问后，这里会记录本轮问题、工具选择、执行过程、附件证据和审计链路。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.trace-page {
  display: grid;
  gap: 18px;
}

.page-header,
.header-actions,
.trace-filters,
.trace-detail header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header,
.trace-detail header {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.trace-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.trace-metrics article,
.trace-list,
.trace-detail,
.empty-detail {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.trace-metrics article {
  display: grid;
  gap: 6px;
  padding: 16px;
}

.trace-metrics strong {
  font-size: 30px;
}

.trace-metrics span,
.page-subtitle,
.trace-detail p,
.trace-detail dd,
.trace-list small,
.target-box span,
.answer-box p,
.attachment-box li,
.timeline-box span,
.empty-detail p {
  color: var(--color-text-muted);
}

.trace-filters {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

input,
select,
button {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-panel);
}

input,
select {
  padding: 0 12px;
}

input {
  flex: 1;
  min-width: 220px;
}

button {
  padding: 0 14px;
  cursor: pointer;
}

.trace-layout {
  min-height: 560px;
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.5fr);
  gap: 16px;
}

.trace-list {
  max-height: 680px;
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 10px;
  overflow: auto;
}

.trace-list button {
  height: auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 8px;
  padding: 12px;
  text-align: left;
}

.trace-list button.active {
  border-color: color-mix(in srgb, var(--color-primary) 76%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-panel));
}

.trace-list strong,
.trace-list small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-list small {
  grid-column: 2;
  font-size: 12px;
}

.status-dot {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #10b981;
}

.status-dot.warning {
  background: #f59e0b;
}

.trace-detail {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px;
}

.trace-detail h3,
.empty-detail h3 {
  margin: 4px 0;
  font-size: 22px;
}

.status-pill {
  display: inline-flex;
  width: fit-content;
  padding: 3px 9px;
  border-radius: 999px;
  color: #047857;
  background: #d1fae5;
  font-size: 12px;
}

.status-pill.warning {
  color: #92400e;
  background: #fef3c7;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.detail-grid div,
.warning-box,
.answer-box,
.target-box,
.attachment-box,
.timeline-box {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

dt {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

dd,
.answer-box p {
  margin: 0;
}

.warning-box {
  border-color: color-mix(in srgb, #f59e0b 52%, var(--color-border));
}

.target-box {
  grid-template-columns: auto repeat(3, minmax(0, 1fr));
  align-items: center;
}

.attachment-box ul,
.timeline-box ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.attachment-box ul {
  display: grid;
  gap: 6px;
}

.timeline-box ol {
  display: grid;
  gap: 8px;
}

.timeline-box li {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
  border-radius: 8px;
  background: var(--surface-raised);
}

.timeline-box em {
  color: var(--color-primary);
  font-style: normal;
  font-weight: 700;
}

.timeline-box div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.timeline-box li.warning {
  border-color: #f59e0b;
}

.empty-detail {
  display: grid;
  place-content: center;
  padding: 36px;
  text-align: center;
}

@media (max-width: 1100px) {
  .trace-metrics,
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trace-layout {
    grid-template-columns: 1fr;
  }
}
</style>
