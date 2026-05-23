import type { AiModelConfig, AuditLog } from "../../types/domain";
import { invokeCommand } from "./invoke";

const AI_MODEL_CONFIGS_STORAGE_KEY = "qf-ai-dcim.aiModelConfigs";

type BackendAiModelConfig = Omit<AiModelConfig, "enabled"> & {
  enabled: boolean | number;
};

type BackendAuditLog = AuditLog & {
  metadataJson?: string;
};

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAuditLog(log: BackendAuditLog): AuditLog {
  return {
    ...log,
    metadata:
      log.metadata ??
      parseJsonField<Record<string, unknown> | undefined>(
        log.metadataJson,
        undefined,
      ),
  };
}

function normalizeAiModelConfig(config: BackendAiModelConfig): AiModelConfig {
  return {
    ...config,
    enabled: Boolean(config.enabled),
  };
}

function readLocalAiModelConfigs(): AiModelConfig[] {
  const raw = localStorage.getItem(AI_MODEL_CONFIGS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return (JSON.parse(raw) as BackendAiModelConfig[]).map(normalizeAiModelConfig);
  } catch {
    return [];
  }
}

function writeLocalAiModelConfigs(configs: AiModelConfig[]) {
  localStorage.setItem(AI_MODEL_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
}

export async function getAiModelConfigs(): Promise<AiModelConfig[]> {
  try {
    return (
      await invokeCommand<BackendAiModelConfig[]>("get_ai_model_configs")
    ).map(normalizeAiModelConfig);
  } catch {
    return readLocalAiModelConfigs();
  }
}

export async function saveAiModelConfig(
  config: AiModelConfig,
): Promise<AiModelConfig> {
  try {
    return normalizeAiModelConfig(
      await invokeCommand<BackendAiModelConfig>("save_ai_model_config", {
        input: config,
      }),
    );
  } catch {
    const existing = readLocalAiModelConfigs().filter((item) => item.id !== config.id);
    const next = config.enabled
      ? [{ ...config, enabled: true }, ...existing.map((item) => ({ ...item, enabled: false }))]
      : [{ ...config }, ...existing];
    writeLocalAiModelConfigs(next);
    return config;
  }
}

export async function discoverAiModels(
  config: AiModelConfig,
): Promise<string[]> {
  try {
    return await invokeCommand<string[]>("discover_ai_models", {
      input: config,
    });
  } catch {
    const response = await fetch("/__ai_proxy/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKeyRef: config.apiKeyRef,
        model: config.model,
      }),
    });
    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || "模型发现失败");
    }
    const data = await response.json();
    return Array.isArray(data.data)
      ? data.data.map((item: { id: string }) => item.id)
      : Array.isArray(data.models)
        ? data.models
        : [];
  }
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  try {
    return (
      await invokeCommand<BackendAuditLog[]>("get_audit_logs", { limit })
    ).map(normalizeAuditLog);
  } catch {
    return [];
  }
}

export async function restoreSampleData(): Promise<void> {
  await invokeCommand<void>("restore_sample_data", { confirmed: true });
}
