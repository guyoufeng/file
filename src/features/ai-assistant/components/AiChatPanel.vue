<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { Alert, Device, Rack, Room } from "../../../types/domain";
import type { AiNavigationTarget } from "../../../types/aiNavigation";
import { answerWithAiAssistant } from "../../../services/ai/aiAssistant";
import { writeAiAuditLog } from "../../../services/backend/ai";
import { useAiStore } from "../../../stores/aiStore";
import AiAnswerCard from "./AiAnswerCard.vue";

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
  target?: AiNavigationTarget;
}

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
const messageListRef = ref<HTMLElement | null>(null);
const activeSession = computed(() =>
  sessions.value.find((session) => session.id === activeSessionId.value),
);
const answers = computed(() => activeSession.value?.answers ?? []);

onMounted(() => {
  void aiStore.loadConfigs();
  loadSessions();
});

watch(
  sessions,
  () => {
    localStorage.setItem(storageKey, JSON.stringify(sessions.value));
  },
  { deep: true },
);

async function ask() {
  if (!question.value.trim() || asking.value) return;
  if (!activeSession.value) createSession();

  asking.value = true;
  const currentQuestion = question.value;
  try {
    const result = await answerWithAiAssistant({
      question: currentQuestion,
      configs: aiStore.configs,
      rooms: props.rooms,
      racks: props.racks,
      devices: props.devices,
      alerts: props.alerts,
    });
    answers.value.push({
      id: `${Date.now()}-${answers.value.length}`,
      question: currentQuestion,
      content: result.answer,
      target: buildNavigationTarget(result),
    });
    if (activeSession.value) {
      activeSession.value.title =
        activeSession.value.title === "新的会话"
          ? currentQuestion.slice(0, 18)
          : activeSession.value.title;
      activeSession.value.updatedAt = new Date().toISOString();
    }
    question.value = "";
    await scrollToLatestMessage();
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
      </div>
      <div v-for="answer in answers" :key="answer.id" class="answer-item">
        <div class="question-bubble">{{ answer.question }}</div>
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
    </div>
    <form class="composer" data-testid="ai-composer" @submit.prevent="ask">
      <textarea
        v-model="question"
        rows="2"
        placeholder="输入问题，按 Enter 发送，Shift+Enter 换行"
        @keydown="handleComposerKeydown"
      />
      <div class="composer-actions">
        <button type="button" class="tool-button" aria-label="添加图片">
          图片
        </button>
        <button type="button" class="tool-button" aria-label="添加附件">
          附件
        </button>
        <button type="submit" class="send-button" :disabled="asking">
          {{ asking ? "分析中..." : "发送查询" }}
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
