import type { AiToolName } from "./aiTools";
import {
  formatAgentElapsed,
  type AgentRunRecord,
} from "./agentRunStore";

export type AgentTraceStatusFilter = "all" | AgentRunRecord["status"];

export interface AgentTraceFilters {
  keyword?: string;
  status?: AgentTraceStatusFilter;
  toolName?: AiToolName | "all";
}

export interface AgentRunSummary {
  durationLabel: string;
  eventCount: number;
  attachmentCount: number;
  hasNavigationTarget: boolean;
  riskLabel: "正常" | "需关注";
}

function includesKeyword(record: AgentRunRecord, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [
    record.question,
    record.answer,
    record.toolName,
    record.dataSource,
    record.usedModel,
    record.fallbackReason,
    record.status,
    record.target?.roomId,
    record.target?.rackId,
    record.target?.deviceId,
    ...(record.attachments?.map((item) => item.name) ?? []),
    ...record.events.flatMap((event) => [event.label, event.detail, event.type]),
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalized));
}

export function filterAgentTraceRecords(
  records: AgentRunRecord[],
  filters: AgentTraceFilters,
): AgentRunRecord[] {
  const status = filters.status ?? "all";
  const toolName = filters.toolName ?? "all";
  return records.filter((record) => {
    if (status !== "all" && record.status !== status) return false;
    if (toolName !== "all" && record.toolName !== toolName) return false;
    return includesKeyword(record, filters.keyword ?? "");
  });
}

export function buildAgentRunSummary(record: AgentRunRecord): AgentRunSummary {
  return {
    durationLabel: formatAgentElapsed(record.durationMs),
    eventCount: record.events.length,
    attachmentCount: record.attachments?.length ?? 0,
    hasNavigationTarget: Boolean(
      record.target?.roomId || record.target?.rackId || record.target?.deviceId,
    ),
    riskLabel: record.status === "warning" ? "需关注" : "正常",
  };
}
