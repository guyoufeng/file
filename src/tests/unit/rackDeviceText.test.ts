import { describe, expect, it } from "vitest";
import type { Device } from "../../types/domain";
import {
  getRackDeviceText,
  getRackDeviceTextLayout,
  shouldCenterRackDeviceText,
} from "../../services/rack/rackDeviceText";

function makeDevice(overrides: Partial<Device>): Device {
  return {
    id: "device-1",
    rackId: "rack-1",
    categoryId: "server",
    name: "默认设备",
    ips: [],
    side: "front",
    startU: 20,
    endU: 21,
    heightU: 2,
    status: "normal",
    ports: [],
    ...overrides,
  };
}

describe("rack device text layout", () => {
  it("shows computer name and business IP for compact physical server cards", () => {
    const device = makeDevice({
      computerName: "zstack22160",
      businessIp: "10.10.0.21",
    });

    expect(getRackDeviceText(device, true)).toBe("zstack22160\n10.10.0.21");

    const layout = getRackDeviceTextLayout({
      device,
      compact: true,
      zoom: 1.25,
      blockHeight: 28,
    });

    expect(layout.fontSize).toBeGreaterThanOrEqual(9);
    expect(layout.align).toBe("center");
    expect(layout.verticalAlign).toBe("middle");
    expect(layout.yOffset).toBe(0);
  });

  it("centers facility rack labels vertically", () => {
    const device = makeDevice({
      categoryId: "facility",
      subtype: "精密空调",
      name: "529-A3-精密空调",
      heightU: 42,
    });

    expect(shouldCenterRackDeviceText(device)).toBe(true);
    expect(getRackDeviceText(device, true)).toBe("精密空调");

    const layout = getRackDeviceTextLayout({
      device,
      compact: true,
      zoom: 1.25,
      blockHeight: 560,
    });

    expect(layout.align).toBe("center");
    expect(layout.verticalAlign).toBe("middle");
    expect(layout.yOffset).toBe(0);
  });

  it("uses one compact line for 1U devices", () => {
    const device = makeDevice({
      heightU: 1,
      endU: 20,
      computerName: "理线架-01",
      businessIp: "10.10.0.21",
    });

    expect(getRackDeviceText(device, true)).toBe("理线架-01");
  });
});
