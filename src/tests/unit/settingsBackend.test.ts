import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeCommand = vi.fn();
const fetchMock = vi.fn();

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
};

vi.mock("../../services/backend/invoke", () => ({
  invokeCommand,
}));

describe("settings backend service", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
    fetchMock.mockReset();
    storage.clear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", localStorageMock);
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

  it("normalizes ai model configs and saves updated config", async () => {
    const { getAiModelConfigs, saveAiModelConfig } = await import(
      "../../services/backend/settings"
    );
    invokeCommand
      .mockResolvedValueOnce([
        {
          id: "ai-001",
          provider: "gpustack",
          name: "GPUStack",
          baseUrl: "http://192.168.127.8/v1",
          model: "qwen3.6-35b-a3b-awq",
          apiKeyRef: "secret",
          enabled: 1,
        },
      ])
      .mockResolvedValueOnce({
        id: "ai-001",
        provider: "gpustack",
        name: "GPUStack",
        baseUrl: "http://192.168.127.8/v1",
        model: "qwen3.6-35b-a3b-awq",
        apiKeyRef: "secret",
        enabled: 1,
      });

    const configs = await getAiModelConfigs();
    const saved = await saveAiModelConfig({
      id: "ai-001",
      provider: "gpustack",
      name: "GPUStack",
      baseUrl: "http://192.168.127.8/v1",
      model: "qwen3.6-35b-a3b-awq",
      apiKeyRef: "secret",
      enabled: true,
    });

    expect(configs[0].enabled).toBe(true);
    expect(saved.enabled).toBe(true);
    expect(invokeCommand).toHaveBeenCalledWith(
      "save_ai_model_config",
      expect.objectContaining({
        input: expect.objectContaining({
          provider: "gpustack",
          model: "qwen3.6-35b-a3b-awq",
        }),
      }),
    );
  });

  it("discovers models through dev proxy when tauri invoke is unavailable", async () => {
    const { discoverAiModels } = await import("../../services/backend/settings");
    invokeCommand.mockRejectedValueOnce(new Error("invoke unavailable"));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "qwen3.6-35b-a3b-awq" }] }),
    });

    const models = await discoverAiModels({
      id: "ai-001",
      provider: "gpustack",
      name: "GPUStack",
      baseUrl: "http://192.168.127.8/v1",
      model: "",
      apiKeyRef: "secret",
      enabled: true,
    });

    expect(models).toEqual(["qwen3.6-35b-a3b-awq"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/__ai_proxy/models",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
