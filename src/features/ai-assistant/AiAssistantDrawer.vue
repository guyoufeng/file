<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAlertStore } from "../../stores/alertStore";
import { useAiStore } from "../../stores/aiStore";
import { useAssetStore } from "../../stores/assetStore";
import { useRoomStore } from "../../stores/roomStore";
import type { AiNavigationTarget } from "../../types/aiNavigation";
import AiChatPanel from "./components/AiChatPanel.vue";

const props = defineProps<{
  open: boolean;
  restoreToken?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const roomStore = useRoomStore();
const assetStore = useAssetStore();
const alertStore = useAlertStore();
const aiStore = useAiStore();
const router = useRouter();
const mode = ref<"default" | "expanded" | "fullscreen">("default");
const minimized = ref(false);
const panelRef = ref<HTMLElement | null>(null);
const drawerClass = computed(() => `drawer-panel ${mode.value}`);
const currentModelLabel = computed(() => {
  const config =
    aiStore.configs.find((item) => item.enabled) ?? aiStore.configs[0];
  return config?.model ?? "未配置模型";
});
const windowRect = ref({
  x: Math.max(252, window.innerWidth - 430),
  y: 92,
  width: 400,
  height: 560,
});
const windowStyle = computed(() =>
  mode.value === "fullscreen"
    ? {
        left: "252px",
        top: "78px",
        width: "calc(100vw - 276px)",
        height: "calc(100vh - 102px)",
      }
    : {
        left: `${windowRect.value.x}px`,
        top: `${windowRect.value.y}px`,
        width: `${windowRect.value.width}px`,
        height: `${windowRect.value.height}px`,
      },
);
let dragState: {
  kind: "move" | "resize";
  startX: number;
  startY: number;
  rect: typeof windowRect.value;
} | null = null;

onMounted(async () => {
  await Promise.all([
    roomStore.loadRooms(),
    assetStore.loadDevices(),
    alertStore.loadAlerts(),
    aiStore.loadConfigs(),
  ]);
  clampWindow();
  window.addEventListener("pointerdown", handleOutsidePointerDown);
});

onBeforeUnmount(() => {
  stopPointerTracking();
  window.removeEventListener("pointerdown", handleOutsidePointerDown);
});

watch(
  () => props.restoreToken,
  () => {
    minimized.value = false;
  },
);

watch(
  () => props.open,
  (open) => {
    if (open) minimized.value = false;
  },
);

function setMode(nextMode: "default" | "expanded" | "fullscreen") {
  mode.value = nextMode;
  if (nextMode === "expanded") {
    windowRect.value = { ...windowRect.value, width: 760, height: 720 };
  }
  if (nextMode === "default") {
    windowRect.value = { ...windowRect.value, width: 400, height: 560 };
  }
  clampWindow();
}

function startMove(event: PointerEvent) {
  if (mode.value === "fullscreen") return;
  const target = event.target as HTMLElement;
  if (target.closest("button")) return;
  dragState = {
    kind: "move",
    startX: event.clientX,
    startY: event.clientY,
    rect: { ...windowRect.value },
  };
  startPointerTracking();
}

function startResize(event: PointerEvent) {
  if (mode.value === "fullscreen") return;
  event.stopPropagation();
  dragState = {
    kind: "resize",
    startX: event.clientX,
    startY: event.clientY,
    rect: { ...windowRect.value },
  };
  startPointerTracking();
}

function startPointerTracking() {
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopPointerTracking, { once: true });
}

function stopPointerTracking() {
  window.removeEventListener("pointermove", handlePointerMove);
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (dragState.kind === "move") {
    windowRect.value = {
      ...dragState.rect,
      x: dragState.rect.x + dx,
      y: dragState.rect.y + dy,
    };
  } else {
    windowRect.value = {
      ...dragState.rect,
      width: Math.max(360, dragState.rect.width + dx),
      height: Math.max(460, dragState.rect.height + dy),
    };
  }
  clampWindow();
}

function clampWindow() {
  const margin = 12;
  const minLeft = window.innerWidth < 760 ? margin : 252;
  const maxWidth = Math.max(360, window.innerWidth - minLeft - margin);
  windowRect.value = {
    ...windowRect.value,
    width: Math.min(windowRect.value.width, maxWidth),
    x: Math.min(
      Math.max(minLeft, windowRect.value.x),
      Math.max(minLeft, window.innerWidth - windowRect.value.width - margin),
    ),
    y: Math.min(
      Math.max(76, windowRect.value.y),
      Math.max(76, window.innerHeight - 140),
    ),
  };
}

async function locateTarget(target: AiNavigationTarget) {
  await router.push({
    path: "/rack-overview",
    query: {
      ...(target.roomId ? { roomId: target.roomId } : {}),
      ...(target.rackId ? { rackId: target.rackId } : {}),
      ...(target.deviceId ? { deviceId: target.deviceId } : {}),
      focus: Date.now().toString(),
      view: "u-view",
    },
  });
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!props.open || minimized.value) return;
  const target = event.target as HTMLElement;
  if (panelRef.value?.contains(target)) return;
  if (target.closest(".ai-icon-button")) return;
  minimized.value = true;
}
</script>

<template>
  <button
    v-if="open && minimized"
    type="button"
    class="ai-minimized-pill"
    @click="minimized = false"
  >
    AI助手{{ currentModelLabel ? " · 已最小化" : "" }}
  </button>
  <aside
    v-if="open && !minimized"
    ref="panelRef"
    :class="drawerClass"
    :style="windowStyle"
    data-testid="ai-floating-window"
  >
    <header @pointerdown="startMove">
      <div>
        <h3>AI 助手</h3>
        <p class="eyebrow">当前模型：{{ currentModelLabel }}</p>
      </div>
      <div class="actions">
        <button
          type="button"
          :class="{ active: mode === 'default' }"
          @click="setMode('default')"
        >
          窄窗
        </button>
        <button
          type="button"
          :class="{ active: mode === 'expanded' }"
          @click="setMode('expanded')"
        >
          宽窗
        </button>
        <button
          type="button"
          :class="{ active: mode === 'fullscreen' }"
          @click="setMode('fullscreen')"
        >
          全屏
        </button>
        <button type="button" @click="emit('close')">关闭</button>
      </div>
    </header>
    <AiChatPanel
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      :alerts="alertStore.alerts"
      @locate="locateTarget"
    />
    <span class="resize-handle" aria-hidden="true" @pointerdown="startResize" />
  </aside>
</template>

<style scoped>
.drawer-panel {
  position: fixed;
  z-index: 60;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 8px;
  background:
    radial-gradient(
      circle at 20% 0%,
      rgba(14, 165, 233, 0.18),
      transparent 34%
    ),
    rgba(8, 17, 31, 0.96);
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(14, 165, 233, 0.08);
  backdrop-filter: blur(16px);
}

header {
  flex: 0 0 auto;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
  user-select: none;
}

.eyebrow {
  margin: 5px 0 0;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
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

.ai-minimized-pill {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 60;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid rgba(56, 189, 248, 0.42);
  border-radius: 999px;
  color: #e0f2fe;
  background:
    radial-gradient(circle at 30% 18%, rgba(125, 211, 252, 0.52), transparent 34%),
    linear-gradient(135deg, rgba(14, 165, 233, 0.9), rgba(37, 99, 235, 0.84));
  box-shadow: 0 18px 38px rgba(14, 165, 233, 0.24);
  cursor: pointer;
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
