import { describe, expect, it, vi } from "vitest";
import { reloadProjectStores } from "../../services/project/reloadProjectData";

describe("project data reload", () => {
  it("reloads room asset alert and ai stores after project data changes", async () => {
    const roomStore = { loadRooms: vi.fn().mockResolvedValue(undefined) };
    const assetStore = { loadDevices: vi.fn().mockResolvedValue(undefined) };
    const alertStore = { loadAlerts: vi.fn().mockResolvedValue(undefined) };
    const aiStore = { loadConfigs: vi.fn().mockResolvedValue(undefined) };

    await reloadProjectStores({
      roomStore,
      assetStore,
      alertStore,
      aiStore,
    });

    expect(roomStore.loadRooms).toHaveBeenCalledTimes(1);
    expect(assetStore.loadDevices).toHaveBeenCalledTimes(1);
    expect(alertStore.loadAlerts).toHaveBeenCalledTimes(1);
    expect(aiStore.loadConfigs).toHaveBeenCalledTimes(1);
  });
});
