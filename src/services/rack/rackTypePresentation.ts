import type { RackType } from "../../types/domain";

const rackTypeLabels: Record<RackType, string> = {
  server: "服务器柜",
  network: "网络柜",
  storage: "服务器柜",
  patching: "配线柜",
  row_head: "列头柜",
  cooling: "精密空调",
  ups_pdu: "供电柜",
  empty: "空柜",
  other: "其他",
};

const rackTypeColors: Record<RackType, string> = {
  server: "#2563eb",
  network: "#059669",
  storage: "#2563eb",
  patching: "#ca8a04",
  row_head: "#0891b2",
  cooling: "#7c3aed",
  ups_pdu: "#dc2626",
  empty: "#334155",
  other: "#64748b",
};

export function getRackTypeLabel(type: RackType): string {
  return rackTypeLabels[type] ?? type;
}

export function getRackTypeColor(type: RackType): string {
  return rackTypeColors[type] ?? rackTypeColors.other;
}
