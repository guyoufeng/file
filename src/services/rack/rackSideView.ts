import type { Device, DeviceSide } from "../../types/domain";

export function filterRackSideDevices(
  devices: Device[],
  rackId: string,
  side: DeviceSide,
): Device[] {
  return devices
    .filter((device) => device.rackId === rackId && device.side === side)
    .sort((left, right) => right.startU - left.startU);
}
