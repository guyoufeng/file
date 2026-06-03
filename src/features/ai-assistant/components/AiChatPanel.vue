<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Alert, Device, Rack, Room } from "../../../types/domain";
import type { AiNavigationTarget } from "../../../types/aiNavigation";
import { runQfAiAgent } from "../../../services/ai/agentRuntime";
import { recordAiAgentToolCall } from "../../../services/ai/agentAudit";
import {
  buildAiAgentEvents,
} from "../../../services/ai/agentEvents";
import { answerAgentControlMessage } from "../../../services/ai/agentNaturalLanguageCommands";
import { writeAiAuditLog } from "../../../services/backend/ai";
import { exportProjectJson } from "../../../services/backend/data";
import {
  loadAgentReadonlyTools,
  loadAgentReadonlyContext,
  syncAgentReadonlySnapshot,
} from "../../../services/agent/apiClient";
import { useAiStore } from "../../../stores/aiStore";
import { qfDcimSkills } from "../../../services/ai/agentProfile";
import { getAgentMemories } from "../../../services/ai/agentMemory";
import {
  summarizeAgentAttachment,
  type AgentAttachmentSummary,
} from "../../../services/ai/agentAttachments";
import {
  buildLiveAgentTimeline,
  saveAgentRunRecord,
  type TimedAiAgentEvent,
} from "../../../services/ai/agentRunStore";
import AiAnswerCard from "./AiAnswerCard.vue";
import { getAccessRecords } from "../../access-management/accessRecords";
import { getChangeEvents } from "../../change-management/changeEvents";
import { getConnectionRecords } from "../../connection-manager/connections";

const props = defineProps<{
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
}>();

const emit = defineEmits<{
  locate: [target: AiNavigationTarget];
}>();

interface ChatAnswer {
  id: string;
  question: string;
  content: string;
  toolName: string;
  usedModel?: string;
  fallbackReason?: string;
  dataSource: string;
  events: TimedAiAgentEvent[];
  target?: AiNavigationTarget;
  attachments?: ChatAttachment[];
}

type ChatAttachment = AgentAttachmentSummary;

interface ChatSession {
  id: string;
  title: string;
  answers: ChatAnswer[];
  updatedAt: string;
}

const storageKey = "qf-ai-assistant-sessions";

const aiStore = useAiStore();
const question = ref("");
const sessions = ref<ChatSession[]>([]);
const activeSessionId = ref("");
const asking = ref(false);
const runningQuestion = ref("");
const runningStartedAt = ref("");
const runningEvents = ref<TimedAiAgentEvent[]>([]);
let runningTimer: number | undefined;
const messageListRef = ref<HTMLElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const pendingAttachments = ref<ChatAttachment[]>([]);
const pendingSubmission = ref<{
  question: string;
  attachments: ChatAttachment[];
} | null>(null);
const queuedSubmissions = ref<Array<{ question: string; attachments: ChatAttachment[] }>>([]);
const guidanceNotes = ref<string[]>([]);
const activeSession = computed(() =>
  sessions.value.find((session) => session.id === activeSessionId.value),
);
const answers = computed(() => activeSession.value?.answers ?? []);
const runningElapsedLabel = computed(
  () => runningEvents.value.at(-1)?.durationLabel ?? "0秒",
);

onMounted(() => {
  void aiStore.loadConfigs();
  loadSessions();
});

onUnmounted(() => {
  stopThinkingTimeline();
});

watch(
  sessions,
  () => {
    localStorage.setItem(storageKey, JSON.stringify(sessions.value));
  },
  { deep: true },
);

async function ask() {
  if (!question.value.trim()) return;
  const nextQuestion = question.value.trim();
  const nextAttachments = [...pendingAttachments.value];
  if (asking.value) {
    pendingSubmission.value = {
      question: nextQuestion,
      attachments: nextAttachments,
    };
    question.value = "";
    pendingAttachments.value = [];
    return;
  }
  await processQuestion(nextQuestion, nextAttachments);
}

