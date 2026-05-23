<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Rack } from '../../types/domain'
import type { DeviceSearchResult } from '../../services/search/deviceSearch'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import DataCenterSelector from './components/DataCenterSelector.vue'
import GlobalSearchBox from './components/GlobalSearchBox.vue'
import LayoutOverview from './components/LayoutOverview.vue'
import LeadershipModeToggle from './components/LeadershipModeToggle.vue'
import RackUView from './components/RackUView.vue'
import RightDetailDrawer from './components/RightDetailDrawer.vue'
import ViewModeTabs, { type ViewMode } from './components/ViewModeTabs.vue'
import { getRoomOptions, getRoomRacks } from './layout'

const Rack3DView = defineAsyncComponent(() => import('./components/Rack3DView.vue'))

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()
const route = useRoute()

const selectedRoomId = ref<string | null>(null)
const selectedRack = ref<Rack | null>(null)
const selectedDeviceId = ref<string | null>(null)
const viewMode = ref<ViewMode>('layout')
const leadershipMode = ref(false)
const detailOpen = ref(false)
const detailMode = ref<'normal' | 'wide'>('normal')

const roomOptions = computed(() => getRoomOptions(roomStore.rooms))
const selectedRoom = computed(() => roomOptions.value.find((room) => room.id === selectedRoomId.value) ?? roomOptions.value[0])
const selectedRoomRacks = computed(() => getRoomRacks(selectedRoom.value, roomStore.racks))
const activeRack = computed(() => selectedRack.value)
const selectedDevice = computed(() => assetStore.devices.find((device) => device.id === selectedDeviceId.value) ?? null)
const activeAlerts = computed(() => alertStore.alerts.filter((alert) => alert.status !== 'recovered').length)

watch(roomOptions, (rooms) => {
  if (!selectedRoomId.value && rooms.length > 0) {
    selectedRoomId.value = rooms[0].id
  }
})

watch(selectedRoomId, () => {
  selectedRack.value = null
  selectedDeviceId.value = null
  detailOpen.value = false
})

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
  if (typeof route.query.roomId === 'string') selectedRoomId.value = route.query.roomId
  if (typeof route.query.rackId === 'string') selectedRack.value = roomStore.racks.find((rack) => rack.id === route.query.rackId) ?? null
  if (typeof route.query.deviceId === 'string') selectedDeviceId.value = route.query.deviceId
})

async function locateSearchResult(result: DeviceSearchResult) {
  if (result.room) {
    selectedRoomId.value = result.room.id
  }
  await nextTick()
  selectedRack.value = result.rack ?? null
  selectedDeviceId.value = result.device.id
  detailOpen.value = true
  viewMode.value = 'layout'
}

function selectRack(rack: Rack) {
  selectedRack.value = rack
  selectedDeviceId.value = null
  detailOpen.value = true
}
</script>

<template>
  <section class="page rack-overview-page" :class="{ 'leadership-mode': leadershipMode }">
    <div class="page-header">
      <div>
        <h2 class="page-title">机柜总览</h2>
        <p class="page-subtitle">按实际机房查看机柜布局、设备数量、容量占用和告警状态。</p>
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
      <div>
        <strong>{{ roomStore.rooms.length }}</strong>
        <span>机房</span>
      </div>
      <div>
        <strong>{{ selectedRoomRacks.length }}</strong>
        <span>当前机柜</span>
      </div>
      <div>
        <strong>{{ assetStore.devices.length }}</strong>
        <span>设备</span>
      </div>
      <div>
        <strong>{{ activeAlerts }}</strong>
        <span>活动告警</span>
      </div>
    </div>

    <div v-if="roomStore.loading || assetStore.loading || alertStore.loading" class="empty-panel">
      <div class="empty-panel-inner">
        <h2>正在加载本地数据</h2>
        <p>正在读取机房、机柜、设备和告警信息。</p>
      </div>
    </div>

    <div v-else class="overview-grid">
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
        :mode="detailMode"
        @update:mode="detailMode = $event"
        @close="detailOpen = false"
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.layout-panel {
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.mode-placeholder {
  min-height: 420px;
}
</style>
