<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import * as XLSX from "xlsx";
import { useRouter } from "vue-router";
import TableColumnSettings from "../../components/TableColumnSettings.vue";
import { useAssetStore } from "../../stores/assetStore";
import { useRoomStore } from "../../stores/roomStore";
import type { DataTableColumn, ResolvedDataTableColumn } from "../../services/table/tableColumnPreferences";
import { useTableColumnResize } from "../../services/table/tableColumnResize";
import {
  createChangeEvent,
  deleteChangeEvent,
  getChangeEvents,
  importChangeEventsFromRows,
  searchChangeEvents,
  updateChangeEvent,
  type ChangeEvent,
  type ChangeEventStatus,
  type ChangeEventType,
} from "./changeEvents";

const router = useRouter();
const assetStore = useAssetStore();
const roomStore = useRoomStore();
const keyword = ref("");
const records = ref<ChangeEvent[]>([]);
const tableColumns: DataTableColumn[] = [
  { id: "title", label: "变更标题", locked: true, width: 240, minWidth: 170 },
  { id: "typeStatus", label: "类型/状态", width: 140 },
  { id: "device", label: "关联设备", width: 220, minWidth: 160 },
  { id: "changedAt", label: "变更时间", width: 190, minWidth: 150 },
  { id: "content", label: "内容摘要", width: 300, minWidth: 180 },
  { id: "actions", label: "操作", locked: true, width: 190, minWidth: 150 },
];
const activeColumns = ref<ResolvedDataTableColumn[]>([]);
const tableId = "change-management";
const { columnWidthStyle, startColumnResize } = useTableColumnResize(
  tableId,
  tableColumns,
  (columns) => {
    activeColumns.value = columns;
  },
);
const editingId = ref("");
const formWindowOpen = ref(false);
const excelWindowOpen = ref(false);
const formWindowRef = ref<HTMLElement | null>(null);
const excelWindowRef = ref<HTMLElement | null>(null);
const windowPosition = ref({ x: 360, y: 130 });
const excelMessage = ref("请选择变更记录 Excel，系统会按标题、类型、设备、IP、机房、机柜、时间、内容等字段导入。");
const form = reactive({
  title: "",
  type: "maintenance" as ChangeEventType,
  status: "completed" as ChangeEventStatus,
  deviceId: "",
  operator: "admin",
  changedAt: new Date().toISOString().slice(0, 16),
  content: "",
  impact: "",
  result: "",
  attachments: "",
});
let dragState:
  | { startX: number; startY: number; originX: number; originY: number }
  | null = null;

const typeOptions: Array<{ value: ChangeEventType; label: string }> = [
  { value: "rack_mount", label: "物理机上架" },
  { value: "rack_unmount", label: "物理机下架" },
  { value: "maintenance", label: "维修维护" },
  { value: "cabling", label: "接线调整" },
  { value: "software", label: "软件安装" },
  { value: "configuration", label: "配置修改" },
  { value: "inspection", label: "巡检复核" },
  { value: "other", label: "其他" },
];
const statusOptions: Array<{ value: ChangeEventStatus; label: string }> = [
  { value: "planned", label: "计划中" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "reviewed", label: "已复核" },
  { value: "cancelled", label: "已取消" },
];

const selectedDevice = computed(() =>
  assetStore.devices.find((device) => device.id === form.deviceId),
);
const selectedRack = computed(() =>
  roomStore.racks.find((rack) => rack.id === selectedDevice.value?.rackId),
);
const selectedRoom = computed(() =>
  roomStore.rooms.find((room) => room.id === selectedRack.value?.roomId),
);
const filteredRecords = computed(() =>
  keyword.value.trim() ? searchChangeEvents(keyword.value, records.value) : records.value,
);
const visibleColumns = computed(() => activeColumns.value.filter((column) => column.visible));

watch(
  () => form.deviceId,
  () => {
    const device = selectedDevice.value;
    if (!device) return;
    if (!form.title.trim()) {
      form.title = `${device.computerName || device.name} 运维变更`;
    }
  },
);

onMounted(async () => {
  await Promise.all([assetStore.loadDevices(), roomStore.loadRooms()]);
  refreshRecords();
  document.addEventListener("pointerdown", closeFloatingWhenOutside, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeFloatingWhenOutside, true);
  window.removeEventListener("pointermove", moveWindow);
  window.removeEventListener("pointerup", stopDrag);
});

