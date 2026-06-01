import { describe, expect, it } from "vitest";
import { computeDeviceCenterScrollTop } from "../../features/rack-overview/rackFocus";

describe("rack focus helpers", () => {
  it("centers the selected device in the U view scroll container", () => {
    const scrollTop = computeDeviceCenterScrollTop({
      rackHeightU: 42,
      deviceStartU: 20,
      deviceEndU: 21,
      deviceHeightU: 2,
      unitHeight: 18,
      containerHeight: 360,
    });

    expect(scrollTop).toBeGreaterThan(0);
    expect(scrollTop).toBeLessThan(42 * 18);
  });
});
