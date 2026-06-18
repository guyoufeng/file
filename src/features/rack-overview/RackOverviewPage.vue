<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import type { Device, Rack, RackType } from "../../types/domain";
import type { DeviceSearchResult } from "../../services/search/deviceSearch";
import { useAlertStore } from "../../stores/alertStore";
import { useAssetStore } from "../../stores/assetStore";
import { useRoomStore } from "../../stores/roomStore";
import DataCenterSelector from "./components/DataCenterSelector.vue";
import GlobalSearchBox from "./components/GlobalSearchBox.vue";
import LayoutOverview from "./components/LayoutOverview.vue";
import RackUView from "./components/RackUView.vue";
import RightDetailDrawer from "./components/RightDetailDrawer.vue";
import ViewModeTabs, { type ViewMode } from "./components/ViewModeTabs.vue";
import DeviceFormDrawer from "../asset-management/components/DeviceFormDrawer.vue";
import { getRoomOptions, getRoomRacks } from "./layout";
import { getRackOverviewMetrics } from "./metrics";
import { writeSystemAuditLog } from "../../services/backend/ai";

const Rack3DView = defineAsyncComponent(
  () => import("./components/Rack3DView.vue"),
);

const roomStore = useRoomStore();
const assetStore = useAssetStore();
const alertStore = useAlertStore();
const route = useRoute();

const selectedRoomId = ref<string | null>(null);
const selectedRack = ref<Rack | null>(null);
const selectedDeviceId = ref<string | null>(null);
const viewMode = ref<ViewMode>("u-view");
const detailOpen = ref(false);
const deviceEditorOpen = ref(false);
const editingDevice = ref<Device | null>(null);
const alertSummaryOpen = ref(false);
const roomMenu = ref({
  open: false,
  x: 0,
  y: 0,
  mode: "actions" as "actions" | "add" | "rename" | "delete" | "restore",
});
const rackMenu = ref({
  open: false,
  x: 0,
  y: 0,
  mode: "actions" as "actions" | "add" | "rename" | "delete" | "restore",
});
const roomFormName = ref("");
const roomFormTargetId = ref("");
const rackFormName = ref("");
const rackFormTargetId = ref("");
const rackFormType = ref<RackType>("server");

const roomOptions = computed(() => getRoomOptions(roomStore.rooms));
const selectedRoom = computed(
  () =>
    roomOptions.value.find((room) => room.id === selectedRoomId.value) ??
    roomOptions.value[0],
);
const selectedRoomRacks = computed(() =>
  getRoomRacks(selectedRoom.value, roomStore.racks),
);
const activeRack = computed(() => selectedRack.value);
const selectedDevice = computed(
  () =>
    assetStore.devices.find((device) => device.id === selectedDeviceId.value) ??
    null,
);
const overviewMetrics = computed(() =>
  getRackOverviewMetrics(
    roomStore.rooms,
    roomStore.racks,
    assetStore.devices,
    alertStore.alerts,
    selectedRoom.value?.id,
  ),
);
const recoverableRooms = computed(() =>
  roomStore.deletedTopology.filter((item) => item.type === "room"),
);
const recoverableRacks = computed(() =>
  roomStore.deletedTopology.filter((item) => item.type === "rack"),
);
const locationFocusText = computed(() => {
  if (!selectedRack.value && !selectedDevice.value) return "";

  const rackName = selectedRack.value?.name ?? "未知机柜";
  if (!selectedDevice.value) return `已定位：${rackName}`;

  const deviceName =
    selectedDevice.value.computerName || selectedDevice.value.name;
  return `已定位：${rackName} / ${deviceName} / ${selectedDevice.value.businessIp ?? "无业务IP"} / ${selectedDevice.value.startU}U-${selectedDevice.value.endU}U`;
});
const currentAlertItems = computed(() => {
  const selectedRackIds = new Set(selectedRoomRacks.value.map((rack) => rack.id));
  return alertStore.alerts
    .filter((alert) => alert.status !== "recovered" && alert.status !== "closed")
    .map((alert) => {
      const device = assetStore.devices.find((item) => item.id === alert.deviceId);
      const rack = roomStore.racks.find((item) => item.id === device?.rackId);
      const room = roomStore.rooms.find((item) => item.id === rack?.roomId);
      return { alert, device, rack, room };
    })
    .filter((item) => item.rack && selectedRackIds.has(item.rack.id))
    .sort((first, second) => second.alert.startedAt.localeCompare(first.alert.startedAt));
});
watch(roomOptions, (rooms) => {
  if (!selectedRoomId.value && rooms.length > 0) {
    selectedRoomId.value = rooms[0].id;
  }
});

