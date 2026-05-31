import type { AiToolName } from "./aiTools";

export type AiAgentEventType =
  | "agent_start"
  | "turn_start"
  | "message_start"
  | "permission_check"
  | "tool_selection"
  | "tool_execution_start"
  | "tool_execution_end"
  | "message_end"
  | "audit_write"
  | "turn_end"
  | "agent_end";

export interface AiAgentEvent {
  id: string;
  type: AiAgentEventType;
  label: string;
  detail: string;
  status: "pending" | "success" | "warning";
  createdAt: string;
}

export interface AiAgentEventInput {
  question: string;
  toolName: AiToolName;
  answer: string;
  usedModel?: string;
  fallbackReason?: string;
  dataSource?: string;
  relatedDeviceId?: string;
  relatedRackId?: string;
  relatedRoomId?: string;
}

function createEvent(
  sequence: number,
  type: AiAgentEventType,
  label: string,
  detail: string,
  status: AiAgentEvent["status"] = "success",
): AiAgentEvent {
  return {
    id: `${Date.now()}-${sequence}-${type}`,
    type,
    label,
    detail,
    status,
    createdAt: new Date().toISOString(),
  };
}

export function buildAiAgentEvents(input: AiAgentEventInput): AiAgentEvent[] {
  const relatedTargets = [
    input.relatedRoomId ? `机房 ${input.relatedRoomId}` : "",
    input.relatedRackId ? `机柜 ${input.relatedRackId}` : "",
    input.relatedDeviceId ? `设备 ${input.relatedDeviceId}` : "",
  ].filter(Boolean);

  const toolDetail = input.dataSource
    ? `${input.toolName} / ${input.dataSource}`
    : input.toolName;

  return [
    createEvent(1, "agent_start", "Agent 启动", input.usedModel ? `模型：${input.usedModel}` : "使用本地确定性工具"),
    createEvent(2, "turn_start", "新一轮推理", input.question),
    createEvent(3, "message_start", "接收问题", input.question),
    createEvent(4, "permission_check", "权限校验", "只读模式：允许查询，禁止新增、修改、删除"),
    createEvent(5, "tool_selection", "工具选择", `选择工具：${input.toolName}`),
    createEvent(6, "tool_execution_start", "工具开始", toolDetail),
    createEvent(7, "tool_execution_end", "工具完成", toolDetail),
    createEvent(8, "message_end", "模型总结", input.answer.split("\n").slice(0, 1).join("")),
    createEvent(9, "audit_write", "写入审计", "记录问题、工具、数据来源和结果摘要"),
    createEvent(10, "turn_end", "本轮完成", relatedTargets.join(" / ") || "无定位目标"),
    createEvent(
      11,
      "agent_end",
      "Agent 结束",
      input.fallbackReason ?? "完成",
      input.fallbackReason ? "warning" : "success",
    ),
  ];
}
