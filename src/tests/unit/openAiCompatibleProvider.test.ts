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
});
