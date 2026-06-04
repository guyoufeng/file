import { beforeEach, describe, expect, it } from "vitest";
import {
  createPersistentCollection,
  getPersistenceBackendInfo,
} from "../../services/persistence/unifiedPersistence";

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

describe("unified persistence", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("migrates legacy localStorage data into the unified collection namespace", () => {
    localStorage.setItem("legacy.agent.runs", JSON.stringify([{ id: "run-1", question: "查服务器" }]));

    const collection = createPersistentCollection<{ id: string; question: string }>({
      name: "agent.runRecords",
      legacyKeys: ["legacy.agent.runs"],
      maxRecords: 10,
    });

    expect(collection.read()).toEqual([{ id: "run-1", question: "查服务器" }]);
    expect(localStorage.getItem("qf-ai-dcim.data.agent.runRecords")).toContain("run-1");
    expect(localStorage.getItem("legacy.agent.runs")).toBeNull();
  });

  it("keeps recent records and exposes the current backend type for Tauri/SQLite migration", () => {
    const collection = createPersistentCollection<{ id: string }>({
      name: "agent.runRecords",
      maxRecords: 2,
    });

    collection.write([{ id: "1" }, { id: "2" }, { id: "3" }]);

    expect(collection.read()).toEqual([{ id: "1" }, { id: "2" }]);
    expect(getPersistenceBackendInfo()).toMatchObject({
      type: "browser-local",
      sqliteReady: false,
      tauriReady: false,
    });
  });
});
