import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleProject } from "../../services/backend/data";
import {
  buildProjectJson,
  getProjectSummary,
  importProjectJson,
  restoreSampleProject,
  sanitizeProjectJson,
  validateProjectJson,
} from "../../services/backend/data";
import { getLocalAiAuditLogs } from "../../services/backend/ai";
import { createAccessRecord } from "../../features/access-management/accessRecords";
import { createChangeEvent, getChangeEvents } from "../../features/change-management/changeEvents";
import { createConnectionRecord, getConnectionRecords } from "../../features/connection-manager/connections";
import { addKnowledgeEntry, getKnowledgeEntries } from "../../services/ai/agentKnowledgeBase";
import { createAgentApiKey } from "../../services/agent/apiKeys";

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

describe('system data management', () => {
  it("summarizes exported project data for review before import", () => {
    const summary = getProjectSummary({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-22T00:00:00.000Z",
      data: sampleProject,
    })

    expect(summary.roomCount).toBe(5)
    expect(summary.rackCount).toBe(52)
    expect(summary.deviceCount).toBe(208)
    expect(summary.alertCount).toBe(12)
  })

  it("validates project json schema and required collections", () => {
    const result = validateProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-22T00:00:00.000Z",
      data: sampleProject,
    })

    expect(result.valid).toBe(true)
    expect(validateProjectJson({ schemaVersion: "0.0.1", data: {} }).valid).toBe(false);
  });

  it("builds project json from current local browser data", () => {
    const realDevice = {
      ...sampleProject.devices[0],
      id: "real-device",
      computerName: "REAL-SRV-001",
    };
    localStorage.setItem("qf-ai-dcim.devices", JSON.stringify([realDevice]));

    const project = buildProjectJson({
      dataCenters: sampleProject.dataCenters,
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
    });

    expect(project.data.devices).toEqual([realDevice]);
    expect(getProjectSummary(project).deviceCount).toBe(1);
    expect(project.data.microModules?.length).toBeGreaterThan(0);
  });

  it("includes non-sensitive operational collections in project export", () => {
    createAccessRecord({
      date: "2026-06-04",
      unit: "维保厂家",
      visitorName: "王工",
      enterTime: "15:00",
      reason: "检查服务器",
      isServerRepair: true,
      attachments: [],
    });
    createChangeEvent({
      title: "QF-SRV-001 增加 L20 显卡",
      type: "configuration",
      status: "completed",
      operator: "admin",
      changedAt: "2026-06-04T15:00:00.000Z",
      content: "增加 3 块 L20 显卡",
      attachments: [],
    });
    createConnectionRecord({
      sourceDeviceId: "dev-1",
      sourceDeviceName: "QF-SRV-001",
      sourcePortName: "eth0",
      targetDeviceId: "sw-1",
      targetDeviceName: "SW-529-CORE-A",
      targetPortName: "GE1/0/1",
      direction: "uplink",
      status: "active",
    });
    addKnowledgeEntry({
      title: "ECC 报警处理",
      content: "先查看BMC日志，再安排内存条复插或更换。",
      sourceType: "manual",
    });
    createAgentApiKey({ name: "外部只读Agent", scopes: ["read"] });

    const project = buildProjectJson(sampleProject);

    expect(project.data.accessRecords).toHaveLength(1);
    expect(project.data.changeEvents?.[0].title).toContain("L20");
    expect(project.data.connectionRecords?.[0].targetPortName).toBe("GE1/0/1");
    expect(project.data.knowledgeEntries?.[0].title).toBe("ECC 报警处理");
    expect(JSON.stringify(project)).not.toContain("tokenHash");
    expect(project.data.persistentCollections?.["agent.apiKeys"]).toBeUndefined();
  });

  it("removes sensitive AI fields from exported project json", () => {
    const project = sanitizeProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-22T00:00:00.000Z",
      data: {
        ...sampleProject,
        aiModelConfigs: [
          {
            id: "cfg",
            provider: "gpustack",
            name: "GPUStack",
            baseUrl: "http://localhost/v1",
            model: "qwen",
            apiKeyRef: "secret-key",
            enabled: true,
          },
        ],
      },
    });

    expect(JSON.stringify(project)).not.toContain("secret-key");
  });

  it("imports project devices into browser storage when desktop backend is unavailable", async () => {
    const importedDevice = {
      ...sampleProject.devices[0],
      id: "imported-device",
      name: "导入设备",
      computerName: "imported-host",
    };

    await importProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-25T08:00:00.000Z",
      data: {
        rooms: sampleProject.rooms,
        racks: sampleProject.racks,
        devices: [importedDevice],
        alerts: [],
      },
    });

    expect(JSON.parse(localStorage.getItem("qf-ai-dcim.devices") ?? "[]")).toEqual([
      importedDevice,
    ]);
  });

  it("imports operational collections into unified browser persistence", async () => {
    await importProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-06-04T08:00:00.000Z",
      data: {
        rooms: sampleProject.rooms,
        racks: sampleProject.racks,
        devices: [],
        alerts: [],
        changeEvents: [
          {
            id: "change-imported",
            title: "导入变更",
            type: "maintenance",
            status: "completed",
            operator: "admin",
            changedAt: "2026-06-04T08:00:00.000Z",
            content: "导入测试",
            attachments: [],
            createdAt: "2026-06-04T08:00:00.000Z",
            updatedAt: "2026-06-04T08:00:00.000Z",
          },
        ],
        connectionRecords: [
          {
            id: "conn-imported",
            sourceDeviceId: "dev-1",
            sourceDeviceName: "QF-SRV-001",
            sourcePortName: "eth0",
            targetDeviceId: "sw-1",
            targetDeviceName: "SW-529-CORE-A",
            targetPortName: "GE1/0/1",
            direction: "uplink",
            status: "active",
            createdAt: "2026-06-04T08:00:00.000Z",
            updatedAt: "2026-06-04T08:00:00.000Z",
          },
        ],
        knowledgeEntries: [
          {
            id: "knowledge-imported",
            title: "巡检建议",
            content: "检查温湿度、UPS、空调和告警。",
            sourceType: "manual",
            tags: [],
            createdAt: "2026-06-04T08:00:00.000Z",
          },
        ],
      },
    });

    expect(getChangeEvents()[0].id).toBe("change-imported");
    expect(getConnectionRecords()[0].id).toBe("conn-imported");
    expect(getKnowledgeEntries()[0].id).toBe("knowledge-imported");
  });

  it("preserves top-level micro modules as room layout data on browser import", async () => {
    const room = {
      ...sampleProject.rooms[0],
      microModules: undefined,
    };
    const microModules = [
      {
        id: "mm-imported",
        roomId: room.id,
        name: "导入华为模块",
        rows: 2,
        columns: 10,
        rackIds: [],
      },
    ];
    const racks = [
      {
        ...sampleProject.racks[0],
        roomId: room.id,
        microModuleId: "mm-imported",
      },
    ];

    await importProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-25T08:00:00.000Z",
      data: {
        rooms: [room],
        microModules,
        racks,
        devices: [],
        alerts: [],
      },
    });

    const rooms = JSON.parse(localStorage.getItem("qf-ai-dcim.rooms") ?? "[]");

    expect(rooms[0].microModules[0]).toMatchObject({
      id: "mm-imported",
      name: "导入华为模块",
      rackIds: [racks[0].id],
    });
  });

  it("writes local audit logs for project import and sample restore", async () => {
    await importProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-25T08:00:00.000Z",
      data: {
        rooms: sampleProject.rooms,
        racks: sampleProject.racks,
        devices: [sampleProject.devices[0]],
        alerts: [],
      },
    });
    await restoreSampleProject();

    const logs = getLocalAiAuditLogs();

    expect(logs.some((log) => log.action === "project.import_json")).toBe(true);
    expect(logs.some((log) => log.action === "project.restore_sample")).toBe(true);
    expect(logs[0].metadata).toMatchObject({ status: "success" });
  });
});
