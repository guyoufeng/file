import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importProjectJson, sampleProject } from "../../services/backend/data";
import { getAlerts } from "../../services/backend/alerts";
import { getRacks, getRooms } from "../../services/backend/rooms";

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("project local data closure", () => {
  it("imports rooms racks and alerts into browser storage fallback", async () => {
    const room = {
      ...sampleProject.rooms[0],
      id: "room-demo",
      name: "演示机房",
      racks: [],
    };
    const rack = {
      ...sampleProject.racks[0],
      id: "rack-demo",
      roomId: room.id,
      name: "DEMO-A1",
    };
    const alert = {
      ...sampleProject.alerts[0],
      id: "alert-demo",
      deviceId: "device-demo",
      title: "演示告警",
    };

    await importProjectJson({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-25T10:00:00.000Z",
      data: {
        dataCenters: sampleProject.dataCenters,
        rooms: [room],
        racks: [rack],
        devices: [],
        alerts: [alert],
      },
    });

    await expect(getRooms()).resolves.toEqual([room]);
    await expect(getRacks(room.id)).resolves.toEqual([rack]);
    await expect(getAlerts()).resolves.toEqual([alert]);
  });
});
