import type { AiProviderAdapter } from './types'

export const geminiAdapter: AiProviderAdapter = {
  name: 'gemini',
  async listModels(config) {
    return config.model ? [config.model] : []
  },
  async testConnection(config) {
    return config.model
      ? { ok: true, message: 'Gemini 配置可用于手工模型调用' }
      : { ok: false, message: '请填写 Gemini 模型标识' }
  },
  async chat() {
    throw new Error('Gemini chat adapter will be connected in AI assistant task')
  },
}
