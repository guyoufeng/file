<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import AiChatPanel from './components/AiChatPanel.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()
const mode = ref<'default' | 'expanded' | 'fullscreen'>('default')
const drawerClass = computed(() => `drawer-panel ${mode.value}`)
const windowRect = ref({ x: Math.max(window.innerWidth - 430, 900), y: 92, width: 400, height: 560 })
const windowStyle = computed(() => mode.value === 'fullscreen'
  ? { left: '252px', top: '78px', width: 'calc(100vw - 276px)', height: 'calc(100vh - 102px)' }
  : { left: `${windowRect.value.x}px`, top: `${windowRect.value.y}px`, width: `${windowRect.value.width}px`, height: `${windowRect.value.height}px` })
let dragState: { kind: 'move' | 'resize'; startX: number; startY: number; rect: typeof windowRect.value } | null = null

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
})

onBeforeUnmount(() => {
  stopPointerTracking()
})

function setMode(nextMode: 'default' | 'expanded' | 'fullscreen') {
  mode.value = nextMode
  if (nextMode === 'expanded') {
    windowRect.value = { ...windowRect.value, width: 760, height: 720 }
  }
  if (nextMode === 'default') {
    windowRect.value = { ...windowRect.value, width: 400, height: 560 }
  }
  clampWindow()
}

function startMove(event: PointerEvent) {
  if (mode.value === 'fullscreen') return
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  dragState = { kind: 'move', startX: event.clientX, startY: event.clientY, rect: { ...windowRect.value } }
  startPointerTracking()
}

function startResize(event: PointerEvent) {
  if (mode.value === 'fullscreen') return
  event.stopPropagation()
  dragState = { kind: 'resize', startX: event.clientX, startY: event.clientY, rect: { ...windowRect.value } }
  startPointerTracking()
}

function startPointerTracking() {
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopPointerTracking, { once: true })
}

function stopPointerTracking() {
  window.removeEventListener('pointermove', handlePointerMove)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (dragState.kind === 'move') {
    windowRect.value = { ...dragState.rect, x: dragState.rect.x + dx, y: dragState.rect.y + dy }
  } else {
    windowRect.value = {
      ...dragState.rect,
      width: Math.max(360, dragState.rect.width + dx),
      height: Math.max(460, dragState.rect.height + dy),
    }
  }
  clampWindow()
}

function clampWindow() {
  const margin = 12
  windowRect.value = {
    ...windowRect.value,
    x: Math.min(Math.max(252, windowRect.value.x), Math.max(252, window.innerWidth - windowRect.value.width - margin)),
    y: Math.min(Math.max(76, windowRect.value.y), Math.max(76, window.innerHeight - 140)),
  }
}
</script>

<template>
  <aside v-if="open" :class="drawerClass" :style="windowStyle" data-testid="ai-floating-window">
      <header @pointerdown="startMove">
        <div>
          <p class="eyebrow">AI 助手</p>
          <h3>只读智能查询</h3>
        </div>
        <div class="actions">
          <button type="button" :class="{ active: mode === 'default' }" @click="setMode('default')">窄窗</button>
          <button type="button" :class="{ active: mode === 'expanded' }" @click="setMode('expanded')">宽窗</button>
          <button type="button" :class="{ active: mode === 'fullscreen' }" @click="setMode('fullscreen')">全屏</button>
          <button type="button" @click="emit('close')">关闭</button>
        </div>
      </header>
      <p class="hint">第一版 AI 只读取本地资产、机柜和告警数据，不执行新增、修改或删除。</p>
      <AiChatPanel
        :rooms="roomStore.rooms"
        :racks="roomStore.racks"
        :devices="assetStore.devices"
        :alerts="alertStore.alerts"
      />
    <span class="resize-handle" aria-hidden="true" @pointerdown="startResize" />
  </aside>
</template>

<style scoped>
.drawer-panel {
  position: fixed;
  z-index: 60;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 8px;
  background:
    radial-gradient(circle at 20% 0%, rgba(14, 165, 233, 0.18), transparent 34%),
    rgba(8, 17, 31, 0.96);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(14, 165, 233, 0.08);
  backdrop-filter: blur(16px);
}

header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
  user-select: none;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3,
.hint {
  margin: 0;
}

.hint {
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: end;
}

button {
  min-height: 30px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

button.active {
  border-color: rgba(56, 189, 248, 0.72);
  background: rgba(14, 165, 233, 0.16);
}

.resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 20px;
  height: 20px;
  border-right: 2px solid rgba(56, 189, 248, 0.74);
  border-bottom: 2px solid rgba(56, 189, 248, 0.74);
  cursor: nwse-resize;
}
</style>
