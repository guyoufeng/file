import type { AiModelConfig } from "../../types/domain";

export function aiProviderLabel(provider: AiModelConfig["provider"]) {
  switch (provider) {
    case "gpustack":
      return "GPUStack";
    case "openai_compatible":
      return "OpenAI Compatible";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "ollama":
      return "Ollama";
    case "vllm":
      return "vLLM";
  }
}

export function buildAiModelConfigName(
  provider: AiModelConfig["provider"],
  model: string,
) {
  return model.trim() ? `${aiProviderLabel(provider)} ${model.trim()}` : "";
}
