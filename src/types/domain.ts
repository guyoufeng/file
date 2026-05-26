export type LayoutType = 'micro_module' | 'simple_rows' | 'single_rack'
export type RackType =
  | 'server'
  | 'network'
  | 'storage'
  | 'patching'
  | 'row_head'
  | 'cooling'
  | 'ups_pdu'
  | 'empty'
  | 'other'
export type DeviceStatus =
  | 'normal'
  | 'alert'
  | 'offline'
  | 'maintenance'
  | 'disabled'
  | 'standby'
  | 'pending_install'
  | 'pending_remove'
  | 'retired'
export type DeviceSide = 'front' | 'rear'
export type AlertLevel = 'info' | 'warning' | 'critical'
export type AlertStatus = 'unconfirmed' | 'read' | 'acknowledged' | 'recovered' | 'closed'
export type DeviceMajorCategory = 'server' | 'network' | 'security' | 'storage' | 'facility' | 'patching' | 'other'

export interface DataCenter {
  id: string
  name: string
  location: string
  rooms: Room[]
}

export interface Room {
  id: string
  dataCenterId: string
  name: string
  layoutType: LayoutType
  defaultRackHeightU: number
  racks: Rack[]
  microModules?: MicroModule[]
}

export interface MicroModule {
  id: string
  roomId: string
  name: string
  rows: number
  columns: number
  rackIds: string[]
}

export interface Rack {
  id: string
  roomId: string
  microModuleId?: string
  name: string
  type: RackType
  rowName?: string
  columnIndex?: number
  heightU: number
  status: DeviceStatus
  powerCapacityW?: number
  notes?: string
}

export interface DeviceCategory {
  id: string
  name: string
  major: DeviceMajorCategory
  subtypes: string[]
}

export interface Device {
  id: string
  rackId: string
  categoryId: string
  subtype?: string
  name: string
  computerName?: string
  businessIp?: string
  managementIp?: string
  ips: string[]
  purpose?: string
  owner?: string
  vendor?: string
  model?: string
  serialNumber?: string
  assetNo?: string
  warrantyExpireAt?: string
  hardwareSpec?: string
  operatingSystem?: string
  side: DeviceSide
  startU: number
  endU: number
  heightU: number
  status: DeviceStatus
  ports: Port[]
  metadata?: Record<string, unknown>
}

export interface Port {
  id: string
  deviceId: string
  name: string
  type: string
  speed?: string
  status: 'available' | 'used' | 'disabled'
}

export interface Connection {
  id: string
  sourceDeviceId: string
  sourcePortId: string
  targetDeviceId: string
  targetPortId: string
  cableNo?: string
  cableType?: string
  status: 'active' | 'planned' | 'disabled'
}

export interface Alert {
  id: string
  deviceId: string
  source: 'manual' | 'prometheus' | 'zoho' | 'custom'
  level: AlertLevel
  status: AlertStatus
  title: string
  description?: string
  startedAt: string
  recoveredAt?: string
}

export interface AiModelConfig {
  id: string
  provider: 'gpustack' | 'openai_compatible' | 'deepseek' | 'gemini' | 'ollama' | 'vllm'
  name: string
  baseUrl: string
  model: string
  apiKeyRef?: string
  enabled: boolean
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  targetType: string
  targetId?: string
  summary: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface ImportBatch {
  id: string
  sourceFileName: string
  status: 'pending' | 'completed' | 'failed'
  totalRows: number
  successRows: number
  failedRows: number
  createdAt: string
}

export interface ImportRowIssue {
  id: string
  batchId: string
  rowIndex: number
  field?: string
  message: string
}

export interface DeviceTemplate {
  id: string
  name: string
  categoryId: string
  vendor?: string
  model?: string
  heightU: number
  ports: Omit<Port, 'id' | 'deviceId'>[]
}

export interface ChangeRecord {
  id: string
  deviceId: string
  title: string
  content: string
  operator: string
  changedAt: string
  source: 'manual' | 'ai' | 'import' | 'api'
  relatedTicketId?: string
}
