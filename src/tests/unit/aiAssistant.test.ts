import { describe, expect, it, vi } from "vitest";
import type { AiModelConfig } from "../../types/domain";
import { sampleProject } from "../../services/backend/data";

const chat = vi.fn();

vi.mock("../../services/ai/aiGateway", () => ({
  getProviderAdapter: () => ({
    name: "openai-compatible",
    chat,
  }),
}));

const config: AiModelConfig = {
  id: "ai-config-gpustack-default",
  provider: "gpustack",
  name: "GPUStack qwen3.6-35b-a3b-awq",
  baseUrl: "http://192.168.127.8/v1",
  model: "qwen3.6-35b-a3b-awq",
  apiKeyRef: "secret",
  enabled: true,
};

describe("ai assistant", () => {
  it("routes non-DCIM questions to general model chat without fake asset facts", async () => {
    const { answerWithAiAssistant } =
      await import("../../services/ai/aiAssistant");
    chat.mockResolvedValueOnce("我是平台助手，可以回答通用问题，也可以查询资产。");

    const result = await answerWithAiAssistant({
      question: "你能帮忙做哪些事情？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("平台助手");
    expect(chat).toHaveBeenCalledWith(
      config,
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.not.stringContaining("工具查询结果"),
        }),
      ]),
    );
  });

  it("uses enabled model with agent role, skill context, and tool result", async () => {
    const { answerWithAiAssistant } =
      await import("../../services/ai/aiAssistant");
    chat.mockResolvedValueOnce("模型整理后的专业回答");

    const result = await answerWithAiAssistant({
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
    });

    expect(result.answer).toBe("模型整理后的专业回答");
    expect(result.usedModel).toBe("qwen3.6-35b-a3b-awq");
    expect(result.toolName).toBe("locate_device");
    expect(chat).toHaveBeenCalledWith(
      config,
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("泉峰AI数据中心管理平台"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("资产定位"),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("工具查询结果"),
        }),
      ]),
    );
  });

  it("treats serial number and asset owner questions as internal platform queries", async () => {
    const { answerWithAiAssistant } =
      await import("../../services/ai/aiAssistant");
    const device = sampleProject.devices[3];
    chat.mockResolvedValueOnce("模型整理后的资产详情");

    const result = await answerWithAiAssistant({
      question: `查询 ${device.serialNumber} 的详细信息`,
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
    });

    expect(result.toolName).toBe("search_devices");
    expect(result.relatedDeviceId).toBe(device.id);
    expect(chat).toHaveBeenCalledWith(
      config,
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("工具查询结果"),
        }),
      ]),
    );
  });

  it("falls back to deterministic tool answer when no model is enabled", async () => {
    const { answerWithAiAssistant } =
      await import("../../services/ai/aiAssistant");

    const result = await answerWithAiAssistant({
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      configs: [],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
    });

    expect(result.answer).toContain("QF-SRV-001");
    expect(result.usedModel).toBeUndefined();
    expect(result.fallbackReason).toBe("未配置启用模型");
  });
});
