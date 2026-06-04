import { describe, expect, it } from "vitest";
import {
  buildAgentRunSummary,
  filterAgentTraceRecords,
} from "../../services/ai/agentTraceView";
import type { AgentRunRecord } from "../../services/ai/agentRunStore";

const baseRecord: AgentRunRecord = {
  id: "agent-run-1",
  sessionId: "session-1",
  question: "查下 QF-SRV-001 在哪里",
  answer: "位于 529-A1 / 39U-41U。",
  toolName: "search_devices",
  dataSource: "只读 Agent API",
  usedModel: "qwen3.6-35b-a3b-awq",
  startedAt: "2026-06-04T09:00:00.000Z",
  endedAt: "2026-06-04T09:00:03.200Z",
  status: "success",
  durationMs: 3200,
  events: [
    {
      id: "event-1",
      type: "agent_start",
      label: "Agent 启动",
      detail: "创建上下文",
      status: "success",
      createdAt: "2026-06-04T09:00:00.000Z",
      elapsedMs: 0,
      durationLabel: "0秒",
    },
    {
      id: "event-2",
      type: "tool_execution_end",
      label: "工具完成",
      detail: "查询资产库",
      status: "success",
      createdAt: "2026-06-04T09:00:03.200Z",
      elapsedMs: 3200,
      durationLabel: "3秒",
    },
  ],
  target: {
    roomId: "room-nj-529",
    rackId: "rack-529-a1",
    deviceId: "dev-qf-srv-001",
  },
  attachments: [{ name: "zstack.log", type: "text/plain", size: 1024 }],
};

const warningRecord: AgentRunRecord = {
  ...baseRecord,
  id: "agent-run-2",
  question: "分析日志附件",
  answer: "模型不可用，使用附件证据链分析。",
  toolName: "general_chat",
  dataSource: "附件全文分析",
  status: "warning",
  fallbackReason: "Model not found",
  attachments: [],
  target: undefined,
};

describe("agent trace view helpers", () => {
  it("filters agent run records by keyword, status and tool", () => {
    expect(filterAgentTraceRecords([baseRecord, warningRecord], { keyword: "QF-SRV-001" })).toEqual([
      baseRecord,
    ]);
    expect(filterAgentTraceRecords([baseRecord, warningRecord], { status: "warning" })).toEqual([
      warningRecord,
    ]);
    expect(filterAgentTraceRecords([baseRecord, warningRecord], { toolName: "search_devices" })).toEqual([
      baseRecord,
    ]);
  });

  it("builds an execution summary for detail presentation", () => {
    const summary = buildAgentRunSummary(baseRecord);

    expect(summary.durationLabel).toBe("3秒");
    expect(summary.eventCount).toBe(2);
    expect(summary.attachmentCount).toBe(1);
    expect(summary.hasNavigationTarget).toBe(true);
    expect(summary.riskLabel).toBe("正常");
  });
});
