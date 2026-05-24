<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
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
  content: string;
  target?: AiNavigationTarget;
}

const aiStore = useAiStore();
const question = ref("");
const answers = ref<ChatAnswer[]>([]);
const asking = ref(false);
const messageListRef = ref<HTMLElement | null>(null);

onMounted(() => {
  void aiStore.loadConfigs();
});

async function ask() {
  if (!question.value.trim() || asking.value) return;

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
      content: result.answer,
      target: buildNavigationTarget(result),
    });
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
    <div
      ref="messageListRef"
      class="message-list"
      data-testid="ai-message-list"
    >
      <div v-if="answers.length === 0" class="welcome-message">
        <strong>我可以查询资产、机柜位置和当前告警。</strong>
        <span>例如：IP 为 10.10.0.21 的服务器在哪里？</span>
      </div>
      <div v-for="answer in answers" :key="answer.id" class="answer-item">
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
  min-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
