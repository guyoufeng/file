import type { Rack, Room } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

function readLocalJson<T>(key: string): T[] | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T[]
  } catch {
    return null
  }
}

export async function getRooms(): Promise<Room[]> {
  try {
    const rooms = await invokeCommand<Room[]>('get_rooms')
    return rooms.length > 0 ? rooms : sampleProject.rooms
  } catch {
    const localRooms = readLocalJson<Room>('qf-ai-dcim.rooms')
    if (localRooms) return localRooms
    return sampleProject.rooms
  }
}

export async function getRacks(roomId?: string): Promise<Rack[]> {
  try {
    const racks = await invokeCommand<Rack[]>('get_racks', { roomId })
    if (racks.length > 0) {
      return racks
    }
    return roomId ? sampleProject.racks.filter((rack) => rack.roomId === roomId) : sampleProject.racks
  } catch {
    const localRacks = readLocalJson<Rack>('qf-ai-dcim.racks')
    if (localRacks) {
      return roomId ? localRacks.filter((rack) => rack.roomId === roomId) : localRacks
    }
    return roomId ? sampleProject.racks.filter((rack) => rack.roomId === roomId) : sampleProject.racks
  }
}
