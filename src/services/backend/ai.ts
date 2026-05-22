import type { AuditLog } from '../../types/domain'

const localAuditLogs: AuditLog[] = []

export function writeAiAuditLog(input: {
  question: string
  tools: string[]
  answerSummary: string
  relatedDeviceId?: string
  relatedRoomId?: string
  relatedRackId?: string
  status: 'success' | 'failed'
}): AuditLog {
  const log: AuditLog = {
    id: `audit-ai-${Date.now()}-${localAuditLogs.length + 1}`,
    actor: 'AI助手',
    action: 'ai_readonly_query',
    targetType: 'ai_query',
    targetId: input.relatedDeviceId ?? input.relatedRackId ?? input.relatedRoomId,
    summary: input.answerSummary,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    metadata: input,
  }
  localAuditLogs.unshift(log)
  return log
}

export function getLocalAiAuditLogs(): AuditLog[] {
  return localAuditLogs
}
