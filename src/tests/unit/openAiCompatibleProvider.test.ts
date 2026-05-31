import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig } from "../../types/domain";

const invokeCommand = vi.fn();

vi.mock("../../services/backend/invoke", () => ({
  invokeCommand,
}));

const config: AiModelConfig = {
  id: "gpustack",
  provider: "gpustack",
  name: "GPUStack",
  baseUrl: "http://192.168.127.8/v1",
  model: "qwen3.6-35b-a3b-awq",
  apiKeyRef: "secret",
  enabled: true,
};

describe("openai compatible provider", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
    vi.restoreAllMocks();
  });

  it("throws when proxy returns an upstream error instead of silently returning empty text", async () => {
    const { openAiCompatibleAdapter } = await import(
      "../../services/ai/providers/openAiCompatible"
    );
    invokeCommand.mockRejectedValueOnce(new Error("not tauri"));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "401 Unauthorized" }),
    } as Response);

    await expect(openAiCompatibleAdapter.chat(config, [])).rejects.toThrow(
      "401 Unauthorized",
    );
  });

  it("returns proxy chat content when available", async () => {
    const { openAiCompatibleAdapter } = await import(
      "../../services/ai/providers/openAiCompatible"
    );
    invokeCommand.mockRejectedValueOnce(new Error("not tauri"));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "模型回答" } }],
      }),
    } as Response);

    await expect(openAiCompatibleAdapter.chat(config, [])).resolves.toBe("模型回答");
  });

  it("merges all system messages into the first OpenAI-compatible message", async () => {
    const { openAiCompatibleAdapter } = await import(
      "../../services/ai/providers/openAiCompatible"
    );
    invokeCommand.mockResolvedValueOnce("模型回答");

    await openAiCompatibleAdapter.chat(config, [
      { role: "system", content: "角色定义" },
      { role: "system", content: "Skill 说明" },
      { role: "user", content: "机房温度多少合适？" },
      { role: "system", content: "后续补充约束" },
    ]);

    const sentMessages = invokeCommand.mock.calls[0][1].messages;
    expect(sentMessages.map((message: { role: string }) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(sentMessages[0].content).toContain("角色定义");
    expect(sentMessages[0].content).toContain("Skill 说明");
    expect(sentMessages[0].content).toContain("后续补充约束");
  });

  it("sends normalized messages to the browser proxy fallback", async () => {
    const { openAiCompatibleAdapter } = await import(
      "../../services/ai/providers/openAiCompatible"
    );
    invokeCommand.mockRejectedValueOnce(new Error("not tauri"));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "模型回答" } }],
      }),
    } as Response);

    await openAiCompatibleAdapter.chat(config, [
      { role: "system", content: "角色定义" },
      { role: "user", content: "怎么维护物理机？" },
      { role: "system", content: "知识库内容" },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(body.messages[0].content).toContain("知识库内容");
  });
});
