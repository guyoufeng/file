<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ChangeRecord, Device, Rack, Room } from "../../../types/domain";
import { getRackTypeLabel } from "../../../services/rack/rackTypePresentation";
import {
  addDeviceChangeRecord,
  getDeviceChangeRecords,
} from "../assetChangeRecords";
import { getAccessRecords, type AccessRecord } from "../../access-management/accessRecords";
import {
  createChangeEvent,
  getDeviceChangeEvents,
  type ChangeEvent,
} from "../../change-management/changeEvents";
import { getConnectionRecords, type ManagedConnection } from "../../connection-manager/connections";

type DetailTab = "detail" | "relation" | "changes" | "qr";
type TopologyTab = "default" | "custom";

const props = defineProps<{
  open: boolean;
  device: Device | null;
  rack: Rack | null;
  room: Room | null;
  devices: Device[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const activeTab = ref<DetailTab>("detail");
const topologyTab = ref<TopologyTab>("default");
const position = ref({ x: 0, y: 0 });
const windowRef = ref<HTMLElement | null>(null);
const changeRecords = ref<ChangeRecord[]>([]);
const managedChangeEvents = ref<ChangeEvent[]>([]);
const accessRecords = ref<AccessRecord[]>([]);
const connectionRecords = ref<ManagedConnection[]>([]);
const changeForm = ref({
  title: "",
  content: "",
  operator: "admin",
});
let dragState:
  | { startX: number; startY: number; originX: number; originY: number }
  | null = null;

const deviceName = computed(
  () => props.device?.computerName || props.device?.name || "未知设备",
);
const dialogLabel = computed(() => `资产详情 ${deviceName.value}`);
const windowStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}));
const deviceAccessRecords = computed(() => {
  if (!props.device) return [];
  const names = [props.device.id, props.device.computerName, props.device.name]
    .filter(Boolean)
    .map(String);
  return accessRecords.value.filter((record) => {
    if (record.deviceId === props.device?.id) return true;
    return names.some((name) => record.deviceName?.includes(name));
  });
});
const sameRackDevices = computed(() =>
  props.device
    ? props.devices.filter(
        (device) => device.rackId === props.device?.rackId && device.id !== props.device.id,
      )
    : [],
);
const deviceConnections = computed(() => {
  if (!props.device) return [];
  const names = [props.device.id, props.device.computerName, props.device.name]
    .filter(Boolean)
    .map(String);
  return connectionRecords.value.filter((connection) => {
    if (connection.sourceDeviceId === props.device?.id || connection.targetDeviceId === props.device?.id) return true;
    return names.some(
      (name) =>
        connection.sourceDeviceName.includes(name) ||
        connection.targetDeviceName.includes(name),
    );
  });
});
const latestManagedChanges = computed(() => managedChangeEvents.value.slice(0, 3));
const qrCells = computed(() => buildQrCells(JSON.stringify({
  id: props.device?.id,
  name: deviceName.value,
  ip: props.device?.businessIp,
  rack: props.rack?.name,
})));

watch(
  () => props.open,
  (open) => {
    if (!open) {
      document.removeEventListener("pointerdown", closeWhenClickOutside, true);
      return;
    }
    activeTab.value = "detail";
    topologyTab.value = "default";
    position.value = {
      x: Math.max(18, window.innerWidth - 680),
      y: 118,
    };
    loadRecords();
    document.addEventListener("pointerdown", closeWhenClickOutside, true);
  },
);

watch(
  () => props.device?.id,
  () => {
    if (props.open) loadRecords();
  },
);

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", moveWindow);
  window.removeEventListener("pointerup", stopDrag);
  document.removeEventListener("pointerdown", closeWhenClickOutside, true);
});

function loadRecords() {
  if (!props.device) return;
  changeRecords.value = getDeviceChangeRecords(props.device.id);
  managedChangeEvents.value = getDeviceChangeEvents(props.device.id);
  accessRecords.value = getAccessRecords();
  connectionRecords.value = getConnectionRecords();
}

function startDrag(event: PointerEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button")) return;
  dragState = {
    startX: event.clientX,
    startY: event.clientY,
    originX: position.value.x,
    originY: position.value.y,
  };
  window.addEventListener("pointermove", moveWindow);
  window.addEventListener("pointerup", stopDrag);
}

