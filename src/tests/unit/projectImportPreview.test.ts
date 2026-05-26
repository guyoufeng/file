import { describe, expect, it } from "vitest";
import { sampleProject, type ProjectJson } from "../../services/backend/data";
import { buildProjectImportPreview } from "../../services/project/projectImportPreview";

describe("project import preview", () => {
  it("summarizes imported project data and replacement risk", () => {
    const project: ProjectJson = {
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-25T08:00:00.000Z",
      data: {
        dataCenters: sampleProject.dataCenters,
        rooms: sampleProject.rooms,
        microModules: sampleProject.rooms[0].microModules,
        racks: sampleProject.racks,
        devices: sampleProject.devices.slice(0, 12),
        alerts: sampleProject.alerts.slice(0, 3),
        aiModelConfigs: [
          {
            id: "ai-001",
            provider: "gpustack",
            name: "GPUStack",
            baseUrl: "http://192.168.127.8/v1",
            model: "qwen3.6-35b-a3b-awq",
            enabled: true,
          },
        ],
        devices: sampleProject.devices.slice(0, 12).map((device, index) =>
          index === 0
            ? {
                ...device,
                metadata: {
                  note: "Bearer abcdef",
                },
              }
            : device,
        ),
      },
    };

    const preview = buildProjectImportPreview(project, {
      roomCount: 5,
      rackCount: 52,
      deviceCount: 156,
      alertCount: 12,
    });

    expect(preview.stats).toMatchObject({
      dataCenterCount: 3,
      roomCount: 5,
      microModuleCount: 2,
      rackCount: 52,
      deviceCount: 12,
      alertCount: 3,
      aiModelConfigCount: 1,
    });
    expect(preview.exportedAtText).toContain("2026");
    expect(preview.riskItems).toContain("导入后会覆盖当前拓扑、资产和告警数据");
    expect(preview.riskItems).toContain("导出文件不应包含 API Key 或 Token");
    expect(preview.summaryText).toContain("5 个机房");
    expect(preview.summaryText).toContain("52 个机柜");
    expect(preview.summaryText).toContain("12 台设备");
    expect(preview.security.safe).toBe(false);
    expect(preview.securitySummary).toContain("疑似敏感信息");
  });

  it("detects project files without micro module layout", () => {
    const preview = buildProjectImportPreview(
      {
        schemaVersion: "0.1.0",
        exportedAt: "2026-05-25T08:00:00.000Z",
        data: {
          rooms: [{ ...sampleProject.rooms[0], microModules: undefined }],
          racks: sampleProject.racks.slice(0, 1).map((rack) => ({
            ...rack,
            microModuleId: undefined,
          })),
          devices: [],
          alerts: [],
        },
      },
      { roomCount: 1, rackCount: 1, deviceCount: 1, alertCount: 0 },
    );

    expect(preview.stats.microModuleCount).toBe(0);
    expect(preview.riskItems).toContain("导入文件未包含微模块布局，529 这类模块化机房可能按普通机柜布局显示");
  });
});
