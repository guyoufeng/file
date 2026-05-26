import type { Device } from "../../types/domain";

export type AssetCategoryFilter =
  | "physical_server"
  | "virtual_server"
  | "storage"
  | "network"
  | "security"
  | "facility"
  | "patching"
  | "other"
  | "all";

export const assetCategoryFilters: {
  id: AssetCategoryFilter;
  label: string;
}[] = [
  { id: "physical_server", label: "物理服务器" },
  { id: "virtual_server", label: "虚拟服务器" },
  { id: "storage", label: "存储" },
  { id: "network", label: "交换机/网络" },
  { id: "security", label: "安全设备" },
  { id: "facility", label: "精密空调/列头柜" },
  { id: "patching", label: "理线架/配线柜" },
  { id: "other", label: "其他" },
  { id: "all", label: "全部资产" },
];

export function filterDevicesForAssetView(
  devices: Device[],
  category: AssetCategoryFilter,
  keyword: string,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return devices
    .filter((device) => matchesAssetCategory(device, category))
    .filter((device) => {
      if (!normalizedKeyword) return true;

      return [
        device.computerName,
        device.businessIp,
        device.managementIp,
        device.assetNo,
        device.serialNumber,
        device.purpose,
        device.owner,
        device.model,
        device.subtype,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalizedKeyword));
    });
}

function matchesAssetCategory(device: Device, category: AssetCategoryFilter) {
  if (category === "all") return true;
  if (category === "physical_server") {
    return device.categoryId === "server";
  }
  if (category === "other") {
    return ![
      "server",
      "virtual_server",
      "storage",
      "network",
      "security",
      "facility",
      "patching",
    ].includes(device.categoryId);
  }
  if (category === "virtual_server") {
    return device.categoryId === "virtual_server";
  }
  return device.categoryId === category;
}
