import { defineStore } from "pinia";
import type { Device } from "../types/domain";
import {
  getDevices,
  removeDevice,
  saveDevice,
} from "../services/backend/assets";

export interface DeviceImportSummary {
  total: number;
  saved: number;
  failed: number;
  savedDevices: Device[];
  errors: {
    deviceId: string;
    deviceName: string;
    message: string;
  }[];
}

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
    async importDevices(devices: Device[]) {
      const summary = await this.importDevicesWithSummary(devices);
      return summary.savedDevices;
    },
    async importDevicesWithSummary(
      devices: Device[],
    ): Promise<DeviceImportSummary> {
      const summary: DeviceImportSummary = {
        total: devices.length,
        saved: 0,
        failed: 0,
        savedDevices: [],
        errors: [],
      };

      for (const device of devices) {
        try {
          const saved = await this.upsertDevice(device);
          summary.saved += 1;
          summary.savedDevices.push(saved);
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({
            deviceId: device.id,
            deviceName: device.computerName || device.name,
            message: error instanceof Error ? error.message : "设备保存失败",
          });
        }
      }

      return summary;
    },
  },
});
