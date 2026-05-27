<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useAiStore } from '../../../stores/aiStore'
import { useAlertStore } from '../../../stores/alertStore'
import { useAssetStore } from '../../../stores/assetStore'
import { useRoomStore } from '../../../stores/roomStore'
import {
  exportProjectJson,
  getProjectSummary,
  importProjectJson,
  restoreSampleProject,
  type ProjectJson,
  validateProjectJson,
} from '../../../services/backend/data'
import { reloadProjectStores } from '../../../services/project/reloadProjectData'
import {
  buildProjectImportPreview,
  type ProjectImportPreview,
} from '../../../services/project/projectImportPreview'
import {
  scanProjectBackupSecurity,
  summarizeBackupSecurity,
} from '../../../services/project/backupSecurity'
import { writeSystemAuditLog } from '../../../services/backend/ai'

const message = ref('当前数据管理支持 v0.1.0 项目 JSON 导出、导入校验和示例数据恢复。')
const importing = ref(false)
const importPreview = ref<ProjectImportPreview | null>(null)
const roomStore = useRoomStore()
const assetStore = useAssetStore()
const alertStore = useAlertStore()
const aiStore = useAiStore()
const recoverableTopology = computed(() => roomStore.deletedTopology)

async function reloadProjectData() {
  await reloadProjectStores({
    roomStore,
    assetStore,
    alertStore,
    aiStore,
  })
}

onMounted(async () => {
  if (roomStore.rooms.length === 0 && !roomStore.loading) {
    await reloadProjectData()
  }
})

function getRecoverableTitle(item: (typeof roomStore.deletedTopology)[number]) {
  return item.type === 'room' ? item.room.name : item.rack.name
}

function getRecoverableDescription(item: (typeof roomStore.deletedTopology)[number]) {
  const expireDate = new Date(item.expiresAt).toLocaleDateString('zh-CN')
  if (item.type === 'room') {
    return `${item.racks.length} 个机柜 / ${item.devices?.length ?? 0} 台设备 / 保留至 ${expireDate}`
  }
  return `${item.rack.type} / ${item.devices?.length ?? 0} 台设备 / 保留至 ${expireDate}`
}

async function restoreTopologyItem(itemId: string) {
  const item = roomStore.restoreDeletedItem(itemId)
  if (!item) return

  for (const device of item.devices ?? []) {
    await assetStore.upsertDevice(device)
  }

  if (item.type === 'room') {
    writeSystemAuditLog({
      action: 'room.restore',
      targetType: 'room',
      targetId: item.room.id,
      summary: `恢复机房：${item.room.name}`,
      status: 'success',
      metadata: {
        roomName: item.room.name,
        restoredRackCount: item.racks.length,
        restoredDeviceCount: item.devices?.length ?? 0,
        source: 'data_management_recycle_center',
      },
    })
    message.value = `已恢复机房：${item.room.name}`
  } else {
    writeSystemAuditLog({
      action: 'rack.restore',
      targetType: 'rack',
      targetId: item.rack.id,
      summary: `恢复机柜：${item.rack.name}`,
      status: 'success',
      metadata: {
        rackName: item.rack.name,
        roomId: item.rack.roomId,
        restoredDeviceCount: item.devices?.length ?? 0,
        source: 'data_management_recycle_center',
      },
    })
    message.value = `已恢复机柜：${item.rack.name}`
  }
}

