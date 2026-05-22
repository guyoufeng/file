import { describe, expect, it } from 'vitest'
import { getProviderAdapter } from '../../services/ai/aiGateway'
import type { AiModelConfig } from '../../types/domain'

function config(provider: AiModelConfig['provider']): AiModelConfig {
  return {
    id: provider,
    provider,
    name: provider,
    baseUrl: 'http://localhost:11434',
    model: 'qwen3.6-35b',
    enabled: true,
  }
}

describe('ai gateway', () => {
  it.each([
    ['gpustack', 'openai-compatible'],
    ['openai_compatible', 'openai-compatible'],
    ['deepseek', 'openai-compatible'],
    ['vllm', 'openai-compatible'],
    ['ollama', 'ollama'],
    ['gemini', 'gemini'],
  ] as const)('maps %s to %s adapter', (provider, adapterName) => {
    expect(getProviderAdapter(config(provider)).name).toBe(adapterName)
  })
})
