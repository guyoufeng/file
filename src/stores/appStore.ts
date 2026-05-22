import { defineStore } from 'pinia'
import type { AiModelConfig, AuditLog } from '../types/domain'
import { getAiModelConfigs, getAuditLogs } from '../services/backend/settings'

export const useAppStore = defineStore('app', {
  state: () => ({
    aiModelConfigs: [] as AiModelConfig[],
    auditLogs: [] as AuditLog[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadSettings() {
      this.loading = true
      this.error = null
      try {
        const [aiModelConfigs, auditLogs] = await Promise.all([getAiModelConfigs(), getAuditLogs()])
        this.aiModelConfigs = aiModelConfigs
        this.auditLogs = auditLogs
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载系统设置失败'
      } finally {
        this.loading = false
      }
    },
  },
})
