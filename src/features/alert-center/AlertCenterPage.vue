<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Alert } from '../../types/domain'
import { filterAlertsWithContext, getAlertDeviceContext, type AlertFilters as AlertFilterState } from '../../services/alerts/alertFilters'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import AlertFilters from './components/AlertFilters.vue'
import AlertFormDrawer from './components/AlertFormDrawer.vue'
import AlertTable from './components/AlertTable.vue'

const router = useRouter()
const alertStore = useAlertStore()
const assetStore = useAssetStore()
const roomStore = useRoomStore()
const drawerOpen = ref(false)
const filters = ref<AlertFilterState>({ level: 'all', status: 'all' })

const filteredAlerts = computed(() =>
  filterAlertsWithContext(alertStore.alerts, assetStore.devices, roomStore.racks, roomStore.rooms, filters.value),
)

onMounted(async () => {
  await Promise.all([alertStore.loadAlerts(), assetStore.loadDevices(), roomStore.loadRooms()])
})

function saveAlert(alert: Alert) {
  alertStore.alerts.unshift(alert)
  drawerOpen.value = false
}

function locateAlert(alert: Alert) {
  const context = getAlertDeviceContext(alert, assetStore.devices, roomStore.racks, roomStore.rooms)
  void router.push({
    path: '/rack-overview',
    query: {
      roomId: context.room?.id,
      rackId: context.rack?.id,
      deviceId: context.device?.id,
    },
  })
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">告警中心</h2>
        <p class="page-subtitle">统一查看手工告警、未来 Prometheus 与卓豪监控同步的设备异常。</p>
      </div>
      <button class="add-alert" type="button" @click="drawerOpen = true">新增告警</button>
    </div>

    <AlertFilters
      :filters="filters"
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @update:filters="filters = $event"
    />
    <AlertTable
      :alerts="filteredAlerts"
      :devices="assetStore.devices"
      :racks="roomStore.racks"
      :rooms="roomStore.rooms"
      @locate="locateAlert"
    />
    <AlertFormDrawer
      :open="drawerOpen"
      :devices="assetStore.devices"
      @close="drawerOpen = false"
      @save="saveAlert"
    />
  </section>
</template>

<style scoped>
.add-alert {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(239, 68, 68, 0.72);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(239, 68, 68, 0.16);
  cursor: pointer;
}
</style>
