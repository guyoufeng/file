import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getLocalAiAuditLogs,
  searchAuditLogs,
  writeAiAuditLog,
  writeAiToolAuditLog,
} from "../../services/backend/ai";

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

describe("ai audit log", () => {
  it("persists AI audit logs for later review", () => {
    writeAiAuditLog({
      question: "查下 10.10.0.21",
      tools: ["locate_device"],
      answerSummary: "QF-SRV-001 / 529-A1",
      relatedDeviceId: "dev-001",
      relatedRackId: "rack-529-a1",
      relatedRoomId: "room-nj-529",
      status: "success",
    });

    expect(getLocalAiAuditLogs()[0]).toMatchObject({
      action: "ai_readonly_query",
      summary: "QF-SRV-001 / 529-A1",
      targetId: "dev-001",
    });
  });

  it("searches audit logs by question, summary, tool, and related object", () => {
    const log = writeAiAuditLog({
      question: "查下 10.10.0.21",
      tools: ["locate_device"],
      answerSummary: "QF-SRV-001 / 529-A1",
      relatedDeviceId: "dev-001",
      relatedRackId: "rack-529-a1",
      relatedRoomId: "room-nj-529",
      status: "success",
    });

    expect(searchAuditLogs([log], "529-A1")).toHaveLength(1);
    expect(searchAuditLogs([log], "locate_device")).toHaveLength(1);
    expect(searchAuditLogs([log], "no-match")).toHaveLength(0);
  });

  it("records external AI tool calls with input source duration and result summary", () => {
    const log = writeAiToolAuditLog({
      toolName: "weather.lookup",
      inputSummary: "南京天气",
      source: "external_weather_api",
      durationMs: 328,
      status: "success",
      resultSummary: "晴，22 到 29 摄氏度",
      requestId: "tool-call-001",
    });

    expect(log).toMatchObject({
      action: "ai_tool_call",
      targetType: "ai_tool",
      targetId: "weather.lookup",
      summary: "晴，22 到 29 摄氏度",
    });
    expect(log.metadata).toMatchObject({
      inputSummary: "南京天气",
      source: "external_weather_api",
      durationMs: 328,
      requestId: "tool-call-001",
    });
    expect(searchAuditLogs([log], "external_weather_api")).toHaveLength(1);
  });
});
