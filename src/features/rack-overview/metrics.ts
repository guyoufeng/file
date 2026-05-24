import type { Alert, Device, Rack, Room } from "../../types/domain";

export interface RackOverviewMetrics {
  totalRooms: number;
  totalDevices: number;
  currentRacks: number;
  currentDevices: number;
  currentAlerts: number;
}

export function getRackOverviewMetrics(
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
  roomId?: string | null,
): RackOverviewMetrics {
  const currentRackIds = new Set(
    racks.filter((rack) => rack.roomId === roomId).map((rack) => rack.id),
  );
  const currentDeviceIds = new Set(
    devices
      .filter((device) => currentRackIds.has(device.rackId))
      .map((device) => device.id),
  );

  return {
    totalRooms: rooms.length,
    totalDevices: devices.length,
    currentRacks: currentRackIds.size,
    currentDevices: currentDeviceIds.size,
    currentAlerts: alerts.filter(
      (alert) =>
        currentDeviceIds.has(alert.deviceId) && alert.status !== "recovered",
    ).length,
  };
}
