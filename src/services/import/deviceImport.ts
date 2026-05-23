import type { Device } from "../../types/domain";
import type { ImportValidationResult } from "../../types/import";
import { getEndU } from "../rack/uPosition";

export function buildImportedDevices(
  result: ImportValidationResult,
  batchTime = Date.now(),
): Device[] {
  return result.rows
    .filter((item) => item.errors.length === 0 && item.rackId)
    .map((item) => ({
      id: `dev-import-${batchTime}-${item.row.rowIndex}`,
      name: item.row.computerName,
      computerName: item.row.computerName,
      rackId: item.rackId!,
      categoryId: item.row.categoryId,
      subtype: item.row.subtype,
      businessIp: item.row.businessIp,
      managementIp: item.row.managementIp,
      ips: [item.row.businessIp, item.row.managementIp].filter(
        Boolean,
      ) as string[],
      purpose: item.row.purpose,
      owner: item.row.owner,
      vendor: item.row.vendor,
      model: item.row.model,
      serialNumber: item.row.serialNumber,
      assetNo: item.row.assetNo,
      warrantyExpireAt: item.row.warrantyExpireAt,
      hardwareSpec: item.row.hardwareSpec,
      operatingSystem: item.row.operatingSystem,
      side: item.row.side,
      startU: item.row.startU,
      endU: getEndU(item.row.startU, item.row.heightU),
      heightU: item.row.heightU,
      status: "normal",
      ports: [],
      metadata: {
        importRowIndex: item.row.rowIndex,
      },
    }));
}
