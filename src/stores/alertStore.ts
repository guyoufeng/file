import { defineStore } from 'pinia'
import type { Alert } from '../types/domain'
import { getAlerts } from '../services/backend/alerts'

export const useAlertStore = defineStore('alerts', {
  state: () => ({
    alerts: [] as Alert[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadAlerts(deviceId?: string) {
      this.loading = true
      this.error = null
      try {
        this.alerts = await getAlerts(deviceId)
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载告警数据失败'
      } finally {
        this.loading = false
      }
    },
  },
})
