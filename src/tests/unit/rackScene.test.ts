import { describe, expect, it } from 'vitest'
import type { Alert, Device, Rack, Room } from '../../types/domain'
import { getRackVisualState, rackTypeColor } from '../../services/three/rackMaterials'
import { buildRackSceneModel } from '../../services/three/rackScene'

const room: Room = {
  id: 'room-529',
  dataCenterId: 'dc-nanjing',
  name: '529数据中心',
  layoutType: 'micro_module',
  defaultRackHeightU: 48,
  racks: [],
  microModules: [
    { id: 'module-1', roomId: 'room-529', name: '华为微模块1', rows: 2, columns: 10, rackIds: [] },
    { id: 'module-2', roomId: 'room-529', name: '华为微模块2', rows: 2, columns: 10, rackIds: [] },
  ],
}

const racks: Rack[] = [
  { id: 'rack-a01', roomId: 'room-529', microModuleId: 'module-1', name: 'A01', type: 'server', rowName: 'A排', columnIndex: 1, heightU: 48, status: 'normal' },
  { id: 'rack-a02', roomId: 'room-529', microModuleId: 'module-1', name: 'A02', type: 'cooling', rowName: 'A排', columnIndex: 2, heightU: 48, status: 'normal' },
  { id: 'rack-b01', roomId: 'room-529', microModuleId: 'module-1', name: 'B01', type: 'network', rowName: 'B排', columnIndex: 1, heightU: 48, status: 'normal' },
  { id: 'rack-c01', roomId: 'room-529', microModuleId: 'module-2', name: 'C01', type: 'empty', rowName: 'C排', columnIndex: 1, heightU: 48, status: 'normal' },
  { id: 'rack-d01', roomId: 'room-529', microModuleId: 'module-2', name: '529-D1', type: 'server', rowName: 'D排', columnIndex: 1, heightU: 48, status: 'normal' },
  { id: 'rack-d10', roomId: 'room-529', microModuleId: 'module-2', name: '529-D10', type: 'cooling', rowName: 'D排', columnIndex: 10, heightU: 48, status: 'normal' },
]

const devices: Device[] = [
  {
    id: 'device-critical',
    rackId: 'rack-a01',
    categoryId: 'server',
    name: '数据库服务器-01',
    computerName: 'db-01',
    businessIp: '10.10.1.11',
    ips: ['10.10.1.11'],
    side: 'front',
    startU: 20,
    endU: 23,
    heightU: 4,
    status: 'normal',
    ports: [],
  },
]

const alerts: Alert[] = [
  {
    id: 'alert-critical',
    deviceId: 'device-critical',
    source: 'manual',
    level: 'critical',
    status: 'unconfirmed',
    title: '硬盘故障',
    startedAt: '2026-05-22T10:00:00.000Z',
  },
]

describe('rack 3d scene model', () => {
  it('places micro module racks into separated rows and modules', () => {
    const model = buildRackSceneModel(room, racks, devices, alerts)

    expect(model.items).toHaveLength(6)
    expect(model.modules).toHaveLength(2)
    expect(model.items.find((item) => item.rackId === 'rack-a01')?.position.z).not.toBe(
      model.items.find((item) => item.rackId === 'rack-b01')?.position.z,
    )
    expect(model.items.find((item) => item.rackId === 'rack-a01')?.position.x).toBe(
      model.items.find((item) => item.rackId === 'rack-c01')?.position.x,
    )
    expect(model.items.find((item) => item.rackId === 'rack-b01')?.position.z).toBeLessThan(
      model.items.find((item) => item.rackId === 'rack-c01')?.position.z ?? 0,
    )
    expect(model.items.find((item) => item.rackId === 'rack-c01')?.position.z).not.toBe(
      model.items.find((item) => item.rackId === 'rack-d01')?.position.z,
    )
    expect(model.items.find((item) => item.rackId === 'rack-d10')?.displayName).toBe('529-A1')
    expect(model.items.find((item) => item.rackId === 'rack-d01')?.displayName).toBe('529-A10')
  })

  it('marks critical alert racks and special rack types with distinct colors', () => {
    const state = getRackVisualState(racks[0], devices, alerts)

    expect(state.alertLevel).toBe('critical')
    expect(state.emissive).toBe('#7f1d1d')
    expect(rackTypeColor('cooling')).not.toBe(rackTypeColor('server'))
    expect(rackTypeColor('empty')).not.toBe(rackTypeColor('network'))
  })
})
