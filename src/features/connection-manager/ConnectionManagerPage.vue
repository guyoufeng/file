<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useAssetStore } from "../../stores/assetStore";
import {
  ensureDemoConnectionRecords,
  getConnectionRecords,
  getSavedConnectionViews,
  saveConnectionView,
  searchConnectionRecords,
  type ManagedConnection,
  type SavedConnectionView,
} from "./connections";

type ViewMode = "topology" | "table" | "ports";

interface ConnectionNode {
  id: string;
  name: string;
  role: "server" | "switch";
  subtitle: string;
}

const assetStore = useAssetStore();
const records = ref<ManagedConnection[]>([]);
const savedViews = ref<SavedConnectionView[]>([]);
const activeView = ref<ViewMode>("topology");
const keyword = ref("");
const selectedDeviceIds = ref<string[]>([]);
const viewName = ref("529生产网络拓扑");
const zoom = ref(1);
const nodePositions = reactive<Record<string, { x: number; y: number }>>({});
let draggingNode:
  | { id: string; startX: number; startY: number; originX: number; originY: number }
  | null = null;

const availableNodes = computed<ConnectionNode[]>(() => {
  const nodes = new Map<string, ConnectionNode>();
  for (const record of records.value) {
    nodes.set(record.sourceDeviceId, {
      id: record.sourceDeviceId,
      name: record.sourceDeviceName,
      role: "server",
      subtitle: record.sourcePortName,
    });
    nodes.set(record.targetDeviceId, {
      id: record.targetDeviceId,
      name: record.targetDeviceName,
      role: "switch",
      subtitle: record.targetPortName,
    });
  }
  return [...nodes.values()].sort((first, second) => first.name.localeCompare(second.name));
});

const filteredRecords = computed(() => {
  const base = keyword.value.trim() ? searchConnectionRecords(keyword.value, records.value) : records.value;
  if (selectedDeviceIds.value.length === 0) return base;
  const selected = new Set(selectedDeviceIds.value);
  return base.filter(
    (record) => selected.has(record.sourceDeviceId) || selected.has(record.targetDeviceId),
  );
});

const topologyNodes = computed<ConnectionNode[]>(() => {
  const nodeIds = new Set<string>();
  for (const record of filteredRecords.value) {
    nodeIds.add(record.sourceDeviceId);
    nodeIds.add(record.targetDeviceId);
  }
  return availableNodes.value.filter((node) => nodeIds.has(node.id));
});

const portGroups = computed(() => {
  const groups = new Map<string, ManagedConnection[]>();
  for (const record of filteredRecords.value) {
    for (const id of [record.sourceDeviceId, record.targetDeviceId]) {
      const current = groups.get(id) ?? [];
      current.push(record);
      groups.set(id, current);
    }
  }
  return [...groups.entries()].map(([id, links]) => ({
    id,
    node: availableNodes.value.find((node) => node.id === id),
    links,
  }));
});

onMounted(async () => {
  await assetStore.loadDevices();
  records.value = ensureDemoConnectionRecords(assetStore.devices);
  savedViews.value = getSavedConnectionViews();
  initializeNodePositions();
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", moveNode);
  window.removeEventListener("pointerup", stopNodeDrag);
});

watch(filteredRecords, initializeNodePositions);

function initializeNodePositions() {
  const switches = topologyNodes.value.filter((node) => node.role === "switch");
  const servers = topologyNodes.value.filter((node) => node.role === "server");
  switches.forEach((node, index) => {
    if (!nodePositions[node.id]) {
      nodePositions[node.id] = { x: 420 + index * 280, y: 70 };
    }
  });
  servers.forEach((node, index) => {
    if (!nodePositions[node.id]) {
      const column = index % 6;
      const row = Math.floor(index / 6);
      nodePositions[node.id] = { x: 80 + column * 220, y: 250 + row * 140 };
    }
  });
}

function toggleSelected(nodeId: string) {
  selectedDeviceIds.value = selectedDeviceIds.value.includes(nodeId)
    ? selectedDeviceIds.value.filter((id) => id !== nodeId)
    : [...selectedDeviceIds.value, nodeId];
}

function clearSelected() {
  selectedDeviceIds.value = [];
  keyword.value = "";
}

function applySavedView(view: SavedConnectionView) {
  selectedDeviceIds.value = [...view.selectedDeviceIds];
  keyword.value = view.keyword;
  zoom.value = view.zoom;
  Object.assign(nodePositions, view.nodePositions);
}

function saveCurrentView() {
  const saved = saveConnectionView({
    name: viewName.value.trim() || "未命名连线视图",
    selectedDeviceIds: selectedDeviceIds.value,
    keyword: keyword.value,
    zoom: zoom.value,
    nodePositions: Object.fromEntries(
      topologyNodes.value.map((node) => [node.id, nodePositions[node.id] ?? { x: 0, y: 0 }]),
    ),
  });
  savedViews.value = getSavedConnectionViews();
  viewName.value = saved.name;
}

