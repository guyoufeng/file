import { defineStore } from 'pinia'
import type { AiModelConfig } from '../types/domain'
import {
  discoverAiModels,
  getAiModelConfigs,
  saveAiModelConfig,
} from '../services/backend/settings'
import { getProviderAdapter } from '../services/ai/aiGateway'

export const useAiStore = defineStore('ai', {
  state: () => ({
    configs: [] as AiModelConfig[],
    loading: false,
    error: null as string | null,
    testMessage: '',
  }),
  actions: {
    async loadConfigs() {
      this.loading = true
      this.error = null
      try {
        this.configs = await getAiModelConfigs()
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载 AI 模型配置失败'
      } finally {
        this.loading = false
      }
    },
    addLocalConfig(config: AiModelConfig) {
      const index = this.configs.findIndex((item) => item.id === config.id)
      if (config.enabled) {
        this.configs.forEach((item) => (item.enabled = false))
      }
      if (index >= 0) this.configs.splice(index, 1, config)
      else this.configs.unshift(config)
    },
    async discoverModels(config: AiModelConfig) {
      return await discoverAiModels(config)
    },
    async saveConfig(config: AiModelConfig) {
      const saved = await saveAiModelConfig(config)
      this.addLocalConfig(saved)
      return saved
    },
    async testConfig(config: AiModelConfig) {
      const result = await getProviderAdapter(config).testConnection(config)
      this.testMessage = result.message
      return result
    },
  },
})