async function exportJson(fileNamePrefix = 'qf-ai-dcim-project') {
  const project = await exportProjectJson()
  const summary = getProjectSummary(project)
  const securitySummary = summarizeBackupSecurity(scanProjectBackupSecurity(project))
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  message.value = `已导出项目 JSON：${summary.roomCount} 个机房、${summary.rackCount} 个机柜、${summary.deviceCount} 台设备、${summary.alertCount} 条告警。${securitySummary}`
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const project = JSON.parse(await file.text()) as ProjectJson
    const validation = validateProjectJson(project)
    if (!validation.valid) {
      message.value = validation.message
      return
    }

    const summary = getProjectSummary(project)
    importPreview.value = buildProjectImportPreview(
      project,
      getProjectSummary(await exportProjectJson()),
    )
    await nextTick()
    const confirmText = window.prompt(
      `将导入 ${summary.roomCount} 个机房、${summary.rackCount} 个机柜、${summary.deviceCount} 台设备，并覆盖当前拓扑/资产/告警数据。请输入“导入项目”确认。`,
    )
    if (confirmText !== '导入项目') {
      message.value = '已取消导入项目 JSON。'
      return
    }

    await importProjectJson(project)
    await reloadProjectData()
    writeSystemAuditLog({
      action: 'project.import_json',
      targetType: 'project',
      summary: `导入项目 JSON：${summary.roomCount} 个机房、${summary.rackCount} 个机柜`,
      status: 'success',
      metadata: {
        roomCount: summary.roomCount,
        rackCount: summary.rackCount,
        deviceCount: summary.deviceCount,
        alertCount: summary.alertCount,
      },
    })
    importPreview.value = null
    message.value = '项目 JSON 已导入，机房、机柜、资产、告警和 AI 配置已刷新。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入项目 JSON 失败'
  } finally {
    importing.value = false
    input.value = ''
  }
}

async function restoreSample() {
  const confirmText = window.prompt('恢复示例数据会覆盖当前拓扑、资产和告警。请输入“恢复示例数据”确认。')
  if (confirmText !== '恢复示例数据') {
    message.value = '已取消恢复示例数据。'
    return
  }

  try {
    await restoreSampleProject()
    await reloadProjectData()
    writeSystemAuditLog({
      action: 'project.restore_sample',
      targetType: 'project',
      summary: '恢复 v0.1 示例数据',
      status: 'success',
      metadata: { source: 'settings_data_management' },
    })
    message.value = '已恢复 v0.1 示例数据，机房、机柜、资产、告警和 AI 配置已刷新。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '恢复示例数据失败'
  }
}

function clearReserved() {
  const confirmText = window.prompt('清空数据属于高风险操作，v0.1 暂不直接开放。请输入“我知道风险”查看说明。')
  message.value = confirmText === '我知道风险' ? '清空数据命令已预留，稳定权限和审计后再开放。当前请使用“恢复示例数据”覆盖。' : '已取消清空数据。'
}
</script>

