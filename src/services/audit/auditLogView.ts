import type { AuditLog } from "../../types/domain";
import { paginate, type PaginationResult, type PaginationState } from "../pagination";

export interface AuditLogViewFilters extends PaginationState {
  keyword: string;
  action: string;
  status: string;
}

function getMetadataText(log: AuditLog, key: string): string {
  const value = log.metadata?.[key];
  if (Array.isArray(value)) return value.join("、");
  return typeof value === "string" ? value : "";
}

function searchAuditLog(log: AuditLog, keyword: string): boolean {
  const text = keyword.trim().toLowerCase();
  if (!text) return true;

  return [
    log.actor,
    log.action,
    log.targetType,
    log.targetId,
    log.summary,
    JSON.stringify(log.metadata ?? {}),
  ]
    .join(" ")
    .toLowerCase()
    .includes(text);
}

export function buildAuditLogPage(
  logs: AuditLog[],
  filters: AuditLogViewFilters,
): PaginationResult<AuditLog> {
  const filtered = logs.filter((log) => {
    const status = getMetadataText(log, "status");
    const matchAction = filters.action === "all" || log.action === filters.action;
    const matchStatus = filters.status === "all" || status === filters.status;
    return matchAction && matchStatus && searchAuditLog(log, filters.keyword);
  });

  return paginate(filtered, {
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export function getAuditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    ai_readonly_query: "AI查询",
    ai_tool_call: "工具调用",
    "project.import_json": "项目导入",
    "project.restore_sample": "恢复示例",
  };
  return labels[action] ?? action;
}
