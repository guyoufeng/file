<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  getAlertWebhookPublicBaseUrl,
  getAlertWebhooks,
  refreshAlertWebhookUrls,
  setAlertWebhookPublicBaseUrl,
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
const webhookBaseUrl = ref('')
const webhooks = ref<AlertWebhook[]>([])
const webhookWindowOpen = ref(false)
const webhookCopyMessage = ref('')
const webhookWindow = ref({ x: 0, y: 0 })
let webhookDrag:
  | { startX: number; startY: number; originX: number; originY: number }
  | null = null

const filteredAlerts = computed(() =>
  sortByStartedAtDesc(filterAlertsWithContext(alertStore.alerts, assetStore.devices, roomStore.racks, roomStore.rooms, filters.value)),
)
const pagedAlerts = computed(() => paginate(filteredAlerts.value, { page: page.value, pageSize: pageSize.value }))
const webhookWindowStyle = computed(() => ({
  left: `${webhookWindow.value.x}px`,
  top: `${webhookWindow.value.y}px`,
}))

watch([filters, pageSize], () => {
  page.value = 1
})

onMounted(async () => {
  await Promise.all([alertStore.loadAlerts(), assetStore.loadDevices(), roomStore.loadRooms()])
  webhookBaseUrl.value = getAlertWebhookPublicBaseUrl()
  await detectPublicWebhookBaseUrl()
  webhooks.value = refreshAlertWebhookUrls(webhookBaseUrl.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', moveWebhookWindow)
  window.removeEventListener('pointerup', stopWebhookDrag)
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
  webhookBaseUrl.value = setAlertWebhookPublicBaseUrl(webhookBaseUrl.value)
  createAlertWebhook({
    name: webhookName.value,
    source: webhookSource.value,
    enabled: true,
  })
  webhooks.value = getAlertWebhooks()
  webhookCopyMessage.value = ''
}

function saveWebhookBaseUrl() {
  webhookBaseUrl.value = setAlertWebhookPublicBaseUrl(webhookBaseUrl.value)
  webhooks.value = getAlertWebhooks()
  webhookCopyMessage.value = '对外访问地址已更新'
}

async function detectPublicWebhookBaseUrl() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(webhookBaseUrl.value)) return
  try {
    const response = await fetch('/api/runtime/public-base-url')
    if (!response.ok) return
    const data = (await response.json()) as { baseUrl?: string }
    if (data.baseUrl && !/127\.0\.0\.1|localhost/i.test(data.baseUrl)) {
      webhookBaseUrl.value = setAlertWebhookPublicBaseUrl(data.baseUrl)
    }
  } catch {
    // 保留用户手动填写能力。
  }
}

function removeWebhook(id: string) {
  deleteAlertWebhook(id)
  webhooks.value = getAlertWebhooks()
}

function openWebhookWindow() {
  const width = 520
  webhookWindow.value = {
    x: Math.max(18, window.innerWidth - width - 38),
    y: 142,
  }
  webhookWindowOpen.value = true
}

async function copyWebhookUrl(url: string) {
  try {
    await navigator.clipboard?.writeText(url)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  webhookCopyMessage.value = 'Webhook地址已复制'
}

function startWebhookDrag(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  webhookDrag = {
    startX: event.clientX,
    startY: event.clientY,
    originX: webhookWindow.value.x,
    originY: webhookWindow.value.y,
  }
  window.addEventListener('pointermove', moveWebhookWindow)
  window.addEventListener('pointerup', stopWebhookDrag)
}

function moveWebhookWindow(event: PointerEvent) {
  if (!webhookDrag) return
  webhookWindow.value = {
    x: Math.max(10, Math.min(window.innerWidth - 540, webhookDrag.originX + event.clientX - webhookDrag.startX)),
    y: Math.max(10, Math.min(window.innerHeight - 360, webhookDrag.originY + event.clientY - webhookDrag.startY)),
  }
}

function stopWebhookDrag() {
  webhookDrag = null
  window.removeEventListener('pointermove', moveWebhookWindow)
  window.removeEventListener('pointerup', stopWebhookDrag)
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">告警中心</h2>
        <p class="page-subtitle">统一查看手工告警、未来 Prometheus 与卓豪监控同步的设备异常。</p>
      </div>
      <div class="header-actions">
        <button class="webhook-button" type="button" @click="openWebhookWindow">Webhook接入</button>
        <button class="add-alert" type="button" @click="openAddAlert">新增告警</button>
      </div>
    </div>

    <AlertFilters
      :filters="filters"
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @update:filters="filters = $event"
    />
    <aside
      v-if="webhookWindowOpen"
      class="webhook-window"
      :style="webhookWindowStyle"
      role="dialog"
      aria-label="告警 Webhook 接入"
    >
      <header @pointerdown="startWebhookDrag">
        <div>
          <strong>Webhook 接入</strong>
          <span>用于卓豪、Prometheus 或自定义监控推送告警。</span>
        </div>
        <button type="button" @click="webhookWindowOpen = false">关闭</button>
      </header>
      <div class="webhook-form">
        <label class="webhook-base-url">
          <span>对外访问地址</span>
          <input
            v-model="webhookBaseUrl"
            aria-label="Webhook对外访问地址"
            placeholder="例如：http://192.168.31.50:5173"
            @blur="saveWebhookBaseUrl"
          />
        </label>
        <input v-model="webhookName" aria-label="Webhook名称" placeholder="Webhook名称" />
        <select v-model="webhookSource" aria-label="Webhook来源">
          <option value="zoho">卓豪监控</option>
          <option value="prometheus">Prometheus</option>
          <option value="custom">自定义</option>
        </select>
        <button type="button" @click="addWebhook">创建Webhook</button>
      </div>
      <div class="webhook-list">
        <article v-for="webhook in webhooks" :key="webhook.id">
          <div>
            <strong>{{ webhook.name }}</strong>
            <code>{{ webhook.url }}</code>
          </div>
          <button type="button" aria-label="复制Webhook地址" @click="copyWebhookUrl(webhook.url)">复制</button>
          <button type="button" @click="removeWebhook(webhook.id)">删除</button>
        </article>
        <p v-if="webhooks.length === 0">暂无 Webhook 配置。</p>
        <p v-if="webhookCopyMessage" class="copy-message">{{ webhookCopyMessage }}</p>
      </div>
    </aside>
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
.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.add-alert {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(239, 68, 68, 0.72);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(239, 68, 68, 0.16);
  cursor: pointer;
}

.webhook-button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.48);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.12);
  cursor: pointer;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--color-text-muted);
}

.webhook-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 138px auto;
  gap: 8px;
}

.webhook-base-url {
  grid-column: 1 / -1;
  display: grid;
  gap: 5px;
}

.webhook-base-url span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.webhook-window {
  position: fixed;
  z-index: 90;
  width: min(520px, calc(100vw - 28px));
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-glass);
  box-shadow: 0 20px 58px rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(16px);
}

.webhook-window header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  cursor: move;
}

.webhook-window header button {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(14, 165, 233, 0.48);
  border-radius: 8px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 16%, var(--control-bg));
  cursor: pointer;
}

.webhook-window header div {
  display: grid;
  gap: 4px;
}

.webhook-window span,
.webhook-list p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
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
  max-height: 220px;
  overflow: auto;
}

.webhook-list article {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: start;
  padding: 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.copy-message {
  color: var(--color-success) !important;
}

.webhook-list article > div {
  min-width: 0;
  display: grid;
  gap: 4px;
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
  background: var(--control-bg);
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
