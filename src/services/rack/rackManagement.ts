import type { Rack, RackType, Room } from "../../types/domain";

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