watch(selectedRoomId, () => {
  selectedRack.value = null;
  selectedDeviceId.value = null;
  detailOpen.value = false;
});

watch(
  () => route.query,
  async () => {
    await applyRouteSelection();
  },
);

onMounted(async () => {
  await Promise.all([
    roomStore.loadRooms(),
    assetStore.loadDevices(),
    alertStore.loadAlerts(),
  ]);
  await applyRouteSelection();
});

async function applyRouteSelection() {
  if (typeof route.query.roomId === "string")
    selectedRoomId.value = route.query.roomId;
  await nextTick();
  if (typeof route.query.rackId === "string")
    selectedRack.value =
      roomStore.racks.find((rack) => rack.id === route.query.rackId) ?? null;
  if (typeof route.query.deviceId === "string")
    selectedDeviceId.value = route.query.deviceId;
  if (route.query.view === "u-view") viewMode.value = "u-view";
  if (selectedRack.value || selectedDeviceId.value) {
    detailOpen.value = !selectedDeviceId.value;
    if (selectedDeviceId.value) viewMode.value = "u-view";
  }
}

async function locateSearchResult(result: DeviceSearchResult) {
  if (result.room) {
    selectedRoomId.value = result.room.id;
  }
  await nextTick();
  selectedRack.value = result.rack ?? null;
  selectedDeviceId.value = result.device.id;
  detailOpen.value = true;
  viewMode.value = "layout";
}

function selectRack(rack: Rack) {
  selectedRack.value = rack;
  selectedDeviceId.value = null;
  detailOpen.value = true;
  alertSummaryOpen.value = false;
}

function openDeviceEditor(device: Device) {
  editingDevice.value = device;
  selectedDeviceId.value = device.id;
  deviceEditorOpen.value = true;
}

function selectDeviceFromRack(device: Device) {
  const rack = roomStore.racks.find((item) => item.id === device.rackId);
  if (rack) {
    selectedRack.value = rack;
  }
  detailOpen.value = false;
  openDeviceEditor(device);
}

async function locateAlertItem(item: (typeof currentAlertItems.value)[number]) {
  if (item.room) selectedRoomId.value = item.room.id;
  await nextTick();
  selectedRack.value = item.rack ?? null;
  selectedDeviceId.value = item.device?.id ?? null;
  viewMode.value = "u-view";
  detailOpen.value = false;
  alertSummaryOpen.value = false;
}

async function saveDevice(device: Device) {
  const saved = await assetStore.upsertDevice(device);
  editingDevice.value = saved;
  selectedDeviceId.value = saved.id;
  deviceEditorOpen.value = false;
}

function clampMenuPosition(event: MouseEvent) {
  const menuWidth = 260;
  const menuHeight = 280;
  return {
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
  };
}

function openRoomManagementMenu(event: MouseEvent) {
  if (!selectedRoom.value) return;
  closeRackMenu();
  const position = clampMenuPosition(event);
  roomMenu.value = {
    open: true,
    x: position.x,
    y: position.y,
    mode: "actions",
  };
  roomFormTargetId.value = selectedRoom.value.id;
  roomFormName.value = selectedRoom.value.name;
}

function closeRoomMenu() {
  roomMenu.value.open = false;
}

function closeRackMenu() {
  rackMenu.value.open = false;
}

function setRoomMenuMode(mode: "add" | "rename" | "delete" | "restore") {
  roomMenu.value.mode = mode;
  if (mode === "restore") return;
  if (mode === "add") {
    roomFormName.value = "";
    roomFormTargetId.value = selectedRoom.value?.id ?? "";
    return;
  }

  const target = roomOptions.value.find((room) => room.id === roomFormTargetId.value) ?? selectedRoom.value;
  roomFormTargetId.value = target?.id ?? "";
  roomFormName.value = target?.name ?? "";
}

