import { describe, expect, it } from "vitest";
import type { Device } from "../../types/domain";
import {
  assetCategoryFilters,
  filterDevicesForAssetView,
} from "../../features/asset-management/assetFilters";

const baseDevice = {
  id: "device",
  rackId: "rack-529-a1",
  side: "front",
  startU: 1,
  endU: 2,
  heightU: 2,
  status: "normal",
  ips: [],
  ports: [],
} satisfies Partial<Device>;

describe("asset filters", () => {
  it("defaults to physical servers only", () => {
    const devices = [
      {
        ...baseDevice,
        id: "server-1",
        categoryId: "server",
        subtype: "物理服务器",
        name: "server-1",
        computerName: "server-1",
      },
      {
        ...baseDevice,
        id: "storage-1",
        categoryId: "storage",
        subtype: "存储设备",
        name: "storage-1",
      },
    ] as Device[];

    expect(assetCategoryFilters[0].id).toBe("physical_server");
    expect(filterDevicesForAssetView(devices, "physical_server", "")).toEqual([
      devices[0],
    ]);
  });

  it("groups facility and patching assets separately from physical servers", () => {
    const devices = [
      {
        ...baseDevice,
        id: "cooling-1",
        categoryId: "facility",
        subtype: "精密空调",
        name: "529-A3-精密空调",
      },
      {
        ...baseDevice,
        id: "patch-1",
        categoryId: "patching",
        subtype: "配线架",
        name: "529-A10-配线架",
      },
    ] as Device[];

    expect(filterDevicesForAssetView(devices, "facility", "")).toEqual([
      devices[0],
    ]);
    expect(filterDevicesForAssetView(devices, "patching", "")).toEqual([
      devices[1],
    ]);
  });
});