function moveWindow(event: PointerEvent) {
  if (!dragState) return;
  position.value = {
    x: Math.max(10, Math.min(window.innerWidth - 660, dragState.originX + event.clientX - dragState.startX)),
    y: Math.max(10, Math.min(window.innerHeight - 620, dragState.originY + event.clientY - dragState.startY)),
  };
}

function stopDrag() {
  dragState = null;
  window.removeEventListener("pointermove", moveWindow);
  window.removeEventListener("pointerup", stopDrag);
}

function closeWhenClickOutside(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target || windowRef.value?.contains(target)) return;
  emit("close");
}

function saveChangeRecord() {
  if (!props.device || !changeForm.value.title.trim()) return;
  addDeviceChangeRecord({
    deviceId: props.device.id,
    title: changeForm.value.title.trim(),
    content: changeForm.value.content.trim() || "未填写详细内容",
    operator: changeForm.value.operator.trim() || "admin",
    changedAt: new Date().toISOString(),
    source: "manual",
  });
  createChangeEvent({
    title: changeForm.value.title.trim(),
    type: "maintenance",
    status: "completed",
    roomId: props.room?.id,
    roomName: props.room?.name,
    rackId: props.rack?.id,
    rackName: props.rack?.name,
    deviceId: props.device.id,
    deviceName: props.device.computerName || props.device.name,
    businessIp: props.device.businessIp,
    operator: changeForm.value.operator.trim() || "admin",
    changedAt: new Date().toISOString(),
    content: changeForm.value.content.trim() || "未填写详细内容",
    impact: "资产详情录入",
    result: "已记录",
    attachments: [],
  });
  changeForm.value = { title: "", content: "", operator: "admin" };
  loadRecords();
}

function buildQrCells(value: string) {
  const size = 17;
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const inFinder =
      (x < 5 && y < 5) ||
      (x > size - 6 && y < 5) ||
      (x < 5 && y > size - 6);
    if (inFinder) {
      const localX = x < 5 ? x : x - (size - 5);
      const localY = y < 5 ? y : y - (size - 5);
      return localX === 0 || localX === 4 || localY === 0 || localY === 4 || (localX === 2 && localY === 2);
    }
    const bit = (hash >> (index % 24)) & 1;
    hash = Math.imul(hash ^ (index + 31), 1103515245);
    return Boolean(bit);
  });
}
</script>

