<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Alert, AlertStatus } from '../../types/domain'
import { filterAlertsWithContext, getAlertDeviceContext, type AlertFilters as AlertFilterState } from '../../services/alerts/alertFilters'
import { buildAlertLocateQuery } from '../../services/alerts/alertNavigation'
import { alertStatusOptions, batchUpdateAlertStatus } from '../../services/alerts/alertWorkflow'
import { useAlertStore } from '../../stores/alertStore'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import AlertFilters from './components/AlertFilters.vue'
import AlertFormDrawer from './components/AlertFormDrawer.vue'
import AlertTable from './components/AlertTable.vue'
import PaginationControls from '../../components/PaginationControls.vue'
import { paginate, sortByStartedAtDesc } from '../../services/pagination'
import {
  createAlertWebhook,
  deleteAlertWebhook,
  getAlertWebhooks,
  type AlertWebhook,
} from '../../services/alerts/alertWebhooks'

const router = useRouter()
const alertStore = useAlertStore()
const assetStore = useAssetStore()
const roomStore = useRoomStore()
const drawerOpen = ref(false)
const editingAlert = ref<Alert | null>(null)
const selectedAlertIds = ref<string[]>([])
const batchStatus = ref<AlertStatus>('read')
const filters = ref<AlertFilterState>({ level: 'all', status: 'all' })
const page = ref(1)
const pageSize = ref(20)
const webhookName = ref('卓豪监控告警')
const webhookSource = ref<AlertWebhook['source']>('zoho')
const webhooks = ref<AlertWebhook[]>([])

const filteredAlerts = computed(() =>
  sortByStartedAtDesc(filterAlertsWithContext(alertStore.alerts, assetStore.devices, roomStore.racks, roomStore.rooms, filters.value)),
)
const pagedAlerts = computed(() => paginate(filteredAlerts.value, { page: page.value, pageSize: pageSize.value }))

watch([filters, pageSize], () => {
  page.value = 1
})

onMounted(async () => {
  await Promise.all([alertStore.loadAlerts(), assetStore.loadDevices(), roomStore.loadRooms()])
  webhooks.value = getAlertWebhooks()
})

function saveAlert(alert: Alert) {
  const index = alertStore.alerts.findIndex((item) => item.id === alert.id)
  if (index >= 0) alertStore.alerts.splice(index, 1, alert)
  else alertStore.alerts.unshift(alert)
  drawerOpen.value = false
  editingAlert.value = null
}

function openAddAlert() {
  editingAlert.value = null
  drawerOpen.value = true
}

function editAlert(alert: Alert) {
  editingAlert.value = alert
  drawerOpen.value = true
}

function toggleAlert(alertId: string) {
  selectedAlertIds.value = selectedAlertIds.value.includes(alertId)
    ? selectedAlertIds.value.filter((id) => id !== alertId)
    : [...selectedAlertIds.value, alertId]
}

function toggleAllPagedAlerts() {
  const pageIds = pagedAlerts.value.items.map((alert) => alert.id)
  const allSelected = pageIds.every((id) => selectedAlertIds.value.includes(id))
  selectedAlertIds.value = allSelected
    ? selectedAlertIds.value.filter((id) => !pageIds.includes(id))
    : [...new Set([...selectedAlertIds.value, ...pageIds])]
}

function applyBatchStatus() {
  alertStore.alerts = batchUpdateAlertStatus(alertStore.alerts, selectedAlertIds.value, batchStatus.value)
  selectedAlertIds.value = []
}

function locateAlert(alert: Alert) {
  void router.push({
    path: '/rack-overview',
    query: buildAlertLocateQuery(alert, assetStore.devices, roomStore.racks, roomStore.rooms),
  })
}

function addWebhook() {
  createAlertWebhook({
    name: webhookName.value,
    source: webhookSource.value,
    enabled: true,
  })
  webhooks.value = getAlertWebhooks()
}

function removeWebhook(id: string) {
  deleteAlertWebhook(id)
  webhooks.value = getAlertWebhooks()
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">告警中心</h2>
        <p class="page-subtitle">统一查看手工告警、未来 Prometheus 与卓豪监控同步的设备异常。</p>
      </div>
      <button class="add-alert" type="button" @click="openAddAlert">新增告警</button>
    </div>

    <AlertFilters
      :filters="filters"
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @update:filters="filters = $event"
    />
    <section class="webhook-panel" aria-label="告警 Webhook 接入">
      <div>
        <strong>Webhook 接入</strong>
        <span>创建后可在卓豪或其他监控系统中填写地址，平台收到告警后进入告警中心。</span>
      </div>
      <div class="webhook-form">
        <input v-model="webhookName" aria-label="Webhook名称" placeholder="Webhook名称" />
        <select v-model="webhookSource" aria-label="Webhook来源">
          <option value="zoho">卓豪监控</option>
          <option value="prometheus">Prometheus</option>
          <option value="custom">自定义</option>
        </select>
        <button type="button" @click="addWebhook">创建Webhook</button>
      </div>
      <div v-if="webhooks.length" class="webhook-list">
        <article v-for="webhook in webhooks" :key="webhook.id">
          <strong>{{ webhook.name }}</strong>
          <code>{{ webhook.url }}</code>
          <button type="button" @click="removeWebhook(webhook.id)">删除</button>
        </article>
      </div>
    </section>
    <div class="batch-toolbar">
      <span>已选择 {{ selectedAlertIds.length }} 条告警</span>
      <select v-model="batchStatus">
        <option v-for="option in alertStatusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <button type="button" :disabled="selectedAlertIds.length === 0" @click="applyBatchStatus">
        批量更新状态
      </button>
    </div>
    <AlertTable
      :alerts="pagedAlerts.items"
      :devices="assetStore.devices"
      :racks="roomStore.racks"
      :rooms="roomStore.rooms"
      :selected-ids="selectedAlertIds"
      @locate="locateAlert"
      @edit="editAlert"
      @toggle="toggleAlert"
      @toggle-all="toggleAllPagedAlerts"
    />
    <PaginationControls
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="pagedAlerts.total"
      :page-count="pagedAlerts.pageCount"
    />
    <AlertFormDrawer
      :open="drawerOpen"
      :devices="assetStore.devices"
      :alert="editingAlert"
      @close="drawerOpen = false; editingAlert = null"
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

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--color-text-muted);
}

.webhook-panel {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

.webhook-panel > div:first-child {
  display: grid;
  gap: 4px;
}

.webhook-panel span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.webhook-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 160px auto;
  gap: 8px;
}

.webhook-form input,
.webhook-form select,
.webhook-form button,
.webhook-list button {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-panel);
}

.webhook-form button,
.webhook-list button {
  padding: 0 12px;
  cursor: pointer;
}

.webhook-list {
  display: grid;
  gap: 8px;
}

.webhook-list article {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.webhook-list code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-primary);
}

.batch-toolbar select,
.batch-toolbar button {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.82);
}

.batch-toolbar button {
  padding: 0 12px;
  cursor: pointer;
}

.batch-toolbar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