function startNodeDrag(nodeId: string, event: PointerEvent) {
  const position = nodePositions[nodeId];
  if (!position) return;
  draggingNode = {
    id: nodeId,
    startX: event.clientX,
    startY: event.clientY,
    originX: position.x,
    originY: position.y,
  };
  window.addEventListener("pointermove", moveNode);
  window.addEventListener("pointerup", stopNodeDrag);
}

function moveNode(event: PointerEvent) {
  if (!draggingNode) return;
  nodePositions[draggingNode.id] = {
    x: Math.max(12, draggingNode.originX + (event.clientX - draggingNode.startX) / zoom.value),
    y: Math.max(12, draggingNode.originY + (event.clientY - draggingNode.startY) / zoom.value),
  };
}

function stopNodeDrag() {
  draggingNode = null;
  window.removeEventListener("pointermove", moveNode);
  window.removeEventListener("pointerup", stopNodeDrag);
}

function nodeCenter(nodeId: string) {
  const position = nodePositions[nodeId] ?? { x: 0, y: 0 };
  return {
    x: position.x + 86,
    y: position.y + 38,
  };
}
</script>

<template>
  <section class="page connection-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">连线管理</h2>
        <p class="page-subtitle">按设备查看服务器接口、交换机端口、线缆编号和网络拓扑。实际录入入口后续放在资产详情的接口关系中。</p>
      </div>
    </div>

    <section class="connection-toolbar">
      <div class="search-box">
        <input v-model="keyword" placeholder="搜索服务器、交换机、端口、线缆编号" aria-label="搜索连线" />
        <button type="button" @click="clearSelected">清空筛选</button>
      </div>
      <div class="view-tabs" aria-label="连线视图">
        <button type="button" :class="{ active: activeView === 'topology' }" @click="activeView = 'topology'">拓扑视图</button>
        <button type="button" :class="{ active: activeView === 'table' }" @click="activeView = 'table'">表格视图</button>
        <button type="button" :class="{ active: activeView === 'ports' }" @click="activeView = 'ports'">端口视图</button>
      </div>
    </section>

    <section class="connection-filters">
      <article class="device-selector">
        <header>
          <div>
            <p class="eyebrow">Device Selector</p>
            <h3>选择设备</h3>
          </div>
          <span>{{ selectedDeviceIds.length || "全部" }} / {{ availableNodes.length }}</span>
        </header>
        <div class="device-chip-list">
          <button
            v-for="node in availableNodes"
            :key="node.id"
            type="button"
            :class="['device-chip', node.role, { active: selectedDeviceIds.includes(node.id) }]"
            @click="toggleSelected(node.id)"
          >
            <strong>{{ node.name }}</strong>
            <span>{{ node.subtitle }}</span>
          </button>
        </div>
      </article>

      <article class="saved-view-panel">
        <header>
          <div>
            <p class="eyebrow">Saved Views</p>
            <h3>保存视图</h3>
          </div>
        </header>
        <div class="save-view-row">
          <input v-model="viewName" aria-label="连线视图名称" />
          <button type="button" @click="saveCurrentView">保存当前视图</button>
        </div>
        <div class="saved-view-list">
          <button v-for="view in savedViews" :key="view.id" type="button" @click="applySavedView(view)">
            {{ view.name }}
          </button>
          <span v-if="savedViews.length === 0">暂无保存视图。</span>
        </div>
      </article>
    </section>

    <section class="connection-workspace">
      <div v-if="activeView === 'topology'" class="topology-view" aria-label="连线拓扑视图">
        <div class="topology-controls">
          <button type="button" @click="zoom = Math.max(0.65, zoom - 0.1)">缩小</button>
          <strong>{{ Math.round(zoom * 100) }}%</strong>
          <button type="button" @click="zoom = Math.min(1.8, zoom + 0.1)">放大</button>
        </div>
        <div class="topology-canvas">
          <div class="topology-canvas-inner" :style="{ transform: `scale(${zoom})` }">
            <svg class="topology-lines" viewBox="0 0 1500 820" aria-hidden="true">
              <line
                v-for="record in filteredRecords"
                :key="record.id"
                :x1="nodeCenter(record.sourceDeviceId).x"
                :y1="nodeCenter(record.sourceDeviceId).y"
                :x2="nodeCenter(record.targetDeviceId).x"
                :y2="nodeCenter(record.targetDeviceId).y"
              />
            </svg>
            <article
              v-for="node in topologyNodes"
              :key="node.id"
              :class="['topology-node', node.role]"
              :style="{ left: `${nodePositions[node.id]?.x ?? 0}px`, top: `${nodePositions[node.id]?.y ?? 0}px` }"
              @pointerdown.prevent="startNodeDrag(node.id, $event)"
            >
              <small>{{ node.role === "switch" ? "交换机" : "服务器" }}</small>
              <strong>{{ node.name }}</strong>
              <span>{{ node.subtitle }}</span>
            </article>
          </div>
        </div>
      </div>

      <div v-else-if="activeView === 'table'" class="connection-table-wrap">
        <table>
          <thead>
            <tr>
              <th>源设备</th>
              <th>源端口</th>
              <th>目标设备</th>
              <th>目标端口</th>
              <th>线缆编号</th>
              <th>类型</th>
              <th>状态</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record.id">
              <td>{{ record.sourceDeviceName }}</td>
              <td>{{ record.sourcePortName }}</td>
              <td>{{ record.targetDeviceName }}</td>
              <td>{{ record.targetPortName }}</td>
              <td>{{ record.cableNo || "-" }}</td>
              <td>{{ record.cableType || "-" }}</td>
              <td>{{ record.status }}</td>
              <td>{{ record.notes || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="port-view">
        <article v-for="group in portGroups" :key="group.id" class="port-card">
          <header>
            <div>
              <p class="eyebrow">{{ group.node?.role === "switch" ? "Switch Ports" : "Server Ports" }}</p>
              <h3>{{ group.node?.name || group.id }}</h3>
            </div>
            <span>已用端口 {{ group.links.length }}</span>
          </header>
          <ul>
            <li v-for="link in group.links" :key="`${group.id}-${link.id}`">
              <strong>
                {{ group.id === link.sourceDeviceId ? link.sourcePortName : link.targetPortName }}
              </strong>
              <span>
                对端：
                {{ group.id === link.sourceDeviceId ? link.targetDeviceName : link.sourceDeviceName }}
                /
                {{ group.id === link.sourceDeviceId ? link.targetPortName : link.sourcePortName }}
              </span>
              <small>{{ link.cableNo || "未填写线缆编号" }}</small>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.connection-page {
  display: grid;
  gap: 16px;
}

.connection-toolbar,
.connection-filters,
.connection-workspace,
.device-selector,
.saved-view-panel {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.connection-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
}

.search-box,
.view-tabs,
.save-view-row,
.saved-view-list,
.topology-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

input {
  min-width: 0;
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
  cursor: pointer;
}

button.active,
.device-chip.active {
  border-color: color-mix(in srgb, var(--color-primary) 72%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 16%, var(--control-bg));
}

.connection-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 12px;
  padding: 12px;
}

.device-selector,
.saved-view-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
}

