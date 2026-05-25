<script setup lang="ts">
import { ref } from 'vue'
import {
  exportProjectJson,
  getProjectSummary,
  importProjectJson,
  restoreSampleProject,
  type ProjectJson,
  validateProjectJson,
} from '../../../services/backend/data'

const message = ref('当前数据管理支持 v0.1.0 项目 JSON 导出、导入校验和示例数据恢复。')
const importing = ref(false)

async function exportJson(fileNamePrefix = 'qf-ai-dcim-project') {
  const project = await exportProjectJson()
  const summary = getProjectSummary(project)
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  message.value = `已导出项目 JSON：${summary.roomCount} 个机房、${summary.rackCount} 个机柜、${summary.deviceCount} 台设备、${summary.alertCount} 条告警。`
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
    const confirmText = window.prompt(
      `将导入 ${summary.roomCount} 个机房、${summary.rackCount} 个机柜、${summary.deviceCount} 台设备，并覆盖当前拓扑/资产/告警数据。请输入“导入项目”确认。`,
    )
    if (confirmText !== '导入项目') {
      message.value = '已取消导入项目 JSON。'
      return
    }

    await importProjectJson(project)
    message.value = '项目 JSON 已导入，请刷新或重新进入页面查看最新数据。'
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
    message.value = '已恢复 v0.1 示例数据，请刷新或重新进入页面查看。'
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
}
</style>
