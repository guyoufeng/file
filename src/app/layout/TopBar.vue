<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const emit = defineEmits<{
  openAi: []
}>()

const currentTime = ref(formatTime(new Date()))
const timer = window.setInterval(() => {
  currentTime.value = formatTime(new Date())
}, 1000)

onBeforeUnmount(() => {
  window.clearInterval(timer)
})

function formatTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <header class="top-bar">
    <div>
      <p class="eyebrow">v0.1 Foundation</p>
      <h1>数据中心运维控制台</h1>
    </div>
    <div class="status-group">
      <span data-testid="app-clock" class="clock">{{ currentTime }}</span>
      <button type="button" class="ai-icon-button" aria-label="打开 AI 助手" @click="emit('openAi')">
        <span>AI</span>
      </button>
      <button type="button" data-testid="current-user" class="user-button">admin</button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(8, 17, 31, 0.92);
}

.eyebrow {
  margin: 0 0 2px;
  color: #38bdf8;
  font-size: 12px;
}

h1 {
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.clock,
.user-button,
.ai-icon-button {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
}

.clock {
  padding: 6px 10px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}

.user-button {
  min-height: 32px;
  padding: 0 13px;
  color: #e0f2fe;
  cursor: pointer;
}

.ai-icon-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  color: #e0f2fe;
  background:
    radial-gradient(circle at 30% 18%, rgba(125, 211, 252, 0.52), transparent 34%),
    linear-gradient(135deg, rgba(14, 165, 233, 0.88), rgba(37, 99, 235, 0.82));
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22);
  cursor: pointer;
}

.ai-icon-button span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}
</style>
