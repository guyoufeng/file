import type { Device, Rack, RackType, Room } from "../../types/domain";

export type DeletedTopologyItem =
  | {
      id: string;
      type: "room";
      deletedAt: string;
      expiresAt: string;
      room: Room;
      racks: Rack[];
      devices: Device[];
    }
  | {
      id: string;
      type: "rack";
      deletedAt: string;
      expiresAt: string;
      rack: Rack;
      devices: Device[];
    };

function slug(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "new-room";
}

export function renameRoom(rooms: Room[], roomId: string, name: string): Room[] {
  const nextName = name.trim();
  if (!nextName) return rooms;
  return rooms.map((room) =>
    room.id === roomId ? { ...room, name: nextName } : room,
  );
}

export function renameRack(racks: Rack[], rackId: string, name: string): Rack[] {
  const nextName = name.trim();
  if (!nextName) return racks;
  return racks.map((rack) =>
    rack.id === rackId ? { ...rack, name: nextName } : rack,
  );
}

export function addSimpleRoom(rooms: Room[], name: string): Room[] {
  const nextName = name.trim();
  if (!nextName) return rooms;
  const baseId = `room-${slug(nextName)}`;
  const id = rooms.some((room) => room.id === baseId)
    ? `${baseId}-${rooms.length + 1}`
    : baseId;
  const dataCenterId = rooms[0]?.dataCenterId ?? "dc-local";

  return [
    ...rooms,
    {
      id,
      dataCenterId,
      name: nextName,
      layoutType: "simple_rows",
      defaultRackHeightU: 42,
      racks: [],
    },
  ];
}

export function addRackToRoom(
  racks: Rack[],
  room: Room,
  input: { name: string; type: RackType },
): Rack[] {
  const name = input.name.trim();
  if (!name) return racks;
  const roomRacks = racks.filter((rack) => rack.roomId === room.id);
  const baseId = `rack-${slug(name)}`;
  const id = racks.some((rack) => rack.id === baseId)
    ? `${baseId}-${racks.length + 1}`
    : baseId;

  return [
    ...racks,
    {
      id,
      roomId: room.id,
      name,
      type: input.type,
      rowName: "A排",
      columnIndex: roomRacks.length + 1,
      heightU: room.defaultRackHeightU || 42,
      status: "normal",
    },
  ];
}

export function deleteRoomWithRacks(
  rooms: Room[],
  racks: Rack[],
  roomId: string,
): { rooms: Room[]; racks: Rack[]; deletedRackIds: string[] } {
  const deletedRackIds = racks
    .filter((rack) => rack.roomId === roomId)
    .map((rack) => rack.id);

  return {
    rooms: rooms.filter((room) => room.id !== roomId),
    racks: racks.filter((rack) => rack.roomId !== roomId),
    deletedRackIds,
  };
}

export function deleteRack(
  racks: Rack[],
  rackId: string,
): { racks: Rack[]; deletedRackId: string | null } {
  if (!racks.some((rack) => rack.id === rackId)) {
    return { racks, deletedRackId: null };
  }

  return {
    racks: racks.filter((rack) => rack.id !== rackId),
    deletedRackId: rackId,
  };
}

export function getRecoverableDeletedItems(
  items: DeletedTopologyItem[],
  now = new Date(),
): DeletedTopologyItem[] {
  return items.filter((item) => new Date(item.expiresAt).getTime() > now.getTime());
}

export function restoreDeletedRoom(
  rooms: Room[],
  racks: Rack[],
  item: Extract<DeletedTopologyItem, { type: "room" }>,
): { rooms: Room[]; racks: Rack[] } {
  return {
    rooms: rooms.some((room) => room.id === item.room.id)
      ? rooms
      : [...rooms, item.room],
    racks: [
      ...racks,
      ...item.racks.filter(
        (rack) => !racks.some((existing) => existing.id === rack.id),
      ),
    ],
  };
}

export function restoreDeletedRack(
  racks: Rack[],
  item: Extract<DeletedTopologyItem, { type: "rack" }>,
): Rack[] {
  if (racks.some((rack) => rack.id === item.rack.id)) return racks;
  return [...racks, item.rack];
}

export function buildDeletedRoomItem(
  room: Room,
  racks: Rack[],
  devices: Device[] = [],
  now = new Date(),
): DeletedTopologyItem {
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const roomRackIds = racks
    .filter((rack) => rack.roomId === room.id)
    .map((rack) => rack.id);
  return {
    id: `deleted-room-${room.id}-${now.getTime()}`,
    type: "room",
    deletedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    room,
    racks: racks.filter((rack) => rack.roomId === room.id),
    devices: devices.filter((device) => roomRackIds.includes(device.rackId)),
  };
}

export function buildDeletedRackItem(
  rack: Rack,
  devices: Device[] = [],
  now = new Date(),
): DeletedTopologyItem {
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: `deleted-rack-${rack.id}-${now.getTime()}`,
    type: "rack",
    deletedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rack,
    devices: devices.filter((device) => device.rackId === rack.id),
  };
}
