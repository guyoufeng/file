import type { Rack, Room } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getRooms(): Promise<Room[]> {
  try {
    return await invokeCommand<Room[]>('get_rooms')
  } catch {
    return sampleProject.rooms
  }
}

export async function getRacks(roomId?: string): Promise<Rack[]> {
  try {
    return await invokeCommand<Rack[]>('get_racks', { roomId })
  } catch {
    return roomId ? sampleProject.racks.filter((rack) => rack.roomId === roomId) : sampleProject.racks
  }
}
