import { describe, expect, it } from "vitest";
import {
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
});
