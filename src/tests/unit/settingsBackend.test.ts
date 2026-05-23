import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeCommand = vi.fn();

vi.mock("../../services/backend/invoke", () => ({
  invokeCommand,
}));

describe("settings backend service", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it("normalizes backend audit metadata json", async () => {
    const { getAuditLogs } = await import("../../services/backend/settings");
    invokeCommand.mockResolvedValueOnce([
      {
        id: "audit-001",
        actor: "admin",
        action: "device.upsert",
        targetType: "device",
        targetId: "dev-001",
        summary: "保存设备 DB-SRV-01",
        metadataJson: '{"rackId":"rack-529-a1","startU":21}',
        createdAt: "2026-05-23 18:30:00",
      },
    ]);

    const logs = await getAuditLogs();

    expect(logs[0]).toMatchObject({
      id: "audit-001",
      metadata: {
        rackId: "rack-529-a1",
        startU: 21,
      },
    });
  });
});
