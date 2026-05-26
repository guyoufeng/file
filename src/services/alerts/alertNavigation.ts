import type { Alert, Device, Rack, Room } from "../../types/domain";

export interface AlertLocateQuery {
  roomId?: string;
  rackId?: string;
  deviceId?: string;
  view: "u-view";
  source: "alert";
}

export function buildAlertLocateQuery(
  alert: Alert,
  devices: Device[],
  racks: Rack[],
  rooms: Room[],
): AlertLocateQuery {
  const device = devices.find((item) => item.id === alert.deviceId);
  const rack = racks.find((item) => item.id === device?.rackId);
  const room = rooms.find((item) => item.id === rack?.roomId);

  return {
    roomId: room?.id,
    rackId: rack?.id,
    deviceId: device?.id,
    view: "u-view",
    source: "alert",
  };
}
