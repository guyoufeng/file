import type { AiMessageInput } from '../../../types/ai'
import type { AiModelConfig } from '../../../types/domain'
import type { AiProviderAdapter } from './types'

function headers(config: AiModelConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(config.apiKeyRef ? { Authorization: `Bearer ${config.apiKeyRef}` } : {}),
  }
}

export const openAiCompatibleAdapter: AiProviderAdapter = {
  name: 'openai-compatible',
  async listModels(config) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models`, { headers: headers(config) })
    const data = await response.json()
    return Array.isArray(data.data) ? data.data.map((item: { id: string }) => item.id) : []
  },
  async testConnection(config) {
    try {
      const models = await this.listModels(config)
      return { ok: true, message: models.length > 0 ? `发现 ${models.length} 个模型` : '连接成功，但未返回模型列表' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '连接失败' }
    }
  },
  async chat(config, messages: AiMessageInput[]) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({ model: config.model, messages }),
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? ''
  },
}
