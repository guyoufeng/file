import { describe, expect, it } from "vitest";
import {
  getRackTypeColor,
  getRackTypeLabel,
} from "../../services/rack/rackTypePresentation";

describe("rack type presentation", () => {
  it("treats storage racks as server cabinets for label and color", () => {
    expect(getRackTypeLabel("storage")).toBe("服务器柜");
    expect(getRackTypeColor("storage")).toBe(getRackTypeColor("server"));
  });

  it("keeps facility and network rack types visually distinct", () => {
    expect(getRackTypeColor("cooling")).not.toBe(getRackTypeColor("server"));
    expect(getRackTypeColor("row_head")).not.toBe(getRackTypeColor("network"));
    expect(getRackTypeLabel("patching")).toBe("配线柜");
  });
});