function updateRoomTarget(roomId: string) {
  roomFormTargetId.value = roomId;
  roomFormName.value = roomOptions.value.find((room) => room.id === roomId)?.name ?? "";
}

function submitAddRoom() {
  if (!roomFormName.value.trim()) return;
  const room = roomStore.addSimpleRoom(roomFormName.value);
  writeSystemAuditLog({
    action: "room.create",
    targetType: "room",
    targetId: room.id,
    summary: `新增机房：${room.name}`,
    status: "success",
    metadata: { roomName: room.name },
  });
  selectedRoomId.value = room.id;
  closeRoomMenu();
}

function submitRenameRoom() {
  if (!roomFormTargetId.value || !roomFormName.value.trim()) return;
  const oldName =
    roomOptions.value.find((room) => room.id === roomFormTargetId.value)?.name ??
    "";
  roomStore.renameRoom(roomFormTargetId.value, roomFormName.value);
  writeSystemAuditLog({
    action: "room.rename",
    targetType: "room",
    targetId: roomFormTargetId.value,
    summary: `修改机房：${oldName} -> ${roomFormName.value.trim()}`,
    status: "success",
    metadata: { oldName, newName: roomFormName.value.trim() },
  });
  selectedRoomId.value = roomFormTargetId.value;
  closeRoomMenu();
}

async function submitDeleteRoom() {
  const room = roomOptions.value.find((item) => item.id === roomFormTargetId.value);
  if (!room || roomOptions.value.length <= 1) return;

  const rackIds = roomStore.racks
    .filter((rack) => rack.roomId === room.id)
    .map((rack) => rack.id);
  const deviceIds = assetStore.devices
    .filter((device) => rackIds.includes(device.rackId))
    .map((device) => device.id);
  const deletedDevices = assetStore.devices.filter((device) =>
    rackIds.includes(device.rackId),
  );

  for (const deviceId of deviceIds) {
    await assetStore.deleteDevice(deviceId);
  }
  roomStore.deleteRoom(room.id, deletedDevices);
  writeSystemAuditLog({
    action: "room.delete",
    targetType: "room",
    targetId: room.id,
    summary: `删除机房：${room.name}`,
    status: "success",
    metadata: {
      roomName: room.name,
      deletedRackCount: rackIds.length,
      deletedDeviceCount: deletedDevices.length,
      retentionDays: 7,
    },
  });
  selectedRoomId.value = roomOptions.value.find((item) => item.id !== room.id)?.id ?? null;
  selectedRack.value = null;
  selectedDeviceId.value = null;
  closeRoomMenu();
}

async function restoreRoomItem(itemId: string) {
  const item = roomStore.restoreDeletedItem(itemId);
  if (item?.type === "room") {
    for (const device of item.devices ?? []) {
      await assetStore.upsertDevice(device);
    }
    selectedRoomId.value = item.room.id;
    selectedRack.value = null;
    selectedDeviceId.value = null;
    detailOpen.value = false;
    writeSystemAuditLog({
      action: "room.restore",
      targetType: "room",
      targetId: item.room.id,
      summary: `恢复机房：${item.room.name}`,
      status: "success",
      metadata: {
        roomName: item.room.name,
        restoredRackCount: item.racks.length,
        restoredDeviceCount: item.devices?.length ?? 0,
      },
    });
  }
  closeRoomMenu();
}

function openRackManagementMenu(event: MouseEvent) {
  if (!selectedRoom.value) return;
  closeRoomMenu();
  const position = clampMenuPosition(event);
  rackMenu.value = {
    open: true,
    x: position.x,
    y: position.y,
    mode: "actions",
  };
  const target = selectedRack.value ?? selectedRoomRacks.value[0];
  rackFormTargetId.value = target?.id ?? "";
  rackFormName.value = target?.name ?? "";
  rackFormType.value = target?.type ?? "server";
}

