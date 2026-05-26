import { describe, expect, it } from "vitest";
import {
  addVirtualServer,
  filterVirtualServers,
  sampleVirtualServers,
} from "../../features/virtual-server-management/virtualServers";

describe("virtual server management", () => {
  it("tracks virtual servers separately from rack devices", () => {
    expect(sampleVirtualServers[0]).toMatchObject({
      name: "MES-VM-APP-01",
      platform: "ZStack",
      hostDeviceName: "QF-SRV-001",
    });
    expect(sampleVirtualServers[0]).not.toHaveProperty("rackId");
  });

  it("searches by virtual server name ip business owner or host", () => {
    const result = filterVirtualServers(sampleVirtualServers, "QF-SRV-001");

    expect(result.map((item) => item.name)).toContain("MES-VM-APP-01");
  });

  it("adds a virtual server with generated id and blocks duplicate business ip", () => {
    const addResult = addVirtualServer(sampleVirtualServers, {
      name: "MES-VM-DB-01",
      platform: "ZStack",
      businessIp: "192.168.129.90",
      purpose: "MES数据库虚拟机",
      owner: "张文军",
      hostDeviceName: "QF-SRV-001",
      status: "running",
    });

    expect(addResult.ok).toBe(true);
    expect(addResult.servers).toHaveLength(sampleVirtualServers.length + 1);
    expect(addResult.servers.at(-1)).toMatchObject({
      id: "vm-mes-vm-db-01",
      name: "MES-VM-DB-01",
      businessIp: "192.168.129.90",
    });

    const duplicateResult = addVirtualServer(addResult.servers, {
      name: "DUPLICATE-VM",
      platform: "ZStack",
      businessIp: "192.168.129.90",
      status: "running",
    });

    expect(duplicateResult.ok).toBe(false);
    expect(duplicateResult.message).toContain("业务IP已存在");
    expect(duplicateResult.servers).toHaveLength(addResult.servers.length);
  });
});
