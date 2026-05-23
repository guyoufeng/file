import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "../../types/domain";

const invokeCommand = vi.fn();

vi.mock("../../services/backend/invoke", () => ({
  invokeCommand,
}));

const baseDevice: Device = {
  id: "dev-test-001",
  rackId: "rack-529-a1",
  categoryId: "server",
  subtype: "physical",
  name: "数据库服务器-01",
  computerName: "DB-SRV-01",
  businessIp: "10.10.1.21",
  managementIp: "172.16.1.21",
  ips: ["10.10.1.21", "172.16.1.21"],
  purpose: "生产数据库",
  owner: "张三",
  side: "front",
  startU: 21,
  endU: 22,
  heightU: 2,
  status: "normal",
  ports: [],
  metadata: {
    cpu: "2*32C",
    memory: "512GB",
  },
};

describe("asset backend service", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it("serializes editable device fields when saving to backend", async () => {
    const { saveDevice } = await import("../../services/backend/assets");
    invokeCommand.mockResolvedValueOnce({
      ...baseDevice,
      ipsJson: JSON.stringify(baseDevice.ips),
      metadataJson: JSON.stringify(baseDevice.metadata),
    });

    const saved = await saveDevice(baseDevice);

    expect(invokeCommand).toHaveBeenCalledWith("upsert_device", {
      input: expect.objectContaining({
        id: baseDevice.id,
        rackId: baseDevice.rackId,
        computerName: baseDevice.computerName,
        ipsJson: JSON.stringify(baseDevice.ips),
        metadataJson: JSON.stringify(baseDevice.metadata),
      }),
    });
    expect(saved.ips).toEqual(baseDevice.ips);
    expect(saved.metadata).toEqual(baseDevice.metadata);
  });

  it("normalizes backend device JSON fields when loading devices", async () => {
    const { getDevices } = await import("../../services/backend/assets");
    invokeCommand.mockResolvedValueOnce([
      {
        ...baseDevice,
        ips: undefined,
        ports: undefined,
        ipsJson: '["10.10.1.21","172.16.1.21"]',
        metadataJson: '{"cpu":"2*32C","memory":"512GB"}',
      },
    ]);

    const devices = await getDevices();

    expect(devices[0]).toMatchObject({
      id: baseDevice.id,
      ips: ["10.10.1.21", "172.16.1.21"],
      ports: [],
      metadata: {
        cpu: "2*32C",
        memory: "512GB",
      },
    });
  });

  it("calls backend delete command for device removal", async () => {
    const { removeDevice } = await import("../../services/backend/assets");
    invokeCommand.mockResolvedValueOnce(undefined);

    await removeDevice("dev-test-001");

    expect(invokeCommand).toHaveBeenCalledWith("delete_device", {
      id: "dev-test-001",
    });
  });
});