function setRackMenuMode(mode: "add" | "rename" | "delete" | "restore") {
  rackMenu.value.mode = mode;
  if (mode === "restore") return;
  if (mode === "add") {
    rackFormName.value = "";
    rackFormType.value = "server";
    rackFormTargetId.value = selectedRack.value?.id ?? selectedRoomRacks.value[0]?.id ?? "";
    return;
  }

  const target =
    selectedRoomRacks.value.find((rack) => rack.id === rackFormTargetId.value) ??
    selectedRack.value ??
    selectedRoomRacks.value[0];
  rackFormTargetId.value = target?.id ?? "";
  rackFormName.value = target?.name ?? "";
  rackFormType.value = target?.type ?? "server";
}

function updateRackTarget(rackId: string) {
  const rack = selectedRoomRacks.value.find((item) => item.id === rackId);
  rackFormTargetId.value = rackId;
  rackFormName.value = rack?.name ?? "";
  rackFormType.value = rack?.type ?? "server";
}

function submitAddRack() {
  if (!selectedRoom.value || !rackFormName.value.trim()) return;
  const rack = roomStore.addRack(selectedRoom.value, rackFormName.value, rackFormType.value);
  writeSystemAuditLog({
    action: "rack.create",
    targetType: "rack",
    targetId: rack.id,
    summary: `新增机柜：${rack.name}`,
    status: "success",
    metadata: { rackName: rack.name, roomId: rack.roomId, rackType: rack.type },
  });
  selectedRack.value = rack;
  detailOpen.value = true;
  closeRackMenu();
}

function submitRenameRack() {
  if (!rackFormTargetId.value || !rackFormName.value.trim()) return;
  const oldName =
    roomStore.racks.find((rack) => rack.id === rackFormTargetId.value)?.name ??
    "";
  roomStore.renameRack(rackFormTargetId.value, rackFormName.value);
  writeSystemAuditLog({
    action: "rack.rename",
    targetType: "rack",
    targetId: rackFormTargetId.value,
    summary: `修改机柜：${oldName} -> ${rackFormName.value.trim()}`,
    status: "success",
    metadata: { oldName, newName: rackFormName.value.trim() },
  });
  selectedRack.value =
    roomStore.racks.find((rack) => rack.id === rackFormTargetId.value) ?? null;
  detailOpen.value = Boolean(selectedRack.value);
  closeRackMenu();
}

async function submitDeleteRack() {
  const rack = selectedRoomRacks.value.find((item) => item.id === rackFormTargetId.value);
  if (!rack) return;

  const deviceIds = assetStore.devices
    .filter((device) => device.rackId === rack.id)
    .map((device) => device.id);
  const deletedDevices = assetStore.devices.filter(
    (device) => device.rackId === rack.id,
  );
  for (const deviceId of deviceIds) {
    await assetStore.deleteDevice(deviceId);
  }
  roomStore.deleteRack(rack.id, deletedDevices);
  writeSystemAuditLog({
    action: "rack.delete",
    targetType: "rack",
    targetId: rack.id,
    summary: `删除机柜：${rack.name}`,
    status: "success",
    metadata: {
      rackName: rack.name,
      roomId: rack.roomId,
      deletedDeviceCount: deletedDevices.length,
      retentionDays: 7,
    },
  });
  selectedRack.value = null;
  selectedDeviceId.value = null;
  detailOpen.value = false;
  closeRackMenu();
}

async function restoreRackItem(itemId: string) {
  const item = roomStore.restoreDeletedItem(itemId);
  if (item?.type === "rack") {
    for (const device of item.devices ?? []) {
      await assetStore.upsertDevice(device);
    }
    selectedRoomId.value = item.rack.roomId;
    selectedRack.value = item.rack;
    selectedDeviceId.value = null;
    detailOpen.value = true;
    writeSystemAuditLog({
      action: "rack.restore",
      targetType: "rack",
      targetId: item.rack.id,
      summary: `恢复机柜：${item.rack.name}`,
      status: "success",
      metadata: {
        rackName: item.rack.name,
        roomId: item.rack.roomId,
        restoredDeviceCount: item.devices?.length ?? 0,
      },
    });
  }
  closeRackMenu();
}
</script>

