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
