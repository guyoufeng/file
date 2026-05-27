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

function openRoomManagementMenu() {
  if (!selectedRoom.value) return;
  const action = window.prompt(
    "机房管理：输入 1 修改当前机房名称，输入 2 新增普通 42U 机房。",
    "1",
  );
  if (action === "1") {
    const name = window.prompt("请输入新的机房名称", selectedRoom.value.name);
    if (!name?.trim()) return;
    roomStore.renameRoom(selectedRoom.value.id, name);
    return;
  }
  if (action === "2") {
    const name = window.prompt("请输入新机房名称", "新数据中心");
    if (!name?.trim()) return;
    const room = roomStore.addSimpleRoom(name);
    selectedRoomId.value = room.id;
  }
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
</style>