<template>
  <section class="page rack-overview-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">机柜总览</h2>
        <p class="page-subtitle">
          按实际机房查看机柜布局、设备数量、容量占用和告警状态。
        </p>
      </div>
      <div class="header-actions">
        <ViewModeTabs v-model="viewMode" />
      </div>
    </div>

    <DataCenterSelector
      class="selector-row"
      :rooms="roomOptions"
      :selected-room-id="selectedRoomId"
      @select="selectedRoomId = $event"
    />
    <GlobalSearchBox
      class="search-row"
      :rooms="roomOptions"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @locate="locateSearchResult"
    />

    <div class="overview-metrics" aria-label="数据加载状态">
      <div
        title="右键管理机房"
        @contextmenu.prevent="openRoomManagementMenu"
      >
        <strong>{{ overviewMetrics.totalRooms }}</strong>
        <span>总机房</span>
      </div>
      <div>
        <strong>{{ overviewMetrics.totalDevices }}</strong>
        <span>总设备</span>
      </div>
      <div
        title="右键管理当前机房机柜"
        @contextmenu.prevent="openRackManagementMenu"
      >
        <strong>{{ overviewMetrics.currentRacks }}</strong>
        <span>当前机柜</span>
      </div>
      <div>
        <strong>{{ overviewMetrics.currentDevices }}</strong>
        <span>当前设备</span>
      </div>
      <div
        class="metric-clickable"
        role="button"
        tabindex="0"
        aria-label="当前报警"
        @click="alertSummaryOpen = !alertSummaryOpen"
        @keydown.enter.prevent="alertSummaryOpen = !alertSummaryOpen"
        @keydown.space.prevent="alertSummaryOpen = !alertSummaryOpen"
      >
        <strong>{{ overviewMetrics.currentAlerts }}</strong>
        <span>当前报警</span>
      </div>
    </div>

    <div
      v-if="alertSummaryOpen"
      class="context-backdrop"
      @click="alertSummaryOpen = false"
    />
    <aside
      v-if="alertSummaryOpen"
      class="alert-summary-popover"
      role="dialog"
      aria-label="当前报警汇总"
      @click.stop
    >
      <header>
        <div>
          <p class="eyebrow">Alert Summary</p>
          <h3>当前报警汇总</h3>
        </div>
        <button type="button" @click="alertSummaryOpen = false">关闭</button>
      </header>
      <p class="alert-summary-stat">
        活动告警 {{ currentAlertItems.length }} 条，严重
        {{ currentAlertItems.filter((item) => item.alert.level === "critical").length }}
        条。
      </p>
      <div class="alert-summary-list">
        <article v-for="item in currentAlertItems.slice(0, 12)" :key="item.alert.id">
          <div>
            <strong>{{ item.alert.title }}</strong>
            <span>
              {{ item.device?.computerName || item.device?.name || "未知设备" }}
              / {{ item.device?.businessIp || "无业务IP" }}
            </span>
            <small>{{ item.rack?.name || "-" }} / {{ item.device?.startU }}U-{{ item.device?.endU }}U</small>
          </div>
          <button type="button" @click="locateAlertItem(item)">
            定位告警设备
          </button>
        </article>
        <p v-if="currentAlertItems.length === 0" class="restore-empty">
          当前机房暂无活动告警。
        </p>
      </div>
    </aside>

    <div
      v-if="roomStore.loading || assetStore.loading || alertStore.loading"
      class="empty-panel"
    >
      <div class="empty-panel-inner">
        <h2>正在加载本地数据</h2>
        <p>正在读取机房、机柜、设备和告警信息。</p>
      </div>
    </div>

    <div v-else class="overview-grid">
      <div
        v-if="locationFocusText"
        class="location-focus-banner"
        data-testid="location-focus-banner"
      >
        <span>{{ locationFocusText }}</span>
        <strong>当前机柜与设备已高亮</strong>
      </div>
      <div class="layout-panel">
        <LayoutOverview
          v-if="viewMode === 'layout'"
          :room="selectedRoom"
          :racks="selectedRoomRacks"
          :devices="assetStore.devices"
          :alerts="alertStore.alerts"
          :selected-rack-id="selectedRack?.id ?? null"
          @select-rack="selectRack"
        />
        <RackUView
          v-else-if="viewMode === 'u-view'"
          :rack="activeRack"
          :racks="selectedRoomRacks"
          :devices="assetStore.devices"
          :alerts="alertStore.alerts"
          :highlight-device-id="selectedDeviceId"
          @select-rack="selectRack"
          @select-device="selectDeviceFromRack"
        />
        <Rack3DView
          v-else
          :room="selectedRoom"
          :racks="selectedRoomRacks"
          :devices="assetStore.devices"
          :alerts="alertStore.alerts"
          :selected-rack-id="selectedRack?.id ?? null"
          :leadership-mode="false"
          @select-rack="selectRack"
        />
      </div>
      <RightDetailDrawer
        v-if="detailOpen"
        :rack="activeRack"
        :device="selectedDevice"
        :devices="assetStore.devices"
        :alerts="alertStore.alerts"
        @edit-device="openDeviceEditor"
        @close="detailOpen = false"
      />
      <DeviceFormDrawer
        :open="deviceEditorOpen"
        :device="editingDevice"
        :rooms="roomStore.rooms"
        :racks="roomStore.racks"
        :devices="assetStore.devices"
        @close="deviceEditorOpen = false"
        @save="saveDevice"
      />
    </div>

    <div
      v-if="roomMenu.open"
      class="context-backdrop"
      @click="closeRoomMenu"
      @contextmenu.prevent="closeRoomMenu"
    />
    <div
      v-if="roomMenu.open"
      class="room-context-menu"
      :style="{ left: `${roomMenu.x}px`, top: `${roomMenu.y}px` }"
      role="menu"
      @click.stop
    >
      <template v-if="roomMenu.mode === 'actions'">
        <button type="button" role="menuitem" @click="setRoomMenuMode('add')">
          <span class="menu-icon">＋</span>
          <span>新增机房</span>
        </button>
        <button type="button" role="menuitem" @click="setRoomMenuMode('rename')">
          <span class="menu-icon">✎</span>
          <span>修改现有机房</span>
        </button>
        <button type="button" role="menuitem" @click="setRoomMenuMode('restore')">
          <span class="menu-icon">↺</span>
          <span>恢复已删除机房</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="danger"
          @click="setRoomMenuMode('delete')"
        >
          <span class="menu-icon">×</span>
          <span>删除现有机房</span>
        </button>
      </template>

      <template v-else>
        <div class="menu-panel-title">
          {{
            roomMenu.mode === "add"
              ? "新增机房"
              : roomMenu.mode === "rename"
                ? "修改机房名称"
                : roomMenu.mode === "restore"
                  ? "恢复已删除机房"
                  : "删除机房"
          }}
        </div>
        <label v-if="roomMenu.mode !== 'add' && roomMenu.mode !== 'restore'">
          选择机房
          <select
            :value="roomFormTargetId"
            @change="updateRoomTarget(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="room in roomOptions" :key="room.id" :value="room.id">
              {{ room.name }}
            </option>
          </select>
        </label>
        <label v-if="roomMenu.mode !== 'delete' && roomMenu.mode !== 'restore'">
          机房名称
          <input v-model="roomFormName" placeholder="例如：新数据中心" />
        </label>
        <p v-else-if="roomMenu.mode === 'delete'" class="delete-hint">
          删除会移除该机房、机柜和机柜内设备。至少保留一个机房。
        </p>
        <div v-else class="restore-list" aria-label="可恢复机房">
          <button
            v-for="item in recoverableRooms"
            :key="item.id"
            type="button"
            class="restore-item"
            @click="restoreRoomItem(item.id)"
          >
            <span>{{ item.room.name }}</span>
            <small>保留至 {{ new Date(item.expiresAt).toLocaleDateString("zh-CN") }}</small>
          </button>
          <p v-if="recoverableRooms.length === 0" class="restore-empty">
            暂无 7 天内可恢复机房。
          </p>
        </div>
        <div class="menu-actions">
          <button type="button" class="ghost" @click="roomMenu.mode = 'actions'">
            返回
          </button>
          <button
            v-if="roomMenu.mode === 'add'"
            type="button"
            @click="submitAddRoom"
          >
            确认新增
          </button>
          <button
            v-else-if="roomMenu.mode === 'rename'"
            type="button"
            @click="submitRenameRoom"
          >
            保存
          </button>
          <button
            v-else-if="roomMenu.mode === 'delete'"
            type="button"
            class="danger-button"
            :disabled="roomOptions.length <= 1"
            @click="submitDeleteRoom"
          >
            确认删除
          </button>
        </div>
      </template>
    </div>

    <div
      v-if="rackMenu.open"
      class="context-backdrop"
      @click="closeRackMenu"
      @contextmenu.prevent="closeRackMenu"
    />
    <div
      v-if="rackMenu.open"
      class="room-context-menu"
      :style="{ left: `${rackMenu.x}px`, top: `${rackMenu.y}px` }"
      role="menu"
      @click.stop
    >
      <template v-if="rackMenu.mode === 'actions'">
        <button type="button" role="menuitem" @click="setRackMenuMode('add')">
          <span class="menu-icon">＋</span>
          <span>新增机柜</span>
        </button>
        <button type="button" role="menuitem" @click="setRackMenuMode('rename')">
          <span class="menu-icon">✎</span>
          <span>修改现有机柜</span>
        </button>
        <button type="button" role="menuitem" @click="setRackMenuMode('restore')">
          <span class="menu-icon">↺</span>
          <span>恢复已删除机柜</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="danger"
          @click="setRackMenuMode('delete')"
        >
          <span class="menu-icon">×</span>
          <span>删除现有机柜</span>
        </button>
      </template>

      <template v-else>
        <div class="menu-panel-title">
          {{
            rackMenu.mode === "add"
              ? "新增机柜"
              : rackMenu.mode === "rename"
                ? "修改机柜名称"
                : rackMenu.mode === "restore"
                  ? "恢复已删除机柜"
                  : "删除机柜"
          }}
        </div>
        <label v-if="rackMenu.mode !== 'add' && rackMenu.mode !== 'restore'">
          选择机柜
          <select
            :value="rackFormTargetId"
            @change="updateRackTarget(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="rack in selectedRoomRacks" :key="rack.id" :value="rack.id">
              {{ rack.name }}
            </option>
          </select>
        </label>
        <label v-if="rackMenu.mode !== 'delete' && rackMenu.mode !== 'restore'">
          机柜名称
          <input v-model="rackFormName" placeholder="例如：529-A11" />
        </label>
        <label v-if="rackMenu.mode === 'add'">
          机柜类型
          <select v-model="rackFormType">
            <option value="server">服务器柜</option>
            <option value="network">网络柜</option>
            <option value="patching">配线柜</option>
            <option value="row_head">列头柜</option>
            <option value="cooling">精密空调</option>
            <option value="ups_pdu">供电柜</option>
            <option value="empty">空柜</option>
            <option value="other">其他</option>
          </select>
        </label>
        <p v-if="rackMenu.mode === 'delete'" class="delete-hint">
          删除会移除该机柜和机柜内设备，相关资产位置也会同步清理。
        </p>
        <div v-else-if="rackMenu.mode === 'restore'" class="restore-list" aria-label="可恢复机柜">
          <button
            v-for="item in recoverableRacks"
            :key="item.id"
            type="button"
            class="restore-item"
            @click="restoreRackItem(item.id)"
          >
            <span>{{ item.rack.name }}</span>
            <small>保留至 {{ new Date(item.expiresAt).toLocaleDateString("zh-CN") }}</small>
          </button>
          <p v-if="recoverableRacks.length === 0" class="restore-empty">
            暂无 7 天内可恢复机柜。
          </p>
        </div>
        <div class="menu-actions">
          <button type="button" class="ghost" @click="rackMenu.mode = 'actions'">
            返回
          </button>
          <button
            v-if="rackMenu.mode === 'add'"
            type="button"
            @click="submitAddRack"
          >
            确认新增
          </button>
          <button
            v-else-if="rackMenu.mode === 'rename'"
            type="button"
            @click="submitRenameRack"
          >
            保存
          </button>
          <button
            v-else-if="rackMenu.mode === 'delete'"
            type="button"
            class="danger-button"
            :disabled="selectedRoomRacks.length === 0"
            @click="submitDeleteRack"
          >
            确认删除
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.rack-overview-page {
  min-width: 0;
}

