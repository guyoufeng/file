import type { Alert, Device, Rack, Room } from '../../types/domain'
import { getRackVisualState, type RackVisualState } from './rackMaterials'

export interface SceneVector3 {
  x: number
  y: number
  z: number
}

export interface RackSceneItem {
  rackId: string
  name: string
  rack: Rack
  position: SceneVector3
  size: SceneVector3
  visual: RackVisualState
  deviceCount: number
}

export interface RackSceneModule {
  id: string
  name: string
  position: SceneVector3
  size: SceneVector3
}

export interface RackSceneModel {
  items: RackSceneItem[]
  modules: RackSceneModule[]
  bounds: {
    width: number
    depth: number
  }
}

const rackSize = { x: 1.1, y: 3.2, z: 0.92 }
const columnGap = 1.38
const rowGap = 1.65
const moduleGap = 3.4

export function buildRackSceneModel(room: Room | undefined, racks: Rack[], devices: Device[], alerts: Alert[]): RackSceneModel {
  if (!room) {
    return { items: [], modules: [], bounds: { width: 1, depth: 1 } }
  }

  if (room.layoutType === 'micro_module') {
    return buildMicroModuleScene(room, racks, devices, alerts)
  }

  return buildSimpleRoomScene(racks, devices, alerts)
}

function buildMicroModuleScene(room: Room, racks: Rack[], devices: Device[], alerts: Alert[]): RackSceneModel {
  const modules = room.microModules?.length
    ? room.microModules
    : [...new Set(racks.map((rack) => rack.microModuleId).filter(Boolean))].map((id) => ({
        id: id as string,
        roomId: room.id,
        name: id as string,
        rows: 2,
        columns: 10,
        rackIds: racks.filter((rack) => rack.microModuleId === id).map((rack) => rack.id),
      }))
  const items: RackSceneItem[] = []
  const sceneModules: RackSceneModule[] = []

  modules.forEach((module, moduleIndex) => {
    const moduleOriginX = moduleIndex * (module.columns * columnGap + moduleGap)
    const moduleRacks = racks.filter((rack) => rack.microModuleId === module.id)
    const rowNames = [...new Set(moduleRacks.map((rack) => rack.rowName ?? 'A排'))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hans-CN'),
    )

    sceneModules.push({
      id: module.id,
      name: module.name,
      position: { x: moduleOriginX + ((module.columns - 1) * columnGap) / 2, y: 0.01, z: rowGap / 2 },
      size: { x: module.columns * columnGap + 0.8, y: 0.02, z: rowGap + 2.1 },
    })

    for (const rack of moduleRacks) {
      const column = Math.max((rack.columnIndex ?? 1) - 1, 0)
      const row = Math.max(rowNames.indexOf(rack.rowName ?? 'A排'), 0)
      items.push(createRackSceneItem(rack, devices, alerts, {
        x: moduleOriginX + column * columnGap,
        y: rackSize.y / 2,
        z: row * rowGap,
      }))
    }
  })

  const width = modules.length * 10 * columnGap + Math.max(modules.length - 1, 0) * moduleGap
  return { items, modules: sceneModules, bounds: { width, depth: 5.8 } }
}

function buildSimpleRoomScene(racks: Rack[], devices: Device[], alerts: Alert[]): RackSceneModel {
  const items = racks.map((rack, index) => {
    const column = rack.columnIndex ? rack.columnIndex - 1 : index
    const row = rack.rowName === 'B排' ? 1 : 0
    return createRackSceneItem(rack, devices, alerts, {
      x: column * columnGap,
      y: rackSize.y / 2,
      z: row * rowGap,
    })
  })
  const maxColumn = Math.max(...items.map((item) => item.position.x), 0)
  const maxRow = Math.max(...items.map((item) => item.position.z), 0)

  return {
    items,
    modules: [],
    bounds: { width: maxColumn + columnGap, depth: maxRow + rowGap + 2.4 },
  }
}

function createRackSceneItem(
  rack: Rack,
  devices: Device[],
  alerts: Alert[],
  position: SceneVector3,
): RackSceneItem {
  return {
    rackId: rack.id,
    name: rack.name,
    rack,
    position,
    size: rackSize,
    visual: getRackVisualState(rack, devices, alerts),
    deviceCount: devices.filter((device) => device.rackId === rack.id).length,
  }
}