function refreshRecords() {
  records.value = getChangeEvents();
}

function resetForm() {
  editingId.value = "";
  form.title = "";
  form.type = "maintenance";
  form.status = "completed";
  form.deviceId = "";
  form.operator = "admin";
  form.changedAt = new Date().toISOString().slice(0, 16);
  form.content = "";
  form.impact = "";
  form.result = "";
  form.attachments = "";
}

function openManualForm() {
  resetForm();
  formWindowOpen.value = true;
  excelWindowOpen.value = false;
  windowPosition.value = {
    x: Math.max(16, window.innerWidth - 620),
    y: 126,
  };
}

function openExcelImport() {
  excelWindowOpen.value = true;
  formWindowOpen.value = false;
  excelMessage.value = "请选择变更记录 Excel，系统会按标题、类型、设备、IP、机房、机柜、时间、内容等字段导入。";
  windowPosition.value = {
    x: Math.max(16, window.innerWidth - 560),
    y: 150,
  };
}

function submitChange() {
  if (!form.title.trim()) return;
  const device = selectedDevice.value;
  const rack = selectedRack.value;
  const room = selectedRoom.value;
  const payload = {
    title: form.title.trim(),
    type: form.type,
    status: form.status,
    roomId: room?.id,
    roomName: room?.name,
    rackId: rack?.id,
    rackName: rack?.name,
    deviceId: device?.id,
    deviceName: device?.computerName || device?.name,
    businessIp: device?.businessIp,
    operator: form.operator.trim() || "admin",
    changedAt: new Date(form.changedAt).toISOString(),
    content: form.content.trim() || "未填写变更内容",
    impact: form.impact.trim(),
    result: form.result.trim(),
    attachments: form.attachments
      .split(/[,\s，、]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  };

  if (editingId.value) {
    updateChangeEvent(editingId.value, payload);
  } else {
    createChangeEvent(payload);
  }
  refreshRecords();
  resetForm();
  formWindowOpen.value = false;
}

function editChange(record: ChangeEvent) {
  editingId.value = record.id;
  form.title = record.title;
  form.type = record.type;
  form.status = record.status;
  form.deviceId = record.deviceId || "";
  form.operator = record.operator;
  form.changedAt = record.changedAt.slice(0, 16);
  form.content = record.content;
  form.impact = record.impact || "";
  form.result = record.result || "";
  form.attachments = record.attachments.join("，");
  formWindowOpen.value = true;
  excelWindowOpen.value = false;
  windowPosition.value = {
    x: Math.max(16, window.innerWidth - 620),
    y: 126,
  };
}

function removeChange(id: string) {
  deleteChangeEvent(id);
  refreshRecords();
  if (editingId.value === id) resetForm();
}

function locateChange(record: ChangeEvent) {
  if (!record.rackId && !record.deviceId) return;
  void router.push({
    path: "/rack-overview",
    query: {
      roomId: record.roomId,
      rackId: record.rackId,
      deviceId: record.deviceId,
      focus: Date.now().toString(),
      view: "u-view",
    },
  });
}

function startDrag(event: PointerEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button,input,select,textarea,label")) return;
  dragState = {
    startX: event.clientX,
    startY: event.clientY,
    originX: windowPosition.value.x,
    originY: windowPosition.value.y,
  };
  window.addEventListener("pointermove", moveWindow);
  window.addEventListener("pointerup", stopDrag);
}

function moveWindow(event: PointerEvent) {
  if (!dragState) return;
  windowPosition.value = {
    x: Math.max(8, Math.min(window.innerWidth - 520, dragState.originX + event.clientX - dragState.startX)),
    y: Math.max(8, Math.min(window.innerHeight - 420, dragState.originY + event.clientY - dragState.startY)),
  };
}

function stopDrag() {
  dragState = null;
  window.removeEventListener("pointermove", moveWindow);
  window.removeEventListener("pointerup", stopDrag);
}

function closeFloatingWhenOutside(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target) return;
  if (formWindowOpen.value && formWindowRef.value?.contains(target)) return;
  if (excelWindowOpen.value && excelWindowRef.value?.contains(target)) return;
  formWindowOpen.value = false;
  excelWindowOpen.value = false;
}

