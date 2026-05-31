import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { AiModelConfig } from "../../types/domain";

const getAiModelConfigs = vi.fn();
const saveAiModelConfig = vi.fn();
const discoverAiModels = vi.fn();

vi.mock("../../services/backend/settings", () => ({
  getAiModelConfigs,
  saveAiModelConfig,
  discoverAiModels,
}));

const config: AiModelConfig = {
  id: "ai-001",
  provider: "gpustack",
  name: "GPUStack",
  baseUrl: "http://192.168.127.8/v1",
  model: "",
  apiKeyRef: "secret",
  enabled: true,
};

describe("ai store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getAiModelConfigs.mockReset();
    saveAiModelConfig.mockReset();
    discoverAiModels.mockReset();
  });

  it("discovers models and returns list", async () => {
    const { useAiStore } = await import("../../stores/aiStore");
    const store = useAiStore();
    discoverAiModels.mockResolvedValueOnce(["qwen3.6-35b-a3b-awq"]);

    const models = await store.discoverModels(config);

    expect(models).toEqual(["qwen3.6-35b-a3b-awq"]);
    expect(discoverAiModels).toHaveBeenCalledWith(config);
  });

  it("uses the company GPUStack model as default when no config exists", async () => {
    const { useAiStore } = await import("../../stores/aiStore");
    const store = useAiStore();
    getAiModelConfigs.mockResolvedValueOnce([]);

    await store.loadConfigs();

    expect(store.configs).toHaveLength(1);
    expect(store.configs[0]).toMatchObject({
      provider: "gpustack",
      baseUrl: "http://192.168.127.8/v1",
      model: "qwen3.6-35b-a3b-awq",
      enabled: true,
    });
  });

  it("saves config and keeps only one enabled model", async () => {
    const { useAiStore } = await import("../../stores/aiStore");
    const store = useAiStore();
    store.configs = [
      config,
      { ...config, id: "ai-002", name: "Backup", model: "backup-model", enabled: false },
    ];
    saveAiModelConfig.mockResolvedValueOnce({
      ...config,
      id: "ai-003",
      model: "qwen3.6-35b-a3b-awq",
      name: "Qwen 35B",
      enabled: true,
    });

    const saved = await store.saveConfig({
      ...config,
      id: "ai-003",
      model: "qwen3.6-35b-a3b-awq",
      name: "Qwen 35B",
      enabled: true,
    });

    expect(saved.model).toBe("qwen3.6-35b-a3b-awq");
    expect(store.configs[0].id).toBe("ai-003");
    expect(store.configs.filter((item) => item.enabled)).toHaveLength(1);
  });
});
