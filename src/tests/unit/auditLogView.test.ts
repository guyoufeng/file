import { describe, expect, it } from "vitest";
import type { AuditLog } from "../../types/domain";
import {
  buildAuditLogPage,
  getAuditActionLabel,
} from "../../services/audit/auditLogView";

function makeLog(index: number, overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: `audit-${index}`,
    actor: "admin",
    action: "project.import_json",
    targetType: "project",
    summary: `导入项目 JSON ${index}`,
    createdAt: `2026-05-26 13:${String(index).padStart(2, "0")}:00`,
    metadata: { status: "success" },
    ...overrides,
  };
}

describe("audit log view", () => {
  it("paginates audit logs with default page size 20", () => {
    const result = buildAuditLogPage(
      Array.from({ length: 45 }, (_, index) => makeLog(index + 1)),
      { keyword: "", action: "all", status: "all", page: 2, pageSize: 20 },
    );

    expect(result.total).toBe(45);
    expect(result.pageCount).toBe(3);
    expect(result.items[0].id).toBe("audit-21");
    expect(result.items).toHaveLength(20);
  });

  it("filters audit logs by action status and keyword", () => {
    const result = buildAuditLogPage(
      [
        makeLog(1, { action: "project.import_json" }),
        makeLog(2, {
          action: "ai_readonly_query",
          summary: "查询 cnsmffluxdb1",
          metadata: { status: "success", question: "查看下 cnsmffluxdb1" },
        }),
        makeLog(3, {
          action: "ai_readonly_query",
          summary: "查询失败",
          metadata: { status: "failed", question: "查看下 db" },
        }),
      ],
      {
        keyword: "cnsmffluxdb1",
        action: "ai_readonly_query",
        status: "success",
        page: 1,
        pageSize: 20,
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("audit-2");
  });

  it("uses readable labels for project operations", () => {
    expect(getAuditActionLabel("project.import_json")).toBe("项目导入");
    expect(getAuditActionLabel("project.restore_sample")).toBe("恢复示例");
  });
});
