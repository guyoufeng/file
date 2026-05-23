<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import type { Device } from "../../types/domain";
import type { ImportValidationResult } from "../../types/import";
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
  editingDevice.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(device: Device) {
  editingDevice.value = device;
  drawerOpen.value = true;
}

function openImportDialog() {
  importSummary.value = null;
  importOpen.value = true;
}

async function saveDevice(device: Device) {
  await assetStore.upsertDevice(device);
  drawerOpen.value = false;
}

async function deleteDevice(device: Device) {
  if (!window.confirm(`确认删除设备 ${device.computerName || device.name}？`)) {
    return;
  }
  await assetStore.deleteDevice(device.id);
}

async function confirmImport(result: ImportValidationResult) {
  importSaving.value = true;
  importSummary.value = null;
  const importedDevices = buildImportedDevices(result);
  try {
    importSummary.value =
      await assetStore.importDevicesWithSummary(importedDevices);
    if (importSummary.value.failed === 0) {
      importOpen.value = false;
    }
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
