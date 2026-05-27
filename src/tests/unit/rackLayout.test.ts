import { describe, expect, it } from "vitest";
import { sampleProject } from "../../services/backend/data";
import {
  getRackTileStats,
  getRoomOptions,
} from "../../features/rack-overview/layout";

describe("rack layout helpers", () => {
  it("returns the expected room selector options", () => {
    expect(
      getRoomOptions(sampleProject.rooms).map((room) => room.name),
    ).toEqual([
      "529数据中心",
      "99数据中心",
      "308数据中心",
      "杭州数据中心",
      "越南C7数据中心",
    ]);
  });

  it("keeps newly added rooms after the known room order", () => {
    expect(
      getRoomOptions([
        ...sampleProject.rooms,
        {
          id: "room-temp",
          dataCenterId: "dc-nanjing",
          name: "临时测试机房",
          layoutType: "simple_rows",
          defaultRackHeightU: 42,
          racks: [],
        },
      ]).map((room) => room.name),
    ).toEqual([
      "529数据中心",
      "99数据中心",
      "308数据中心",
      "杭州数据中心",
      "越南C7数据中心",
      "临时测试机房",
    ]);
  });

  it("counts devices, alerts, and capacity for a rack tile", () => {
    const rack = sampleProject.racks[0];
    const stats = getRackTileStats(
      rack,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(stats.deviceCount).toBe(4);
    expect(stats.capacityText).toBe("16U / 42U");
    expect(stats.alertCount).toBeGreaterThanOrEqual(0);
  });

  it("uses the actual 529 rack roles and 42U height", () => {
    const racksByName = new Map(
      sampleProject.racks.map((rack) => [rack.name, rack]),
    );

    expect(
      sampleProject.racks
        .filter((rack) => rack.name.startsWith("529-"))
        .every((rack) => rack.heightU === 42),
    ).toBe(true);

    for (const rackName of [
      "529-A3",
      "529-A7",
      "529-B5",
      "529-C3",
      "529-C7",
      "529-D5",
    ]) {
      expect(racksByName.get(rackName)?.type).toBe("cooling");
    }

    for (const rackName of ["529-B1", "529-D1"]) {
      expect(racksByName.get(rackName)?.type).toBe("row_head");
    }

    for (const rackName of [
      "529-A10",
      "529-B10",
      "529-C10",
      "529-D10",
      "529-B2",
      "529-D2",
    ]) {
      expect(racksByName.get(rackName)?.type).toBe("patching");
    }

    for (const rackName of ["529-A8", "529-A9", "529-B9", "529-C8", "529-D9"]) {
      expect(racksByName.get(rackName)?.type).toBe("network");
    }

    expect(racksByName.get("529-A1")?.type).toBe("server");
    expect(racksByName.get("529-C2")?.type).toBe("server");
  });
});