.selector-row {
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.search-row {
  margin-bottom: 16px;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.overview-metrics div {
  min-height: 88px;
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 0 18px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.overview-metrics strong {
  color: var(--color-text);
  font-size: 28px;
  line-height: 1;
}

.overview-metrics span {
  color: var(--color-text-muted);
}

.metric-clickable {
  cursor: pointer;
}

.metric-clickable:hover,
.metric-clickable:focus-visible {
  border-color: rgba(14, 165, 233, 0.56);
  outline: none;
  box-shadow:
    var(--shadow-soft),
    0 0 0 2px rgba(14, 165, 233, 0.12);
}

.alert-summary-popover {
  position: fixed;
  right: 34px;
  top: 190px;
  z-index: 82;
  width: min(460px, calc(100vw - 40px));
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--surface-raised);
  box-shadow: 0 22px 62px rgba(15, 23, 42, 0.18);
}

.alert-summary-popover header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.alert-summary-popover h3,
.alert-summary-popover p {
  margin: 0;
}

.alert-summary-popover button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--control-bg);
  cursor: pointer;
}

.alert-summary-stat {
  padding: 9px 10px;
  border: 1px solid rgba(239, 68, 68, 0.24);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-critical) 8%, var(--color-panel));
}

.alert-summary-list {
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}

