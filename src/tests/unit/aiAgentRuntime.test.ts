import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig } from "../../types/domain";
import { sampleProject } from "../../services/backend/data";
import { addKnowledgeEntry } from "../../services/ai/agentKnowledgeBase";
import { saveAgentCredential } from "../../services/ai/agentCredentials";

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

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

describe("QF AI agent runtime", () => {
  beforeEach(() => {
    installLocalStorage();
    chat.mockReset();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
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

  it("routes data-center maintenance advice questions to general model chat", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockResolvedValueOnce("推荐温度一般控制在 18-27 摄氏度。");

    const result = await runQfAiAgent({
      question: "机房推荐的参考温度多少度合适？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("18-27");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("routes hardware alarm handling advice to general model chat", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockResolvedValueOnce("ECC 报警建议先确认 DIMM 槽位和错误计数。");

    const result = await runQfAiAgent({
      question: "物理机 ECC 报警如何处理？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("ECC");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("answers current model identity from enabled model config", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");

    const result = await runQfAiAgent({
      question: "你好，你现在用的是哪个模型？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("qwen3.6-35b-a3b-awq");
    expect(result.answer).toContain("GPUStack qwen3.6-35b-a3b-awq");
    expect(chat).not.toHaveBeenCalled();
  });

  it("reports model call failure when generic chat has an enabled config", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockRejectedValueOnce(new Error("401 Unauthorized"));

    const result = await runQfAiAgent({
      question: "数据中心日常维护要注意什么？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("模型调用失败");
    expect(result.answer).toContain("qwen3.6-35b-a3b-awq");
    expect(result.fallbackReason).toBe("401 Unauthorized");
    expect(result.answer).not.toContain("当前未配置启用模型");
  });

  it("adds knowledge base and masked credential catalog to generic model prompt", async () => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    addKnowledgeEntry({
      title: "服务器内存故障处理",
      content: "先确认告警 DIMM 槽位，再安排停机更换同规格内存条。",
      tags: ["硬件", "内存"],
    });
    saveAgentCredential({
      type: "zoho",
      name: "卓豪生产监控",
      endpoint: "https://zoho.example/api",
      username: "ops",
      secret: "super-secret",
      notes: "生产监控",
    });
    chat.mockResolvedValueOnce("建议先定位 DIMM 槽位，再安排更换。");

    await runQfAiAgent({
      question: "服务器内存条坏了要怎么维修？",
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    const prompt = chat.mock.calls[0][1].at(-1).content;
    expect(prompt).toContain("服务器内存故障处理");
    expect(prompt).toContain("卓豪生产监控");
    expect(prompt).toContain("密钥：已保存");
    expect(prompt).not.toContain("super-secret");
  });
});
