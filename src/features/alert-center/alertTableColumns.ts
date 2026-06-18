import type { DataTableColumn } from '../../services/table/tableColumnPreferences'

export const alertTableColumns: DataTableColumn[] = [
  { id: 'select', label: '选择', locked: true },
  { id: 'level', label: '级别' },
  { id: 'title', label: '标题', locked: true },
  { id: 'device', label: '设备' },
  { id: 'location', label: '位置' },
  { id: 'description', label: '描述' },
  { id: 'source', label: '来源' },
  { id: 'status', label: '状态' },
  { id: 'startedAt', label: '开始时间' },
  { id: 'actions', label: '操作', locked: true },
]

export function getAlertTableColumnIds(): string[] {
  return alertTableColumns.map((column) => column.id)
}
