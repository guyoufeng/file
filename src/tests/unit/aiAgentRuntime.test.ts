import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("QF AI agent runtime", () => {
  beforeEach(() => {
    chat.mockReset();
  });

  it("runs a Pi-style readonly agent loop with model planning and tool execution", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat
      .mockResolvedValueOnce(
        JSON.stringify({
          toolName: "locate_device",
          reason: "用户提供了明确 IP，需要定位设备所在机柜和 U 位。",
        }),
      )
      .mockResolvedValueOnce("模型基于工具结果总结：QF-SRV-001 位于 529-A1。");

    const result = await runQfAiAgent({
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("locate_device");
    expect(result.answer).toContain("QF-SRV-001");
    expect(result.usedModel).toBe("qwen3.6-35b-a3b-awq");
    expect(result.plan).toMatchObject({
      toolName: "locate_device",
      planner: "model",
    });
    expect(result.events.map((event) => event.type)).toContain("tool_selection");
    expect(result.events.find((event) => event.type === "tool_selection")?.detail).toContain(
      "locate_device",
    );
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[0][1].at(-1).content).toContain("只输出 JSON");
    expect(chat.mock.calls[1][1].at(-1).content).toContain("工具查询结果");
  });

  it("falls back to deterministic tool planning when planner model output is invalid", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockResolvedValueOnce("我觉得应该查一下").mockResolvedValueOnce("模型总结");

    const result = await runQfAiAgent({
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("locate_device");
    expect(result.plan.planner).toBe("deterministic");
    expect(result.plan.reason).toContain("模型工具选择结果不是有效 JSON");
  });

  it("returns a deterministic answer when no model is configured", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");

    const result = await runQfAiAgent({
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      configs: [],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.answer).toContain("QF-SRV-001");
    expect(result.fallbackReason).toBe("未配置启用模型");
    expect(result.plan.planner).toBe("deterministic");
    expect(chat).not.toHaveBeenCalled();
  });

  it("answers general questions directly with the selected model instead of platform summary", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockResolvedValueOnce("你好，我可以帮你查询平台，也可以回答通用运维问题。");

    const result = await runQfAiAgent({
      question: "你好，请问你能帮忙做哪些事情",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
      memories: ["用户希望我优先围绕数据中心运维辅助工作回答。"],
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("通用运维问题");
    expect(result.answer).not.toContain("当前平台已纳管");
    expect(result.plan).toMatchObject({
      toolName: "general_chat",
      planner: "model",
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][1].at(-1).content).toContain("用户希望我优先围绕数据中心运维辅助工作回答");
  });
});
