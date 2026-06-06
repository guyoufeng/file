<script setup lang="ts">
import { computed, ref } from "vue";
import AssetSyncDialog from "../asset-management/components/AssetSyncDialog.vue";
import TableColumnSettings from "../../components/TableColumnSettings.vue";
import {
  addVirtualServer,
  filterVirtualServers,
  loadVirtualServers,
  saveVirtualServers,
  type VirtualServerInput,
  type VirtualServer,
} from "./virtualServers";
import type { AssetSyncConfig } from "../../services/asset/assetSyncConfig";
import type { DataTableColumn, ResolvedDataTableColumn } from "../../services/table/tableColumnPreferences";
import { useTableColumnResize } from "../../services/table/tableColumnResize";

const search = ref("");
const syncOpen = ref(false);
const manualOpen = ref(false);
const servers = ref<VirtualServer[]>(loadVirtualServers());
const tableColumns: DataTableColumn[] = [
  { id: "name", label: "虚拟机名", locked: true, width: 210, minWidth: 150 },
  { id: "businessIp", label: "业务IP", width: 150 },
  { id: "platform", label: "平台", width: 120 },
  { id: "purpose", label: "用途", width: 190 },
  { id: "owner", label: "责任人", width: 120 },
  { id: "hostDeviceName", label: "宿主物理服务器", width: 210, minWidth: 150 },
  { id: "status", label: "状态", width: 110 },
];
const activeColumns = ref<ResolvedDataTableColumn[]>([]);
const tableId = "virtual-servers";
const { columnWidthStyle, startColumnResize } = useTableColumnResize(
  tableId,
  tableColumns,
  (columns) => {
    activeColumns.value = columns;
  },
);
const message = ref("虚拟服务器独立管理，不占用机柜 U 位，通过宿主物理服务器关联到数据中心。");
const form = ref<VirtualServerInput>({
  name: "",
  platform: "ZStack",
  businessIp: "",
  os: "",
  purpose: "",
  owner: "",
  hostDeviceName: "",
  status: "running",
});

const filteredServers = computed(() =>
  filterVirtualServers(servers.value, search.value),
);
const visibleColumns = computed(() => activeColumns.value.filter((column) => column.visible));

function confirmMcpSync(config: AssetSyncConfig) {
  syncOpen.value = false;
  message.value = `已保存 ${config.name} 配置，后续可通过 ZStack MCP 同步虚拟服务器。`;
}

function resetForm() {
  form.value = {
    name: "",
    platform: "ZStack",
    businessIp: "",
    os: "",
    purpose: "",
    owner: "",
    hostDeviceName: "",
    status: "running",
  };
}

function saveManualVirtualServer() {
  const result = addVirtualServer(servers.value, form.value);
  message.value = result.message;
  if (!result.ok) return;

  servers.value = result.servers;
  saveVirtualServers(result.servers);
  manualOpen.value = false;
  resetForm();
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">虚拟服务器管理</h2>
        <p class="page-subtitle">
          管理 ZStack、VMware 等虚拟机资源，并关联承载它们的虚拟化物理服务器。
        </p>
      </div>
    </div>

    <div class="virtual-toolbar">
      <input v-model="search" type="search" placeholder="搜索虚拟机名、业务IP、用途、责任人、宿主服务器" />
      <button type="button" @click="manualOpen = true">手动录入</button>
      <button type="button">Excel导入</button>
      <button type="button" @click="syncOpen = true">MCP同步</button>
      <TableColumnSettings
        :table-id="tableId"
        :columns="tableColumns"
        @update:columns="activeColumns = $event"
      />
    </div>

    <p class="virtual-message">{{ message }}</p>

    <div class="virtual-table">
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
          <tr v-for="server in filteredServers" :key="server.id">
            <td v-for="column in visibleColumns" :key="column.id">
              <template v-if="column.id === 'name'">{{ server.name }}</template>
              <template v-else-if="column.id === 'businessIp'">{{ server.businessIp || '-' }}</template>
              <template v-else-if="column.id === 'platform'">{{ server.platform }}</template>
              <template v-else-if="column.id === 'purpose'">{{ server.purpose || '-' }}</template>
              <template v-else-if="column.id === 'owner'">{{ server.owner || '-' }}</template>
              <template v-else-if="column.id === 'hostDeviceName'">{{ server.hostDeviceName || '未关联' }}</template>
              <template v-else-if="column.id === 'status'">{{ server.status }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AssetSyncDialog
      :open="syncOpen"
      type="mcp"
      @close="syncOpen = false"
      @confirm="confirmMcpSync"
    />

    <div v-if="manualOpen" class="modal-mask" @click.self="manualOpen = false">
      <form class="virtual-dialog" @submit.prevent="saveManualVirtualServer">
        <div class="dialog-header">
          <div>
            <p class="eyebrow">手动录入</p>
            <h3>新增虚拟服务器</h3>
          </div>
          <button type="button" class="icon-button" @click="manualOpen = false">×</button>
        </div>

        <div class="form-grid">
          <label>
            虚拟机名
            <input v-model="form.name" placeholder="MES-VM-DB-01" />
          </label>
          <label>
            业务IP
            <input v-model="form.businessIp" placeholder="192.168.129.90" />
          </label>
          <label>
            平台
            <select v-model="form.platform">
              <option value="ZStack">ZStack</option>
              <option value="VMware">VMware</option>
              <option value="Other">其他</option>
            </select>
          </label>
          <label>
            状态
            <select v-model="form.status">
              <option value="running">运行中</option>
              <option value="stopped">已停止</option>
              <option value="warning">异常</option>
              <option value="unknown">未知</option>
            </select>
          </label>
          <label>
            操作系统
            <input v-model="form.os" placeholder="Rocky Linux 9" />
          </label>
          <label>
            责任人
            <input v-model="form.owner" placeholder="张文军" />
          </label>
          <label>
            用途
            <input v-model="form.purpose" placeholder="MES数据库虚拟机" />
          </label>
          <label>
            宿主物理服务器
            <input v-model="form.hostDeviceName" placeholder="QF-SRV-001" />
          </label>
        </div>

        <div class="dialog-actions">
          <button type="button" class="ghost" @click="manualOpen = false">取消</button>
          <button type="submit">保存虚拟服务器</button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.virtual-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

input {
  width: min(520px, 100%);
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}

select {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
}

button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.64);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}

.virtual-message {
  color: var(--color-text-muted);
}

.virtual-table {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  box-shadow: var(--shadow-soft);
}

table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

th {
  position: relative;
  color: var(--color-text-muted);
  background: var(--table-header-bg);
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

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(3, 7, 18, 0.62);
  backdrop-filter: blur(8px);
}

.virtual-dialog {
  width: min(720px, 100%);
  padding: 18px;
  border: 1px solid rgba(56, 189, 248, 0.36);
  border-radius: 8px;
  background: var(--surface-glass);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.2);
}

.dialog-header,
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dialog-header h3 {
  margin: 4px 0 0;
}

.eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.icon-button {
  width: 32px;
  min-height: 32px;
  padding: 0;
  border-color: var(--color-border);
  background: var(--control-bg-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 13px;
}

label input {
  width: 100%;
}

.ghost {
  border-color: var(--color-border);
  background: var(--control-bg-muted);
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
