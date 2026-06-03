<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as XLSX from "xlsx";
import {
  createAccessRecord,
  deleteAccessRecord,
  getAccessRecords,
  importAccessRecords,
  searchAccessRecords,
  updateAccessRecord,
  type AccessRecord,
  type AccessRecordInput,
} from "./accessRecords";
import { useAssetStore } from "../../stores/assetStore";
import { writeSystemAuditLog } from "../../services/backend/ai";

const assetStore = useAssetStore();
const records = ref<AccessRecord[]>([]);
const keyword = ref("");
const editingId = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const recordWindowOpen = ref(false);
const recordWindowRef = ref<HTMLElement | null>(null);
const recordWindow = ref({ x: 0, y: 0 });
let recordDrag:
  | { startX: number; startY: number; originX: number; originY: number }
  | null = null;
const form = ref<AccessRecordInput>({
  date: new Date().toISOString().slice(0, 10),
  unit: "",
  visitorName: "",
  enterTime: "09:00",
  leaveTime: "",
  reason: "",
  isServerRepair: false,
  deviceId: "",
  deviceName: "",
  faultDescription: "",
  result: "",
  attachments: [],
});

const filteredRecords = computed(() =>
  keyword.value ? searchAccessRecords(keyword.value, records.value) : records.value,
);
const recordWindowStyle = computed(() => ({
  left: `${recordWindow.value.x}px`,
  top: `${recordWindow.value.y}px`,
}));

onMounted(async () => {
  await assetStore.loadDevices();
  records.value = getAccessRecords();
});

watch(recordWindowOpen, (open) => {
  if (open) {
    document.addEventListener("pointerdown", closeRecordWhenClickOutside, true);
  } else {
    document.removeEventListener("pointerdown", closeRecordWhenClickOutside, true);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", moveRecordWindow);
  window.removeEventListener("pointerup", stopRecordDrag);
  document.removeEventListener("pointerdown", closeRecordWhenClickOutside, true);
});

function resetForm() {
  editingId.value = null;
  form.value = {
    date: new Date().toISOString().slice(0, 10),
    unit: "",
    visitorName: "",
    enterTime: "09:00",
    leaveTime: "",
    reason: "",
    isServerRepair: false,
    deviceId: "",
    deviceName: "",
    faultDescription: "",
    result: "",
    attachments: [],
  };
}

function openRecordWindow() {
  resetForm();
  const width = 520;
  recordWindow.value = {
    x: Math.max(18, window.innerWidth - width - 38),
    y: 142,
  };
  recordWindowOpen.value = true;
}

function closeRecordWindow() {
  recordWindowOpen.value = false;
  resetForm();
}

function editRecord(record: AccessRecord) {
  editingId.value = record.id;
  form.value = {
    date: record.date,
    unit: record.unit,
    visitorName: record.visitorName,
    enterTime: record.enterTime,
    leaveTime: record.leaveTime ?? "",
    reason: record.reason,
    isServerRepair: record.isServerRepair,
    deviceId: record.deviceId ?? "",
    deviceName: record.deviceName ?? "",
    faultDescription: record.faultDescription ?? "",
    result: record.result ?? "",
    attachments: [...record.attachments],
  };
  const width = 520;
  recordWindow.value = {
    x: Math.max(18, window.innerWidth - width - 38),
    y: 142,
  };
  recordWindowOpen.value = true;
}

function saveRecord() {
  if (!form.value.date || !form.value.unit.trim() || !form.value.visitorName.trim()) return;
  const device = assetStore.devices.find((item) => item.id === form.value.deviceId);
  const input = {
    ...form.value,
    deviceName:
      device?.computerName ||
      device?.name ||
      form.value.deviceName ||
      undefined,
    deviceId: form.value.deviceId || undefined,
    leaveTime: form.value.leaveTime || undefined,
  };
  const saved = editingId.value
    ? updateAccessRecord(editingId.value, input)
    : createAccessRecord(input);
  writeSystemAuditLog({
    action: editingId.value ? "access_record.update" : "access_record.create",
    targetType: "access_record",
    targetId: saved?.id,
    summary: `${editingId.value ? "修改" : "新增"}进出记录：${input.date} ${input.unit}`,
    status: "success",
    metadata: { deviceId: input.deviceId, isServerRepair: input.isServerRepair },
  });
  records.value = getAccessRecords();
  closeRecordWindow();
}

function removeRecord(record: AccessRecord) {
  deleteAccessRecord(record.id);
  writeSystemAuditLog({
    action: "access_record.delete",
    targetType: "access_record",
    targetId: record.id,
    summary: `删除进出记录：${record.date} ${record.unit}`,
    status: "success",
  });
  records.value = getAccessRecords();
}

function openImport() {
  fileInputRef.value?.click();
}

function startRecordDrag(event: PointerEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button")) return;
  recordDrag = {
    startX: event.clientX,
    startY: event.clientY,
    originX: recordWindow.value.x,
    originY: recordWindow.value.y,
  };
  window.addEventListener("pointermove", moveRecordWindow);
  window.addEventListener("pointerup", stopRecordDrag);
}

function moveRecordWindow(event: PointerEvent) {
  if (!recordDrag) return;
  recordWindow.value = {
    x: Math.max(10, Math.min(window.innerWidth - 540, recordDrag.originX + event.clientX - recordDrag.startX)),
    y: Math.max(10, Math.min(window.innerHeight - 560, recordDrag.originY + event.clientY - recordDrag.startY)),
  };
}

function stopRecordDrag() {
  recordDrag = null;
  window.removeEventListener("pointermove", moveRecordWindow);
  window.removeEventListener("pointerup", stopRecordDrag);
}

function closeRecordWhenClickOutside(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target || recordWindowRef.value?.contains(target)) return;
  closeRecordWindow();
}