async function processQuestion(currentQuestion: string, currentAttachments: ChatAttachment[]) {
  if (!activeSession.value) createSession();

  asking.value = true;
  const startedAt = new Date();
  startThinkingTimeline(currentQuestion, startedAt.toISOString());
  try {
    const commandAnswer = await answerLocalAgentCommand(currentQuestion);
    if (commandAnswer) {
      const endedAt = new Date();
      const eventInput = {
        question: currentQuestion,
        toolName: commandAnswer.toolName,
        answer: commandAnswer.answer,
        dataSource: "只读 Agent API 工具清单",
      } as const;
      const runRecord = saveAgentRunRecord({
        sessionId: activeSessionId.value,
        question: currentQuestion,
        answer: commandAnswer.answer,
        toolName: commandAnswer.toolName,
        dataSource: "只读 Agent API 工具清单",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        events: buildAiAgentEvents(eventInput),
        attachments: compactAttachmentsForStorage(currentAttachments),
      });
      answers.value.push({
        id: `${Date.now()}-${answers.value.length}`,
        question: currentQuestion,
        content: commandAnswer.answer,
        toolName: commandAnswer.toolName,
        dataSource: "只读 Agent API 工具清单",
        events: runRecord.events,
        attachments: compactAttachmentsForStorage(currentAttachments),
      });
      updateActiveSession(currentQuestion);
      question.value = "";
      pendingAttachments.value = [];
      await scrollToLatestMessage();
      recordAiAgentToolCall({
        toolName: commandAnswer.toolName,
        question: currentQuestion,
        source: "只读 Agent API 工具清单",
        answer: commandAnswer.answer,
        startedAt: startedAt.getTime(),
        status: "success",
      });
      writeAiAuditLog({
        question: currentQuestion,
        tools: [commandAnswer.toolName],
        answerSummary: commandAnswer.answer.split("\n").slice(0, 2).join(" / "),
        status: "success",
      });
      return;
    }

    const agentContext = await loadContextForAgent();
    const result = await runQfAiAgent({
      question: currentQuestion,
      configs: aiStore.configs,
      rooms: agentContext.rooms,
      racks: agentContext.racks,
      devices: agentContext.devices,
      alerts: agentContext.alerts,
      auditLogs: agentContext.auditLogs,
      accessRecords: agentContext.accessRecords,
      changeEvents: agentContext.changeEvents,
      connectionRecords: agentContext.connectionRecords,
      dataSource: agentContext.dataSource,
      memories: [
        ...getAgentMemories().map((memory) => memory.content),
        ...guidanceNotes.value.map((note) => `会话引导：${note}`),
      ],
      attachments: compactAttachmentsForStorage(currentAttachments),
    });
    const endedAt = new Date();
    const target = buildNavigationTarget(result);
    const runRecord = saveAgentRunRecord({
      sessionId: activeSessionId.value,
      question: currentQuestion,
      answer: result.answer,
      toolName: result.toolName,
      dataSource: agentContext.dataSource,
      usedModel: result.usedModel,
      fallbackReason: result.fallbackReason,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      events: result.events,
      target,
      attachments: compactAttachmentsForStorage(currentAttachments),
    });
    answers.value.push({
      id: `${Date.now()}-${answers.value.length}`,
      question: currentQuestion,
      content: result.answer,
      toolName: result.toolName,
      usedModel: result.usedModel,
      fallbackReason: result.fallbackReason,
      dataSource: agentContext.dataSource,
      events: runRecord.events,
      target,
      attachments: currentAttachments,
    });
    updateActiveSession(currentQuestion);
    question.value = "";
    pendingAttachments.value = [];
    await scrollToLatestMessage();
    recordAiAgentToolCall({
      toolName: result.toolName,
      question: currentQuestion,
      source: agentContext.dataSource,
      answer: result.answer,
      startedAt: startedAt.getTime(),
      status: result.fallbackReason ? "failed" : "success",
      errorMessage: result.fallbackReason,
      plan: {
        planner: result.plan.planner,
        reason: result.plan.reason,
      },
      eventCount: result.events.length,
    });
    writeAiAuditLog({
      question: currentQuestion,
      tools: [result.toolName],
      answerSummary: result.answer.split("\n").slice(0, 2).join(" / "),
      relatedDeviceId: result.relatedDeviceId,
      relatedRackId: result.relatedRackId,
      relatedRoomId: result.relatedRoomId,
      status: "success",
    });
  } finally {
    asking.value = false;
    stopThinkingTimeline();
    const next = queuedSubmissions.value.shift();
    if (next) {
      await processQuestion(next.question, next.attachments);
    }
  }
}

