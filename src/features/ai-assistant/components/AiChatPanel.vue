<script setup lang="ts">
import { ref } from 'vue'
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import { runDeterministicAiQuery } from '../../../services/ai/aiTools'
import { writeAiAuditLog } from '../../../services/backend/ai'
import AiAnswerCard from './AiAnswerCard.vue'

const props = defineProps<{
  rooms: Room[]
  racks: Rack[]
  devices: Device[]
  alerts: Alert[]
}>()

const question = ref('IP 为 10.10.3.31 的服务器在哪里？')
const answers = ref<string[]>([])

function ask() {
  const result = runDeterministicAiQuery(question.value, props.rooms, props.racks, props.devices, props.alerts)
  answers.value.unshift(result.answer)
  writeAiAuditLog({
    question: question.value,
    tools: [result.toolName],
    answerSummary: result.answer.split('\n').slice(0, 2).join(' / '),
    relatedDeviceId: result.relatedDeviceId,
    relatedRackId: result.relatedRackId,
    relatedRoomId: result.relatedRoomId,
    status: 'success',
  })
}
</script>

<template>
  <div class="chat-panel">
    <div class="message-list" data-testid="ai-message-list">
      <div v-if="answers.length === 0" class="welcome-message">
        <strong>我可以查询资产、机柜位置和当前告警。</strong>
        <span>例如：IP 为 10.10.0.21 的服务器在哪里？</span>
      </div>
      <AiAnswerCard v-for="answer in answers" :key="answer" :answer="answer" />
    </div>
    <form class="composer" data-testid="ai-composer" @submit.prevent="ask">
      <textarea v-model="question" rows="2" placeholder="例如：IP 为 10.10.3.25 的服务器在哪里？" />
      <div class="composer-actions">
        <button type="button" class="tool-button" aria-label="添加图片">图片</button>
        <button type="button" class="tool-button" aria-label="添加附件">附件</button>
        <button type="submit" class="send-button">发送查询</button>
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
</style>
