import { defineStore } from "pinia";
import type { Device } from "../types/domain";
import {
  getDevices,
  removeDevice,
  saveDevice,
} from "../services/backend/assets";

export const useAssetStore = defineStore("assets", {
  state: () => ({
    devices: [] as Device[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadDevices(rackId?: string) {
      this.loading = true;
      this.error = null;
      try {
        this.devices = await getDevices(rackId);
      } catch (error) {
        this.error =
          error instanceof Error ? error.message : "加载资产数据失败";
      } finally {
        this.loading = false;
      }
    },
    async upsertDevice(device: Device) {
      const saved = await saveDevice(device);
      const index = this.devices.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        this.devices.splice(index, 1, saved);
      } else {
        this.devices.unshift(saved);
      }
      return saved;
    },
    async deleteDevice(id: string) {
      await removeDevice(id);
      this.devices = this.devices.filter((device) => device.id !== id);
    },
  },
});
