import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Device } from "../../types/domain";

const saveDevice = vi.fn();
const removeDevice = vi.fn();
const getDevices = vi.fn();

vi.mock("../../services/backend/assets", () => ({
  getDevices,
  saveDevice,
  removeDevice,
}));

const device: Device = {
  id: "dev-store-001",
  rackId: "rack-529-a1",
  categoryId: "server",
  name: "数据库服务器-01",
  computerName: "DB-SRV-01",
  businessIp: "10.10.1.21",
  ips: ["10.10.1.21"],
  purpose: "生产数据库",
  owner: "张三",
  side: "front",
  startU: 21,
  endU: 22,
  heightU: 2,
  status: "normal",
  ports: [],
};

describe("asset store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saveDevice.mockReset();
    removeDevice.mockReset();
    getDevices.mockReset();
  });

  it("upserts saved devices into local state", async () => {
    const { useAssetStore } = await import("../../stores/assetStore");
    const store = useAssetStore();
    saveDevice.mockResolvedValueOnce({ ...device, purpose: "生产数据库集群" });

    const saved = await store.upsertDevice({
      ...device,
      purpose: "生产数据库集群",
    });

    expect(saveDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: device.id }),
    );
    expect(saved.purpose).toBe("生产数据库集群");
    expect(store.devices).toEqual([saved]);
  });

  it("replaces existing devices after saving", async () => {
    const { useAssetStore } = await import("../../stores/assetStore");
    const store = useAssetStore();
    store.devices = [device];
    saveDevice.mockResolvedValueOnce({ ...device, owner: "李四" });

    await store.upsertDevice({ ...device, owner: "李四" });

    expect(store.devices).toHaveLength(1);
    expect(store.devices[0].owner).toBe("李四");
  });

  it("removes devices through backend command", async () => {
    const { useAssetStore } = await import("../../stores/assetStore");
    const store = useAssetStore();
    store.devices = [device];
    removeDevice.mockResolvedValueOnce(undefined);

    await store.deleteDevice(device.id);

    expect(removeDevice).toHaveBeenCalledWith(device.id);
    expect(store.devices).toEqual([]);
  });
});
