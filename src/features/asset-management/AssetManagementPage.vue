<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import type { Device } from "../../types/domain";
import type { ImportValidationResult } from "../../types/import";
import {
  buildAssetOperationError,
  type AssetOperationNotice,
} from "../../services/asset/operationNotice";
import { buildImportedDevices } from "../../services/import/deviceImport";
import type { DeviceImportSummary } from "../../stores/assetStore";
import { useAssetStore } from "../../stores/assetStore";
import { useRoomStore } from "../../stores/roomStore";
import AssetTable from "./components/AssetTable.vue";
import AssetToolbar from "./components/AssetToolbar.vue";
import DeviceFormDrawer from "./components/DeviceFormDrawer.vue";
import ExcelImportDialog from "./components/ExcelImportDialog.vue";

const assetStore = useAssetStore();
const roomStore = useRoomStore();
const search = ref("");
const drawerOpen = ref(false);
const importOpen = ref(false);
const importSaving = ref(false);
const importSummary = ref<DeviceImportSummary | null>(null);
const editingDevice = ref<Device | null>(null);
const operationNotice = ref<AssetOperationNotice | null>(null);

const filteredDevices = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return assetStore.devices;

  return assetStore.devices.filter((device) =>
    [
      device.computerName,
      device.businessIp,
      device.managementIp,
      device.assetNo,
      device.serialNumber,
      device.purpose,
      device.owner,
    ]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(keyword)),
  );
});

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices()]);
});

function openAddDrawer() {
  operationNotice.value = null;
  editingDevice.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(device: Device) {
  operationNotice.value = null;
  editingDevice.value = device;
  drawerOpen.value = true;
}

function openImportDialog() {
  importSummary.value = null;
  importOpen.value = true;
}

async function saveDevice(device: Device) {
  operationNotice.value = null;
  try {
    await assetStore.upsertDevice(device);
    drawerOpen.value = false;
  } catch (error) {
    operationNotice.value = buildAssetOperationError("save", error);
  }
}

async function deleteDevice(device: Device) {
  if (!window.confirm(`确认删除设备 ${device.computerName || device.name}？`)) {
    return;
  }
  operationNotice.value = null;
  try {
    await assetStore.deleteDevice(device.id);
  } catch (error) {
    operationNotice.value = buildAssetOperationError("delete", error);
  }
}

async function confirmImport(result: ImportValidationResult) {
  importSaving.value = true;
  importSummary.value = null;
  operationNotice.value = null;
  const importedDevices = buildImportedDevices(result);
  try {
    importSummary.value =
      await assetStore.importDevicesWithSummary(importedDevices);
    if (importSummary.value.failed === 0) {
      importOpen.value = false;
    }
  } catch (error) {
    operationNotice.value = buildAssetOperationError("import", error);
  } finally {
    importSaving.value = false;
  }
}

function exportDevices() {
  const rows = filteredDevices.value.map((device) => ({
    计算机名: device.computerName,
    业务IP: device.businessIp,
    带外IP: device.managementIp,
    用途: device.purpose,
    责任人: device.owner,
    厂商: device.vendor,
    型号: device.model,
    所属机柜:
      roomStore.racks.find((rack) => rack.id === device.rackId)?.name ??
      device.rackId,
    起始U位: device.startU,
    高度U: device.heightU,
    设备大类: device.categoryId,
    设备子类型: device.subtype,
    固定资产编号: device.assetNo,
    SN号: device.serialNumber,
    维保到期: device.warrantyExpireAt,
    硬件配置: device.hardwareSpec,
    操作系统: device.operatingSystem,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "设备清单");
  XLSX.writeFile(
    workbook,
    `泉峰AI数据中心设备清单-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">资产管理</h2>
        <p class="page-subtitle">
          维护设备、固定资产编号、计算机名、业务IP、用途、责任人和硬件配置。
        </p>
      </div>
    </div>

    <AssetToolbar
      v-model:search="search"
      @add="openAddDrawer"
      @import="openImportDialog"
      @export="exportDevices"
    />
    <div v-if="operationNotice" class="operation-notice" role="alert">
      <strong>{{ operationNotice.title }}</strong>
      <span>{{ operationNotice.message }}</span>
      <button
        type="button"
        aria-label="关闭提示"
        @click="operationNotice = null"
      >
        ×
      </button>
    </div>
    <AssetTable
      :devices="filteredDevices"
      :racks="roomStore.racks"
      @edit="openEditDrawer"
      @delete="deleteDevice"
    />
    <DeviceFormDrawer
      :open="drawerOpen"
      :device="editingDevice"
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @close="drawerOpen = false"
      @save="saveDevice"
    />
    <ExcelImportDialog
      :open="importOpen"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      :saving="importSaving"
      :import-summary="importSummary"
      @close="importOpen = false"
      @confirm="confirmImport"
    />
  </section>
</template>

<style scoped>
.operation-notice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(239, 68, 68, 0.42);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.28);
}

.operation-notice strong {
  color: #fecaca;
}

.operation-notice span {
  min-width: 0;
  color: var(--color-text-muted);
}

.operation-notice button {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(239, 68, 68, 0.34);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.66);
  cursor: pointer;
}
</style>
