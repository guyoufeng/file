import { describe, expect, it } from "vitest";
import type { Device } from "../../types/domain";
import { filterRackSideDevices } from "../../services/rack/rackSideView";

function makeDevice(id: string, side: "front" | "rear"): Device {
  return {
    id,
    rackId: "rack-1",
    categoryId: "server",
    name: id,
    ips: [],
    side,
    startU: id === "front" ? 10 : 20,
    endU: id === "front" ? 11 : 21,
    heightU: 2,
    status: "normal",
    ports: [],
  };
}

describe("rack side view", () => {
  it("filters devices by selected rack side", () => {
    expect(
      filterRackSideDevices([makeDevice("front", "front"), makeDevice("rear", "rear")], "rack-1", "rear").map(
        (device) => device.id,
      ),
    ).toEqual(["rear"]);
  });
});
