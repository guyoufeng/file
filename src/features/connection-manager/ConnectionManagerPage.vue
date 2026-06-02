<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { Device } from "../../types/domain";
import { useAssetStore } from "../../stores/assetStore";
import {
  createConnectionRecord,
  deleteConnectionRecord,
  getConnectionRecords,
  searchConnectionRecords,
  updateConnectionRecord,
  type ConnectionDirection,
  type ConnectionStatus,
  type ManagedConnection,
} from "./connections";

type ViewMode = "topology" | "table" | "ports";

const assetStore = useAssetStore();
const records = ref<ManagedConnection[]>([]);
const keyword = ref("");
const viewMode = ref<ViewMode>("topology");
const editingId = ref("");
const selectedConnectionId = ref("");
const form = reactive({
  sourceDeviceId: "",
  sourcePortName: "",
  targetDeviceId: "",
  targetPortName: "",
  cableNo: "",
  cableType: "万兆光纤",
  direction: "front_to_rear" as ConnectionDirection,
  status: "active" as ConnectionStatus,
  notes: "",
});

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: "topology", label: "拓扑视图" },
  { value: "table", label: "表格视图" },
  { value: "ports", label: "端口视图" },
];
const directionOptions: Array<{ value: ConnectionDirection; label: string }> = [
  { value: "front_to_rear", label: "正面到背面" },
  { value: "rear_to_front", label: "背面到正面" },
  { value: "same_side", label: "同侧连接" },
  { value: "uplink", label: "上联链路" },
  { value: "oob", label: "带外管理" },
];
const statusOptions: Array<{ value: ConnectionStatus; label: string }> = [
  { value: "active", label: "已连接" },
  { value: "planned", label: "计划中" },
  { value: "disabled", label: "已停用" },
];

const filteredRecords = computed(() =>
  keyword.value.trim() ? searchConnectionRecords(keyword.value, records.value) : records.value,
);
const sourceDevice = computed(() => assetStore.devices.find((device) => device.id === form.sourceDeviceId));
const targetDevice = computed(() => assetStore.devices.find((device) => device.id === form.targetDeviceId));
const selectedConnection = computed(() =>
  records.value.find((record) => record.id === selectedConnectionId.value) ?? filteredRecords.value[0],
);
const portUsage = computed(() =>
  assetStore.devices
    .map((device) => {
      const connections = records.value.filter(
        (record) => record.sourceDeviceId === device.id || record.targetDeviceId === device.id,
      );
      return {
        device,
        connections,
        usedPorts: connections.length,
        totalPorts: Math.max(fallbackPorts(device, "source").length, connections.length),
      };
    })
    .filter((item) => item.usedPorts > 0 || /交换机|switch|sw-|网络/i.test(item.device.name + item.device.computerName)),
);

watch(sourceDevice, (device) => {
  if (!device) return;
  form.sourcePortName = form.sourcePortName || fallbackPorts(device, "source")[0];
});

watch(targetDevice, (device) => {
  if (!device) return;
  form.targetPortName = form.targetPortName || fallbackPorts(device, "target")[0];
});

onMounted(async () => {
  await assetStore.loadDevices();
  refreshRecords();
});

function refreshRecords() {
  records.value = getConnectionRecords();
  if (!selectedConnectionId.value && records.value[0]) {
    selectedConnectionId.value = records.value[0].id;
  }
}

function deviceLabel(device: Device | undefined) {
  if (!device) return "-";
  return `${device.computerName || device.name} / ${device.businessIp || "无业务IP"}`;
}

function fallbackPorts(device: Device | undefined, endpoint: "source" | "target") {
  if (!device) return [];
  if (device.ports.length > 0) return device.ports.map((port) => port.name);
  const name = `${device.name} ${device.computerName ?? ""}`.toLowerCase();
  if (/交换机|switch|sw-/.test(name)) {
    return ["GE1/0/1", "GE1/0/2", "GE1/0/3", "GE1/0/4", "XGE1/0/1", "XGE1/0/2"];
  }
  if (endpoint === "target") return ["GE1/0/1", "GE1/0/2", "XGE1/0/1"];
  return ["eth0", "eth1", "bond0", "iDRAC", "iLO", "MGMT"];
}

function resetForm() {
  editingId.value = "";
  form.sourceDeviceId = "";
  form.sourcePortName = "";
  form.targetDeviceId = "";
  form.targetPortName = "";
  form.cableNo = "";
  form.cableType = "万兆光纤";
  form.direction = "front_to_rear";
  form.status = "active";
  form.notes = "";
}

