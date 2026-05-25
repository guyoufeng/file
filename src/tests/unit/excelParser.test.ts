import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseDeviceImportWorkbook } from "../../services/import/excelParser";

function workbookBuffer(rows: Record<string, string | number | undefined>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Sheet1",
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("excel parser", () => {
  it("parses the actual asset workbook column names from a single Sheet1", () => {
    const parsed = parseDeviceImportWorkbook(
      workbookBuffer([
        {
          机柜号: "529-A1",
          机柜位置: "33-34",
          固定资产号: "7-00011106",
          计算机名: "zstack22160",
          资产说明: "dell r740",
          IP: "192.168.221.60",
          外接管理口: "192.168.45.91",
          类型: "zstack系统",
          操作系统: "zstack",
          责任人: "顾友峰",
          维保号: "BPY0BW3",
          服务器维保: "2026.3-2026.12.31",
          硬件配置: "intel 4214*2共24核CPU，128G内存",
        },
        {
          机柜号: "529-C7",
          机柜位置: "1-42",
          设备大类: "精密空调",
          类型: "精密空调",
          责任人: "顾友峰",
        },
      ]),
    );

    expect(parsed.devices).toHaveLength(2);
    expect(parsed.devices[0]).toMatchObject({
      rowIndex: 2,
      rackName: "529-A1",
      computerName: "zstack22160",
      startU: 33,
      heightU: 2,
      categoryId: "server",
      subtype: "虚拟化服务器",
      businessIp: "192.168.221.60",
      managementIp: "192.168.45.91",
      purpose: "zstack系统",
      owner: "顾友峰",
      model: "dell r740",
      serialNumber: "BPY0BW3",
      assetNo: "7-00011106",
      warrantyExpireAt: "2026.3-2026.12.31",
    });
    expect(parsed.devices[1]).toMatchObject({
      rackName: "529-C7",
      computerName: "529-C7-精密空调",
      startU: 1,
      heightU: 42,
      categoryId: "facility",
      subtype: "精密空调",
    });
  });
});
