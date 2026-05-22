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
    <form @submit.prevent="ask">
      <textarea v-model="question" rows="4" placeholder="例如：IP 为 10.10.3.25 的服务器在哪里？" />
      <button type="submit">发送查询</button>
    </form>
    <AiAnswerCard v-for="answer in answers" :key="answer" :answer="answer" />
  </div>
</template>

<style scoped>
.chat-panel {
  display: grid;
  gap: 12px;
}

form {
  display: grid;
  gap: 10px;
}

textarea {
  width: 100%;
  resize: vertical;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.92);
}

button {
  min-height: 36px;
  border: 1px solid rgba(14, 165, 233, 0.7);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.18);
  cursor: pointer;
}
</style>