header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow,
h3,
p {
  margin: 0;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
}

header span,
.device-chip span,
.saved-view-list span,
.port-card span,
.port-card small {
  color: var(--color-text-muted);
}

.device-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 168px;
  overflow: auto;
}

.device-chip {
  min-width: 150px;
  height: 58px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 3px;
}

.device-chip.switch {
  border-color: color-mix(in srgb, #10b981 45%, var(--color-border));
}

.device-chip.server {
  border-color: color-mix(in srgb, #3b82f6 42%, var(--color-border));
}

.saved-view-panel {
  align-content: start;
}

.saved-view-list {
  flex-wrap: wrap;
}

.connection-workspace {
  min-height: 560px;
  overflow: hidden;
}

.topology-view {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.topology-controls {
  justify-content: flex-end;
}

.topology-canvas {
  position: relative;
  height: 620px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 8%, transparent) 1px, transparent 1px),
    linear-gradient(color-mix(in srgb, var(--color-primary) 8%, transparent) 1px, transparent 1px),
    color-mix(in srgb, #ecfdf5 72%, var(--color-panel));
  background-size: 36px 36px;
}

.topology-canvas-inner {
  position: relative;
  width: 1500px;
  height: 820px;
  transform-origin: 0 0;
}

.topology-lines {
  position: absolute;
  inset: 0;
  width: 1500px;
  height: 820px;
  pointer-events: none;
}

.topology-lines line {
  stroke: color-mix(in srgb, var(--color-primary) 44%, transparent);
  stroke-width: 2;
}

.topology-node {
  position: absolute;
  width: 172px;
  min-height: 76px;
  display: grid;
  gap: 4px;
  align-content: center;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--surface-raised);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  cursor: grab;
  user-select: none;
}

.topology-node:active {
  cursor: grabbing;
}

.topology-node.switch {
  border-color: rgba(16, 185, 129, 0.58);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), var(--surface-raised));
}

.topology-node.server {
  border-color: rgba(59, 130, 246, 0.58);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), var(--surface-raised));
}

.topology-node small,
.topology-node span {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-table-wrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

th {
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-panel));
}

.port-view {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
}

.port-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.port-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.port-card li {
  display: grid;
  gap: 3px;
  padding: 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

@media (max-width: 980px) {
  .connection-toolbar,
  .connection-filters,
  .port-view {
    grid-template-columns: 1fr;
  }
}
</style>