<template>
  <aside
    v-if="open && device"
    ref="windowRef"
    class="asset-detail-window"
    :style="windowStyle"
    role="dialog"
    :aria-label="dialogLabel"
  >
    <header @pointerdown="startDrag">
      <div>
        <p class="eyebrow">Asset Detail</p>
        <h3>{{ deviceName }}</h3>
        <span>{{ device.businessIp || "无业务IP" }} / {{ rack?.name || "未绑定机柜" }}</span>
      </div>
      <button type="button" @click="emit('close')">关闭</button>
    </header>

    <nav class="detail-tabs" aria-label="资产详情页签">
      <button type="button" :class="{ active: activeTab === 'detail' }" @click="activeTab = 'detail'">详细信息</button>
      <button type="button" :class="{ active: activeTab === 'relation' }" @click="activeTab = 'relation'">实例关系</button>
      <button type="button" :class="{ active: activeTab === 'changes' }" @click="activeTab = 'changes'">变更记录</button>
      <button type="button" :class="{ active: activeTab === 'qr' }" @click="activeTab = 'qr'">二维码</button>
    </nav>
    <div class="topology-shortcuts" aria-label="实例拓扑">
      <button type="button" @click="activeTab = 'relation'; topologyTab = 'default'">默认拓扑</button>
      <button type="button" @click="activeTab = 'relation'; topologyTab = 'custom'">新建拓扑</button>
    </div>

    <section v-if="activeTab === 'detail'" class="detail-grid">
      <article><span>固定资产编号</span><strong>{{ device.assetNo || "-" }}</strong></article>
      <article><span>计算机名</span><strong>{{ device.computerName || device.name }}</strong></article>
      <article><span>业务IP</span><strong>{{ device.businessIp || "-" }}</strong></article>
      <article><span>带外IP</span><strong>{{ device.managementIp || "-" }}</strong></article>
      <article><span>用途</span><strong>{{ device.purpose || "-" }}</strong></article>
      <article><span>责任人</span><strong>{{ device.owner || "-" }}</strong></article>
      <article><span>型号</span><strong>{{ device.vendor || "-" }} {{ device.model || "" }}</strong></article>
      <article><span>SN号</span><strong>{{ device.serialNumber || "-" }}</strong></article>
      <article><span>操作系统</span><strong>{{ device.operatingSystem || "-" }}</strong></article>
      <article><span>硬件配置</span><strong>{{ device.hardwareSpec || "-" }}</strong></article>
      <article><span>维保时间</span><strong>{{ device.warrantyExpireAt || "-" }}</strong></article>
      <article><span>安装位置</span><strong>{{ room?.name || "-" }} / {{ rack?.name || "-" }} / {{ device.startU }}U-{{ device.endU }}U</strong></article>
    </section>

    <section v-else-if="activeTab === 'relation'" class="relation-view">
      <div class="relation-cards">
        <article>
          <span>所属机房</span>
          <strong>{{ room?.name || "-" }}</strong>
        </article>
        <article>
          <span>所属机柜</span>
          <strong>{{ rack?.name || "-" }} / {{ rack ? getRackTypeLabel(rack.type) : "-" }}</strong>
        </article>
        <article>
          <span>同柜设备</span>
          <strong>{{ sameRackDevices.length }} 台</strong>
        </article>
        <article>
          <span>维修/进出记录</span>
          <strong>{{ deviceAccessRecords.length }} 条</strong>
        </article>
      </div>
      <div class="topology-tabs">
        <button type="button" :class="{ active: topologyTab === 'default' }" @click="topologyTab = 'default'">默认拓扑</button>
        <button type="button" :class="{ active: topologyTab === 'custom' }" @click="topologyTab = 'custom'">新建拓扑</button>
      </div>
      <div class="topology-panel">
        <template v-if="topologyTab === 'default'">
          <div class="asset-topology-graph" aria-label="资产实例关系拓扑">
            <div class="topology-node root">
              <small>物理机</small>
              <strong>{{ deviceName }}</strong>
              <span>{{ device.businessIp || "无业务IP" }}</span>
            </div>
            <div class="topology-branches">
              <article class="topology-node">
                <small>属于机房</small>
                <strong>{{ room?.name || "-" }}</strong>
                <span>{{ room?.layoutType || "未配置布局" }}</span>
              </article>
              <article class="topology-node">
                <small>属于机柜</small>
                <strong>{{ rack?.name || "-" }}</strong>
                <span>{{ rack ? getRackTypeLabel(rack.type) : "-" }} / {{ device.startU }}U-{{ device.endU }}U</span>
              </article>
              <article class="topology-node">
                <small>关联人员</small>
                <strong>{{ device.owner || "未填写" }}</strong>
                <span>{{ device.purpose || "未填写用途" }}</span>
              </article>
              <article class="topology-node">
                <small>网络标识</small>
                <strong>{{ device.businessIp || "-" }}</strong>
                <span>带外 {{ device.managementIp || "-" }}</span>
              </article>
              <article class="topology-node">
                <small>同柜设备</small>
                <strong>{{ sameRackDevices.length }} 台</strong>
                <span>{{ sameRackDevices.slice(0, 2).map((item) => item.computerName || item.name).join("、") || "无" }}</span>
              </article>
              <article class="topology-node">
                <small>连线对端</small>
                <strong>{{ deviceConnections.length }} 条</strong>
                <span>{{ deviceConnections[0] ? `${deviceConnections[0].targetDeviceName} ${deviceConnections[0].targetPortName}` : "暂无连线" }}</span>
              </article>
              <article class="topology-node">
                <small>维修进出</small>
                <strong>{{ deviceAccessRecords.length }} 条</strong>
                <span>{{ deviceAccessRecords[0]?.reason || "暂无记录" }}</span>
              </article>
              <article class="topology-node">
                <small>变更记录</small>
                <strong>{{ managedChangeEvents.length + changeRecords.length }} 条</strong>
                <span>{{ latestManagedChanges[0]?.title || changeRecords[0]?.title || "暂无变更" }}</span>
              </article>
            </div>
          </div>
        </template>
        <template v-else>
          <p>可按业务系统、虚拟化集群、交换机链路或维修流程创建新的实例拓扑。</p>
          <button type="button">新建拓扑</button>
        </template>
      </div>
    </section>

    <section v-else-if="activeTab === 'changes'" class="change-view">
      <form class="change-form" @submit.prevent="saveChangeRecord">
        <h4>新增变更记录</h4>
        <input v-model="changeForm.title" placeholder="变更标题，例如：更换内存条" />
        <textarea v-model="changeForm.content" rows="3" placeholder="变更内容、维修过程或影响说明" />
        <div>
          <input v-model="changeForm.operator" placeholder="操作人" />
          <button type="submit">保存变更</button>
        </div>
      </form>
      <div class="change-list">
        <article v-for="record in changeRecords" :key="record.id">
          <strong>{{ record.title }}</strong>
          <span>{{ new Date(record.changedAt).toLocaleString("zh-CN") }} / {{ record.operator }} / {{ record.source }}</span>
          <p>{{ record.content }}</p>
        </article>
        <p v-if="changeRecords.length === 0" class="empty">暂无变更记录，后续维修、调整和 AI/API 修改会沉淀到这里。</p>
      </div>
    </section>

    <section v-else class="qr-view">
      <div class="qr-code" data-testid="asset-qr-code">
        <span v-for="(cell, index) in qrCells" :key="index" :class="{ filled: cell }" />
      </div>
      <div>
        <h4>设备二维码</h4>
        <p>用于现场巡检、资产盘点和维修记录快速定位。</p>
        <code>{{ device.id }}</code>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.asset-detail-window {
  position: fixed;
  z-index: 92;
  width: min(640px, calc(100vw - 28px));
  max-height: calc(100vh - 36px);
  overflow: auto;
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--surface-glass);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(16px);
}

