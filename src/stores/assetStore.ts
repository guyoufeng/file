import { defineStore } from 'pinia'
import type { Device } from '../types/domain'
import { getDevices } from '../services/backend/assets'

export const useAssetStore = defineStore('assets', {
  state: () => ({
    devices: [] as Device[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadDevices(rackId?: string) {
      this.loading = true
      this.error = null
      try {
        this.devices = await getDevices(rackId)
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载资产数据失败'
      } finally {
        this.loading = false
      }
    },
  },
})
