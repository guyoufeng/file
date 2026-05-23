import type { AiModelConfig, AuditLog } from "../../types/domain";
import { invokeCommand } from "./invoke";

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

export async function getAiModelConfigs(): Promise<AiModelConfig[]> {
  try {
    return await invokeCommand<AiModelConfig[]>("get_ai_model_configs");
  } catch {
    return [];
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