<template>
  <section class="settings-panel">
    <header>
      <div>
        <p class="eyebrow">Data Management</p>
        <h3>数据管理</h3>
      </div>
      <span>本地优先项目数据可导出为开放 JSON，后续方便迁移、备份和外部 AI/API 对接。导出文件会自动排除模型 API Key。</span>
    </header>

    <div class="notice-grid">
      <div>
        <strong>项目备份</strong>
        <span>包含机房、机柜、资产、告警和 AI 模型基础配置。</span>
      </div>
      <div>
        <strong>安全规则</strong>
        <span>登录凭据、API Key、Token 不进入导出文件。</span>
      </div>
      <div>
        <strong>导入策略</strong>
        <span>导入前会校验版本和集合结构，确认后覆盖当前项目数据。</span>
      </div>
    </div>

    <div class="action-grid">
      <button type="button" @click="exportJson()">导出项目 JSON</button>
      <button type="button" @click="exportJson('qf-ai-dcim-backup')">创建本地备份</button>
      <label class="import-button">
        <input type="file" accept="application/json,.json" :disabled="importing" @change="handleImport" />
        导入项目 JSON
      </label>
      <button type="button" @click="restoreSample">恢复示例数据</button>
      <button type="button" class="danger" @click="clearReserved">清空当前数据</button>
    </div>

    <section class="recycle-center">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Recycle Center</p>
          <h3>回收站 / 恢复中心</h3>
        </div>
        <span>删除的机房和机柜默认保留 7 天，恢复时会带回关联设备。</span>
      </div>
      <div v-if="recoverableTopology.length === 0" class="empty-recycle">
        暂无 7 天内可恢复的机房或机柜。
      </div>
      <div v-else class="recycle-list" aria-label="可恢复拓扑">
        <article v-for="item in recoverableTopology" :key="item.id" class="recycle-item">
          <div>
            <strong>{{ getRecoverableTitle(item) }}</strong>
            <small>{{ item.type === 'room' ? '已删除机房' : '已删除机柜' }}</small>
          </div>
          <span>{{ getRecoverableDescription(item) }}</span>
          <button type="button" @click="restoreTopologyItem(item.id)">
            恢复 {{ getRecoverableTitle(item) }}
          </button>
        </article>
      </div>
    </section>

    <section v-if="importPreview" class="import-preview" aria-label="项目导入预览">
      <div>
        <p class="eyebrow">Import Preview</p>
        <h4>项目导入预览</h4>
        <span>导出时间：{{ importPreview.exportedAtText }}</span>
      </div>
      <div class="preview-stats">
        <span>{{ importPreview.stats.dataCenterCount }} 数据中心</span>
        <span>{{ importPreview.stats.roomCount }} 机房</span>
        <span>{{ importPreview.stats.microModuleCount }} 微模块</span>
        <span>{{ importPreview.stats.rackCount }} 机柜</span>
        <span>{{ importPreview.stats.deviceCount }} 设备</span>
        <span>{{ importPreview.stats.alertCount }} 告警</span>
        <span>{{ importPreview.stats.aiModelConfigCount }} AI配置</span>
      </div>
      <p>{{ importPreview.currentSummaryText }}</p>
      <p :class="['security-summary', { warning: !importPreview.security.safe }]">
        {{ importPreview.securitySummary }}
      </p>
      <div v-if="!importPreview.security.safe" class="security-findings">
        <span v-for="finding in importPreview.security.findings.slice(0, 6)" :key="finding.path">
          {{ finding.path }}：{{ finding.reason }}
        </span>
      </div>
      <ul>
        <li v-for="item in importPreview.riskItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <p class="message">{{ message }}</p>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
}

header span,
.message {
  max-width: 620px;
  color: var(--color-text-muted);
}

.notice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.import-preview {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(14, 165, 233, 0.46);
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
}

.import-preview h4,
.import-preview p,
.import-preview ul {
  margin: 0;
}

.import-preview span,
.import-preview li {
  color: var(--color-text-muted);
  font-size: 13px;
}

.preview-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-stats span {
  padding: 5px 8px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 999px;
  color: #bae6fd;
  background: rgba(8, 17, 31, 0.6);
}

.security-summary {
  color: #bbf7d0;
}

.security-summary.warning {
  color: #fde68a;
}

.security-findings {
  display: grid;
  gap: 4px;
}

.security-findings span {
  color: #fed7aa;
  word-break: break-all;
}

.notice-grid div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.62);
}

.notice-grid span {
  color: var(--color-text-muted);
  font-size: 13px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.recycle-center {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(56, 189, 248, 0.26);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.62);
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.section-heading span,
.empty-recycle {
  color: var(--color-text-muted);
  font-size: 13px;
}

.recycle-list {
  display: grid;
  gap: 8px;
}

.recycle-item {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(220px, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
}

.recycle-item div {
  display: grid;
  gap: 3px;
}

.recycle-item small,
.recycle-item span {
  color: var(--color-text-muted);
  font-size: 12px;
}

button,
.import-button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.62);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.14);
  cursor: pointer;
}

.danger {
  border-color: rgba(239, 68, 68, 0.64);
  background: rgba(239, 68, 68, 0.12);
}

input[type='file'] {
  display: none;
}

.message {
  margin: 0;
}

@media (max-width: 900px) {
  .notice-grid {
    grid-template-columns: 1fr;
  }

  .recycle-item {
    grid-template-columns: 1fr;
  }
}
</style>