function guideRunningAnswer() {
  if (!pendingSubmission.value) return;
  guidanceNotes.value.push(pendingSubmission.value.question);
  queuedSubmissions.value.unshift({
    question: `补充引导：${pendingSubmission.value.question}\n请结合上一轮上下文继续处理。`,
    attachments: pendingSubmission.value.attachments,
  });
  pendingSubmission.value = null;
}

function queuePendingQuestion() {
  if (!pendingSubmission.value) return;
  queuedSubmissions.value.push(pendingSubmission.value);
  pendingSubmission.value = null;
}

async function answerLocalAgentCommand(questionText: string) {
  return answerAgentControlMessage(questionText, loadAgentReadonlyTools);
}

function pickImages() {
  imageInputRef.value?.click();
}

function pickFiles() {
  fileInputRef.value?.click();
}

async function handleAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  const summaries = await Promise.all(files.map((file) => summarizeAgentAttachment(file)));
  pendingAttachments.value = [...pendingAttachments.value, ...summaries].slice(0, 8);
  input.value = "";
}

function removeAttachment(index: number) {
  pendingAttachments.value.splice(index, 1);
}

function updateActiveSession(titleSeed: string) {
  if (!activeSession.value) return;
  activeSession.value.title =
    activeSession.value.title === "新的会话"
      ? titleSeed.slice(0, 18)
      : activeSession.value.title;
  activeSession.value.updatedAt = new Date().toISOString();
}

async function loadContextForAgent() {
  try {
    const project = await exportProjectJson();
    const snapshotProject = {
      ...project,
      data: {
        ...project.data,
        changeEvents: getChangeEvents(),
        connectionRecords: getConnectionRecords(),
      },
    };
    await syncAgentReadonlySnapshot(snapshotProject);
    return await loadAgentReadonlyContext();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "API 不可用";
    return {
      rooms: props.rooms,
      racks: props.racks,
      devices: props.devices,
      alerts: props.alerts,
      auditLogs: [],
      accessRecords: getAccessRecords(),
      changeEvents: getChangeEvents(),
      connectionRecords: getConnectionRecords(),
      dataSource: `页面状态（${reason}）`,
    };
  }
}

function loadSessions() {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as ChatSession[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        sessions.value = parsed;
        activeSessionId.value = parsed[0].id;
        return;
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }
  createSession();
}

function createSession() {
  const session: ChatSession = {
    id: `session-${Date.now()}`,
    title: "新的会话",
    answers: [],
    updatedAt: new Date().toISOString(),
  };
  sessions.value.unshift(session);
  activeSessionId.value = session.id;
}

async function scrollToLatestMessage() {
  await nextTick();
  if (!messageListRef.value) return;
  messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
}

function startThinkingTimeline(questionText: string, startedAt: string) {
  runningQuestion.value = questionText;
  runningStartedAt.value = startedAt;
  refreshThinkingTimeline();
  if (runningTimer) window.clearInterval(runningTimer);
  runningTimer = window.setInterval(() => {
    refreshThinkingTimeline();
    void scrollToLatestMessage();
  }, 1000);
  void scrollToLatestMessage();
}

function refreshThinkingTimeline() {
  if (!runningStartedAt.value) return;
  runningEvents.value = buildLiveAgentTimeline(
    runningQuestion.value,
    runningStartedAt.value,
  );
}

function stopThinkingTimeline() {
  if (runningTimer) {
    window.clearInterval(runningTimer);
    runningTimer = undefined;
  }
  runningQuestion.value = "";
  runningStartedAt.value = "";
  runningEvents.value = [];
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  void ask();
}

