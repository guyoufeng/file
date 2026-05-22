import { describe, expect, it } from 'vitest'
import { validateImportRows } from '../../services/import/importValidator'
import { sampleProject } from '../../services/backend/data'

describe('import validator', () => {
  it('reports missing rack and hostname errors', () => {
    const result = validateImportRows(
      [
        {
          rowIndex: 2,
          computerName: '',
          rackName: '不存在机柜',
          side: 'front',
          startU: 1,
          heightU: 2,
          categoryId: 'server',
          subtype: '物理服务器',
        },
      ],
      sampleProject.racks,
      sampleProject.devices,
    )

    expect(result.errorRows).toBe(1)
    expect(result.rows[0].errors).toContain('计算机名不能为空')
    expect(result.rows[0].errors).toContain('机柜不存在')
  })

  it('reports duplicate asset number, duplicate SN, and U conflict', () => {
    const existing = sampleProject.devices[0]
    const rack = sampleProject.racks.find((item) => item.id === existing.rackId)!
    const result = validateImportRows(
      [
        {
          rowIndex: 3,
          computerName: 'QF-IMPORT-001',
          rackName: rack.name,
          side: existing.side,
          startU: existing.startU,
          heightU: 1,
          categoryId: 'server',
          subtype: '物理服务器',
          assetNo: existing.assetNo,
          serialNumber: existing.serialNumber,
        },
      ],
      sampleProject.racks,
      sampleProject.devices,
    )

    expect(result.errorRows).toBe(1)
    expect(result.rows[0].errors).toContain('固定资产编号重复')
    expect(result.rows[0].errors).toContain('SN号重复')
    expect(result.rows[0].errors).toContain('同一机柜同一安装面 U 位冲突')
  })
})
