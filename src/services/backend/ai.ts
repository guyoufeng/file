import type { AuditLog } from '../../types/domain'

const LOCAL_AUDIT_LOGS_STORAGE_KEY = 'qf-ai-dcim.auditLogs'
const localAuditLogs: AuditLog[] = []

function readStoredAuditLogs(): AuditLog[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_STORAGE_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as AuditLog[]
  } catch {
    return []
  }
}

function writeStoredAuditLogs(logs: AuditLog[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LOCAL_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs))
}

function persistAuditLog(log: AuditLog) {
  localAuditLogs.unshift(log)
  writeStoredAuditLogs([log, ...readStoredAuditLogs().filter((item) => item.id !== log.id)])
}

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
  persistAuditLog(log)
  return log
}

export function writeAiToolAuditLog(input: {
  toolName: string
  inputSummary: string
  source: string
  durationMs?: number
  status: 'success' | 'failed'
  resultSummary: string
  requestId?: string
  errorMessage?: string
}): AuditLog {
  const log: AuditLog = {
    id: `audit-ai-tool-${Date.now()}-${localAuditLogs.length + 1}`,
    actor: 'AI助手',
    action: 'ai_tool_call',
    targetType: 'ai_tool',
    targetId: input.toolName,
    summary: input.resultSummary,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    metadata: input,
  }
  persistAuditLog(log)
  return log
}

export function getLocalAiAuditLogs(): AuditLog[] {
  const stored = readStoredAuditLogs()
  const byId = new Map([...stored, ...localAuditLogs].map((log) => [log.id, log]))
  return [...byId.values()].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export function searchAuditLogs(logs: AuditLog[], keyword: string): AuditLog[] {
  const text = keyword.trim().toLowerCase()
  if (!text) return logs

  return logs.filter((log) =>
    [
      log.actor,
      log.action,
      log.targetType,
      log.targetId,
      log.summary,
      JSON.stringify(log.metadata ?? {}),
    ]
      .join(' ')
      .toLowerCase()
      .includes(text),
  )
}
