import { describe, expect, it } from "vitest";
import type { Device, Rack, Room } from "../../types/domain";
import {
  addSimpleRoom,
  addRackToRoom,
  buildDeletedRackItem,
  buildDeletedRoomItem,
  deleteRack,
  deleteRoomWithRacks,
  getRecoverableDeletedItems,
  restoreDeletedRack,
  restoreDeletedRoom,
  renameRoom,
  renameRack,
  type DeletedTopologyItem,
} from "../../services/rack/rackManagement";

const rooms: Room[] = [
  {
    id: "room-529",
    dataCenterId: "dc-nanjing",
    name: "529数据中心",
    layoutType: "micro_module",
    defaultRackHeightU: 42,
    racks: [],
  },
];

const racks: Rack[] = [
  {
    id: "rack-529-a1",
    roomId: "room-529",
    name: "529-A1",
    type: "server",
    rowName: "A排",
    columnIndex: 1,
    heightU: 42,
    status: "normal",
  },
];

const devices: Device[] = [
  {
    id: "device-1",
    rackId: "rack-529-a1",
    categoryId: "server",
    name: "测试服务器",
    computerName: "test-server",
    businessIp: "192.168.1.10",
    ips: ["192.168.1.10"],
    side: "front",
    startU: 1,
    endU: 2,
    heightU: 2,
    status: "normal",
    ports: [],
  },
];

describe("rack management", () => {
  it("renames rooms and racks without changing unrelated records", () => {
    expect(renameRoom(rooms, "room-529", "南京529数据中心")[0].name).toBe(
      "南京529数据中心",
    );
    expect(renameRack(racks, "rack-529-a1", "529-A01")[0].name).toBe("529-A01");
  });

  it("adds a simple 42U room and a rack to the selected room", () => {
    const nextRooms = addSimpleRoom(rooms, "新机房");
    const nextRacks = addRackToRoom(racks, nextRooms[1], {
      name: "NEW-A1",
      type: "server",
    });

    expect(nextRooms[1]).toMatchObject({
      id: "room-new-room",
      name: "新机房",
      layoutType: "simple_rows",
      defaultRackHeightU: 42,
    });
    expect(nextRacks.at(-1)).toMatchObject({
      roomId: "room-new-room",
      name: "NEW-A1",
      type: "server",
      heightU: 42,
    });
  });

  it("deletes a room and the racks inside it", () => {
    const nextRooms = [
      ...rooms,
      {
        id: "room-empty",
        dataCenterId: "dc-nanjing",
        name: "临时机房",
        layoutType: "simple_rows" as const,
        defaultRackHeightU: 42,
        racks: [],
      },
    ];
    const nextRacks = [
      ...racks,
      {
        id: "rack-temp-a1",
        roomId: "room-empty",
        name: "TEMP-A1",
        type: "server" as const,
        heightU: 42,
        status: "normal" as const,
      },
    ];

    const result = deleteRoomWithRacks(nextRooms, nextRacks, "room-empty");

    expect(result.rooms.map((room) => room.id)).not.toContain("room-empty");
    expect(result.racks.map((rack) => rack.id)).not.toContain("rack-temp-a1");
    expect(result.deletedRackIds).toEqual(["rack-temp-a1"]);
  });

  it("deletes a rack and reports the affected rack id", () => {
    const result = deleteRack(racks, "rack-529-a1");

    expect(result.racks).toHaveLength(0);
    expect(result.deletedRackId).toBe("rack-529-a1");
  });

  it("keeps deleted rooms and racks recoverable for seven days", () => {
    const deletedAt = "2026-05-27T08:00:00.000Z";
    const roomItem: DeletedTopologyItem = {
      id: "deleted-room-1",
      type: "room",
      deletedAt,
      expiresAt: "2026-06-03T08:00:00.000Z",
      room: rooms[0],
      racks,
      devices,
    };
    const rackItem: DeletedTopologyItem = {
      id: "deleted-rack-1",
      type: "rack",
      deletedAt,
      expiresAt: "2026-06-03T08:00:00.000Z",
      rack: racks[0],
      devices,
    };

    expect(
      getRecoverableDeletedItems(
        [
          roomItem,
          rackItem,
          {
            ...rackItem,
            id: "expired-rack",
            expiresAt: "2026-05-28T08:00:00.000Z",
          },
        ],
        new Date("2026-05-30T08:00:00.000Z"),
      ).map((item) => item.id),
    ).toEqual(["deleted-room-1", "deleted-rack-1"]);

    const restoredRoom = restoreDeletedRoom([], [], roomItem);
    expect(restoredRoom.rooms[0].id).toBe("room-529");
    expect(restoredRoom.racks[0].id).toBe("rack-529-a1");

    const restoredRack = restoreDeletedRack([], rackItem);
    expect(restoredRack[0].id).toBe("rack-529-a1");
  });

  it("stores devices with recoverable deleted rooms and racks", () => {
    const deletedRoom = buildDeletedRoomItem(
      rooms[0],
      racks,
      devices,
      new Date("2026-05-27T08:00:00.000Z"),
    );
    const deletedRack = buildDeletedRackItem(
      racks[0],
      devices,
      new Date("2026-05-27T08:00:00.000Z"),
    );

    expect(deletedRoom.devices.map((device) => device.id)).toEqual(["device-1"]);
    expect(deletedRack.devices.map((device) => device.id)).toEqual(["device-1"]);
  });
});
