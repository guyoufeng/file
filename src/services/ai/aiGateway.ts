import type { AiModelConfig } from '../../types/domain'
import { geminiAdapter } from './providers/gemini'
import { ollamaAdapter } from './providers/ollama'
import { openAiCompatibleAdapter } from './providers/openAiCompatible'
import type { AiProviderAdapter } from './providers/types'

export function getProviderAdapter(config: AiModelConfig): AiProviderAdapter {
  switch (config.provider) {
    case 'ollama':
      return ollamaAdapter
    case 'gemini':
      return geminiAdapter
    case 'gpustack':
    case 'openai_compatible':
    case 'deepseek':
    case 'vllm':
      return openAiCompatibleAdapter
  }
}
