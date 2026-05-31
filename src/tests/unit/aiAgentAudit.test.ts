import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getLocalAiAuditLogs,
} from "../../services/backend/ai";
import { recordAiAgentToolCall } from "../../services/ai/agentAudit";

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

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("AI agent audit helper", () => {
  it("records readonly agent tool calls as searchable audit logs", () => {
    const log = recordAiAgentToolCall({
      toolName: "locate_device",
      question: "IP 为 10.10.0.21 的服务器在哪里？",
      source: "只读 Agent API",
      answer: "设备：QF-SRV-001\n位置：529-A1",
      startedAt: Date.now() - 25,
      status: "success",
      plan: {
        planner: "model",
        reason: "用户提供 IP，需要定位设备。",
      },
      eventCount: 11,
    });

    expect(log).toMatchObject({
      action: "ai_tool_call",
      targetId: "locate_device",
      summary: "设备：QF-SRV-001",
    });
    expect(log.metadata).toMatchObject({
      inputSummary: "IP 为 10.10.0.21 的服务器在哪里？",
      source: "只读 Agent API",
      status: "success",
      plan: {
        planner: "model",
        reason: "用户提供 IP，需要定位设备。",
      },
      eventCount: 11,
    });
    expect(getLocalAiAuditLogs()[0].targetId).toBe("locate_device");
  });
});
