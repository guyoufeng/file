<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Rack } from '../../types/domain'
import type { DeviceSearchResult } from '../../services/search/deviceSearch'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import DataCenterSelector from './components/DataCenterSelector.vue'
import GlobalSearchBox from './components/GlobalSearchBox.vue'
import LayoutOverview from './components/LayoutOverview.vue'
import RackUView from './components/RackUView.vue'
import RightDetailDrawer from './components/RightDetailDrawer.vue'
import ViewModeTabs, { type ViewMode } from './components/ViewModeTabs.vue'
import { getRoomOptions, getRoomRacks } from './layout'

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()

const selectedRoomId = ref<string | null>(null)
const selectedRack = ref<Rack | null>(null)
const selectedDeviceId = ref<string | null>(null)
const viewMode = ref<ViewMode>('layout')

const roomOptions = computed(() => getRoomOptions(roomStore.rooms))
const selectedRoom = computed(() => roomOptions.value.find((room) => room.id === selectedRoomId.value))
const selectedRoomRacks = computed(() => getRoomRacks(selectedRoom.value, roomStore.racks))
const activeRack = computed(() => selectedRack.value ?? selectedRoomRacks.value[0] ?? null)
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
})

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
})

async function locateSearchResult(result: DeviceSearchResult) {
  if (result.room) {
    selectedRoomId.value = result.room.id
  }
  await nextTick()
  selectedRack.value = result.rack ?? null
  selectedDeviceId.value = result.device.id
  viewMode.value = 'layout'
}
</script>

<template>
  <section class="page rack-overview-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">机柜总览</h2>
        <p class="page-subtitle">按实际机房查看机柜布局、设备数量、容量占用和告警状态。</p>
      </div>
      <ViewModeTabs v-model="viewMode" />
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
          @select-rack="selectedRack = $event; selectedDeviceId = null"
        />
        <RackUView
          v-else-if="viewMode === 'u-view'"
          :rack="activeRack"
          :devices="assetStore.devices"
          :highlight-device-id="selectedDeviceId"
        />
        <div v-else class="empty-panel mode-placeholder">
          <div class="empty-panel-inner">
            <h2>{{ viewMode === 'u-view' ? 'U位大图' : '3D轻量视图' }}</h2>
            <p>该视图将在后续任务中接入，当前先完成布局总览。</p>
          </div>
        </div>
      </div>
      <RightDetailDrawer
        :rack="activeRack"
        :device="selectedDevice"
        :devices="assetStore.devices"
        :alerts="alertStore.alerts"
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

.overview-metrics span {
  color: var(--color-text-muted);
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.layout-panel {
  min-width: 0;
  overflow-x: auto;
}

.mode-placeholder {
  min-height: 420px;
}
</style>
