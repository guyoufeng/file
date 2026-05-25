import { describe, expect, it } from "vitest";
import { paginate, sortByStartedAtDesc } from "../../services/pagination";

describe("pagination", () => {
  it("defaults to page-sized slices and reports page count", () => {
    const result = paginate(
      Array.from({ length: 45 }, (_, index) => index + 1),
      { page: 2, pageSize: 20 },
    );

    expect(result.items).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
      39, 40,
    ]);
    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(45);
  });

  it("clamps invalid pages and unsupported page sizes", () => {
    const result = paginate([1, 2, 3], { page: 99, pageSize: 999 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it("sorts alerts by newest started time first", () => {
    expect(
      sortByStartedAtDesc([
        { id: "old", startedAt: "2026-05-20T08:00:00+08:00" },
        { id: "new", startedAt: "2026-05-25T08:00:00+08:00" },
        { id: "middle", startedAt: "2026-05-24T08:00:00+08:00" },
      ]).map((item) => item.id),
    ).toEqual(["new", "middle", "old"]);
  });
});
