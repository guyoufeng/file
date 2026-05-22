import type { AiModelConfig, AuditLog } from '../../types/domain'
import { invokeCommand } from './invoke'

export async function getAiModelConfigs(): Promise<AiModelConfig[]> {
  try {
    return await invokeCommand<AiModelConfig[]>('get_ai_model_configs')
  } catch {
    return []
  }
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  try {
    return await invokeCommand<AuditLog[]>('get_audit_logs', { limit })
  } catch {
    return []
  }
}

export async function restoreSampleData(): Promise<void> {
  await invokeCommand<void>('restore_sample_data', { confirmed: true })
}