function buildNavigationTarget(result: {
  relatedRoomId?: string;
  relatedRackId?: string;
  relatedDeviceId?: string;
}): AiNavigationTarget | undefined {
  if (!result.relatedRoomId && !result.relatedRackId && !result.relatedDeviceId)
    return undefined;

  return {
    roomId: result.relatedRoomId,
    rackId: result.relatedRackId,
    deviceId: result.relatedDeviceId,
  };
}

function compactAttachmentsForStorage(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    imagePreviewDataUrl: undefined,
    extractedText: attachment.extractedText?.slice(0, 1600),
  }));
}
</script>

<template>
  <div class="chat-panel">
    <div class="session-bar">
      <select v-model="activeSessionId" aria-label="AI会话">
        <option
          v-for="session in sessions"
          :key="session.id"
          :value="session.id"
        >
          {{ session.title }}
        </option>
      </select>
      <button type="button" @click="createSession">新会话</button>
    </div>
    <div
      ref="messageListRef"
      class="message-list"
      data-testid="ai-message-list"
    >
      <div v-if="answers.length === 0" class="welcome-message">
        <strong>我可以查询资产、虚拟服务器、机柜位置、当前告警和审计记录。</strong>
        <span>实时天气、新闻和联网搜索需要后续启用外网辅助 Skill。</span>
        <div class="skill-row" aria-label="AI Skill 列表">
          <small v-for="skill in qfDcimSkills" :key="skill.name">
            {{ skill.name }}
          </small>
        </div>
      </div>
      <div v-for="answer in answers" :key="answer.id" class="answer-item">
        <div class="question-bubble">{{ answer.question }}</div>
        <div v-if="answer.attachments?.length" class="attachment-list">
          <small v-for="item in answer.attachments" :key="item.name">
            {{ item.name }}
          </small>
        </div>
        <details class="agent-events">
          <summary>
            Agent 轨迹
            <span>{{ answer.toolName }}</span>
            <small>{{ answer.dataSource }}</small>
            <small v-if="answer.fallbackReason">{{ answer.fallbackReason }}</small>
          </summary>
          <ol>
            <li
              v-for="event in answer.events"
              :key="event.id"
              :class="event.status"
            >
              <strong>{{ event.label }}</strong>
              <span>{{ event.detail }}</span>
              <em>{{ event.durationLabel }}</em>
            </li>
          </ol>
        </details>
        <AiAnswerCard :answer="answer.content" />
        <button
          v-if="answer.target"
          type="button"
          class="locate-button"
          @click="emit('locate', answer.target)"
        >
          定位到机柜/设备
        </button>
      </div>
      <div v-if="asking && runningEvents.length" class="answer-item pending-answer">
        <div class="question-bubble">{{ runningQuestion }}</div>
        <details class="agent-events live-events">
          <summary>
            思考中
            <span>Agent 正在处理</span>
            <small>{{ runningElapsedLabel }}</small>
          </summary>
          <ol>
            <li
              v-for="event in runningEvents"
              :key="event.id"
              :class="event.status"
            >
              <strong>{{ event.label }}</strong>
              <span>{{ event.detail }}</span>
              <em>{{ event.durationLabel }}</em>
            </li>
          </ol>
        </details>
      </div>
    </div>
    <form class="composer" data-testid="ai-composer" @submit.prevent="ask">
      <div v-if="pendingSubmission" class="pending-choice">
        <strong>上一条还在处理，这条消息怎么处理？</strong>
        <span>{{ pendingSubmission.question }}</span>
        <div>
          <button type="button" @click="guideRunningAnswer">引导当前任务</button>
          <button type="button" @click="queuePendingQuestion">等待后发送</button>
        </div>
      </div>
      <div v-if="pendingAttachments.length" class="attachment-list pending">
        <small v-for="(item, index) in pendingAttachments" :key="`${item.name}-${index}`">
          {{ item.name }} · {{ item.status === "ready" ? item.sizeLabel : item.error }}
          <button type="button" aria-label="移除附件" @click="removeAttachment(index)">×</button>
        </small>
      </div>
      <textarea
        v-model="question"
        rows="2"
        placeholder="输入问题，按 Enter 发送，Shift+Enter 换行"
        @keydown="handleComposerKeydown"
      />
      <div class="composer-actions">
        <input
          ref="imageInputRef"
          class="hidden-input"
          type="file"
          accept="image/*"
          multiple
          @change="handleAttachmentChange"
        />
        <input
          ref="fileInputRef"
          class="hidden-input"
          type="file"
          multiple
          @change="handleAttachmentChange"
        />
        <button type="button" class="tool-button" aria-label="添加图片" @click="pickImages">
          图片
        </button>
        <button type="button" class="tool-button" aria-label="添加附件" @click="pickFiles">
          附件
        </button>
        <button type="submit" class="send-button">
          {{ asking ? "继续发送" : "发送" }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.session-bar select,
.session-bar button {
  min-height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.84);
}