function submitConnection() {
  const source = sourceDevice.value;
  const target = targetDevice.value;
  if (!source || !target || !form.sourcePortName.trim() || !form.targetPortName.trim()) return;
  const payload = {
    sourceDeviceId: source.id,
    sourceDeviceName: source.computerName || source.name,
    sourcePortName: form.sourcePortName.trim(),
    targetDeviceId: target.id,
    targetDeviceName: target.computerName || target.name,
    targetPortName: form.targetPortName.trim(),
    cableNo: form.cableNo.trim(),
    cableType: form.cableType.trim(),
    direction: form.direction,
    status: form.status,
    notes: form.notes.trim(),
  };
  const saved = editingId.value
    ? updateConnectionRecord(editingId.value, payload)
    : createConnectionRecord(payload);
  refreshRecords();
  selectedConnectionId.value = saved?.id ?? selectedConnectionId.value;
  resetForm();
}

function editConnection(record: ManagedConnection) {
  editingId.value = record.id;
  form.sourceDeviceId = record.sourceDeviceId;
  form.sourcePortName = record.sourcePortName;
  form.targetDeviceId = record.targetDeviceId;
  form.targetPortName = record.targetPortName;
  form.cableNo = record.cableNo || "";
  form.cableType = record.cableType || "";
  form.direction = record.direction;
  form.status = record.status;
  form.notes = record.notes || "";
  selectedConnectionId.value = record.id;
}

function removeConnection(id: string) {
  deleteConnectionRecord(id);
  refreshRecords();
  if (editingId.value === id) resetForm();
}
</script>

<template>
  <section class="page connection-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">连线管理</h2>
        <p class="page-subtitle">维护服务器、交换机、配线架之间的端口、线缆和对端关系，后续 AI 可直接查询接线信息。</p>
      </div>
    </div>

    <div class="connection-layout">
      <form class="connection-form" @submit.prevent="submitConnection">
        <header>
          <div>
            <p class="eyebrow">{{ editingId ? "Edit Cable" : "New Cable" }}</p>
            <h3>{{ editingId ? "编辑连线" : "新增连线" }}</h3>
          </div>
          <button type="button" @click="resetForm">清空</button>
        </header>
        <label>
          源设备
          <select v-model="form.sourceDeviceId">
            <option value="">选择服务器/设备</option>
            <option v-for="device in assetStore.devices" :key="device.id" :value="device.id">{{ deviceLabel(device) }}</option>
          </select>
        </label>
        <label>
          源端口
          <select v-model="form.sourcePortName">
            <option v-for="port in fallbackPorts(sourceDevice, 'source')" :key="port" :value="port">{{ port }}</option>
          </select>
        </label>
        <label>
          目标设备
          <select v-model="form.targetDeviceId">
            <option value="">选择交换机/配线设备</option>
            <option v-for="device in assetStore.devices" :key="device.id" :value="device.id">{{ deviceLabel(device) }}</option>
          </select>
        </label>
        <label>
          目标端口
          <select v-model="form.targetPortName">
            <option v-for="port in fallbackPorts(targetDevice, 'target')" :key="port" :value="port">{{ port }}</option>
          </select>
        </label>
        <div class="two-cols">
          <label>
            线缆编号
            <input v-model="form.cableNo" placeholder="例如：CAB-529-A1-001" />
          </label>
          <label>
            线缆类型
            <input v-model="form.cableType" placeholder="万兆光纤 / 六类网线" />
          </label>
        </div>
        <div class="two-cols">
          <label>
            方向/场景
            <select v-model="form.direction">
              <option v-for="option in directionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label>
            状态
            <select v-model="form.status">
              <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
        <label>
          说明
          <textarea v-model="form.notes" rows="3" placeholder="例如：生产网、管理网、存储网、上联链路或临时跳线说明" />
        </label>
        <button class="primary-action" type="submit">{{ editingId ? "保存连线" : "新增连线" }}</button>
      </form>

      <section class="connection-workspace">
        <header>
          <div class="view-tabs">
            <button
              v-for="option in viewOptions"
              :key="option.value"
              type="button"
              :class="{ active: viewMode === option.value }"
              @click="viewMode = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <input v-model="keyword" placeholder="搜索服务器、交换机、端口、线缆编号" />
        </header>

        <div v-if="viewMode === 'topology'" class="connection-topology">
          <div class="topology-stage">
            <article
              v-for="record in filteredRecords"
              :key="record.id"
              class="connection-card"
              :class="{ selected: selectedConnectionId === record.id }"
              @click="selectedConnectionId = record.id"
            >
              <div class="endpoint server">
                <small>源设备</small>
                <strong>{{ record.sourceDeviceName }}</strong>
                <span>{{ record.sourcePortName }}</span>
              </div>
              <div class="cable-line">
                <span>{{ record.cableNo || "未编号" }}</span>
              </div>
              <div class="endpoint switch">
                <small>目标设备</small>
                <strong>{{ record.targetDeviceName }}</strong>
                <span>{{ record.targetPortName }}</span>
              </div>
            </article>
            <p v-if="filteredRecords.length === 0" class="empty">暂无连线。先录入物理服务器到交换机的端口关系，后续可用于 AI 查询和接线表导出。</p>
          </div>
          <aside class="connection-inspector">
            <strong>{{ selectedConnection ? `${selectedConnection.sourceDeviceName} -> ${selectedConnection.targetDeviceName}` : "未选择连线" }}</strong>
            <span>源端口：{{ selectedConnection?.sourcePortName || "-" }}</span>
            <span>目标端口：{{ selectedConnection?.targetPortName || "-" }}</span>
            <span>线缆：{{ selectedConnection?.cableNo || "-" }} / {{ selectedConnection?.cableType || "-" }}</span>
            <span>状态：{{ selectedConnection?.status || "-" }}</span>
            <p>{{ selectedConnection?.notes || "选择一条连线查看详细信息。" }}</p>
          </aside>
        </div>

        <div v-else-if="viewMode === 'table'" class="connection-table">
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
                <th>操作</th>
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
                <td>
                  <button type="button" @click="editConnection(record)">编辑</button>
                  <button type="button" @click="removeConnection(record.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="port-grid">
          <article v-for="item in portUsage" :key="item.device.id">
            <div>
              <strong>{{ item.device.computerName || item.device.name }}</strong>
              <span>{{ item.device.businessIp || "无业务IP" }}</span>
            </div>
            <meter :value="item.usedPorts" :max="item.totalPorts" />
            <small>已用端口 {{ item.usedPorts }} / 估算端口 {{ item.totalPorts }}</small>
          </article>
          <p v-if="portUsage.length === 0" class="empty">暂无端口占用信息。</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.connection-page {
  display: grid;
  gap: 16px;
}

