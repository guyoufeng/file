import { describe, expect, it } from "vitest";
import { getEndU } from "../../services/rack/uPosition";
import type { ImportValidationResult } from "../../types/import";

describe("asset import builder", () => {
  it("builds importable devices from validated rows", async () => {
    const { buildImportedDevices } =
      await import("../../services/import/deviceImport");
    const result: ImportValidationResult = {
      totalRows: 2,
      importableRows: 1,
      errorRows: 1,
      warningRows: 0,
      newDevices: 1,
      skippedDuplicateDevices: 0,
      rows: [
        {
          rackId: "rack-529-a1",
          errors: [],
          warnings: [],
          row: {
            rowIndex: 2,
            computerName: "DB-SRV-01",
            rackName: "529-A1",
            side: "front",
            startU: 21,
            heightU: 2,
            categoryId: "server",
            subtype: "数据库服务器",
            businessIp: "10.10.1.21",
            managementIp: "172.16.1.21",
            purpose: "生产数据库",
            owner: "张三",
            assetNo: "IDC-SRV-001",
          },
        },
        {
          errors: ["机柜不存在"],
          warnings: [],
          row: {
            rowIndex: 3,
            computerName: "BAD-SRV-01",
            rackName: "不存在机柜",
            side: "front",
            startU: 1,
            heightU: 1,
            categoryId: "server",
            subtype: "物理服务器",
          },
        },
      ],
    };

    const devices = buildImportedDevices(result, 1716460000000);

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: "dev-import-1716460000000-2",
      name: "DB-SRV-01",
      computerName: "DB-SRV-01",
      rackId: "rack-529-a1",
      ips: ["10.10.1.21", "172.16.1.21"],
      startU: 21,
      endU: getEndU(21, 2),
      status: "normal",
      ports: [],
    });
  });
});