.session-bar select {
  min-width: 0;
  padding: 0 9px;
}

.session-bar button {
  padding: 0 10px;
  cursor: pointer;
}

.message-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 4px 2px;
}

.welcome-message {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(15, 23, 42, 0.72);
}

.welcome-message strong {
  color: var(--color-text);
  font-size: 13px;
}

.skill-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-row small {
  padding: 3px 7px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 999px;
  color: #bae6fd;
  background: rgba(14, 165, 233, 0.1);
}

.composer {
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.74);
}

textarea {
  width: 100%;
  resize: none;
  padding: 8px 9px;
  border: 0;
  outline: none;
  color: var(--color-text);
  background: transparent;
  line-height: 1.55;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hidden-input {
  display: none;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attachment-list small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 180px;
  padding: 4px 7px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 999px;
  color: #bfdbfe;
  background: rgba(14, 165, 233, 0.1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-list.pending {
  padding-bottom: 2px;
}

.attachment-list button {
  border: 0;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}

.tool-button,
.send-button {
  min-height: 30px;
  border: 1px solid rgba(14, 165, 233, 0.7);
  border-radius: 8px;
  color: var(--color-text);
  cursor: pointer;
}

.tool-button {
  padding: 0 10px;
  border-color: var(--color-border);
  color: var(--color-text-muted);
  background: rgba(15, 23, 42, 0.84);
}

.send-button {
  margin-left: auto;
  padding: 0 14px;
  background: rgba(14, 165, 233, 0.18);
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.pending-choice {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(245, 158, 11, 0.34);
  border-radius: 8px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
}

.pending-choice span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pending-choice div {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.pending-choice button {
  min-height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-panel);
  cursor: pointer;
}

.answer-item {
  display: grid;
  gap: 8px;
}

.question-bubble {
  justify-self: end;
  max-width: 88%;
  padding: 9px 11px;
  border: 1px solid rgba(14, 165, 233, 0.32);
  border-radius: 8px;
  color: #e0f2fe;
  background: rgba(14, 165, 233, 0.12);
  line-height: 1.55;
}

.agent-events {
  justify-self: start;
  width: min(100%, 520px);
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.62);
}

.agent-events summary {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  color: #dbeafe;
  cursor: pointer;
  font-size: 12px;
}

.agent-events summary span,
.agent-events summary small {
  color: var(--color-text-muted);
}

.agent-events ol {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 8px 10px 10px 28px;
  border-top: 1px solid rgba(56, 189, 248, 0.12);
}

.agent-events li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 6px;
  align-items: start;
  color: var(--color-text-muted);
  font-size: 12px;
}

.agent-events li.warning {
  color: #fde68a;
}

.agent-events li strong {
  color: #bae6fd;
}

.agent-events li span {
  min-width: 0;
}

.agent-events li em {
  color: #7dd3fc;
  font-style: normal;
  white-space: nowrap;
}

.live-events {
  border-color: rgba(14, 165, 233, 0.34);
  box-shadow: 0 14px 32px rgba(14, 165, 233, 0.1);
}

.live-events li.pending strong {
  color: #e0f2fe;
}

.locate-button {
  justify-self: start;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(56, 189, 248, 0.46);
  border-radius: 8px;
  color: #dff7ff;
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.24), rgba(37, 99, 235, 0.16)),
    rgba(8, 17, 31, 0.9);
  box-shadow: 0 10px 24px rgba(14, 165, 233, 0.12);
  cursor: pointer;
}
</style>