.connection-layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.72fr) minmax(0, 1.28fr);
  gap: 16px;
}

.connection-form,
.connection-workspace,
.connection-inspector {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.connection-form {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.connection-form header,
.connection-workspace > header {
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

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
}

input,
select,
textarea {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}

input,
select {
  min-height: 36px;
  padding: 0 10px;
}

textarea {
  resize: vertical;
  padding: 10px;
  line-height: 1.55;
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(14, 165, 233, 0.48);
  border-radius: 8px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--control-bg));
  cursor: pointer;
}

.primary-action,
.view-tabs button.active {
  border-color: rgba(14, 165, 233, 0.72);
  background: color-mix(in srgb, var(--color-primary) 18%, var(--control-bg));
}

.two-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.connection-workspace {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.connection-workspace > header input {
  max-width: 340px;
}

.view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.connection-topology {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.32fr);
  gap: 14px;
}

.topology-stage {
  min-height: 520px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background:
    radial-gradient(circle at 8% 0%, rgba(14, 165, 233, 0.11), transparent 28%),
    var(--color-panel);
  overflow: auto;
}

.connection-card {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(130px, 0.6fr) minmax(160px, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  cursor: pointer;
}

.connection-card.selected {
  border-color: rgba(14, 165, 233, 0.68);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.12);
}

.endpoint {
  display: grid;
  gap: 5px;
  padding: 11px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-panel));
}

.endpoint.switch {
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-panel));
}

.endpoint small,
.endpoint span,
.connection-inspector span,
.connection-inspector p,
.port-grid small,
.empty {
  color: var(--color-text-muted);
}

.endpoint strong,
.endpoint span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cable-line {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 64px;
}

.cable-line::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.18), rgba(14, 165, 233, 0.76), rgba(16, 185, 129, 0.22));
}

.cable-line span {
  position: relative;
  z-index: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-panel);
  font-size: 12px;
}

.connection-inspector {
  display: grid;
  align-content: start;
  gap: 9px;
  padding: 14px;
}

.connection-table {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-panel);
}

th,
td {
  padding: 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

td:last-child {
  display: flex;
  gap: 6px;
}

.port-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.port-grid article {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.port-grid article > div {
  display: grid;
  gap: 4px;
}

meter {
  width: 100%;
  height: 12px;
}

@media (max-width: 1080px) {
  .connection-layout,
  .connection-topology,
  .two-cols,
  .connection-card,
  .port-grid {
    grid-template-columns: 1fr;
  }
}
</style>
