import { defineStore } from 'pinia'
import type { Rack, RackType, Room } from '../types/domain'
import { getRacks, getRooms } from '../services/backend/rooms'
import {
  addRackToRoom,
  addSimpleRoom,
  renameRack as renameRackRecords,
  renameRoom as renameRoomRecords,
} from '../services/rack/rackManagement'

function writeLocalJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export const useRoomStore = defineStore('rooms', {
  state: () => ({
    rooms: [] as Room[],
    racks: [] as Rack[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadRooms() {
      this.loading = true
      this.error = null
      try {
        const [rooms, racks] = await Promise.all([getRooms(), getRacks()])
        this.rooms = rooms
        this.racks = racks
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载机房数据失败'
      } finally {
        this.loading = false
      }
    },
    renameRoom(roomId: string, name: string) {
      this.rooms = renameRoomRecords(this.rooms, roomId, name)
      writeLocalJson('qf-ai-dcim.rooms', this.rooms)
    },
    addSimpleRoom(name: string) {
      this.rooms = addSimpleRoom(this.rooms, name)
      writeLocalJson('qf-ai-dcim.rooms', this.rooms)
      return this.rooms[this.rooms.length - 1]
    },
    renameRack(rackId: string, name: string) {
      this.racks = renameRackRecords(this.racks, rackId, name)
      writeLocalJson('qf-ai-dcim.racks', this.racks)
    },
    addRack(room: Room, name: string, type: RackType) {
      this.racks = addRackToRoom(this.racks, room, { name, type })
      writeLocalJson('qf-ai-dcim.racks', this.racks)
      return this.racks[this.racks.length - 1]
    },
  },
})
