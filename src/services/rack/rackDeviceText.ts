import type { Device } from "../../types/domain";

const CENTERED_CATEGORIES = new Set([
  "facility",
  "patching",
  "network",
  "storage",
  "security",
]);

export interface RackDeviceTextLayout {
  text: string;
  fontSize: number;
  lineHeight: number;
  align: "left" | "center";
  verticalAlign: "top" | "middle";
  yOffset: number;
}

export function shouldCenterRackDeviceText(device: Device): boolean {
  return (
    CENTERED_CATEGORIES.has(device.categoryId) ||
    (device.heightU >= 8 && !device.businessIp)
  );
}

export function getRackDeviceText(device: Device, compact: boolean): string {
  if (shouldCenterRackDeviceText(device)) {
    return device.subtype || device.purpose || device.name;
  }

  const lines = [device.computerName || device.name, device.businessIp].filter(
    Boolean,
  );

  if (!compact && device.purpose) {
    lines.push(device.purpose);
  }

  return lines.slice(0, compact ? 2 : 3).join("\n");
}

export function getRackDeviceTextLayout(input: {
  device: Device;
  compact: boolean;
  zoom: number;
  blockHeight: number;
}): RackDeviceTextLayout {
  const centered = shouldCenterRackDeviceText(input.device);
  const availableHeight = Math.max(12, input.blockHeight - 8);
  const lineCount = getRackDeviceText(input.device, input.compact).split("\n")
    .length;
  const compactFontSize = input.zoom >= 1.5 ? 10.5 : input.zoom >= 1.25 ? 10 : 9;
  const baseFontSize = input.compact
    ? compactFontSize
    : input.zoom >= 1
      ? 12
      : 10;
  const fontSize = Math.max(8, Math.min(baseFontSize, availableHeight / lineCount));
  const lineHeight = input.compact ? 1.12 : 1.25;
  const estimatedTextHeight = fontSize * lineHeight * lineCount;

  return {
    text: getRackDeviceText(input.device, input.compact),
    fontSize,
    lineHeight,
    align: centered ? "center" : "left",
    verticalAlign: centered ? "middle" : "top",
    yOffset: centered ? Math.max(0, (input.blockHeight - estimatedTextHeight) / 2) : 4,
  };
}
