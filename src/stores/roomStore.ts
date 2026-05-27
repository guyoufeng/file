import { defineStore } from 'pinia'
import type { Device, Rack, RackType, Room } from '../types/domain'
import { getRacks, getRooms } from '../services/backend/rooms'
import {
  addRackToRoom,
  addSimpleRoom,
  buildDeletedRackItem,
  buildDeletedRoomItem,
  deleteRack,
  deleteRoomWithRacks,
  getRecoverableDeletedItems,
  renameRack as renameRackRecords,
  renameRoom as renameRoomRecords,
  restoreDeletedRack,
  restoreDeletedRoom,
  type DeletedTopologyItem,
} from '../services/rack/rackManagement'

function writeLocalJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const deletedTopologyKey = 'qf-ai-dcim.deletedTopology'

export const useRoomStore = defineStore('rooms', {
  state: () => ({
    rooms: [] as Room[],
    racks: [] as Rack[],
    deletedTopology: [] as DeletedTopologyItem[],
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
        this.deletedTopology = getRecoverableDeletedItems(
          readLocalJson<DeletedTopologyItem[]>(deletedTopologyKey, []),
        )
        writeLocalJson(deletedTopologyKey, this.deletedTopology)
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
    deleteRoom(roomId: string, devices: Device[] = []) {
      const room = this.rooms.find((item) => item.id === roomId)
      if (room) {
        this.deletedTopology.unshift(buildDeletedRoomItem(room, this.racks, devices))
      }
      const result = deleteRoomWithRacks(this.rooms, this.racks, roomId)
      this.rooms = result.rooms
      this.racks = result.racks
      writeLocalJson('qf-ai-dcim.rooms', this.rooms)
      writeLocalJson('qf-ai-dcim.racks', this.racks)
      writeLocalJson(deletedTopologyKey, this.deletedTopology)
      return result.deletedRackIds
    },
    renameRack(rackId: string, name: string) {
      this.racks = renameRackRecords(this.racks, rackId, name)
      writeLocalJson('qf-ai-dcim.racks', this.racks)
    },
    deleteRack(rackId: string, devices: Device[] = []) {
      const rack = this.racks.find((item) => item.id === rackId)
      if (rack) {
        this.deletedTopology.unshift(buildDeletedRackItem(rack, devices))
      }
      const result = deleteRack(this.racks, rackId)
      this.racks = result.racks
      writeLocalJson('qf-ai-dcim.racks', this.racks)
      writeLocalJson(deletedTopologyKey, this.deletedTopology)
      return result.deletedRackId
    },
    restoreDeletedItem(itemId: string) {
      const item = this.deletedTopology.find((entry) => entry.id === itemId)
      if (!item) return null

      if (item.type === 'room') {
        const restored = restoreDeletedRoom(this.rooms, this.racks, item)
        this.rooms = restored.rooms
        this.racks = restored.racks
      } else {
        this.racks = restoreDeletedRack(this.racks, item)
      }
      this.deletedTopology = this.deletedTopology.filter((entry) => entry.id !== itemId)
      writeLocalJson('qf-ai-dcim.rooms', this.rooms)
      writeLocalJson('qf-ai-dcim.racks', this.racks)
      writeLocalJson(deletedTopologyKey, this.deletedTopology)
      return item
    },
    addRack(room: Room, name: string, type: RackType) {
      this.racks = addRackToRoom(this.racks, room, { name, type })
      writeLocalJson('qf-ai-dcim.racks', this.racks)
      return this.racks[this.racks.length - 1]
    },
  },
})
