import { describe, expect, it, vi } from "vitest";
import {
  loadAgentReadonlyHealth,
  loadAgentReadonlyTokenSettings,
  loadAgentReadonlyTools,
  loadAgentReadonlyContext,
  saveAgentReadonlyTokenSettings,
  syncAgentReadonlySnapshot,
} from "../../services/agent/apiClient";
import type { ProjectJson } from "../../services/backend/data";

const project: ProjectJson = {
  schemaVersion: "0.1.0",
  exportedAt: "2026-05-29T00:00:00.000Z",
  data: {
    rooms: [],
    racks: [],
    devices: [],
    alerts: [],
  },
};

describe("agent api client", () => {
  it("syncs the current project snapshot to readonly agent api", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    await syncAgentReadonlySnapshot(project, fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
  });

  it("syncs snapshot with bearer token when readonly api auth is enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    await syncAgentReadonlySnapshot(project, fetcher, "qf-agent-readonly-token");

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/snapshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer qf-agent-readonly-token",
      },
      body: JSON.stringify(project),
    });
  });

  it("loads readonly agent context from topology endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        readonly: true,
        data: {
          rooms: [{ id: "room-529", name: "529数据中心" }],
          racks: [{ id: "rack-529-a1", name: "529-A1" }],
          devices: [{ id: "dev-001", computerName: "QF-SRV-001" }],
          alerts: [{ id: "alert-1", title: "硬盘告警" }],
          auditLogs: [{ id: "audit-1", summary: "查询 QF-SRV-001" }],
        },
      }),
    });

    const context = await loadAgentReadonlyContext(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/topology");
    expect(context.dataSource).toBe("只读 Agent API");
    expect(context.devices[0].computerName).toBe("QF-SRV-001");
  });

  it("loads readonly agent tool catalog", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            name: "agent_search_devices",
            method: "GET",
            path: "/devices",
            url: "http://127.0.0.1:5200/api/agent/v1/devices",
            readonly: true,
          },
        ],
      }),
    });

    const tools = await loadAgentReadonlyTools(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/tools");
    expect(tools[0].name).toBe("agent_search_devices");
  });

  it("loads readonly agent api health", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        readonly: true,
        generatedAt: "2026-05-29T06:00:00.000Z",
        endpoints: ["/api/agent/v1/topology", "/api/agent/v1/devices"],
      }),
    });

    const health = await loadAgentReadonlyHealth(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/health");
    expect(health.readonly).toBe(true);
    expect(health.endpoints).toContain("/api/agent/v1/devices");
  });

  it("saves and loads readonly agent token settings", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, tokenPreview: "qf-agent-...9f2a" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, tokenPreview: "qf-agent-...9f2a" }),
      });

    await saveAgentReadonlyTokenSettings(
      { enabled: true, token: "qf-agent-readonly-token" },
      fetcher,
    );
    const settings = await loadAgentReadonlyTokenSettings(fetcher);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/agent/v1/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, token: "qf-agent-readonly-token" }),
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/agent/v1/auth/token");
    expect(settings).toMatchObject({ enabled: true, tokenPreview: "qf-agent-...9f2a" });
  });

  it("sends bearer token when loading readonly agent tools", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await loadAgentReadonlyTools(fetcher, "qf-agent-readonly-token");

    expect(fetcher).toHaveBeenCalledWith("/api/agent/v1/tools", {
      headers: { Authorization: "Bearer qf-agent-readonly-token" },
    });
  });
});