async function handleChangeExcel(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const imported = importChangeEventsFromRows(rows);
  refreshRecords();
  excelMessage.value = `已导入 ${imported.length} 条变更记录。`;
  input.value = "";
}
</script>

<template>
  <section class="page change-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">变更管理</h2>
        <p class="page-subtitle">记录物理机上架、下架、接线、维修、安装和配置调整，并联动资产、机柜与 AI 查询。</p>
      </div>
      <div class="header-actions">
        <button type="button" @click.stop="openManualForm">手动录入</button>
        <button type="button" @click.stop="openExcelImport">Excel录入</button>
      </div>
    </div>

    <div class="change-layout">
      <form
        v-if="formWindowOpen"
        ref="formWindowRef"
        class="change-form-panel floating-panel"
        :style="{ left: `${windowPosition.x}px`, top: `${windowPosition.y}px` }"
        role="dialog"
        aria-label="变更记录录入"
        @submit.prevent="submitChange"
        @pointerdown.stop
      >
        <header @pointerdown="startDrag">
          <div>
            <p class="eyebrow">{{ editingId ? "Edit Change" : "New Change" }}</p>
            <h3>{{ editingId ? "编辑变更记录" : "新增变更记录" }}</h3>
          </div>
          <div class="inline-actions">
            <button type="button" @click="resetForm">清空</button>
            <button type="button" @click="formWindowOpen = false">关闭</button>
          </div>
        </header>
        <label>
          变更标题
          <input v-model="form.title" placeholder="例如：MES-DB-01 更换内存并调整接线" />
        </label>
        <div class="two-cols">
          <label>
            变更类型
            <select v-model="form.type">
              <option v-for="option in typeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
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
          关联物理设备
          <select v-model="form.deviceId">
            <option value="">不关联具体设备</option>
            <option v-for="device in assetStore.devices" :key="device.id" :value="device.id">
              {{ device.computerName || device.name }} / {{ device.businessIp || "无业务IP" }}
            </option>
          </select>
        </label>
        <div class="link-context">
          <span>机房：{{ selectedRoom?.name || "-" }}</span>
          <span>机柜：{{ selectedRack?.name || "-" }}</span>
          <span>U位：{{ selectedDevice ? `${selectedDevice.startU}U-${selectedDevice.endU}U` : "-" }}</span>
        </div>
        <div class="two-cols">
          <label>
            操作人
            <input v-model="form.operator" />
          </label>
          <label>
            变更时间
            <input v-model="form.changedAt" type="datetime-local" />
          </label>
        </div>
        <label>
          变更内容
          <textarea v-model="form.content" rows="4" placeholder="说明调整内容、接线端口、维修步骤、安装软件或配置变化" />
        </label>
        <div class="two-cols">
          <label>
            影响范围
            <input v-model="form.impact" placeholder="例如：无业务中断 / 影响 MES 数据库" />
          </label>
          <label>
            处理结果
            <input v-model="form.result" placeholder="例如：完成验证 / 待复核" />
          </label>
        </div>
        <label>
          附件/照片
          <input v-model="form.attachments" placeholder="多个附件用逗号分隔" />
        </label>
        <button class="primary-action" type="submit">{{ editingId ? "保存变更" : "新增变更" }}</button>
      </form>

      <aside
        v-if="excelWindowOpen"
        ref="excelWindowRef"
        class="excel-window floating-panel"
        :style="{ left: `${windowPosition.x}px`, top: `${windowPosition.y}px` }"
        role="dialog"
        aria-label="Excel录入变更记录"
        @pointerdown.stop
      >
        <header @pointerdown="startDrag">
          <div>
            <p class="eyebrow">Excel Import</p>
            <h3>Excel录入变更记录</h3>
          </div>
          <button type="button" @click="excelWindowOpen = false">关闭</button>
        </header>
        <p>{{ excelMessage }}</p>
        <label class="upload-box">
          选择 Excel 文件
          <input type="file" accept=".xlsx,.xls,.csv" @change="handleChangeExcel" />
        </label>
        <small>建议字段：变更标题、变更类型、状态、设备名称、业务IP、机房、机柜、操作人、变更时间、变更内容、影响范围、处理结果。</small>
      </aside>

      <section class="change-list-panel">
        <header>
          <div>
            <p class="eyebrow">Change Records</p>
            <h3>变更记录</h3>
          </div>
          <div class="list-tools">
            <input v-model="keyword" placeholder="搜索服务器、IP、机柜、接线、操作人" />
            <TableColumnSettings
              :table-id="tableId"
              :columns="tableColumns"
              @update:columns="activeColumns = $event"
            />
          </div>
        </header>
        <div class="change-record-list table-wrap">
          <table>
            <colgroup>
              <col v-for="column in visibleColumns" :key="column.id" :style="columnWidthStyle(column)" />
            </colgroup>
            <thead>
              <tr>
                <th v-for="column in visibleColumns" :key="column.id" :style="columnWidthStyle(column)">
                  <span>{{ column.label }}</span>
                  <span
                    class="column-resizer"
                    aria-hidden="true"
                    @pointerdown="startColumnResize(column, $event)"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in filteredRecords"
                :key="record.id"
                tabindex="0"
                @click="editChange(record)"
                @keydown.enter="editChange(record)"
              >
                <td
                  v-for="column in visibleColumns"
                  :key="column.id"
                  :class="{ 'row-actions': column.id === 'actions' }"
                >
                  <template v-if="column.id === 'title'">
                    <strong>{{ record.title }}</strong><small>{{ record.operator }}</small>
                  </template>
                  <template v-else-if="column.id === 'typeStatus'">{{ record.type }}<br /><small>{{ record.status }}</small></template>
                  <template v-else-if="column.id === 'device'">{{ record.roomName || "-" }} / {{ record.rackName || "-" }}<br /><small>{{ record.deviceName || "-" }}</small></template>
                  <template v-else-if="column.id === 'changedAt'">{{ record.changedAt }}</template>
                  <template v-else-if="column.id === 'content'">{{ record.content }}</template>
                  <template v-else-if="column.id === 'actions'">
                    <button type="button" @click.stop="locateChange(record)">定位</button>
                    <button type="button" @click.stop="editChange(record)">编辑</button>
                    <button type="button" @click.stop="removeChange(record.id)">删除</button>
                  </template>
                </td>
              </tr>
              <tr v-if="filteredRecords.length === 0">
                <td :colspan="visibleColumns.length || 1" class="empty">暂无变更记录。后续上架、维修、接线和配置调整都建议记录在这里。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.change-page {
  display: block;
  padding-top: 26px;
}

