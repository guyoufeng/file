import type { Rack, Room } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getRooms(): Promise<Room[]> {
  try {
    const rooms = await invokeCommand<Room[]>('get_rooms')
    return rooms.length > 0 ? rooms : sampleProject.rooms
  } catch {
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
    return roomId ? sampleProject.racks.filter((rack) => rack.roomId === roomId) : sampleProject.racks
  }
}