async function importExcel(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const imported = importAccessRecords(rows);
  writeSystemAuditLog({
    action: "access_record.import_excel",
    targetType: "access_record",
    summary: `Excel 导入进出记录：${imported.length} 条`,
    status: "success",
    metadata: { sourceFileName: file.name, importedCount: imported.length },
  });
  records.value = getAccessRecords();
  input.value = "";
}
</script>

<template>
  <section class="page access-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">数据中心进出管理</h2>
        <p class="page-subtitle">记录人员进出、维修事由、关联物理机、故障和处理结果，供 AI 与 API 查询。</p>
      </div>
      <div class="header-actions">
        <input ref="fileInputRef" class="hidden-input" type="file" accept=".xlsx,.xls" @change="importExcel" />
        <button type="button" @click="openRecordWindow">新增进出记录</button>
        <button type="button" @click="openImport">Excel导入</button>
      </div>
    </div>

    <aside
      v-if="recordWindowOpen"
      ref="recordWindowRef"
      class="record-window"
      :style="recordWindowStyle"
      role="dialog"
      :aria-label="editingId ? '编辑进出记录' : '新增进出记录'"
    >
      <form class="record-form" @submit.prevent="saveRecord">
        <header @pointerdown="startRecordDrag">
          <div>
            <h3>{{ editingId ? "编辑进出记录" : "新增进出记录" }}</h3>
            <span>记录人员进出、维修和关联服务器信息。</span>
          </div>
          <button type="button" @click="closeRecordWindow">关闭</button>
        </header>
        <label>日期<input v-model="form.date" type="date" /></label>
        <label>单位<input v-model="form.unit" placeholder="例如：维保厂家" /></label>
        <label>人员<input v-model="form.visitorName" placeholder="进入人员姓名" /></label>
        <label>进入时间<input v-model="form.enterTime" type="time" /></label>
        <label>离开时间<input v-model="form.leaveTime" type="time" /></label>
        <label class="full">事由<input v-model="form.reason" placeholder="巡检、维修、施工、参观等" /></label>
        <label class="check-row"><input v-model="form.isServerRepair" type="checkbox" />物理机维修</label>
        <label v-if="form.isServerRepair">关联服务器
          <select v-model="form.deviceId">
            <option value="">不关联</option>
            <option v-for="device in assetStore.devices" :key="device.id" :value="device.id">
              {{ device.computerName || device.name }} / {{ device.businessIp || "-" }}
            </option>
          </select>
        </label>
        <label v-if="form.isServerRepair" class="full">故障描述<textarea v-model="form.faultDescription" rows="2" /></label>
        <label class="full">处理结果<textarea v-model="form.result" rows="2" /></label>
        <div class="form-actions">
          <button type="button" class="ghost" @click="resetForm">清空</button>
          <button type="submit">{{ editingId ? "保存" : "新增" }}</button>
        </div>
      </form>
    </aside>

    <div class="access-grid">
      <section class="record-list">
        <div class="list-toolbar">
          <input v-model="keyword" placeholder="搜索日期、单位、人员、服务器、故障或处理结果" />
          <span>{{ filteredRecords.length }} 条记录</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>单位/人员</th>
                <th>时间</th>
                <th>事由</th>
                <th>关联服务器</th>
                <th>故障与处理</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in filteredRecords" :key="record.id">
                <td>{{ record.date }}</td>
                <td>{{ record.unit }}<br /><small>{{ record.visitorName }}</small></td>
                <td>{{ record.enterTime }} - {{ record.leaveTime || "未离开" }}</td>
                <td>{{ record.reason || "-" }}</td>
                <td>{{ record.deviceName || record.deviceId || "-" }}</td>
                <td>{{ record.faultDescription || "-" }}<br /><small>{{ record.result || "-" }}</small></td>
                <td>
                  <button type="button" @click="editRecord(record)">编辑</button>
                  <button type="button" class="danger" @click="removeRecord(record)">删除</button>
                </td>
              </tr>
              <tr v-if="filteredRecords.length === 0">
                <td colspan="7" class="empty-cell">暂无进出记录。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.access-grid {
  display: block;
}

.header-actions button,
.record-list {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.header-actions button,
.form-actions button,
.record-form header button,
td button {
  min-height: 34px;
  border: 1px solid rgba(14, 165, 233, 0.38);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.14);
  cursor: pointer;
}

.record-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.record-form h3,
.record-form header,
.full,
.check-row,
.form-actions {
  grid-column: 1 / -1;
}

.record-window {
  position: fixed;
  z-index: 90;
  width: min(520px, calc(100vw - 28px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-glass);
  box-shadow: 0 20px 58px rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(16px);
}

.record-form header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
}

.record-form header > div {
  display: grid;
  gap: 4px;
}

.record-form h3 {
  margin: 0;
}

.record-form header span {
  color: var(--color-text-muted);
  font-size: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--color-text);
  background: var(--color-panel-soft);
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.check-row input {
  width: auto;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.record-list {
  min-width: 0;
  padding: 14px;
}

.list-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.list-toolbar input {
  max-width: 520px;
}

.list-toolbar span,
small {
  color: var(--color-text-muted);
}

.table-wrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--color-text-muted);
  font-size: 12px;
}

td button {
  min-height: 28px;
  margin-right: 6px;
  padding: 0 9px;
}

td button.danger {
  border-color: rgba(239, 68, 68, 0.42);
  background: rgba(239, 68, 68, 0.12);
}

.hidden-input {
  display: none;
}

.empty-cell {
  color: var(--color-text-muted);
  text-align: center;
}
</style>
