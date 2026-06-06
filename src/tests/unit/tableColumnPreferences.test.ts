import { beforeEach, describe, expect, it } from "vitest";
import {
  moveTableColumn,
  resetTableColumns,
  resizeTableColumn,
  resolveTableColumns,
  toggleTableColumn,
  type DataTableColumn,
} from "../../services/table/tableColumnPreferences";

const columns: DataTableColumn[] = [
  { id: "computerName", label: "计算机名", visibleByDefault: true, width: 180 },
  { id: "businessIp", label: "业务IP", visibleByDefault: true, width: 160 },
  { id: "owner", label: "责任人", visibleByDefault: true, width: 120, minWidth: 110 },
];

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

describe("table column preferences", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("toggles and moves user selected columns", () => {
    toggleTableColumn("asset-table", columns, "owner", false);
    moveTableColumn("asset-table", columns, "businessIp", "left");

    const resolved = resolveTableColumns("asset-table", columns);

    expect(resolved.map((column) => column.id)).toEqual(["businessIp", "computerName", "owner"]);
    expect(resolved.find((column) => column.id === "owner")?.visible).toBe(false);
    expect(resolved.filter((column) => column.visible).map((column) => column.id)).toEqual([
      "businessIp",
      "computerName",
    ]);
  });

  it("resets to default column order and visibility", () => {
    toggleTableColumn("asset-table", columns, "owner", false);
    resetTableColumns("asset-table");

    expect(resolveTableColumns("asset-table", columns).map((column) => [column.id, column.visible])).toEqual([
      ["computerName", true],
      ["businessIp", true],
      ["owner", true],
    ]);
  });

  it("persists user resized column widths with min and max guards", () => {
    resizeTableColumn("asset-table", columns, "businessIp", 260);
    resizeTableColumn("asset-table", columns, "owner", 40);

    const resolved = resolveTableColumns("asset-table", columns);

    expect(resolved.find((column) => column.id === "businessIp")?.width).toBe(260);
    expect(resolved.find((column) => column.id === "owner")?.width).toBe(110);
  });
});
