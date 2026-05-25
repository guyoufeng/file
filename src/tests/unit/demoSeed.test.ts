import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDemoSeed } from "../../services/demo/demoSeed";

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

describe("demo seed", () => {
  it("applies shared demo data only when local browser data is empty", () => {
    applyDemoSeed({
      devices: [{ id: "device-demo", name: "演示设备" }],
      aiModelConfigs: [{ id: "ai-demo", model: "qwen", enabled: true }],
    });

    expect(localStorage.getItem("qf-ai-dcim.devices")).toContain("device-demo");
    expect(localStorage.getItem("qf-ai-dcim.aiModelConfigs")).toContain("qwen");
  });

  it("does not overwrite an existing browser asset dataset", () => {
    localStorage.setItem("qf-ai-dcim.devices", JSON.stringify([{ id: "current" }]));

    applyDemoSeed({
      devices: [{ id: "demo" }],
      aiModelConfigs: [{ id: "ai-demo" }],
    });

    expect(localStorage.getItem("qf-ai-dcim.devices")).toContain("current");
    expect(localStorage.getItem("qf-ai-dcim.devices")).not.toContain("demo");
  });
});
