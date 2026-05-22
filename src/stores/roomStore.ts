import { defineStore } from 'pinia'
import type { Rack, Room } from '../types/domain'
import { getRacks, getRooms } from '../services/backend/rooms'

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
  },
})
