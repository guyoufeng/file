import { describe, expect, it } from "vitest";
import type { Rack, Room } from "../../types/domain";
import {
  addSimpleRoom,
  addRackToRoom,
  deleteRoomWithRacks,
  renameRoom,
  renameRack,
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
});
