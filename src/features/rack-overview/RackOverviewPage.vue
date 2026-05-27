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
import LeadershipModeToggle from "./components/LeadershipModeToggle.vue";
import RackUView from "./components/RackUView.vue";
import RightDetailDrawer from "./components/RightDetailDrawer.vue";
import ViewModeTabs, { type ViewMode } from "./components/ViewModeTabs.vue";
import DeviceFormDrawer from "../asset-management/components/DeviceFormDrawer.vue";
import { getRoomOptions, getRoomRacks } from "./layout";
import { getRackOverviewMetrics } from "./metrics";

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
const viewMode = ref<ViewMode>("layout");
const leadershipMode = ref(false);
const detailOpen = ref(false);
const deviceEditorOpen = ref(false);
const editingDevice = ref<Device | null>(null);
const roomMenu = ref({
  open: false,
  x: 0,
  y: 0,
  mode: "actions" as "actions" | "add" | "rename" | "delete",
});
const roomFormName = ref("");
const roomFormTargetId = ref("");

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
const locationFocusText = computed(() => {
  if (!selectedRack.value && !selectedDevice.value) return "";

  const rackName = selectedRack.value?.name ?? "未知机柜";
  if (!selectedDevice.value) return `已定位：${rackName}`;

  const deviceName =
    selectedDevice.value.computerName || selectedDevice.value.name;
  return `已定位：${rackName} / ${deviceName} / ${selectedDevice.value.businessIp ?? "无业务IP"} / ${selectedDevice.value.startU}U-${selectedDevice.value.endU}U`;
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

function setRoomMenuMode(mode: "add" | "rename" | "delete") {
  roomMenu.value.mode = mode;
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
  selectedRoomId.value = room.id;
  closeRoomMenu();
}

function submitRenameRoom() {
  if (!roomFormTargetId.value || !roomFormName.value.trim()) return;
  roomStore.renameRoom(roomFormTargetId.value, roomFormName.value);
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

  for (const deviceId of deviceIds) {
    await assetStore.deleteDevice(deviceId);
  }
  roomStore.deleteRoom(room.id);
  selectedRoomId.value = roomOptions.value.find((item) => item.id !== room.id)?.id ?? null;
  selectedRack.value = null;
  selectedDeviceId.value = null;
  closeRoomMenu();
}

function openRackManagementMenu() {
  if (!selectedRoom.value) return;
  const action = window.prompt(
    [
      "机柜管理：",
      "1 修改当前选中机柜名称",
      "2 新增服务器柜",
      "3 新增网络柜",
      "4 新增配线柜",
      "5 新增列头柜",
      "6 新增精密空调柜",
    ].join("\n"),
    "1",
  );

  if (action === "1") {
    if (!selectedRack.value) {
      window.alert("请先在布局总览或 U 位大图中选择一个机柜，再修改名称。");
      return;
    }
    const name = window.prompt("请输入新的机柜名称", selectedRack.value.name);
    if (!name?.trim()) return;
    roomStore.renameRack(selectedRack.value.id, name);
    selectedRack.value =
      roomStore.racks.find((rack) => rack.id === selectedRack.value?.id) ?? null;
    return;
  }

  const typeByAction: Record<string, RackType> = {
    "2": "server",
    "3": "network",
    "4": "patching",
    "5": "row_head",
    "6": "cooling",
  };
  const type = typeByAction[action ?? ""];
  if (!type) return;
  const name = window.prompt("请输入新机柜名称", `${selectedRoom.value.name}-新机柜`);
  if (!name?.trim()) return;
  const rack = roomStore.addRack(selectedRoom.value, name, type);
  selectedRack.value = rack;
  detailOpen.value = true;
}
</script>

<template>
  <section
    class="page rack-overview-page"
    :class="{ 'leadership-mode': leadershipMode }"
  >
    <div class="page-header">
      <div>
        <h2 class="page-title">机柜总览</h2>
        <p class="page-subtitle">
          按实际机房查看机柜布局、设备数量、容量占用和告警状态。
        </p>
      </div>
      <div class="header-actions">
        <LeadershipModeToggle v-model="leadershipMode" />
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
      <div>
        <strong>{{ overviewMetrics.currentAlerts }}</strong>
        <span>当前报警</span>
      </div>
    </div>

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
          :leadership-mode="leadershipMode"
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
                : "删除机房"
          }}
        </div>
        <label v-if="roomMenu.mode !== 'add'">
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
        <label v-if="roomMenu.mode !== 'delete'">
          机房名称
          <input v-model="roomFormName" placeholder="例如：新数据中心" />
        </label>
        <p v-else class="delete-hint">
          删除会移除该机房、机柜和机柜内设备。至少保留一个机房。
        </p>
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
            v-else
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
  background: rgba(17, 24, 39, 0.82);
}

.overview-metrics strong {
  color: var(--color-text);
  font-size: 28px;
  line-height: 1;
}

.leadership-mode .overview-metrics strong {
  color: #e0f2fe;
  font-size: 34px;
}

.leadership-mode .overview-metrics div {
  border-color: rgba(56, 189, 248, 0.34);
  background: rgba(8, 47, 73, 0.46);
}

.overview-metrics span {
  color: var(--color-text-muted);
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
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  color: var(--color-text);
  background:
    linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(8, 13, 24, 0.98));
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.42),
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
  background: rgba(14, 165, 233, 0.14);
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
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  color: var(--color-text);
  background: rgba(2, 6, 23, 0.82);
}

.delete-hint {
  margin: 8px;
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.5;
}

.menu-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
}

.room-context-menu .ghost {
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.74);
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