.alert-summary-list article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.alert-summary-list article > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.alert-summary-list strong,
.alert-summary-list span,
.alert-summary-list small {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.alert-summary-list span,
.alert-summary-list small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.overview-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.location-focus-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid rgba(253, 230, 138, 0.58);
  border-radius: 8px;
  color: #fef3c7;
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(14, 165, 233, 0.1)),
    rgba(8, 17, 31, 0.94);
  box-shadow:
    0 0 0 1px rgba(253, 230, 138, 0.1),
    0 14px 36px rgba(245, 158, 11, 0.12);
}

.location-focus-banner span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.location-focus-banner strong {
  flex: 0 0 auto;
  color: #7dd3fc;
  font-size: 12px;
}

:global(:root[data-theme="light"]) .location-focus-banner {
  border-color: rgba(34, 197, 94, 0.32);
  color: #134e4a;
  background:
    linear-gradient(135deg, rgba(187, 247, 208, 0.72), rgba(224, 242, 254, 0.72)),
    #ecfdf5;
  box-shadow: 0 12px 32px rgba(15, 118, 110, 0.1);
}

:global(:root[data-theme="light"]) .location-focus-banner strong {
  color: #0369a1;
}

.layout-panel {
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.mode-placeholder {
  min-height: 420px;
}

.context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
}

