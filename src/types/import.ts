export interface ImportColumnMapping {
  sourceColumn: string
  targetField: string
  required: boolean
}

export interface ImportPreviewRow {
  rowIndex: number
  values: Record<string, string>
  issues: string[]
}
