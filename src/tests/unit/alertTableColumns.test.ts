import { describe, expect, it } from 'vitest'
import { alertTableColumns, getAlertTableColumnIds } from '../../features/alert-center/alertTableColumns'

describe('alert table columns', () => {
  it('keeps selection, title and actions locked while preserving the expected default order', () => {
    expect(getAlertTableColumnIds()).toEqual([
      'select',
      'level',
      'title',
      'device',
      'location',
      'source',
      'status',
      'startedAt',
      'actions',
    ])

    expect(alertTableColumns.filter((column) => column.locked).map((column) => column.id)).toEqual([
      'select',
      'title',
      'actions',
    ])
  })
})
