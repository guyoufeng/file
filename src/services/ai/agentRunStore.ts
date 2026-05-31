import type { AiNavigationTarget } from "../../types/aiNavigation";
import type { AiToolName } from "./aiTools";
import type { AiAgentEvent } from "./agentEvents";

const STORAGE_KEY = "qf-ai-dcim.agent.runRecords";
const MAX_RECORDS = 500;

export interface TimedAiAgentEvent extends AiAgentEvent {
  elapsedMs: number;
  durationLabel: string;
}

export interface AgentRunRecordInput {
  sessionId: string;
  question: string;
  answer: string;
  toolName: AiToolName;
  dataSource: string;
  usedModel?: string;
  fallbackReason?: string;
  startedAt: string;
  endedAt: string;
  events: AiAgentEvent[];
  target?: AiNavigationTarget;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

export interface AgentRunRecord extends Omit<AgentRunRecordInput, "events"> {
  id: string;
  status: "success" | "warning";
  durationMs: number;
  events: TimedAiAgentEvent[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): StorageLike | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readRecords(): AgentRunRecord[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AgentRunRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: AgentRunRecord[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function formatAgentElapsed(ms: number) {
  return `${Math.max(0, Math.floor(ms / 1000))}秒`;
}

export function timeAgentEvents(
  events: AiAgentEvent[],
  startedAt: string,
  endedAt: string,
): TimedAiAgentEvent[] {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const durationMs = Math.max(0, end - start);
  const divisor = Math.max(1, events.length - 1);

  return events.map((event, index) => {
    const elapsedMs =
      typeof event.elapsedMs === "number"
        ? event.elapsedMs
        : Math.round((durationMs * index) / divisor);
    return {
      ...event,
      elapsedMs,
      durationLabel: event.durationLabel ?? formatAgentElapsed(elapsedMs),
    };
  });
}

export function buildLiveAgentTimeline(
  question: string,
  startedAt: string,
  now = Date.now(),
): TimedAiAgentEvent[] {
  const start = new Date(startedAt).getTime();
  const elapsedMs = Math.max(0, now - start);
  const activeIndex = Math.min(7, Math.floor(elapsedMs / 1000));
  const rows: Array<Pick<AiAgentEvent, "type" | "label" | "detail">> = [
    { type: "agent_start", label: "Agent 启动", detail: "创建本轮执行上下文" },
    { type: "turn_start", label: "新一轮推理", detail: question },
    { type: "message_start", label: "接收问题", detail: "读取用户问题、附件元数据和当前会话记忆" },
    { type: "permission_check", label: "权限校验", detail: "只读模式：允许查询和总结，禁止修改平台数据" },
    { type: "tool_selection", label: "工具选择", detail: "判断使用平台只读工具或当前大模型" },
    { type: "tool_execution_start", label: "执行中", detail: "调用平台工具、知识库、记忆或模型服务" },
    { type: "message_end", label: "组织回复", detail: "整理可展示回答和定位信息" },
    { type: "audit_write", label: "写入审计", detail: "准备保存执行轨迹和会话记录" },
  ];

  return rows.map((row, index) => {
    const rowElapsed = Math.min(elapsedMs, index * 1000);
    return {
      id: `live-${index}-${row.type}`,
      ...row,
      status: index < activeIndex ? "success" : index === activeIndex ? "pending" : "pending",
      createdAt: new Date(start + rowElapsed).toISOString(),
      elapsedMs: rowElapsed,
      durationLabel: formatAgentElapsed(rowElapsed),
    };
  });
}

export function saveAgentRunRecord(input: AgentRunRecordInput): AgentRunRecord {
  const durationMs = Math.max(
    0,
    new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime(),
  );
  const record: AgentRunRecord = {
    ...input,
    id: createId("agent-run"),
    status: input.fallbackReason ? "warning" : "success",
    durationMs,
    events: timeAgentEvents(input.events, input.startedAt, input.endedAt),
  };
  writeRecords([record, ...readRecords()]);
  return record;
}

export function getAgentRunRecords() {
  return readRecords();
}

export function searchAgentRunRecords(keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return readRecords();
  return readRecords().filter((record) =>
    [
      record.question,
      record.answer,
      record.toolName,
      record.dataSource,
      record.usedModel,
      record.fallbackReason,
      record.status,
    ]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(normalized)),
  );
}

export function clearAgentRunRecords() {
  storage()?.removeItem(STORAGE_KEY);
}
