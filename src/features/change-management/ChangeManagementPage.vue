<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAssetStore } from "../../stores/assetStore";
import { useRoomStore } from "../../stores/roomStore";
import {
  createChangeEvent,
  deleteChangeEvent,
  getChangeEvents,
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
const editingId = ref("");
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
</script>

<template>
  <section class="page change-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">变更管理</h2>
        <p class="page-subtitle">记录物理机上架、下架、接线、维修、安装和配置调整，并联动资产、机柜与 AI 查询。</p>
      </div>
    </div>

    <div class="change-layout">
      <form class="change-form-panel" @submit.prevent="submitChange">
        <header>
          <div>
            <p class="eyebrow">{{ editingId ? "Edit Change" : "New Change" }}</p>
            <h3>{{ editingId ? "编辑变更记录" : "新增变更记录" }}</h3>
          </div>
          <button type="button" @click="resetForm">清空</button>
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

      <section class="change-list-panel">
        <header>
          <div>
            <p class="eyebrow">Change Records</p>
            <h3>变更记录</h3>
          </div>
          <input v-model="keyword" placeholder="搜索服务器、IP、机柜、接线、操作人" />
        </header>
        <div class="change-record-list">
          <article v-for="record in filteredRecords" :key="record.id">
            <div>
              <strong>{{ record.title }}</strong>
              <span>{{ record.changedAt }} / {{ record.operator }} / {{ record.status }}</span>
            </div>
            <p>{{ record.content }}</p>
            <footer>
              <span>{{ record.roomName || "-" }} / {{ record.rackName || "-" }} / {{ record.deviceName || "-" }}</span>
              <div>
                <button type="button" @click="locateChange(record)">定位</button>
                <button type="button" @click="editChange(record)">编辑</button>
                <button type="button" @click="removeChange(record.id)">删除</button>
              </div>
            </footer>
          </article>
          <p v-if="filteredRecords.length === 0" class="empty">暂无变更记录。后续上架、维修、接线和配置调整都建议记录在这里。</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.change-page {
  display: grid;
  gap: 16px;
}

.change-layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.change-form-panel,
.change-list-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.change-form-panel header,
.change-list-panel header {
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

.change-record-list {
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 260px);
  overflow: auto;
}

.change-record-list article {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.change-record-list article > div {
  display: grid;
  gap: 4px;
}

.change-record-list strong {
  color: var(--color-text);
}

.change-record-list span,
.change-record-list p,
.empty {
  color: var(--color-text-muted);
  line-height: 1.6;
}

.change-record-list footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.change-record-list footer div {
  display: flex;
  gap: 6px;
}

@media (max-width: 980px) {
  .change-layout,
  .two-cols,
  .link-context {
    grid-template-columns: 1fr;
  }
}
</style>
