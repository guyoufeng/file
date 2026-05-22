import type { AiModelConfig } from '../../../types/domain'
import type { AiProviderAdapter } from './types'

export const ollamaAdapter: AiProviderAdapter = {
  name: 'ollama',
  async listModels(config) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/tags`)
    const data = await response.json()
    return Array.isArray(data.models) ? data.models.map((item: { name: string }) => item.name) : []
  },
  async testConnection(config) {
    try {
      const models = await this.listModels(config)
      return { ok: true, message: models.length > 0 ? `发现 ${models.length} 个模型` : '连接成功，但未返回模型列表' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '连接失败' }
    }
  },
  async chat(config, messages) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, stream: false }),
    })
    const data = await response.json()
    return data.message?.content ?? ''
  },
}
