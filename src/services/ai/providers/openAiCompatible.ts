import type { AiMessageInput } from "../../../types/ai";
import type { AiModelConfig } from "../../../types/domain";
import { invokeCommand } from "../../backend/invoke";
import type { AiProviderAdapter } from "./types";

function headers(config: AiModelConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(config.apiKeyRef
      ? { Authorization: `Bearer ${config.apiKeyRef}` }
      : {}),
  };
}

function normalizeMessages(messages: AiMessageInput[]): AiMessageInput[] {
  const systemContent = messages
    .filter((message) => message.role === "system" && message.content.trim())
    .map((message) => message.content.trim())
    .join("\n\n");
  const conversation = messages.filter((message) => message.role !== "system");
  return systemContent
    ? [{ role: "system", content: systemContent }, ...conversation]
    : conversation;
}

export const openAiCompatibleAdapter: AiProviderAdapter = {
  name: "openai-compatible",
  async listModels(config) {
    const response = await fetch(
      `${config.baseUrl.replace(/\/$/, "")}/models`,
      { headers: headers(config) },
    );
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data.map((item: { id: string }) => item.id)
      : [];
  },
  async testConnection(config) {
    try {
      const models = await this.listModels(config);
      return {
        ok: true,
        message:
          models.length > 0
            ? `发现 ${models.length} 个模型`
            : "连接成功，但未返回模型列表",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "连接失败",
      };
    }
  },
  async chat(config, messages: AiMessageInput[]) {
    const normalizedMessages = normalizeMessages(messages);
    try {
      const answer = await invokeCommand<string>("chat_with_ai_model", {
        input: config,
        messages: normalizedMessages,
      });
      if (answer?.trim()) return answer;
      throw new Error("模型返回为空");
    } catch {
      try {
        const response = await fetch("/__ai_proxy/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: config.provider,
            baseUrl: config.baseUrl,
            apiKeyRef: config.apiKeyRef,
            model: config.model,
            messages: normalizedMessages,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.error?.message || "模型代理请求失败");
        }
        const answer = data.choices?.[0]?.message?.content ?? data.message?.content ?? "";
        if (answer.trim()) return answer;
        throw new Error(data.message || data.error?.message || "模型返回为空");
      } catch (proxyError) {
        throw new Error(
          proxyError instanceof Error ? proxyError.message : "模型代理请求失败",
        );
      }
    }
  },
};
