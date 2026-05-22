import type { AiMessageInput } from '../../../types/ai'
import type { AiModelConfig } from '../../../types/domain'

export interface AiProviderAdapter {
  name: string
  listModels(config: AiModelConfig): Promise<string[]>
  testConnection(config: AiModelConfig): Promise<{ ok: boolean; message: string }>
  chat(config: AiModelConfig, messages: AiMessageInput[]): Promise<string>
}
