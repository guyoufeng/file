import { describe, expect, it } from "vitest";
import { answerAiAssistantCommand } from "../../services/ai/agentCommands";
import type { AgentReadonlyTool } from "../../services/agent/apiManifest";

const tools: AgentReadonlyTool[] = [
  {
    name: "agent_search_devices",
    description: "按计算机名、IP、责任人、机柜、机房或关键字查询设备资产。",
    method: "GET",
    path: "/devices",
    url: "http://127.0.0.1:5200/api/agent/v1/devices",
    readonly: true,
    query: {
      q: "计算机名、用途、型号、SN、资产编号、机柜名等关键字，可选。",
      ip: "业务 IP、带外 IP 或 IP 列表中的地址，可选。",
    },
  },
];

describe("AI assistant commands", () => {
  it("answers /tools with readonly Agent API tool details", () => {
    const result = answerAiAssistantCommand("/tools", tools);

    expect(result?.toolName).toBe("agent_command");
    expect(result?.answer).toContain("agent_search_devices");
    expect(result?.answer).toContain("GET /api/agent/v1/devices");
    expect(result?.answer).toContain("q、ip");
  });

  it("answers /skills with platform skill names", () => {
    const result = answerAiAssistantCommand("/skills", tools);

    expect(result?.answer).toContain("资产定位");
    expect(result?.answer).toContain("告警分析");
  });

  it("ignores normal natural-language questions", () => {
    expect(answerAiAssistantCommand("查询 cnsmffluxdb1", tools)).toBeNull();
  });
});
