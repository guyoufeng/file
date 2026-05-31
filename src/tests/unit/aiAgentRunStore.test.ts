import { beforeEach, describe, expect, it } from "vitest";
import { buildAiAgentEvents } from "../../services/ai/agentEvents";
import {
  clearAgentRunRecords,
  formatAgentElapsed,
  getAgentRunRecords,
  saveAgentRunRecord,
  searchAgentRunRecords,
} from "../../services/ai/agentRunStore";

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

describe("AI agent run store", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("persists a timed agent run with all execution events", () => {
    const events = buildAiAgentEvents({
      question: "查下 QF-SRV-001",
      toolName: "search_devices",
      answer: "设备位于 529-A1",
      usedModel: "qwen3.6-35b-a3b-awq",
      dataSource: "只读 Agent API",
    });

    const record = saveAgentRunRecord({
      sessionId: "session-1",
      question: "查下 QF-SRV-001",
      answer: "设备位于 529-A1",
      toolName: "search_devices",
      dataSource: "只读 Agent API",
      usedModel: "qwen3.6-35b-a3b-awq",
      startedAt: new Date("2026-05-31T10:00:00.000Z").toISOString(),
      endedAt: new Date("2026-05-31T10:00:03.200Z").toISOString(),
      events,
    });

    expect(record.durationMs).toBe(3200);
    expect(record.events).toHaveLength(events.length);
    expect(record.events[0].elapsedMs).toBe(0);
    expect(record.events.at(-1)?.elapsedMs).toBe(3200);
    expect(getAgentRunRecords()).toHaveLength(1);
  });

  it("searches run records by question, answer, tool, model and failure reason", () => {
    saveAgentRunRecord({
      sessionId: "session-1",
      question: "服务器内存条坏了怎么维修？",
      answer: "建议先确认 DIMM 槽位。",
      toolName: "general_chat",
      dataSource: "当前模型",
      usedModel: "qwen3.6-35b-a3b-awq",
      fallbackReason: "网络抖动后重试成功",
      startedAt: "2026-05-31T10:00:00.000Z",
      endedAt: "2026-05-31T10:00:01.000Z",
      events: [],
    });

    expect(searchAgentRunRecords("DIMM")).toHaveLength(1);
    expect(searchAgentRunRecords("general_chat")).toHaveLength(1);
    expect(searchAgentRunRecords("qwen3.6")).toHaveLength(1);
    expect(searchAgentRunRecords("网络抖动")).toHaveLength(1);
  });

  it("formats elapsed seconds for the execution timeline", () => {
    expect(formatAgentElapsed(0)).toBe("0秒");
    expect(formatAgentElapsed(999)).toBe("0秒");
    expect(formatAgentElapsed(1000)).toBe("1秒");
    expect(formatAgentElapsed(3200)).toBe("3秒");
    expect(formatAgentElapsed(61_000)).toBe("61秒");

    saveAgentRunRecord({
      sessionId: "session-1",
      question: "测试",
      answer: "测试",
      toolName: "general_chat",
      dataSource: "当前模型",
      startedAt: "2026-05-31T10:00:00.000Z",
      endedAt: "2026-05-31T10:00:01.000Z",
      events: [],
    });
    clearAgentRunRecords();
    expect(getAgentRunRecords()).toEqual([]);
  });
});