header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
}

header > div {
  display: grid;
  gap: 4px;
}

.eyebrow,
h3,
h4,
p {
  margin: 0;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
}

header span,
.detail-grid span,
.relation-cards span,
.change-list span,
.qr-view p,
.empty {
  color: var(--color-text-muted);
  font-size: 12px;
}

button {
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
  cursor: pointer;
}

.detail-tabs,
.topology-shortcuts,
.topology-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-tabs button.active,
.topology-shortcuts button,
.topology-tabs button.active,
.change-form button,
.topology-panel button {
  border-color: rgba(14, 165, 233, 0.58);
  background: color-mix(in srgb, var(--color-primary) 14%, var(--control-bg));
}

.detail-grid,
.relation-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid article,
.relation-cards article,
.change-form,
.change-list article,
.topology-panel,
.qr-view {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.detail-grid strong {
  overflow-wrap: anywhere;
}

.relation-view,
.change-view {
  display: grid;
  gap: 12px;
}

.topology-panel {
  grid-template-columns: 1fr;
  align-items: stretch;
  min-height: 260px;
  text-align: center;
}

.topology-panel p {
  grid-column: 1 / -1;
  color: var(--color-text-muted);
}

.topology-panel button {
  grid-column: 1 / -1;
  justify-self: center;
}

.asset-topology-graph {
  position: relative;
  display: grid;
  gap: 22px;
  padding: 10px;
}

.asset-topology-graph::before {
  content: "";
  position: absolute;
  top: 92px;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.36), transparent);
}

.topology-branches {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.topology-node {
  position: relative;
  display: grid;
  gap: 5px;
  min-height: 86px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-panel));
  box-shadow: 0 12px 24px rgba(14, 165, 233, 0.08);
}

.topology-node.root {
  justify-self: center;
  width: min(260px, 100%);
  border-color: rgba(14, 165, 233, 0.58);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(16, 185, 129, 0.08));
}

.topology-node small {
  color: var(--color-text-muted);
  font-size: 11px;
}

.topology-node strong,
.topology-node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topology-node span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.change-form input,
.change-form textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--color-text);
  background: var(--control-bg);
}

.change-form div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.change-list {
  display: grid;
  gap: 8px;
}

.change-list p {
  color: var(--color-text-muted);
  line-height: 1.6;
}

.qr-view {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.qr-code {
  width: 170px;
  height: 170px;
  display: grid;
  grid-template-columns: repeat(17, 1fr);
  grid-template-rows: repeat(17, 1fr);
  gap: 2px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #ffffff;
}

.qr-code span {
  border-radius: 1px;
  background: transparent;
}

.qr-code span.filled {
  background: #0f172a;
}

code {
  overflow-wrap: anywhere;
  color: var(--color-primary);
}

@media (max-width: 760px) {
  .detail-grid,
  .relation-cards,
  .qr-view,
  .topology-panel {
    grid-template-columns: 1fr;
  }
}
</style>
