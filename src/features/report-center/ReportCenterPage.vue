<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import { buildReportMetrics } from '../../services/report/reportMetrics'
import CategorySummary from './components/CategorySummary.vue'
import MetricCards from './components/MetricCards.vue'
import RackCapacityRank from './components/RackCapacityRank.vue'
import StatusSummary from './components/StatusSummary.vue'
import WarrantyWarningList from './components/WarrantyWarningList.vue'

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()

const metrics = computed(() =>
  buildReportMetrics(roomStore.rooms, roomStore.racks, assetStore.devices, alertStore.alerts),
)

const expiringWarrantyDevices = computed(() =>
  assetStore.devices.filter((device) => {
    if (!device.warrantyExpireAt) return false
    const date = new Date(device.warrantyExpireAt)
    const now = new Date()
    const oneYearLater = new Date(now)
    oneYearLater.setFullYear(now.getFullYear() + 1)
    return date >= now && date <= oneYearLater
  }),
)

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">报表中心</h2>
        <p class="page-subtitle">生成容量、资产、告警、巡检和运行健康报告。</p>
      </div>
    </div>

    <MetricCards :metrics="metrics" />

    <div class="report-grid">
      <CategorySummary :counts="metrics.categoryCounts" />
      <StatusSummary :counts="metrics.statusCounts" />
      <RackCapacityRank :ranks="metrics.rackCapacityRank" />
      <WarrantyWarningList :devices="expiringWarrantyDevices" />
    </div>
  </section>
</template>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
</style>
