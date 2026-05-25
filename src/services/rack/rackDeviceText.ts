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
  padding: number;
}

export function shouldCenterRackDeviceText(device: Device): boolean {
  return (
    CENTERED_CATEGORIES.has(device.categoryId) ||
    (device.heightU >= 8 && !device.businessIp)
  );
}

export function getRackDeviceText(device: Device, compact: boolean): string {
  if (compact && device.heightU <= 1) {
    return device.computerName || device.name;
  }

  const primaryName = device.computerName || (!shouldCenterRackDeviceText(device) ? device.name : "");
  const lines = [primaryName, device.businessIp].filter(Boolean);

  if (compact && lines.length > 0) {
    return lines.slice(0, 2).join("\n");
  }

  if (shouldCenterRackDeviceText(device)) {
    return device.subtype || device.purpose || device.name;
  }

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
  const centered = input.compact || shouldCenterRackDeviceText(input.device);
  const oneUCompact = input.compact && input.device.heightU <= 1;
  const availableHeight = Math.max(12, input.blockHeight - 8);
  const lineCount = getRackDeviceText(input.device, input.compact).split("\n")
    .length;
  const compactFontSize = oneUCompact
    ? input.zoom >= 1.5
      ? 9
      : 8.5
    : input.zoom >= 1.5
      ? 10.5
      : input.zoom >= 1.25
        ? 10
        : 9;
  const baseFontSize = input.compact
    ? compactFontSize
    : input.zoom >= 1
      ? 12
      : 10;
  const fontSize = Math.max(8, Math.min(baseFontSize, availableHeight / lineCount));
  const lineHeight = oneUCompact ? 1 : input.compact ? 1.12 : 1.25;
  return {
    text: getRackDeviceText(input.device, input.compact),
    fontSize,
    lineHeight,
    align: centered ? "center" : "left",
    verticalAlign: centered ? "middle" : "top",
    yOffset: 0,
    padding: oneUCompact ? 0 : input.compact ? 2 : 4,
  };
}