.room-context-menu {
  position: fixed;
  z-index: 81;
  width: 248px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--context-menu-bg);
  box-shadow:
    0 18px 48px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.room-context-menu button {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.room-context-menu button:hover {
  background: var(--context-menu-hover);
}

.room-context-menu button.danger {
  color: #fecaca;
}

.menu-icon {
  width: 22px;
  display: inline-grid;
  place-items: center;
  color: #7dd3fc;
  font-weight: 700;
}

.menu-panel-title {
  padding: 6px 8px 9px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  font-size: 13px;
  font-weight: 700;
}

.room-context-menu label {
  display: grid;
  gap: 6px;
  padding: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.room-context-menu input,
.room-context-menu select {
  width: 100%;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: var(--control-bg);
}

.delete-hint {
  margin: 8px;
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.5;
}

.restore-list {
  display: grid;
  gap: 6px;
  max-height: 180px;
  overflow: auto;
  padding: 8px;
}

.room-context-menu .restore-item {
  min-height: 44px;
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 6px 9px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  background: rgba(14, 165, 233, 0.08);
}

.restore-item span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
}

.restore-item small {
  color: var(--color-text-muted);
  font-size: 11px;
}

.restore-empty {
  margin: 4px 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.menu-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
}

.menu-actions button {
  justify-content: center;
}

.room-context-menu .ghost {
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: var(--control-bg-muted);
}

.room-context-menu .danger-button {
  justify-content: center;
  color: #fee2e2;
  background: rgba(220, 38, 38, 0.18);
}

.room-context-menu .danger-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
