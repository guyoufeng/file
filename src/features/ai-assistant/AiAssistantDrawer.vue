<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
})
</script>

<template>
  <div v-if="open" class="ai-drawer">
    <aside :class="drawerClass">
      <header>
        <div>
          <p class="eyebrow">AI 助手</p>
          <h3>只读智能查询</h3>
        </div>
        <div class="actions">
          <button type="button" :class="{ active: mode === 'default' }" @click="mode = 'default'">窄窗</button>
          <button type="button" :class="{ active: mode === 'expanded' }" @click="mode = 'expanded'">宽窗</button>
          <button type="button" :class="{ active: mode === 'fullscreen' }" @click="mode = 'fullscreen'">全屏</button>
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
    </aside>
  </div>
</template>

<style scoped>
.ai-drawer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.36);
}

.drawer-panel {
  width: 420px;
  max-width: 100vw;
  height: 100vh;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  border-left: 1px solid var(--color-border);
  background: #08111f;
}

.drawer-panel.expanded {
  width: 760px;
}

.drawer-panel.fullscreen {
  width: 100vw;
}

header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
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
</style>
