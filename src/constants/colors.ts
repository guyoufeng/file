export const categoryColors = {
  server: '#3B82F6',
  network: '#10B981',
  security: '#EF4444',
  storage: '#F59E0B',
  facility: '#8B5CF6',
  patching: '#EAB308',
  other: '#6B7280',
} as const

export const statusColors = {
  normal: '#10B981',
  alert: '#EF4444',
  offline: '#6B7280',
  maintenance: '#F59E0B',
  disabled: '#475569',
  standby: '#38BDF8',
  pending_install: '#8B5CF6',
  pending_remove: '#F97316',
  retired: '#334155',
} as const
