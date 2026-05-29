import { describe, expect, it } from "vitest";
import { buildAiAgentEvents } from "../../services/ai/agentEvents";

describe("ai agent events", () => {
  it("builds pi-style readonly agent event timeline", () => {
    const events = buildAiAgentEvents({
      question: "查下 QF-SRV-001",
      toolName: "search_devices",
      usedModel: "qwen3.6-35b-a3b-awq",
      answer: "设备位于 529-A1",
      relatedDeviceId: "dev-001",
      relatedRackId: "rack-529-a1",
      relatedRoomId: "room-nj-529",
    });

    expect(events.map((event) => event.type)).toEqual([
      "agent_start",
      "turn_start",
      "message_start",
      "tool_execution_start",
      "tool_execution_end",
      "message_end",
      "turn_end",
      "agent_end",
    ]);
    expect(events.find((event) => event.type === "tool_execution_end")).toMatchObject({
      label: "工具完成",
      detail: "search_devices",
      status: "success",
    });
  });

  it("marks fallback answers when model call fails or is unavailable", () => {
    const events = buildAiAgentEvents({
      question: "查下 QF-SRV-001",
      toolName: "search_devices",
      fallbackReason: "模型调用失败",
      answer: "设备位于 529-A1",
      dataSource: "只读 Agent API",
    });

    expect(events.find((event) => event.type === "agent_end")).toMatchObject({
      status: "warning",
      detail: "模型调用失败",
    });
    expect(events.find((event) => event.type === "tool_execution_start")).toMatchObject({
      detail: "search_devices / 只读 Agent API",
    });
  });
});