.page-header {
  margin-bottom: 16px;
}

.header-actions,
.inline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-layout {
  display: grid;
  gap: 16px;
  align-content: start;
}

.change-form-panel,
.change-list-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.floating-panel {
  position: fixed;
  z-index: 95;
  width: min(560px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
  overflow: auto;
}

.change-form-panel header,
.change-list-panel header {
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr);
  align-items: end;
  gap: 12px;
}

.list-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
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

.primary-action {
  border-color: rgba(14, 165, 233, 0.72);
  background: color-mix(in srgb, var(--color-primary) 18%, var(--control-bg));
}

.two-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.link-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.link-context span {
  min-width: 0;
  overflow: hidden;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: var(--color-panel);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-list-panel header input {
  max-width: 320px;
}

.table-wrap {
  max-height: calc(100vh - 260px);
  overflow: auto;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

th {
  position: relative;
  color: var(--color-text-muted);
  font-size: 12px;
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-panel));
}

th span {
  display: block;
  overflow: hidden;
  padding-right: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-resizer {
  position: absolute;
  top: 7px;
  right: 0;
  width: 8px;
  height: calc(100% - 14px);
  min-height: 0;
  padding: 0;
  border: 0;
  border-right: 2px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  border-radius: 0;
  background: transparent;
  cursor: col-resize;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover,
tbody tr:focus {
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  outline: none;
}

td strong,
.change-record-list strong {
  display: block;
  color: var(--color-text);
}

td small,
.empty {
  color: var(--color-text-muted);
  line-height: 1.6;
}

.row-actions {
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 6px;
}

.excel-window {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.excel-window p,
.excel-window small {
  color: var(--color-text-muted);
  line-height: 1.6;
}

.upload-box {
  min-height: 92px;
  place-items: center;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 42%, var(--color-border));
  border-radius: 8px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-panel));
  cursor: pointer;
}

.upload-box input {
  width: auto;
}

@media (max-width: 980px) {
  .change-layout,
  .two-cols,
  .link-context,
  .change-list-panel header {
    grid-template-columns: 1fr;
  }
}
</style>
