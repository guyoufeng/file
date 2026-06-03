<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore'

const emit = defineEmits<{
  openAi: []
}>()

const router = useRouter()
const authStore = useAuthStore()
const userMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const currentTime = ref(formatTime(new Date()))
const timer = window.setInterval(() => {
  currentTime.value = formatTime(new Date())
}, 1000)

onBeforeUnmount(() => {
  window.clearInterval(timer)
  document.removeEventListener('pointerdown', closeUserMenuWhenOutside, true)
})

onMounted(() => {
  document.addEventListener('pointerdown', closeUserMenuWhenOutside, true)
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

async function logout() {
  authStore.logout()
  userMenuOpen.value = false
  await router.replace('/login')
}

function closeUserMenuWhenOutside(event: PointerEvent) {
  if (!userMenuOpen.value) return
  const target = event.target as Node | null
  if (!target || userMenuRef.value?.contains(target)) return
  userMenuOpen.value = false
}
</script>

<template>
  <header class="top-bar">
    <div>
      <h1>泉峰AI数据中心运维控制台</h1>
      <p class="eyebrow">v0.1.0</p>
    </div>
    <div class="status-group">
      <span data-testid="app-clock" class="clock">{{ currentTime }}</span>
      <button type="button" class="ai-icon-button" aria-label="打开 AI助手" @click="emit('openAi')">
        <span>AI助手</span>
      </button>
      <div ref="userMenuRef" class="user-menu">
        <button
          type="button"
          data-testid="current-user"
          class="user-button"
          @click="userMenuOpen = !userMenuOpen"
        >
          {{ authStore.session?.username || "未登录" }}
        </button>
        <div v-if="userMenuOpen" class="user-popover">
          <strong>{{ authStore.session?.displayName }}</strong>
          <span>{{ authStore.session?.role === "admin" ? "管理员" : "普通/只读账号" }}</span>
          <button type="button" @click="logout">退出登录</button>
        </div>
      </div>
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
  background: var(--surface-glass);
  box-shadow: var(--shadow-soft);
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
  background: var(--color-panel);
}

.clock {
  padding: 6px 10px;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.user-button {
  min-height: 32px;
  padding: 0 13px;
  color: var(--color-text);
  cursor: pointer;
}

.user-menu {
  position: relative;
}

.user-popover {
  position: absolute;
  top: 42px;
  right: 0;
  z-index: 40;
  width: 178px;
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  box-shadow: var(--shadow-soft);
}

.user-popover strong {
  color: var(--color-text);
}

.user-popover span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.user-popover button {
  min-height: 30px;
  border: 1px solid rgba(14, 165, 233, 0.42);
  border-radius: 8px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  cursor: pointer;
}

.ai-icon-button {
  min-width: 74px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0 14px;
  color: #e0f2fe;
  background:
    radial-gradient(circle at 30% 18%, rgba(125, 211, 252, 0.52), transparent 34%),
    linear-gradient(135deg, rgba(14, 165, 233, 0.88), rgba(37, 99, 235, 0.82));
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22);
  cursor: pointer;
}

.ai-icon-button span {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}
</style>
