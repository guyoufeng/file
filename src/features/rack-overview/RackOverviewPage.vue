<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()

const activeAlerts = computed(() => alertStore.alerts.filter((alert) => alert.status !== 'recovered').length)

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices(), alertStore.loadAlerts()])
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">机柜总览</h2>
        <p class="page-subtitle">后续将展示 529、99、308、杭州、越南C7 的机房与机柜状态。</p>
      </div>
    </div>
    <div class="overview-metrics" aria-label="数据加载状态">
      <div>
        <strong>{{ roomStore.rooms.length }}</strong>
        <span>机房</span>
      </div>
      <div>
        <strong>{{ roomStore.racks.length }}</strong>
        <span>机柜</span>
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
    <div class="empty-panel rack-workspace">
      <div class="empty-panel-inner">
        <h2>2D 机柜图工作区</h2>
        <p v-if="roomStore.loading || assetStore.loading || alertStore.loading">正在加载本地数据...</p>
        <p v-else>这里会优先建设日常运维可用的机柜总览、缩放定位、告警高亮和设备快速查看。</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
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

.rack-workspace {
  min-height: 360px;
}
</style>
